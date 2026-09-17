/**
 * Point LocusZoom at static files instead of PheWeb's Flask API.
 *
 * pheweb/serve/static/region.js is used completely unmodified. It already
 * defines the AssociationPheWeb adapter and the whole plot layout; only the
 * transport changes, which in LocusZoom 0.13 is one method, fetchRequest.
 *
 * Load order matters. region.js registers its adapter and populates the plot
 * in the same file, so an override applied after it loads would miss the first
 * request. This file is loaded *before* region.js and hooks adapter
 * registration, installing the transport the moment the class exists.
 */
(function () {
    'use strict';

    if (typeof LocusZoom === 'undefined') throw new Error('load locuszoom before lz-static-adapters.js');
    if (typeof window.PheWebStatic === 'undefined') throw new Error('load pheweb-static.js before lz-static-adapters.js');

    var cfg = window.PHEWEB_STATIC || {};
    var DATA = (cfg.data_base || './data/').replace(/\/+$/, '');

    function installAssoc(cls) {
        if (!cls || cls.prototype.__phewebStatic) return;
        cls.prototype.__phewebStatic = true;

        // getURL is left alone: it no longer performs a request, but LocusZoom
        // still uses it as a cache key and its filter string carries the interval.
        cls.prototype.fetchRequest = function (state, chain, fields) {
            var url = this.getURL(state, chain, fields);
            var parsed = window.PheWebStatic.parseFilter(url);
            if (!parsed) return Promise.reject(new Error('could not parse region filter from ' + url));
            var phenocode = (window.pheno && window.pheno.phenocode) || cfg.phenocode;
            if (!phenocode) return Promise.reject(new Error('window.pheno.phenocode is not set'));
            return window.PheWebStatic.readRegion(
                DATA + '/pheno_gz/' + encodeURIComponent(phenocode) + '.gz',
                parsed.chrom, parsed.start, parsed.end);
        };
    }

    /**
     * Genes, from a tabix track built by `pheweb build-static` out of the same
     * resources/genes-*.bed that `pheweb download-genes` already produces.
     *
     * Subclasses GeneLZ so its normalizeResponse and extractFields are reused:
     * the genes data layer is tightly coupled to that payload shape, and
     * passing records through untouched is exactly what it wants.
     */
    function registerGenes() {
        var Base = LocusZoom.Adapters.get('GeneLZ');
        var cls = LocusZoom.Adapters.extend('GeneLZ', 'PheWebStaticGenes', {});
        // .extend copies the parent class onto the prototype in LZ 0.13, which
        // clobbers overrides passed to it; assign them afterwards.
        cls.prototype.getURL = function (state) {
            return 'genes:' + state.chr + ':' + state.start + '-' + state.end;
        };
        cls.prototype.fetchRequest = function (state) {
            return window.PheWebStatic.readGenes(
                DATA + '/genes.bed.gz', state.chr, state.start, state.end);
        };
        cls.prototype.normalizeResponse = Base.prototype.normalizeResponse;
        cls.prototype.extractFields = Base.prototype.extractFields;
    }

    /**
     * A source that contributes nothing, for panels a static build cannot
     * serve. LocusZoom requires every namespace a layout mentions to resolve,
     * so deleting a source would mean editing region.js; contributing nothing
     * does not, and the layer simply draws nothing.
     *
     * combineChainBody must be overridden. LocusZoom's default *replaces* the
     * chain body with whatever a source returned, which is right for a source
     * that supplies records and catastrophic for one that supplies none: the
     * association data fetched a moment earlier would be thrown away and the
     * plot would come up empty. Annotating sources like LDServer merge instead,
     * and that is the behaviour to imitate.
     */
    function registerEmpty(name) {
        var cls = LocusZoom.Adapters.extend('BaseApiAdapter', name, {});
        cls.prototype.getURL = function () { return 'empty:' + name; };
        cls.prototype.fetchRequest = function () { return Promise.resolve([]); };
        cls.prototype.normalizeResponse = function () { return []; };
        cls.prototype.combineChainBody = function (data, chain) { return chain.body; };
    }

    try { installAssoc(LocusZoom.Adapters.get('AssociationPheWeb')); } catch (e) { /* not yet registered */ }
    var origExtend = LocusZoom.Adapters.extend;
    LocusZoom.Adapters.extend = function (parent, name, overrides) {
        var sub = origExtend.apply(this, arguments);
        if (name === 'AssociationPheWeb') installAssoc(sub);
        return sub;
    };

    registerGenes();
    ['PheWebStaticEmptyLD', 'PheWebStaticEmptyCatalog', 'PheWebStaticEmptyRecomb'].forEach(registerEmpty);

    /**
     * Substitute sources as region.js registers them, not afterwards.
     *
     * region.js builds its DataSources and populates the plot in one pass, so
     * anything swapped later misses the first request; LocusZoom's remote
     * adapters also validate a genome build in getURL and throw before we get
     * a chance. Hooking DataSources.add means the static adapter is in place
     * the moment region.js asks for the remote one, and region.js needs no
     * edits.
     *
     * Which namespaces are replaced depends on configuration. By default they
     * all are, so the site works with no network. Setting remote_sources.ld to
     * a url in config.js restores that panel, pointing at portaldev or at any
     * host offering the same API.
     */
    var remote = cfg.remote_sources || {};
    // LocusZoom's BaseApiAdapter constructor requires a url even when the
    // adapter never performs a request, so these carry a placeholder. Nothing
    // fetches it: every substitute overrides fetchRequest.
    var NO_FETCH = { url: 'about:blank' };
    var SUBSTITUTE = {
        gene: function () { return ['PheWebStaticGenes', NO_FETCH]; },
        ld: function () {
            return remote.ld
                ? ['LDServer', { url: remote.ld, params: remote.ld_params || {} }]
                : ['PheWebStaticEmptyLD', NO_FETCH];
        },
        catalog: function (orig) { return remote.catalog ? orig : ['PheWebStaticEmptyCatalog', NO_FETCH]; },
        recomb: function (orig) { return remote.recomb ? orig : ['PheWebStaticEmptyRecomb', NO_FETCH]; },
    };

    var DataSources = LocusZoom.DataSources;
    if (DataSources && DataSources.prototype && DataSources.prototype.add) {
        var origAdd = DataSources.prototype.add;
        DataSources.prototype.add = function (ns, spec, override) {
            var swap = SUBSTITUTE[ns];
            return origAdd.call(this, ns, swap ? swap(spec) : spec, override);
        };
    }

    /** Kept for callers that want to re-point an existing plot. */
    function useStaticSources(plot) {
        var sources = plot && plot.lzd && plot.lzd._sources;
        if (!sources || typeof sources.add !== 'function') return;
        Object.keys(SUBSTITUTE).forEach(function (ns) {
            try { sources.add(ns, SUBSTITUTE[ns](null), true); } catch (e) { /* not in this layout */ }
        });
    }

    window.PheWebStatic.useStaticSources = useStaticSources;
})();
