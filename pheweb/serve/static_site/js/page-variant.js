/**
 * Variant / PheWAS page.
 *
 * On the Flask site this page is server-rendered: variant.html injects the
 * whole payload as `window.variant` and pheweb's variant.js reads it directly,
 * never calling an API. So porting it needs two things, not one: a reader for
 * the data, and a shell that puts the data in place before variant.js runs.
 *
 * PheWeb's variant.js itself is used unmodified.
 */
(function () {
    'use strict';

    var cfg = window.PHEWEB_STATIC || {};
    var DATA_BASE = (cfg.data_base || './data/').replace(/\/+$/, '');

    function el(id) { return document.getElementById(id); }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function renderHeader(v) {
        var title = escapeHtml(v.variant_name) + (v.rsids ? ' (' + escapeHtml(v.rsids) + ')' : '');
        el('variant-title').innerHTML = title;
        el('nearest-gene').innerHTML = escapeHtml(v.nearest_genes);
        document.title = v.variant_name + ' | DAP PheWeb';

        // Deep link only, never an iframe: if UCSC changes this degrades to a
        // dead link rather than a broken embed, and it keeps the page offline-safe.
        var db = 'hg' + (cfg.hg_build_number || 19);
        var flank = 200000;
        var href = 'https://genome.ucsc.edu/cgi-bin/hgTracks?db=' + encodeURIComponent(db) +
            '&highlight=' + encodeURIComponent(db) + '.chr' + v.chrom + '%3A' + v.pos + '-' + v.pos +
            '&position=chr' + v.chrom + '%3A' + Math.max(0, v.pos - flank) + '-' + (v.pos + flank);
        var a = el('ucsc-link');
        a.href = href;
        a.textContent = 'CanFam4 UCSC';
        el('view-on').style.display = '';
    }

    function fail(msg) {
        var e = document.getElementById('page-error');
        e.textContent = msg;
        e.style.display = '';
    }

    window.PheWebPages = window.PheWebPages || {};
    window.PheWebPages.variant = function (query) {
        var parsed = PheWebStatic.parseVariantQuery(query);
        if (!parsed) return fail('Could not understand the variant ' + query);

        Promise.all([
            fetch(DATA_BASE + '/phenotypes.json').then(function (r) {
                if (!r.ok) throw new Error('phenotypes.json: ' + r.status);
                return r.json();
            }),
            // Templates live with the site, not the data, so this path is
            // relative to the page rather than to DATA_BASE.
            fetch('js/pheweb-templates.json').then(function (r) { return r.ok ? r.json() : {}; })
                .catch(function () { return {}; }),
        ]).then(function (both) {
            var phenoInfo = PheWebStatic.phenoInfoFromSummary(both[0]);
            window.model = window.model || {};
            window.model.tooltip_lztemplate = (both[1] || {}).tooltip_lztemplate || '';
            return PheWebStatic.readVariant(DATA_BASE + '/matrix.tsv.gz', parsed, phenoInfo);
        }).then(function (variant) {
            if (!variant) return fail("Sorry, I couldn't find the variant " + query);
            window.variant = variant;
            renderHeader(variant);
            // variant.js reads window.variant at load time, so it must not be
            // fetched until the payload exists.
            var s = document.createElement('script');
            s.src = 'vendor/variant.js';
            document.body.appendChild(s);
        }).catch(function (e) {
            fail('Failed to load this variant: ' + e.message);
        });
    };
})();
