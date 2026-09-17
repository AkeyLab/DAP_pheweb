/**
 * Hash router.
 *
 * PheWeb's scripts build every internal link as
 * `window.model.urlprefix + "/pheno/CODE"` and similar. Setting urlprefix to
 * "#" turns them all into hash routes with no code changes and, crucially, no
 * server rewrite rules: the same build works on S3, on R2 and from a laptop.
 *
 * One pane is injected at a time. PheWeb's page scripts hardcode ids such as
 * #stream_table and #search, so two pages cannot coexist in the document.
 *
 * Navigation reloads rather than swapping in place: pheweb's page scripts run
 * their setup at load time and are not written to be torn down and re-run.
 */
(function () {
    'use strict';

    var cfg = window.PHEWEB_STATIC || {};
    window.model = window.model || {};
    window.model.urlprefix = '#';
    // layout.html injects these server-side; pheweb's region.js and variant.js
    // read them, and LocusZoom's remote adapters reject an undefined build.
    window.model.hg_build_number = cfg.hg_build_number;
    window.model.grch_build_number = cfg.grch_build_number;

    function tpl(id) {
        var node = document.getElementById(id);
        return node ? node.innerHTML : '';
    }

    /**
     * A route is a hash beginning with "/". Anything else is an in-page anchor
     * such as pheweb's own "#manhattan" and "#qq" section links, which must
     * scroll rather than navigate.
     */
    function parseRoute(hash) {
        var h = (hash || '').replace(/^#/, '');
        if (!h || h === '/') return { name: 'home' };
        if (h.charAt(0) !== '/') return null;      // in-page anchor, not a route
        var m;
        if (h === '/about') return { name: 'about' };
        if (h === '/phenotypes') return { name: 'phenotypes' };
        if (h === '/top_hits') return { name: 'top_hits' };
        if ((m = /^\/variant\/(.+)$/.exec(h))) return { name: 'variant', arg: decodeURIComponent(m[1]) };
        if ((m = /^\/pheno\/(.+)$/.exec(h))) return { name: 'pheno', arg: decodeURIComponent(m[1]) };
        if ((m = /^\/gene\/(.+)$/.exec(h))) return { name: 'gene', arg: decodeURIComponent(m[1]) };
        if ((m = /^\/region\/([^/]+)\/(.+)$/.exec(h))) {
            return { name: 'region', phenocode: decodeURIComponent(m[1]), region: decodeURIComponent(m[2]) };
        }
        return { name: 'unknown', arg: h };
    }

    var current = null;

    function render(route) {
        var pages = window.PheWebPages || {};
        var page = document.getElementById('page');

        if (route.name === 'variant' && pages.variant) {
            page.innerHTML = tpl('tpl-page-variant');
            document.getElementById('streamtable-template').textContent = tpl('tpl-st-variant');
            pages.variant(route.arg);
            return;
        }
        if (route.name === 'pheno' && pages.pheno) {
            page.innerHTML = tpl('tpl-page-pheno');
            document.getElementById('streamtable-template').textContent = tpl('tpl-st-pheno');
            pages.pheno(route.arg);
            return;
        }
        if (route.name === 'about' && pages.about) {
            page.innerHTML = tpl('tpl-page-about');
            pages.about();
            return;
        }
        if (route.name === 'phenotypes' && pages.phenotypes) {
            page.innerHTML = tpl('tpl-page-phenotypes');
            document.getElementById('streamtable-template').textContent = tpl('tpl-st-phenotypes');
            pages.phenotypes();
            return;
        }
        if (route.name === 'top_hits' && pages.top_hits) {
            page.innerHTML = tpl('tpl-page-tophits');
            document.getElementById('streamtable-template').textContent = tpl('tpl-st-tophits');
            pages.top_hits();
            return;
        }
        if (route.name === 'gene' && pages.gene) {
            page.innerHTML = tpl('tpl-page-gene');
            pages.gene(route.arg);
            return;
        }
        if (route.name === 'region' && pages.region) {
            page.innerHTML = tpl('tpl-page-region');
            pages.region(route.phenocode, route.region);
            return;
        }
        page.innerHTML = tpl('tpl-page-home');
        if (route.name !== 'home') {
            var note = document.getElementById('route-note');
            if (note) {
                note.textContent = 'This page is not part of the static build yet: #' + (route.arg || '');
                note.style.display = '';
            }
        }
    }

    function dispatch() {
        var route = parseRoute(window.location.hash);
        if (!route) return;                        // in-page anchor
        current = window.location.hash;
        render(route);
    }

    window.addEventListener('hashchange', function () {
        // Ignore anchor jumps; only a real route change warrants a reload.
        if (!parseRoute(window.location.hash)) return;
        if (window.location.hash === current) return;
        window.location.reload();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', dispatch);
    } else {
        dispatch();
    }
})();
