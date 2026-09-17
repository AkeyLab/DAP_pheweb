'''
Build a static copy of this PheWeb, servable from any plain file host.

    pheweb build-static

The result needs no application server, no database and no network. Every plot
is computed in the browser from the same files `pheweb process` already wrote,
read over HTTP range requests. That makes a PheWeb instance archivable: it can
be deposited, downloaded, and opened years later without anything to keep
running or patch.

Nothing about the science changes. The browser runs the same tabix queries
pheweb/serve/server_utils.py runs today, against byte-identical files.

What the output supports
    phenotype pages (Manhattan and QQ), region plots with pan and zoom,
    variant (PheWAS) pages, gene pages, the phenotype and top-hit tables,
    and the about page.

What it cannot do
    The LD and GWAS-catalog panels come from portaldev.sph.umich.edu, which is
    a live service. By default they are disabled so the output is genuinely
    self-contained; set `remote_sources` in the generated config.js to point at
    portaldev, or at any host offering the same API, to bring them back.

Requirements
    bgzip and tabix on PATH, for the gene track. Both ship with htslib, which
    pheweb already depends on via pysam.
'''

from ..file_utils import get_filepath, get_generated_path, make_basedir
from ..utils import PheWebError
from .. import conf

import argparse
import json
import os
import shutil
import subprocess
import sys
import urllib.request
from typing import Any, Dict, List, Optional


# Third-party assets, pinned to the versions pheweb's own templates request so
# the static copy runs the same code the served site does. Downloaded rather
# than vendored into the repo, the same way pheweb already downloads genes and
# rsids.
CDN_ASSETS = [
    ('jquery.min.js', 'https://unpkg.com/jquery@1.12.4/dist/jquery.min.js'),
    ('underscore.min.js', 'https://unpkg.com/underscore@1.8.3/underscore-min.js'),
    ('d3.min.js', 'https://cdn.jsdelivr.net/npm/d3@5.16.0/dist/d3.min.js'),
    ('d3-tip.js', 'https://unpkg.com/d3-tip@0.9.1/dist/index.js'),
    # pheweb's common.js constructs a Bloodhound at load time, so typeahead has
    # to be present even though the static build has no autocomplete endpoint.
    ('typeahead.bundle.min.js', 'https://unpkg.com/corejs-typeahead@1.2.1/dist/typeahead.bundle.min.js'),
    ('stream_table.min.js', None),          # copied from pheweb's own static/
    # @gmod/tabix publishes a browser build that defines window.gmodTABIX, so
    # reading tabix files in the browser needs no javascript build step.
    ('tabix-bundle.js', 'https://cdn.jsdelivr.net/npm/@gmod/tabix@3.8.2/dist/tabix-bundle.js'),
]

CSS_ASSETS = [
    ('bootstrap.min.css', 'https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css'),
    ('bootstrap.min.js', 'https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js'),
]

# Bootstrap's css asks for ../fonts/, so stylesheets live in css/ and fonts in
# fonts/. Flatten that and every glyphicon 404s.
GLYPHICONS = ['eot', 'svg', 'ttf', 'woff', 'woff2']
GLYPHICON_BASE = 'https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/fonts/glyphicons-halflings-regular.'

# pheweb's own front-end, copied unmodified. The static build overrides their
# transport at runtime rather than editing them, so they stay in step with the
# served site.
PHEWEB_STATIC_FILES = [
    'common.css', 'common.js', 'region.css', 'region.js',
    'variant.js', 'pheno.js', 'phenotypes.js', 'top_hits.js',
    'vendor/stream_table-1.1.1.min.js',
]


def _lzjs_version() -> str:
    return conf.get_lzjs_version()


def _download(url: str, dest: str) -> bytes:
    if os.path.exists(dest):
        with open(dest, 'rb') as f:
            return f.read()
    print('fetching {}'.format(url))
    req = urllib.request.Request(url, headers={'User-Agent': 'pheweb build-static'})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    make_basedir(dest)
    with open(dest, 'wb') as f:
        f.write(data)
    return data


def _require(program: str) -> str:
    path = shutil.which(program)
    if not path:
        raise PheWebError(
            '{} is needed to build the gene track but is not on PATH. '
            'It ships with htslib.'.format(program))
    return path


