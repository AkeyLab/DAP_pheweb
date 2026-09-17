/**
 * Phenotype page: Manhattan plot, QQ plot and the top-loci table.
 *
 * The data layer here is trivial, because manhattan/<pheno>.json and
 * qq/<pheno>.json are already static files that PheWeb serves verbatim. Only
 * the URL changes. What has to be rebuilt is the page: pheno.html carried the
 * fetching logic inline in a Jinja template, and the phenotype's metadata came
 * from the server.
 *
 * PheWeb's pheno.js is used unmodified; it exposes create_gwas_plot,
 * create_qq_plot and populate_streamtable as globals.
 */
(function () {
    'use strict';

    var cfg = window.PHEWEB_STATIC || {};
    var DATA_BASE = (cfg.data_base || './data/').replace(/\/+$/, '');

    function el(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function renderMeta(phenocode, info) {
        el('pheno-title').textContent = phenocode + (info && info.phenostring ? ': ' + info.phenostring : '');
        document.title = phenocode + ' | DAP PheWeb';

        if (info && info.num_cases !== undefined) {
            el('pheno-samples').innerHTML = '<b>' + esc(info.num_cases) + '</b> cases, <b>' +
                esc(info.num_controls) + '</b> controls';
        } else if (info && info.num_samples !== undefined) {
            el('pheno-samples').innerHTML = '<b>' + esc(info.num_samples) + '</b> samples';
        }
        if (info && info.category) {
            el('pheno-category').innerHTML = 'Category: <b>' + esc(info.category) + '</b>';
        }
        // Same warning pheno.html renders for underpowered phenotypes.
        var n = info && (info.num_cases !== undefined ? info.num_cases : info.num_samples);
        if (typeof n === 'number' && n > 0 && n < 200) {
            var w = el('pheno-warning');
            w.innerHTML = '<b>Warning:</b> This phenotype only has ' + esc(n) + ' samples.';
            w.style.display = '';
        }
        // Sumstats come straight out of the data directory; no endpoint needed.
        el('download-sumstats').href = DATA_BASE + '/pheno_gz/' + encodeURIComponent(phenocode) + '.gz';
        el('download-sumstats').setAttribute('download', phenocode + '.tsv.gz');
    }

    function fail(msg) {
        var e = el('page-error');
        e.textContent = msg;
        e.style.display = '';
    }

    window.PheWebPages = window.PheWebPages || {};
    window.PheWebPages.pheno = function (phenocode) {
        // pheno.js reads window.pheno as the phenocode *string* here, unlike
        // region.js where it is the phenotype object.
        window.pheno = phenocode;
        window.model = window.model || {};
        window.model.show_correlations = false;

        var q = encodeURIComponent(phenocode);

        fetch('js/pheweb-templates.json')
            .then(function (r) { return r.ok ? r.json() : {}; })
            .catch(function () { return {}; })
            .then(function (tpl) {
                window.model.tooltip_underscoretemplate = tpl.tooltip_underscoretemplate || '';
                return fetch(DATA_BASE + '/phenotypes.json').then(function (r) { return r.json(); });
            })
            .then(function (summary) {
                var info = null;
                for (var i = 0; i < summary.length; i++) {
                    if (summary[i].phenocode === phenocode) { info = summary[i]; break; }
                }
                if (!info) throw new Error('no such phenotype: ' + phenocode);
                renderMeta(phenocode, info);

                // pheno.js must exist before the plots are drawn.
                return new Promise(function (resolve, reject) {
                    var s = document.createElement('script');
                    s.src = 'vendor/pheno.js';
                    s.onload = resolve;
                    s.onerror = function () { reject(new Error('failed to load pheno.js')); };
                    document.body.appendChild(s);
                });
            })
            .then(function () {
                // Same two requests pheno.html makes inline, and the same
                // handlers, so the plots are drawn by pheweb's own code.
                var manhattan = fetch(DATA_BASE + '/manhattan/' + q + '.json')
                    .then(function (r) {
                        if (!r.ok) throw new Error('manhattan: ' + r.status);
                        return r.json();
                    })
                    .then(function (data) {
                        window.debug.manhattan = data;
                        create_gwas_plot(data.variant_bins, data.unbinned_variants);
                        populate_streamtable(data.unbinned_variants);
                    });

                var qq = fetch(DATA_BASE + '/qq/' + q + '.json')
                    .then(function (r) {
                        if (!r.ok) throw new Error('qq: ' + r.status);
                        return r.json();
                    })
                    .then(function (data) {
                        window.debug.qq = data;
                        _.sortBy(_.pairs(data.overall.gc_lambda), function (d) { return -d[0]; })
                            .forEach(function (d, i) {
                                var text = 'GC lambda ' + d[0] + ': ' + d[1].toFixed(3);
                                if (i === 0) text = '<b>' + text + '</b>';
                                $('.gc-control').append('<br>' + text);
                            });
                        if (data.by_maf) create_qq_plot(data.by_maf, data.ci);
                        else create_qq_plot([{ maf_range: [0, 0.5], qq: data.overall.qq, count: data.overall.count }], data.ci);
                    });

                return Promise.all([manhattan, qq]);
            })
            .catch(function (e) { fail('Failed to load ' + phenocode + ': ' + e.message); });
    };
})();
