/**
 * Region page: the LocusZoom association plot with pan and zoom.
 *
 * region.html injected the phenotype object and the tooltip template from the
 * server, and set the initial interval as a data-region attribute that
 * LocusZoom reads off the container. All three are rebuilt here; region.js
 * itself is unmodified, and its data now arrives via HTTP range requests
 * (see lz-region-adapter.js).
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

    function fail(msg) {
        var e = el('page-error');
        e.textContent = msg;
        e.style.display = '';
    }

    /** "26:16668157-16768157" */
    function parseRegion(s) {
        var m = /^([^:]+):(\d+)-(\d+)$/.exec(String(s || '').trim());
        return m ? { chrom: m[1], start: Number(m[2]), end: Number(m[3]) } : null;
    }

    /**
     * Keep the UCSC link pointing at whatever window the plot is currently
     * showing, so it follows panning and zooming rather than freezing at the
     * interval the page was opened with.
     *
     * A deep link, never an iframe: if UCSC changes this degrades to a dead
     * link instead of a broken embed, and the page stays usable offline.
     */
    function updateUcscLink(chrom, start, end) {
        var a = el('ucsc-region-link');
        if (!a) return;
        var db = 'hg' + (cfg.hg_build_number || 19);
        // The pipeline uses bare chromosome numbers; UCSC canFam4 expects chr1..chr38.
        // Get this wrong and UCSC renders an empty view with no error.
        var pos = 'chr' + chrom + ':' + Math.max(1, Math.round(start)) + '-' + Math.round(end);
        a.href = 'https://genome.ucsc.edu/cgi-bin/hgTracks?db=' + encodeURIComponent(db) +
            '&position=' + encodeURIComponent(pos);
        var label = el('ucsc-region-pos');
        if (label) label.textContent = '(' + pos + ')';
    }

    /**
     * Point the plot's data sources at static files.
     *
     * region.js has already created sources aimed at portaldev. Swapping them
     * afterwards means region.js itself stays unmodified, and a missing gene
     * track degrades to a plot without one rather than a broken page.
     */
    function useStaticSources() {
        try {
            window.PheWebStatic.useStaticSources(window.plot);
        } catch (e) {
            if (window.console) console.warn('could not switch to static sources:', e.message);
        }
    }

    window.PheWebPages = window.PheWebPages || {};

    /**
     * Put a LocusZoom region plot into an existing #lz-1 element.
     *
     * Shared with the gene page, which shows the same plot under a different
     * header. Everything the plot needs is set up here, in the order region.js
     * requires: window.pheno and the tooltip template before it loads, the
     * data-region attribute before it populates, and the gene panel after.
     */
    function plotRegion(phenocode, region) {
        return Promise.all([
            fetch('js/pheweb-templates.json').then(function (r) { return r.ok ? r.json() : {}; })
                .catch(function () { return {}; }),
            fetch(DATA_BASE + '/phenotypes.json').then(function (r) {
                if (!r.ok) throw new Error('phenotypes.json: ' + r.status);
                return r.json();
            }),
        ]).then(function (both) {
            var tpl = both[0], summary = both[1];
            var info = null;
            for (var i = 0; i < summary.length; i++) {
                if (summary[i].phenocode === phenocode) { info = summary[i]; break; }
            }
            if (!info) throw new Error('no such phenotype: ' + phenocode);

            window.model = window.model || {};
            window.model.tooltip_lztemplate = tpl.tooltip_lztemplate || '';
            // region.js reads window.pheno as the phenotype *object* here,
            // unlike pheno.js where it is the phenocode string.
            window.pheno = {
                phenocode: phenocode,
                category: info.category,
                num_samples: info.num_samples,
            };

            el('lz-1').setAttribute('data-region',
                region.chrom + ':' + region.start + '-' + region.end);

            return new Promise(function (resolve, reject) {
                var s = document.createElement('script');
                s.src = 'vendor/region.js';
                s.onload = resolve;
                s.onerror = function () { reject(new Error('failed to load region.js')); };
                document.body.appendChild(s);
            }).then(function () {
                useStaticSources();
                return info;
            });
        });
    }

    /** Used by the gene page, which supplies its own header. */
    window.PheWebPages.regionPlotInto = function (phenocode, regionStr) {
        var region = parseRegion(regionStr);
        if (!region) return Promise.reject(new Error('bad region ' + regionStr));
        return plotRegion(phenocode, region);
    };

    window.PheWebPages.region = function (phenocode, regionStr) {
        var region = parseRegion(regionStr);
        if (!region) return fail('Could not understand the region ' + regionStr);

        // The interval comes straight from the URL, so the UCSC link can be
        // built now. Deferring it until after the data loads made the link
        // depend on everything else succeeding, for no reason.
        updateUcscLink(region.chrom, region.start, region.end);

        plotRegion(phenocode, region).then(function (info) {
            el('region-title').textContent =
                phenocode + (info.phenostring ? ': ' + info.phenostring : '');
            document.title = phenocode + ' ' + regionStr + ' | DAP PheWeb';
            if (info.num_samples !== undefined) {
                el('region-samples').innerHTML = '<b>' + esc(info.num_samples) + '</b> samples';
            }
            if (info.category) {
                el('region-category').innerHTML = 'Category: <b>' + esc(info.category) + '</b>';
            }
            if (window.plot && window.plot.on) {
                window.plot.on('region_changed', function (e) {
                    var d = (e && e.data) || {};
                    if (d.chr !== undefined) updateUcscLink(d.chr, d.start, d.end);
                });
            }
        }).catch(function (e) {
            fail('Failed to load ' + phenocode + ' ' + regionStr + ': ' + e.message);
        });
    };
})();
