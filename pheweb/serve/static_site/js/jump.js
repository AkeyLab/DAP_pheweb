/**
 * "Go" box in the navigation bar.
 *
 * Always lands on a variant page. An earlier version sent bare positions to a
 * region plot, which needs a phenotype, so it silently reused the last one
 * visited; readers got a plot of a phenotype they never chose. Nothing here
 * infers context any more.
 *
 * A position alone cannot address a variant page, which needs ref and alt, so
 * they are looked up in the matrix rather than guessed. When a position holds
 * several variants, or none, the choices are shown instead of one being picked.
 *
 * Accepted:
 *   2-54051770-A-T        a full variant, used as given
 *   2:54051770            a position, resolved against the matrix
 *   chr2:54,051,770
 */
(function () {
    'use strict';

    var cfg = window.PHEWEB_STATIC || {};
    var DATA_BASE = (cfg.data_base || './data/').replace(/\/+$/, '');
    var NEAR_FLANK = 1000;   // how far to look when a position holds no variant
    var MAX_CHOICES = 8;

    /** @returns {{kind:'variant',cpra:string}|{kind:'position',chrom:string,pos:number}|null} */
    function parse(raw) {
        var q = String(raw || '').trim().replace(/,/g, '');
        if (!q) return null;
        q = q.replace(/^chr/i, '');

        var m = /^([0-9]{1,2}|[XYxy])[-:_ ]([0-9]+)[-:_ ]([ACGTacgt.]+)[-:_ ]([ACGTacgt.]+)$/.exec(q);
        if (m) return { kind: 'variant', cpra: m[1] + '-' + m[2] + '-' + m[3].toUpperCase() + '-' + m[4].toUpperCase() };

        m = /^([0-9]{1,2}|[XYxy])[-:_ ]([0-9]+)$/.exec(q);
        if (m) return { kind: 'position', chrom: m[1], pos: Number(m[2]) };

        return null;
    }
    window.PheWebJump = { parse: parse };

    function box() { return document.getElementById('jump-error'); }

    function clear() {
        var e = box();
        if (e) { e.innerHTML = ''; e.style.display = 'none'; }
    }

    function say(html) {
        var e = box();
        if (!e) return;
        e.innerHTML = html;
        e.style.display = '';
    }

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function cpraOf(v) { return v.chrom + '-' + v.pos + '-' + v.ref + '-' + v.alt; }

    function describe(v) {
        return esc(v.chrom + ':' + v.pos.toLocaleString() + ' ' + v.ref + ' / ' + v.alt) +
            (v.nearest_genes ? ' <i>' + esc(v.nearest_genes) + '</i>' : '');
    }

    function offer(intro, variants) {
        var items = variants.slice(0, MAX_CHOICES).map(function (v) {
            return '<li><a href="#/variant/' + esc(cpraOf(v)) + '">' + describe(v) + '</a></li>';
        }).join('');
        say(esc(intro) + '<ul style="margin:6px 0 0 0">' + items + '</ul>');
    }

    function busy(on) {
        var b = document.getElementById('jump-go');
        if (b) { b.disabled = on; b.textContent = on ? '...' : 'Go'; }
    }

    function go() {
        var input = document.getElementById('jump-input');
        if (!input) return;
        var parsed = parse(input.value);
        if (!parsed) {
            say('Try a position like <code>2:54051770</code> or a variant like <code>2-54051770-A-T</code>.');
            return;
        }
        if (parsed.kind === 'variant') {
            clear();
            window.location.hash = '#/variant/' + parsed.cpra;
            return;
        }

        clear();
        busy(true);
        PheWebStatic.readVariantsAt(DATA_BASE + '/matrix.tsv.gz', parsed.chrom, parsed.pos)
            .then(function (exact) {
                if (exact.length === 1) {
                    window.location.hash = '#/variant/' + cpraOf(exact[0]);
                    return null;
                }
                if (exact.length > 1) {
                    offer('Several variants at that position:', exact);
                    return null;
                }
                // Nothing there; offer what is closest rather than a bare failure.
                return PheWebStatic.readVariantsAt(
                    DATA_BASE + '/matrix.tsv.gz', parsed.chrom, parsed.pos, NEAR_FLANK)
                    .then(function (near) {
                        if (!near.length) {
                            say('No variant at ' + esc(parsed.chrom + ':' + parsed.pos.toLocaleString()) +
                                ', and none within ' + NEAR_FLANK.toLocaleString() + ' bp.');
                        } else {
                            offer('No variant exactly at ' + parsed.chrom + ':' + parsed.pos.toLocaleString() +
                                '. Nearest:', near);
                        }
                    });
            })
            .catch(function (e) { say('Lookup failed: ' + esc(e.message)); })
            .then(function () { busy(false); });
    }

    function wire() {
        var input = document.getElementById('jump-input');
        var button = document.getElementById('jump-go');
        if (!input || !button) return;
        button.addEventListener('click', go);
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); go(); }
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
    else wire();
})();