def build_gene_track(out_data: str) -> Optional[int]:
    '''
    Turn resources/genes-*.bed into a tabix-indexed track LocusZoom can read.

    Upstream serves genes from a remote API. A static copy needs them locally,
    and `pheweb download-genes` has already produced exactly the right data:
    chrom, start, end, symbol, ensg.

    The records carry no exons, because that bed has none. LocusZoom renders a
    gene as a single block rather than a transcript model, which is enough to
    see which genes a locus covers.
    '''
    try:
        genes_path = get_filepath('genes')
    except Exception:
        print('! no genes file; the region plots will have no gene track.\n'
              '  Run `pheweb download-genes` first if you want one.', file=sys.stderr)
        return None
    if not os.path.exists(genes_path):
        print('! {} is missing; skipping the gene track'.format(genes_path), file=sys.stderr)
        return None

    bgzip, tabix = _require('bgzip'), _require('tabix')
    rows = []
    with open(genes_path) as f:
        for line in f:
            c = line.rstrip('\n').split('\t')
            if len(c) < 4:
                continue
            chrom, start, end, symbol = c[0], int(c[1]), int(c[2]), c[3]
            rows.append((chrom, start, end, {
                'gene_id': c[4] if len(c) > 4 else symbol,
                'gene_name': symbol,
                'chr': chrom, 'start': start, 'end': end, 'strand': '+',
                'gene_type': 'protein_coding',
                'transcripts': [{
                    'transcript_id': symbol, 'start': start, 'end': end, 'strand': '+',
                    'exons': [{'exon_id': symbol + '-1', 'chr': chrom,
                               'start': start, 'end': end, 'strand': '+'}],
                }],
            }))

    def sort_key(r: Any) -> Any:
        return (str(r[0]).zfill(3), r[1], r[2])
    rows.sort(key=sort_key)

    plain = os.path.join(out_data, 'genes.bed')
    with open(plain, 'w') as f:
        for chrom, start, end, rec in rows:
            f.write('{}\t{}\t{}\t{}\n'.format(chrom, start, end, json.dumps(rec, separators=(',', ':'))))
    gz = plain + '.gz'
    if os.path.exists(gz):
        os.remove(gz)
    subprocess.run([bgzip, '-f', plain], check=True)
    subprocess.run([tabix, '-f', '-s', '1', '-b', '2', '-e', '3', gz], check=True)
    return len(rows)


def _data_files() -> List[str]:
    '''Exactly the generated files the static site reads.

    Everything else under generated-by-pheweb is a build intermediate. parsed/
    in particular is usually larger than everything here combined and must
    never be published.
    '''
    wanted = ['matrix.tsv.gz', 'matrix.tsv.gz.tbi', 'phenotypes.json',
              'phenotypes.tsv', 'top_hits.json', 'top_hits.tsv']
    out = []
    for name in wanted:
        path = get_generated_path(name)
        if os.path.exists(path):
            out.append(path)
    for subdir in ['manhattan', 'qq', 'pheno_gz']:
        d = get_generated_path(subdir)
        if not os.path.isdir(d):
            continue
        for name in sorted(os.listdir(d)):
            out.append(os.path.join(d, name))
    return out


def _place(src: str, dst: str, link: bool) -> int:
    make_basedir(dst)
    if os.path.lexists(dst):
        os.remove(dst)
    if link:
        try:
            os.link(src, dst)
        except OSError:
            shutil.copy2(src, dst)      # different filesystem
    else:
        shutil.copy2(src, dst)
    return os.path.getsize(src)


def _write_config(out: str) -> None:
    '''Settings the generated pages read, mirroring what layout.html injects.'''
    cfg: Dict[str, Any] = {
        'data_base': './data/',
        'hg_build_number': conf.get_hg_build_number(),
        'grch_build_number': conf.get_grch_build_number(),
        'lzjs_version': _lzjs_version(),
        # Panels that need a live service. Empty means the site is fully
        # self-contained; set a url to restore one, eg
        #   "ld": "https://portaldev.sph.umich.edu/ld/"
        # Any host offering the same API works, including a local one.
        'remote_sources': {},
    }
    body = (
        '/* Written by `pheweb build-static`. Safe to edit.\n'
        ' *\n'
        ' * data_base stays relative on purpose: an absolute url would make a\n'
        ' * downloaded copy quietly depend on that server still being up, which\n'
        ' * is the thing a static build exists to avoid.\n'
        ' */\n'
        'window.PHEWEB_STATIC = ' + json.dumps(cfg, indent=2, sort_keys=True) + ';\n')
    with open(os.path.join(out, 'config.js'), 'w') as f:
        f.write(body)


