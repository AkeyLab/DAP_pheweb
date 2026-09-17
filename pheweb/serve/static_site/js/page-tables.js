/**
 * The two browse-and-search pages: all phenotypes, and all top hits.
 *
 * These replace autocomplete rather than supplementing it. stream_table builds
 * its search index by concatenating every field of every row, so one table over
 * phenotypes.json makes phenotype names, categories and top-hit gene names
 * searchable, and the same table over top_hits.json covers 1,933 genes across
 * 2,168 loci. Upstream's autocomplete had four modes, two of which are dead in
 * this dataset: every rsid in cpras-rsids.sqlite3 is NULL and the gene-alias
 * database has no rows. Dropping it removes a 333 MB upload.
 *
 * pheweb's phenotypes.js and top_hits.js are used unmodified; each defines a
 * global populate_streamtable that reads #streamtable-template.
 */
(function () {
    'use strict';

    var cfg = window.PHEWEB_STATIC || {};
    var DATA_BASE = (cfg.data_base || './data/').replace(/\/+$/, '');

    function fail(msg) {
        var e = document.getElementById('page-error');
        e.textContent = msg;
        e.style.display = '';
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = function () { reject(new Error('failed to load ' + src)); };
            document.body.appendChild(s);
        });
    }

    function table(opts) {
        return fetch(DATA_BASE + '/' + opts.file)
            .then(function (r) {
                if (!r.ok) throw new Error(opts.file + ': ' + r.status);
                return r.json();
            })
            .then(function (data) {
                window.debug = window.debug || {};
                window.debug[opts.debugKey] = data;
                return loadScript(opts.script).then(function () {
                    // Defined by the pheweb script just loaded.
                    populate_streamtable(data);
                    return data.length;
                });
            });
    }

    window.PheWebPages = window.PheWebPages || {};

    window.PheWebPages.phenotypes = function () {
        document.title = 'Phenotypes | DAP PheWeb';
        table({ file: 'phenotypes.json', script: 'vendor/phenotypes.js', debugKey: 'phenotypes' })
            .catch(function (e) { fail('Failed to load the phenotype list: ' + e.message); });
    };

    window.PheWebPages.top_hits = function () {
        document.title = 'Top Hits | DAP PheWeb';
        // The Flask site served top_hits_1k.json here because it rendered the
        // table server-side on every request. A static file costs nothing to
        // serve, so use the complete set: 2,168 loci instead of 1,000.
        table({ file: 'top_hits.json', script: 'vendor/top_hits.js', debugKey: 'top_hits' })
            .catch(function (e) { fail('Failed to load the top hits: ' + e.message); });
    };
})();
