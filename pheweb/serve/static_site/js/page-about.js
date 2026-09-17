/**
 * About page.
 *
 * Mirrors pheweb/serve/templates/about/content.html, which the Flask site
 * renders with the pheweb version injected from the server. The static build
 * has no server, so the text is in the template and the two things that vary,
 * the version and the size of this particular copy, are filled in here.
 */
(function () {
    'use strict';

    var cfg = window.PHEWEB_STATIC || {};
    var DATA_BASE = (cfg.data_base || './data/').replace(/\/+$/, '');

    window.PheWebPages = window.PheWebPages || {};
    window.PheWebPages.about = function () {
        document.title = 'About | DAP PheWeb';

        if (cfg.pheweb_version) {
            var v = document.getElementById('about-pheweb-version');
            if (v) v.textContent = cfg.pheweb_version;
        }

        // Say what this copy actually contains. A single-phenotype bundle and
        // the full site are the same pages with different data, and a reader
        // has no other way to tell them apart.
        fetch(DATA_BASE + '/phenotypes.json')
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (phenos) {
                var el = document.getElementById('about-dataset');
                if (!el || !phenos) return;
                if (phenos.length === 1) {
                    el.textContent = 'This copy carries one phenotype, ' +
                        phenos[0].phenocode + '. Variant (PheWAS) pages need the ' +
                        'all-phenotype matrix, which is not included here.';
                } else {
                    el.textContent = 'This copy carries ' + phenos.length + ' phenotypes.';
                }
            })
            .catch(function () { /* the page is still readable without this */ });
    };
})();