def run(argv: List[str]) -> None:
    parser = argparse.ArgumentParser(prog='pheweb build-static', description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--out', default=get_generated_path('static-site'),
                        help='where to write the site (default: %(default)s)')
    parser.add_argument('--link-data', action='store_true',
                        help='hardlink the data instead of copying it, for a quick local check')
    args = parser.parse_args(argv)

    out = os.path.abspath(args.out)
    vendor = os.path.join(out, 'vendor')
    data_out = os.path.join(out, 'data')
    for d in (out, vendor, os.path.join(vendor, 'css'), os.path.join(vendor, 'fonts'), data_out):
        os.makedirs(d, exist_ok=True)

    here = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        'serve', 'static_site')
    pheweb_static = os.path.join(os.path.dirname(here), 'static')

    print('writing {}'.format(out))

    # Third-party assets, so nothing is fetched from a cdn at runtime.
    for name, url in CDN_ASSETS:
        if url:
            _download(url, os.path.join(vendor, name))
    for name, url in CSS_ASSETS:
        sub = 'css' if name.endswith('.css') else ''
        _download(url, os.path.join(vendor, sub, name))
    for ext in GLYPHICONS:
        _download(GLYPHICON_BASE + ext,
                  os.path.join(vendor, 'fonts', 'glyphicons-halflings-regular.' + ext))
    lz = _lzjs_version()
    _download('https://cdn.jsdelivr.net/npm/locuszoom@{}/dist/locuszoom.app.min.js'.format(lz),
              os.path.join(vendor, 'locuszoom.min.js'))
    _download('https://cdn.jsdelivr.net/npm/locuszoom@{}/dist/locuszoom.css'.format(lz),
              os.path.join(vendor, 'css', 'locuszoom.css'))

    # pheweb's own front-end, copied unmodified.
    for rel in PHEWEB_STATIC_FILES:
        src = os.path.join(pheweb_static, rel)
        if os.path.exists(src):
            dst = os.path.join(vendor, 'css' if rel.endswith('.css') else '', os.path.basename(rel))
            _place(src, dst, link=False)
    fonts_src = os.path.join(pheweb_static, 'fonts')
    if os.path.isdir(fonts_src):
        for name in os.listdir(fonts_src):
            _place(os.path.join(fonts_src, name), os.path.join(vendor, 'fonts', name), link=False)

    # The static site's own html and javascript.
    for name in sorted(os.listdir(here)):
        src = os.path.join(here, name)
        if os.path.isfile(src):
            _place(src, os.path.join(out, name), link=False)
    js_src = os.path.join(here, 'js')
    for name in sorted(os.listdir(js_src)):
        _place(os.path.join(js_src, name), os.path.join(out, 'js', name), link=False)

    _write_config(out)

    # The constants layout.html injects server-side, as a file the pages fetch.
    from .. import parse_utils
    with open(os.path.join(out, 'js', 'pheweb-templates.json'), 'w') as f:
        json.dump({'tooltip_lztemplate': parse_utils.tooltip_lztemplate,
                   'tooltip_underscoretemplate': parse_utils.tooltip_underscoretemplate},
                  f, indent=1, sort_keys=True)

    n_genes = build_gene_track(data_out)

    total = 0
    files = _data_files()
    for src in files:
        rel = os.path.relpath(src, get_generated_path(''))
        total += _place(src, os.path.join(data_out, rel), link=args.link_data)

    print('')
    print('  data      {:,} files, {:.1f} GB'.format(len(files), total / 1e9))
    if n_genes:
        print('  genes     {:,}'.format(n_genes))
    print('  site      {}'.format(out))
    print('')
    print('Serve it with any web server that supports byte ranges, then open index.html.')
    print('`python -m http.server` will NOT work: it ignores Range headers and')
    print('mislabels .gz files, which breaks every plot.')
