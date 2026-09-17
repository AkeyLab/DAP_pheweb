# `pheweb build-static`

Builds a copy of a PheWeb site that needs no application server: no Flask, no
database, no network. Every plot is computed in the browser from the files
`pheweb process` already wrote, read over HTTP byte-range requests.

    pheweb build-static

The output can be served from S3, from GitHub Pages, from a shared drive, or
from a laptop, and it can be deposited somewhere like Zenodo and opened years
later without anything left running to maintain or patch.

## How it works

Nothing about the analysis changes. The browser runs the same tabix queries
`pheweb/serve/server_utils.py` runs today, against byte-identical files.
`pheweb_gz/<pheno>.gz` and `matrix.tsv.gz` are already BGZF with tabix indexes,
so a region can be located and read without downloading the file: a 100 kb
window typically costs about 15 kB out of an 88 MB file.

PheWeb's own `region.js`, `variant.js`, `pheno.js`, `phenotypes.js` and
`top_hits.js` are copied **unmodified**. Only the transport is swapped, by
hooking LocusZoom's adapter registration at runtime, so the plots stay in step
with the served site rather than becoming a fork of it.

Tabix reading uses `@gmod/tabix`, which publishes a prebuilt browser bundle.
`build-static` downloads it alongside jQuery and LocusZoom, so there is no
JavaScript build step and no npm.

## What works, and what does not

Phenotype pages with Manhattan and QQ plots, region plots with working pan and
zoom, variant (PheWAS) pages, the phenotype and top-hit tables, and the about
page.

The LD and GWAS-catalog panels come from `portaldev.sph.umich.edu`, a live
service, so by default they are switched off and the output is genuinely
self-contained. To restore them, edit the generated `config.js`:

    "remote_sources": { "ld": "https://portaldev.sph.umich.edu/ld/" }

Any host offering the same API works, including one of your own. Doing this
means the site is no longer self-contained.

Gene pages (`/gene/<name>`) are not built yet.

Requirements: `bgzip` and `tabix` on PATH, for the gene track. Both ship with
htslib, which pheweb already depends on through pysam. Without them the site
still builds, minus the gene track.

## Serving it

It needs a web server that supports byte ranges. **`python -m http.server`
does not work**: it ignores the `Range` header, and it labels `.gz` files as
gzip-encoded, which makes browsers decompress them and desynchronise every
offset in the tabix index. Both failures are silent. `npx serve`, `caddy
file-server` and nginx are all fine.

Opening `index.html` from the filesystem does not work either, because browsers
block `fetch` on `file://` URLs. It has to be served.

## Notes for reviewers

Two details caused real bugs during development and are commented in place.

LocusZoom's `combineChainBody` *replaces* the chain body by default, so a
source that returns no records silently discards the association data fetched
before it. The placeholder sources override it to pass the chain through.

`region.js` registers its adapters and populates the plot in the same file, so
substitutions applied afterwards miss the first request. `DataSources.add` is
hooked instead, which also avoids the remote adapters rejecting an undefined
genome build before anything can intervene.
