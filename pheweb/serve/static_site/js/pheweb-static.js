/**
 * Reads PheWeb's own data files directly from the browser, over HTTP range
 * requests, so a PheWeb site can be served from a plain file host with no
 * application server behind it.
 *
 * Nothing here is new science. These are the same tabix queries
 * pheweb/serve/server_utils.py and pheweb/file_utils.py already make, moved
 * from Python to JavaScript. The files read are byte-for-byte the ones
 * `pheweb process` already produces.
 *
 * Depends on @gmod/tabix's prebuilt browser bundle, which defines
 * window.gmodTABIX. No build step: `pheweb build-static` downloads it
 * alongside the other vendored assets.
 */
(function () {
    'use strict';

    if (typeof window.gmodTABIX === 'undefined') {
        throw new Error('load tabix-bundle.js before pheweb-static.js');
    }
    var TabixIndexedFile = window.gmodTABIX.TabixIndexedFile;

    /**
     * The whole file interface @gmod/tabix needs: read() and readFile().
     *
     * Written out here rather than pulled from npm because it is twenty lines
     * and adding a JavaScript bundler to a Python project is a poor trade.
     */
    function RangeFile(url) { this.url = url; }

    RangeFile.prototype.read = function (length, position) {
        return fetch(this.url, {
            headers: { range: 'bytes=' + position + '-' + (position + length - 1) },
        }).then(function (res) {
            // 416 means the range starts past EOF. Callers detect the end of a
            // file by a short read, so report it as empty rather than throwing.
            if (res.status === 416) return new Uint8Array(0);
            if (!res.ok) throw new Error(res.url + ': HTTP ' + res.status);
            return res.arrayBuffer().then(function (b) { return new Uint8Array(b); });
        });
    };

    RangeFile.prototype.readFile = function () {
        return fetch(this.url).then(function (res) {
            if (!res.ok) throw new Error(res.url + ': HTTP ' + res.status);
            return res.arrayBuffer().then(function (b) { return new Uint8Array(b); });
        });
    };

    // One indexed-file object per URL. The .tbi is parsed once and reused;
    // without this every pan would re-download and re-parse the index.
    var _files = {};

    function indexedFile(gzUrl) {
        if (!_files[gzUrl]) {
            _files[gzUrl] = new TabixIndexedFile({
                filehandle: new RangeFile(gzUrl),
                tbiFilehandle: new RangeFile(gzUrl + '.tbi'),
            });
        }
        return _files[gzUrl];
    }

    /** Numeric fields are nullable in pheweb; an empty cell is null, not NaN. */
    function num(s) {
        return (s === '' || s === undefined) ? null : Number(s);
    }

    /**
     * Read a region from a per-phenotype file, in the shape the LocusZoom
     * adapter expects.
     *
     * Coordinates need care. In pheweb, `position ge S and position le E`
     * reaches pysam as fetch(chrom, S-1, E) after two separate conversions,
     * inclusive of both ends. @gmod/tabix takes the same half-open interval.
     */
    function readRegion(gzUrl, chrom, start, end) {
        if (start < 1) start = 1;
        var cols = { chrom: 0, pos: 1, ref: 2, alt: 3, rsids: 4, nearest_genes: 5, pval: 6, beta: 7, maf: 8 };
        var chr = [], position = [], ref = [], alt = [], rsid = [],
            nearest_genes = [], pvalue = [], beta = [], maf = [], id = [], endCol = [];

        if (start > end) return Promise.resolve({ data: {}, lastpage: null });

        return indexedFile(gzUrl).getLines(String(chrom), start - 1, end, function (line) {
            var c = line.split('\t');
            if (c.length < 9) return;
            var pos = Number(c[cols.pos]);
            chr.push(c[cols.chrom]);
            position.push(pos);
            endCol.push(pos);
            ref.push(c[cols.ref]);
            alt.push(c[cols.alt]);
            rsid.push(c[cols.rsids]);
            nearest_genes.push(c[cols.nearest_genes]);
            pvalue.push(num(c[cols.pval]));
            beta.push(num(c[cols.beta]));
            maf.push(num(c[cols.maf]));
            id.push(c[cols.chrom] + ':' + pos + '_' + c[cols.ref] + '/' + c[cols.alt]);
        }).then(function () {
            // pheweb derives its column names from the rows, so an empty region
            // yields {} rather than empty arrays, and region.js already handles
            // that. Reproduce it rather than "fixing" it.
            if (position.length === 0) return { data: {}, lastpage: null };
            return {
                data: {
                    chr: chr, position: position, ref: ref, alt: alt, rsid: rsid,
                    nearest_genes: nearest_genes, pvalue: pvalue, beta: beta,
                    maf: maf, id: id, end: endCol,
                },
                lastpage: null,
            };
        });
    }

    /** Parse the filter string region.js builds, so the adapter can reuse it. */
    function parseFilter(filter) {
        var m = /chromosome in +'(.+?)' and position ge ([0-9]+) and position le ([0-9]+)/.exec(filter || '');
        return m ? { chrom: m[1], start: Number(m[2]), end: Number(m[3]) } : null;
    }


    /* ---------------------------------------------------------------- *
     * Variant (PheWAS) pages
     *
     * Replaces /api/variant/, which is also the payload variant.html injects
     * as window.variant. One tabix query against matrix.tsv.gz yields every
     * phenotype's association at a position. Mirrors _GetVariant.get_variant
     * in serve/server_utils.py and _mr._parse_variant_row in file_utils.py.
     * ---------------------------------------------------------------- */

    var _matrixCols = {};

    /** Parse matrix.tsv.gz's header once: plain fields, plus field@phenocode. */
    function matrixColumns(matrixUrl) {
        if (_matrixCols[matrixUrl]) return Promise.resolve(_matrixCols[matrixUrl]);
        return indexedFile(matrixUrl).getHeader().then(function (header) {
            var line = String(header).trim().split('\n').pop().replace(/^#/, '');
            var names = line.split('\t');
            var plain = {}, perPheno = [], byPheno = {};
            names.forEach(function (name, i) {
                var at = name.indexOf('@');
                if (at === -1) { plain[name] = i; return; }
                var field = name.slice(0, at), code = name.slice(at + 1);
                if (!byPheno[code]) { byPheno[code] = {}; perPheno.push(code); }
                byPheno[code][field] = i;
            });
            _matrixCols[matrixUrl] = { plain: plain, order: perPheno, byPheno: byPheno };
            return _matrixCols[matrixUrl];
        });
    }

    /** Python's '{:,}'.format(n), without depending on the browser locale. */
    function commas(n) {
        return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /** Mirror of _ParseVariant.parse_variant: 1-123-A-G, chr1:123_A_G, etc. */
    function parseVariantQuery(query) {
        var m = /^(?:[cC][hH][rR])?([0-9XYMTxymt]+)[-_:/ ]([0-9]+)[-_:/ ]([-ATCGatcg.]+)[-_:/ ]([-ATCGatcg.]+)/.exec(String(query).trim());
        if (!m) return null;
        return { chrom: m[1], pos: Number(m[2]), ref: m[3].toUpperCase(), alt: m[4].toUpperCase() };
    }

    /**
     * @param phenoInfo phenocode -> extra fields merged into each result, as
     *        the server merges its phenolist entry.
     */
    function readVariant(matrixUrl, query, phenoInfo) {
        return matrixColumns(matrixUrl).then(function (cols) {
            var rows = [];
            // get_variant scans get_region(chrom, pos, pos+1), which reaches
            // pysam as fetch(chrom, pos-1, pos).
            return indexedFile(matrixUrl)
                .getLines(String(query.chrom), query.pos - 1, query.pos, function (l) { rows.push(l); })
                .then(function () { return { cols: cols, rows: rows }; });
        }).then(function (got) {
            var cols = got.cols;
            for (var i = 0; i < got.rows.length; i++) {
                var c = got.rows[i].split('\t');
                if (Number(c[cols.plain.pos]) !== query.pos) continue;   // tabix can overshoot
                if (c[cols.plain.ref] !== query.ref || c[cols.plain.alt] !== query.alt) continue;

                var variant = {};
                Object.keys(cols.plain).forEach(function (field) {
                    var raw = c[cols.plain[field]];
                    variant[field] = (field === 'pos') ? Number(raw) : raw;
                });

                var phenos = [];
                cols.order.forEach(function (code) {
                    var fields = cols.byPheno[code], names = Object.keys(fields), any = false;
                    for (var k = 0; k < names.length; k++) { if (c[fields[names[k]]] !== '') { any = true; break; } }
                    // A phenotype appears only if it has a non-empty cell, so
                    // variants untested somewhere give a shorter list, not nulls.
                    if (!any) return;
                    var p = {};
                    names.forEach(function (f) { p[f] = num(c[fields[f]]); });
                    var extra = (phenoInfo || {})[code] || { phenocode: code };
                    Object.keys(extra).forEach(function (k2) { p[k2] = extra[k2]; });
                    phenos.push(p);
                });

                variant.phenos = phenos;
                variant.variant_name = query.chrom + ' : ' + commas(query.pos) + ' ' + query.ref + ' / ' + query.alt;
                return variant;
            }
            return null;
        });
    }

    /* ---------------------------------------------------------------- *
     * Gene track
     *
     * Built by `pheweb build-static` from resources/genes-*.bed, the file
     * `pheweb download-genes` already produces. Upstream draws genes from a
     * remote API; this keeps them local so the site works offline.
     * ---------------------------------------------------------------- */

    function readGenes(bedUrl, chrom, start, end) {
        if (start < 1) start = 1;
        if (start > end) return Promise.resolve([]);
        var out = [];
        return indexedFile(bedUrl).getLines(String(chrom), start - 1, end, function (line) {
            var third = line.indexOf('\t', line.indexOf('\t', line.indexOf('\t') + 1) + 1);
            if (third === -1) return;
            try { out.push(JSON.parse(line.slice(third + 1))); } catch (e) { /* skip a bad line */ }
        }).then(function () { return out; });
    }


    /**
     * phenocode -> the fields the server merges into each per-phenotype result
     * from its phenolist. phenotypes.json already carries them, so a static
     * build needs no extra file.
     */
    function phenoInfoFromSummary(summary) {
        var out = {};
        (summary || []).forEach(function (p) {
            out[p.phenocode] = {
                phenocode: p.phenocode,
                category: p.category,
                num_samples: p.num_samples,
            };
        });
        return out;
    }

    /**
     * Variants at, or near, a position.
     *
     * A bare chrom:pos cannot address a variant page, which needs ref and alt.
     * Rather than guess them, look them up: the matrix is indexed by position.
     * Only the leading columns are parsed, so this stays far cheaper than
     * reading a whole variant.
     */
    function readVariantsAt(matrixUrl, chrom, pos, flank) {
        flank = flank || 0;
        var start = Math.max(1, pos - flank), end = pos + flank;
        return matrixColumns(matrixUrl).then(function (cols) {
            var out = [];
            return indexedFile(matrixUrl).getLines(String(chrom), start - 1, end, function (line) {
                var c = line.split('\t', 8);
                var p = Number(c[cols.plain.pos]);
                if (p < start || p > end) return;
                out.push({
                    chrom: c[cols.plain.chrom], pos: p,
                    ref: c[cols.plain.ref], alt: c[cols.plain.alt],
                    nearest_genes: c[cols.plain.nearest_genes] || '',
                });
            }).then(function () {
                out.sort(function (a, b) {
                    return Math.abs(a.pos - pos) - Math.abs(b.pos - pos) || a.pos - b.pos;
                });
                return out;
            });
        });
    }

    window.PheWebStatic = {
        RangeFile: RangeFile,
        indexedFile: indexedFile,
        readRegion: readRegion,
        readVariant: readVariant,
        readGenes: readGenes,
        parseFilter: parseFilter,
        parseVariantQuery: parseVariantQuery,
        phenoInfoFromSummary: phenoInfoFromSummary,
        readVariantsAt: readVariantsAt,
        num: num,
    };
})();
