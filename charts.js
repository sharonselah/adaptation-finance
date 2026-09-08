/* Native SVG figure renderers for the BRP-01 pack.
 *
 * Every renderer draws from window.FIGDATA (generated from figures/figure_data.json), so
 * changing the data changes the page - no image rebuild. Output is vector, inherits the
 * page's Montserrat, and has a transparent ground, which is why it stays sharp at any
 * zoom and sits flush on a white card.
 *
 * Figures are converted incrementally: index.html renders SVG where a renderer exists in
 * CHARTS and falls back to the PNG otherwise, so the page never breaks mid-migration.
 */
(function () {
  'use strict';

  const TEAL = '#387167', LIME = '#98C11F', INK = '#123B33';
  const GREY = '#6B615A', MID = '#9A918B', GRID = '#E6E4E1', DARK = '#4A4440';
  const FAINT = 'rgba(56,113,103,.11)';
  const NS = 'http://www.w3.org/2000/svg';

  // ---------------------------------------------------------------- helpers
  /* Marks carry their own behaviour. `tip:` is the hover readout - first line is the
     heading, later lines the detail. `key:` groups a mark with the rest of its series and
     with its legend swatch, so hovering any one of them lights all of them. */
  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    let cls = '';
    for (const k in attrs) {
      const v = attrs[k];
      if (v === null || v === undefined) continue;
      if (k === 'class') { cls += ' ' + v; continue; }
      if (k === 'key') { n.setAttribute('data-k', v); continue; }
      if (k === 'tip') {
        n.setAttribute('data-tip', v);
        n.setAttribute('aria-label', String(v).replace(/\n/g, ' \u2014 '));   // the same text for a screen reader
        cls += ' hit';
        continue;
      }
      n.setAttribute(k, v);
    }
    if (cls) n.setAttribute('class', cls.trim());
    if (parent) parent.appendChild(n);
    return n;
  }

  function svg(host, w, h) {
    host.innerHTML = '';
    const s = el('svg', {
      xmlns: NS,                                   // so a right-click "save image" is valid SVG
      viewBox: `0 0 ${w} ${h}`, width: '100%', height: 'auto',
      preserveAspectRatio: 'xMidYMid meet', role: 'img',
      style: 'display:block;overflow:visible'
    }, host);
    return s;
  }

  function txt(p, x, y, s, o) {
    o = o || {};
    const t = el('text', {
      x: x, y: y, fill: o.fill || GREY,
      'font-size': o.size || 13, 'font-weight': o.weight || 500,
      'text-anchor': o.anchor || 'start', 'dominant-baseline': o.base || 'auto',
      'letter-spacing': o.track || '-0.005em',
      key: o.key, tip: o.tip
    }, p);
    t.textContent = s;
    return t;
  }

  /* --------------------------------------------------------------- interaction
     One delegated listener for the whole page: find the nearest ancestor carrying a
     tooltip or a series key, read it back at the cursor, and fade the rest of that figure
     so the hovered series stands out. Delegation means a figure re-rendered later needs no
     rebinding and there is nothing to tear down. */
  const HOVER = '[data-tip],[data-k]';
  let tipBox = null, curHit = null;

  function tipEl() {
    if (!tipBox) {
      tipBox = document.createElement('div');
      tipBox.className = 'fig-tip';
      document.body.appendChild(tipBox);
    }
    return tipBox;
  }
  function showTip(node, ev) {
    const body = node.getAttribute('data-tip');
    if (!body) { hideTip(); return; }
    const t = tipEl();
    t.textContent = '';
    body.split('\n').forEach((line, i) => {
      const d = document.createElement('div');
      if (i === 0) d.className = 'h';
      d.textContent = line;
      t.appendChild(d);
    });
    t.classList.add('on');
    moveTip(ev);
  }
  function moveTip(ev) {
    if (!tipBox || !tipBox.classList.contains('on')) return;
    const m = 14, w = tipBox.offsetWidth, h = tipBox.offsetHeight;
    let x = ev.clientX + m, y = ev.clientY + m;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - m;      // flip rather than overflow
    if (y + h > window.innerHeight - 8) y = ev.clientY - h - m;
    tipBox.style.transform = 'translate(' + Math.max(8, x) + 'px,' + Math.max(8, y) + 'px)';
  }
  function hideTip() { if (tipBox) tipBox.classList.remove('on'); }

  function cool() {
    const dim = document.querySelectorAll('svg.dim');
    for (let i = 0; i < dim.length; i++) {
      dim[i].classList.remove('dim');
      const hot = dim[i].querySelectorAll('.hot');
      for (let j = 0; j < hot.length; j++) hot[j].classList.remove('hot');
    }
  }
  function warm(node) {
    const s = node.ownerSVGElement;
    if (!s) return;
    // a band is the empty space between marks: it reads values back without fading them
    const cls = node.getAttribute('class') || '';
    if (cls.indexOf('band') >= 0) return;
    s.classList.add('dim');
    const k = node.getAttribute('data-k');
    if (!k) { node.classList.add('hot'); return; }
    const all = s.querySelectorAll('[data-k]');
    for (let i = 0; i < all.length; i++) if (all[i].getAttribute('data-k') === k) all[i].classList.add('hot');
  }
  function track(ev) {
    const n = ev.target && ev.target.closest ? ev.target.closest(HOVER) : null;
    if (n === curHit) { if (n) moveTip(ev); return; }
    cool();
    curHit = n;
    if (n) { warm(n); showTip(n, ev); } else hideTip();
  }
  function clear() { cool(); curHit = null; hideTip(); }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('pointermove', track, { passive: true });
    document.addEventListener('pointerdown', track, { passive: true });   // touch: tap to read
    document.addEventListener('pointerleave', clear);
    window.addEventListener('scroll', clear, { passive: true });
  }

  /* A transparent column per x position, so a line chart can be read in the gaps between
     its marks. Drawn before the marks, so a mark's own tooltip still wins over the band. */
  function bands(s, top, B, cx, tipFor) {
    cx.forEach((x, i) => {
      const a = i === 0 ? x - (cx[1] - x) / 2 : (cx[i - 1] + x) / 2;
      const b = i === cx.length - 1 ? x + (x - cx[i - 1]) / 2 : (x + cx[i + 1]) / 2;
      el('rect', { x: a, y: top, width: Math.max(1, b - a), height: B - top, class: 'band', tip: tipFor(i) }, s);
    });
  }

  /* Wrap into <=width px at the given size, returning the lines. Rough advance-width
     estimate: good enough for titles and source notes, and avoids measuring in the DOM. */
  function wrap(s, width, size, weight) {
    const k = (weight >= 700 ? 0.60 : 0.545) * size;
    const max = Math.max(8, Math.floor(width / k));
    const words = String(s).split(/\s+/), out = [];
    let line = '';
    for (const w of words) {
      const cand = line ? line + ' ' + w : w;
      if (cand.length > max && line) { out.push(line); line = w; } else { line = cand; }
    }
    if (line) out.push(line);
    return out;
  }

  /* Shared chrome: title, optional subtitle, source note. Returns the top of the plot. */
  function chrome(s, W, title, subtitle, source, pad) {
    let y = 4;
    const tl = wrap(title, W - pad * 2, 17, 700);
    tl.forEach(l => { txt(s, pad, y += 20, l, { fill: INK, size: 17, weight: 700, track: '-0.02em' }); });
    if (subtitle) {
      const sl = wrap(subtitle, W - pad * 2, 12.5, 500);
      sl.forEach(l => { txt(s, pad, y += 18, l, { fill: GREY, size: 12.5 }); });
    }
    if (source) {
      s.__source = source;
    }
    return y + 20;
  }

  function footer(s, W, H, source, pad) {
    if (!source) return H;
    const sl = wrap('Source: ' + source, W - pad * 2, 11, 500);
    let y = H;
    sl.forEach(l => { txt(s, pad, y += 14, l, { fill: MID, size: 11 }); });
    return y + 6;
  }

  /* Resize the viewBox once the real content height is known. */
  function finish(s, W, H) {
    s.setAttribute('viewBox', `0 0 ${W} ${H}`);
  }

  function nice(v) { return v.toLocaleString('en-US', { maximumFractionDigits: 1 }); }

  // ---------------------------------------------------------------- f01
  function f01(host, D) {
    const d = D.f01_headline_series, s0 = d.series;
    const W = 1000, pad = 26;
    const s = svg(host, W, 640);
    let top = chrome(s, W, 'Adaptation finance to Africa rose to a 2022 peak and has fallen for two years',
      'USD bn, annual commitments from all sources, 2017 to 2024', s0.source, pad);
    const L = 62, R = W - 20, B = 520;
    top += 34;                                     // headroom for the annotation row
    const xs = s0.years.concat([d.ssa2024.year]);
    const x0 = 2016.6, x1 = 2024.5, ymax = 20;
    const X = v => L + (v - x0) / (x1 - x0) * (R - L);
    const Y = v => B - v / ymax * (B - top);

    for (let g = 0; g <= ymax; g += 2.5) {
      el('line', { x1: L, x2: R, y1: Y(g), y2: Y(g), stroke: GRID, 'stroke-width': 1 }, s);
      txt(s, L - 10, Y(g), nice(g), { anchor: 'end', base: 'middle', size: 12, fill: MID });
    }
    xs.forEach(v => {
      el('line', { x1: X(v), x2: X(v), y1: top, y2: B, stroke: GRID, 'stroke-width': 1 }, s);
      txt(s, X(v), B + 22, String(v), { anchor: 'middle', size: 13, weight: 600, fill: DARK });
    });

    bands(s, top, B, s0.years.map(X), i =>
      s0.years[i] + '\nNominal  USD ' + s0.nominal[i].toFixed(1) + 'bn'
      + '\nReal, 2017 USD  USD ' + s0.real_2017[i].toFixed(1) + 'bn');

    const pts = s0.years.map((y, i) => [X(y), Y(s0.real_2017[i])]);
    el('path', {
      d: `M${pts.map(p => p.join(',')).join('L')}L${X(s0.years[s0.years.length - 1])},${Y(0)}L${X(s0.years[0])},${Y(0)}Z`,
      fill: FAINT
    }, s);
    el('path', {
      d: 'M' + pts.map(p => p.join(',')).join('L'),
      fill: 'none', stroke: MID, 'stroke-width': 2.4, 'stroke-dasharray': '9 7'
    }, s);

    const np = s0.years.map((y, i) => [X(y), Y(s0.nominal[i])]);
    el('path', { d: 'M' + np.map(p => p.join(',')).join('L'), fill: 'none', stroke: TEAL, 'stroke-width': 3.4, 'stroke-linejoin': 'round' }, s);
    np.forEach((p, i) => {
      el('circle', { cx: p[0], cy: p[1], r: 5.6, fill: TEAL,
        tip: s0.years[i] + '\nAfrica, nominal  USD ' + s0.nominal[i].toFixed(1) + 'bn' }, s);
      txt(s, p[0], p[1] - 15, s0.nominal[i].toFixed(1), { anchor: 'middle', size: 13, weight: 700, fill: TEAL });
    });

    d.vintages.forEach(v => {
      const cx = X(v.x), cy = Y(v.value), r = 6.4;
      el('path', { d: `M${cx},${cy - r}L${cx + r},${cy}L${cx},${cy + r}L${cx - r},${cy}Z`, fill: DARK,
        tip: 'Earlier-vintage biennial average\n' + v.x + '  USD ' + v.value.toFixed(1) + 'bn' }, s);
    });

    const lastReal = s0.real_2017[s0.real_2017.length - 1];
    el('line', {
      x1: X(2023), y1: Y(lastReal), x2: X(d.ssa2024.year), y2: Y(d.ssa2024.value),
      stroke: LIME, 'stroke-width': 2.4, 'stroke-dasharray': '2 6', 'stroke-linecap': 'round'
    }, s);
    el('rect', { x: X(d.ssa2024.year) - 7, y: Y(d.ssa2024.value) - 7, width: 14, height: 14, fill: LIME,
      tip: 'Sub-Saharan Africa only, ' + d.ssa2024.year + '\nUSD ' + d.ssa2024.value.toFixed(1) + 'bn (CPI 2026)' }, s);
    txt(s, X(d.ssa2024.year), Y(d.ssa2024.value) - 16, d.ssa2024.value.toFixed(1),
      { anchor: 'middle', size: 13, weight: 700, fill: '#6E8F16' });

    [[2017, 'Post-Paris MDB|re-tooling'], [2019, 'GCF-1 replenishment|(USD 10bn)'],
     [2020, 'COVID-19 crisis|lending'], [2021, 'Glasgow doubling|pledge'],
     [2022, 'Peak: USD 16.4bn'], [2024, 'SSA falls 15%;|2025 ODA –23%']
    ].forEach(([yr, label], i) => {
      const lines = label.split('|');
      lines.forEach((l, j) => txt(s, X(yr), top - 26 + (i % 2 ? 16 : 0) + j * 13, l,
        { anchor: 'middle', size: 11.5, fill: GREY }));
    });

    const items = [['area', 'Real terms (2017 USD)'], ['line-teal', 'Africa, nominal (GCA/CPI 2025 series)'],
      ['line-dash', 'Africa, real terms (2017 USD)'], ['diamond', 'Earlier-vintage biennial averages'],
      ['square', 'Sub-Saharan Africa only, 2024 (CPI 2026)']];
    let ly = B - 116;
    items.forEach(([kind, label]) => {
      const cx = R - 300;
      if (kind === 'area') el('rect', { x: cx - 14, y: ly - 7, width: 28, height: 13, fill: FAINT }, s);
      if (kind === 'line-teal') {
        el('line', { x1: cx - 15, x2: cx + 15, y1: ly, y2: ly, stroke: TEAL, 'stroke-width': 3.4 }, s);
        el('circle', { cx: cx, cy: ly, r: 5, fill: TEAL }, s);
      }
      if (kind === 'line-dash') el('line', { x1: cx - 15, x2: cx + 15, y1: ly, y2: ly, stroke: MID, 'stroke-width': 2.4, 'stroke-dasharray': '9 7' }, s);
      if (kind === 'diamond') el('path', { d: `M${cx},${ly - 6}L${cx + 6},${ly}L${cx},${ly + 6}L${cx - 6},${ly}Z`, fill: DARK }, s);
      if (kind === 'square') el('rect', { x: cx - 6, y: ly - 6, width: 12, height: 12, fill: LIME }, s);
      txt(s, cx + 26, ly, label, { base: 'middle', size: 12.5, fill: DARK });
      ly += 23;
    });

    txt(s, 16, (top + B) / 2, 'USD billion, commitments',
      { anchor: 'middle', size: 12.5, fill: GREY }).setAttribute('transform', `rotate(-90 16 ${(top + B) / 2})`);
    finish(s, W, footer(s, W, B + 36, s0.source, pad));
  }

  // ---------------------------------------------------------------- f04
  function f04(host, D) {
    const o = D.f04_oda_vs_adaptation.oda, ratio = D.f04_oda_vs_adaptation.ratio;
    const W = 1000, pad = 26;
    const s = svg(host, W, 560);
    let top = chrome(s, W, 'Aid to Africa and adaptation finance move in opposite directions',
      'ODA to Africa, USD bn (bars); adaptation finance as a share of ODA, % (line)', o.source, pad);
    const L = 60, R = W - 60, B = 440;
    const ymax = 80, rmax = 35;
    const n = o.years.length, bw = (R - L) / n * 0.62;
    const X = i => L + (i + 0.5) * (R - L) / n;
    const Y = v => B - v / ymax * (B - top);
    const YR = v => B - v / rmax * (B - top);

    for (let g = 0; g <= ymax; g += 20) {
      el('line', { x1: L, x2: R, y1: Y(g), y2: Y(g), stroke: GRID }, s);
      txt(s, L - 10, Y(g), String(g), { anchor: 'end', base: 'middle', size: 12, fill: MID });
    }
    o.oda.forEach((v, i) => {
      el('rect', { x: X(i) - bw / 2, y: Y(v), width: bw, height: B - Y(v), fill: 'rgba(56,113,103,.30)', rx: 2,
        tip: o.years[i] + '\nODA to Africa  USD ' + v.toFixed(1) + 'bn'
          + (ratio[o.years[i]] ? '\nAdaptation  ' + ratio[o.years[i]].toFixed(1) + '% of ODA' : '') }, s);
      if (i % 2 === 0) txt(s, X(i), B + 20, String(o.years[i]), { anchor: 'middle', size: 11.5, fill: DARK, weight: 600 });
    });
    const rp = Object.keys(ratio).map(k => [X(o.years.indexOf(+k)), YR(ratio[k])]);
    el('path', { d: 'M' + rp.map(p => p.join(',')).join('L'), fill: 'none', stroke: LIME, 'stroke-width': 3.4, 'stroke-linejoin': 'round' }, s);
    const keys = Object.keys(ratio);
    rp.forEach((p, i) => el('circle', { cx: p[0], cy: p[1], r: 5, fill: LIME,
      tip: keys[i] + '\nAdaptation finance  ' + ratio[keys[i]].toFixed(1) + '% of ODA to Africa' }, s));
    txt(s, rp[rp.length - 1][0], rp[rp.length - 1][1] - 14,
      ratio[keys[keys.length - 1]].toFixed(0) + '%', { anchor: 'middle', size: 13, weight: 700, fill: '#6E8F16' });
    for (let g = 0; g <= rmax; g += 10) txt(s, R + 10, YR(g), g + '%', { base: 'middle', size: 12, fill: MID });
    txt(s, L, top - 12, 'ODA to Africa (left)   —   adaptation as % of ODA (right)', { size: 12.5, fill: DARK });
    finish(s, W, footer(s, W, B + 34, o.source, pad));
  }

  // ---------------------------------------------------------------- f16
  function f16(host, D) {
    const d = D.f16_ggw_waffle;
    const W = 1000, pad = 26;
    const s = svg(host, W, 520);
    let top = chrome(s, W, 'The Great Green Wall: each square is one percent of the USD 33bn needed to 2030',
      `USD ${d.pledged}bn pledged since 2021; USD ${d.disbursed}bn disbursed by March 2023`, d.source, pad);
    const cols = 20, cell = 34, gap = 5;
    const pledged = Math.round(d.pledged / d.needed * 100), disb = Math.round(d.disbursed / d.needed * 100);
    for (let i = 0; i < 100; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const fill = i < disb ? TEAL : (i < pledged ? LIME : '#E4E1DD');
      const grp = i < disb ? 'Disbursed' : (i < pledged ? 'Pledged, not yet disbursed' : 'Unfunded');
      el('rect', {
        x: pad + c * (cell + gap), y: top + r * (cell + gap),
        width: cell, height: cell, rx: 3, fill: fill, key: grp,
        tip: grp + '\n' + (i < disb ? 'USD ' + d.disbursed + 'bn, ' + disb + '% of the need'
          : i < pledged ? 'USD ' + (d.pledged - d.disbursed).toFixed(1) + 'bn, ' + (pledged - disb) + '% of the need'
          : 'USD ' + (d.needed - d.pledged).toFixed(1) + 'bn short, ' + (100 - pledged) + '% of the need')
          + '\nOne square = 1% of the USD ' + d.needed + 'bn needed to 2030'
      }, s);
    }
    let ly = top + 5 * (cell + gap) + 22;
    [[TEAL, `Disbursed: USD ${d.disbursed}bn (${disb}%)`, 'Disbursed'],
     [LIME, `Pledged, not yet disbursed (${pledged - disb}%)`, 'Pledged, not yet disbursed'],
     ['#E4E1DD', `Unfunded against the USD ${d.needed}bn need (${100 - pledged}%)`, 'Unfunded']].forEach(([c, l, k]) => {
      el('rect', { x: pad, y: ly - 11, width: 15, height: 15, rx: 3, fill: c, key: k }, s);
      txt(s, pad + 24, ly - 3, l, { size: 12.5, fill: DARK, key: k });
      ly += 24;
    });
    finish(s, W, footer(s, W, ly, d.source, pad));
  }

  // ---------------------------------------------------------------- f17
  function f17(host, D) {
    const v = D.f17_stage_split;
    const keys = ['Readiness / enabling', 'Project preparation', 'Implementation'];
    const cols = [LIME, '#C8DC7A', TEAL];
    const W = 1000, pad = 26;
    const s = svg(host, W, 470);
    let top = chrome(s, W, 'Implementation absorbs 95 to 99 percent of climate-fund money; readiness and preparation share the rest',
      'Shares of cumulative approvals by stage, USD m', v.source, pad);
    const L = 250, R = W - 150, bh = 34, gap = 26;
    v.funds.forEach((f, i) => {
      const tot = keys.reduce((a, k) => a + v[k][i], 0);
      let x = L, y = top + i * (bh + gap);
      txt(s, L - 14, y + bh / 2, f, { anchor: 'end', base: 'middle', size: 12.5, weight: 600, fill: DARK });
      keys.forEach((k, j) => {
        const w = v[k][i] / tot * (R - L);
        if (w <= 0) return;
        el('rect', { x: x, y: y, width: w, height: bh, fill: cols[j], key: k,
          tip: f + '\n' + k + '  ' + (v[k][i] / tot * 100).toFixed(1) + '%  (USD ' + nice(v[k][i]) + 'm)' }, s);
        if (w > 46) txt(s, x + w / 2, y + bh / 2, (v[k][i] / tot * 100).toFixed(1) + '%',
          { anchor: 'middle', base: 'middle', size: 12, weight: 600, fill: j === 2 ? '#fff' : INK });
        x += w;
      });
      txt(s, R + 12, y + bh / 2, 'USD ' + nice(tot) + 'm total', { base: 'middle', size: 11.5, fill: MID });
    });
    let ly = top + v.funds.length * (bh + gap) + 12;
    let lx = L;
    keys.forEach((k, j) => {
      el('rect', { x: lx, y: ly - 11, width: 15, height: 15, rx: 2, fill: cols[j], key: k }, s);
      txt(s, lx + 23, ly - 3, k, { size: 12.5, fill: DARK, key: k });
      lx += 30 + k.length * 7.4;
    });
    finish(s, W, footer(s, W, ly + 16, v.source, pad));
  }

  // ---------------------------------------------------------------- f24
  function f24(host, D) {
    const v = D.f24_appraisal_waffle;
    const cats = [['All three dividends valued', v.three, INK], ['Two dividends', v.two, TEAL],
      ['One dividend', v.one, LIME], ['No dividend monetised', v.none, '#D8D4CF']];
    const total = cats.reduce((a, c) => a + c[1], 0);
    const W = 1000, pad = 26;
    const s = svg(host, W, 520);
    let top = chrome(s, W, `Of ${total} real adaptation appraisals, one square each, only ${v.three} put a value on all three resilience dividends`,
      '', v.source, pad);
    const cols = 32, cell = 26, gap = 3.4;
    const seq = [];
    cats.forEach(c => { for (let i = 0; i < c[1]; i++) seq.push([c[2], c[0], c[1]]); });
    const ox = (W - (cols * cell + (cols - 1) * gap)) / 2;
    seq.forEach(([c, grp, cnt], i) => {
      const r = Math.floor(i / cols), cc = i % cols;
      el('rect', { x: ox + cc * (cell + gap), y: top + r * (cell + gap), width: cell, height: cell, rx: 2.5, fill: c, key: grp,
        tip: grp + '\n' + cnt + ' of ' + total + ' appraisals (' + Math.round(cnt / total * 100) + '%)\nOne square is one appraisal' }, s);
    });
    const rows = Math.ceil(seq.length / cols);
    let ly = top + rows * (cell + gap) + 24, lx = ox;
    cats.forEach(([n, cnt, c], i) => {
      if (i === 2) { ly += 24; lx = ox; }
      el('rect', { x: lx, y: ly - 11, width: 15, height: 15, rx: 2, fill: c, key: n }, s);
      const lbl = `${n}: ${cnt} (${Math.round(cnt / total * 100)}%)`;
      txt(s, lx + 23, ly - 3, lbl, { size: 12.5, fill: DARK, key: n });
      lx += 40 + lbl.length * 7.1;
    });
    finish(s, W, footer(s, W, ly + 16, v.source, pad));
  }

  // ---------------------------------------------------------------- f26
  function f26(host, D) {
    const rows = D.f26_pledge_delivery;
    const W = 1000, pad = 26;
    const s = svg(host, W, 430);
    let top = chrome(s, W, 'Pledges are systematically under-delivered',
      'Bar length is delivery as a share of the headline pledge', null, pad);
    const L = 330, R = W - 230, bh = 32, gap = 30;
    rows.forEach((r, i) => {
      const [label, pledged, delivered, note] = r;
      const y = top + i * (bh + gap), pct = delivered / pledged * 100;
      txt(s, L - 14, y + bh / 2, label, { anchor: 'end', base: 'middle', size: 12.5, weight: 600, fill: DARK });
      el('rect', { x: L, y: y, width: R - L, height: bh, fill: '#EBE8E4', rx: 3 }, s);
      el('rect', { x: L, y: y, width: (R - L) * pct / 100, height: bh, fill: TEAL, rx: 3,
        tip: label + '\nPledged ' + nice(pledged) + '\nDelivered ' + nice(delivered) + '  (' + pct.toFixed(0) + '%)\n' + note }, s);
      txt(s, L + (R - L) * pct / 100 + 12, y + bh / 2,
        `${pct.toFixed(0)}% — ${note}`, { base: 'middle', size: 11.5, fill: GREY });
    });
    let by = top + rows.length * (bh + gap);
    [0, 25, 50, 75, 100].forEach(g => {
      const x = L + (R - L) * g / 100;
      el('line', { x1: x, x2: x, y1: top - 8, y2: by - gap + 8, stroke: GRID }, s);
      txt(s, x, by - gap + 26, g === 100 ? '100%' : String(g), { anchor: 'middle', size: 11.5, fill: MID });
    });
    finish(s, W, footer(s, W, by + 18,
      'Glasgow doubling: OECD 2026. GCF-2: replenishment tracker, 2025. Great Green Wall: UNCCD Accelerator, 2023. Adaptation Fund: AFB, COP30', pad));
  }

  // ---------------------------------------------------------------- f34
  function f34(host, D) {
    const b = D.f34_region_dumbbell, fin = b.finance, pop = b.population;
    const regs = ['East', 'West', 'Southern', 'North', 'Central'];
    const tot = regs.reduce((a, r) => a + fin[r], 0);
    const W = 1000, pad = 26;
    const s = svg(host, W, 470);
    let top = chrome(s, W, 'Regional shares of finance track population, with Central Africa under-served and East Africa ahead',
      "Finance shares computed on the source's regional totals for 2023", fin.source, pad);
    const L = 180, R = W - 300, gap = 52;
    const X = v => L + v / 40 * (R - L);
    for (let g = 0; g <= 40; g += 10) {
      const x = X(g);
      el('line', { x1: x, x2: x, y1: top - 6, y2: top + regs.length * gap - 26, stroke: GRID }, s);
      txt(s, x, top + regs.length * gap - 8, g + '%', { anchor: 'middle', size: 11.5, fill: MID });
    }
    regs.forEach((r, i) => {
      const y = top + i * gap + 8;
      const f = fin[r] / tot * 100, p = pop[r];
      txt(s, L - 16, y, r + ' Africa', { anchor: 'end', base: 'middle', size: 12.5, weight: 600, fill: DARK });
      el('line', { x1: X(Math.min(f, p)), x2: X(Math.max(f, p)), y1: y, y2: y, stroke: '#DDD9D4', 'stroke-width': 5, 'stroke-linecap': 'round' }, s);
      el('circle', { cx: X(p), cy: y, r: 7.5, fill: MID, tip: r + ' Africa\n' + p.toFixed(0) + '% of Africa\u2019s population' }, s);
      el('circle', { cx: X(f), cy: y, r: 7.5, fill: TEAL,
        tip: r + ' Africa\n' + f.toFixed(1) + '% of adaptation finance\nUSD ' + fin[r].toFixed(2) + 'bn in 2023' }, s);
      txt(s, X(Math.max(f, p)) + 16, y, `finance ${f.toFixed(0)}% vs population ${p.toFixed(0)}%`,
        { base: 'middle', size: 11.5, fill: GREY });
    });
    let ly = top + regs.length * gap + 20;
    [[TEAL, 'Share of adaptation finance, 2023'], [MID, 'Share of population']].forEach(([c, l], i) => {
      el('circle', { cx: L + i * 300 + 7, cy: ly - 4, r: 7.5, fill: c }, s);
      txt(s, L + i * 300 + 22, ly - 4, l, { base: 'middle', size: 12.5, fill: DARK });
    });
    finish(s, W, footer(s, W, ly + 14, fin.source, pad));
  }

  // ------------------------------------------------------- shared bits (2)
  /* A single-hue teal ramp and a single-hue lime ramp. Graded scales must never be
     built from two brand hues - lightness alone carries the ordering. */
  const RAMP = ['#EDF2F0', '#CBDDD8', '#9FC2BA', '#6E9E94', '#417A70', '#24534A'];
  const LRAMP = ['#F4F7E7', '#E1EBBB', '#C6DB80', '#A9CA45', '#8AB01C', '#657F14'];
  const REGCOL = { North: '#24534A', West: '#387167', East: '#6E9E94', Central: '#98C11F', Southern: '#C3DA7C' };
  const PALE = '#E4E1DD';

  function mix(a, b, t) {
    const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const A = p(a), B = p(b);
    return '#' + [0, 1, 2].map(i => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join('');
  }
  function ramp(t, arr) {
    arr = arr || RAMP;
    t = Math.max(0, Math.min(1, t || 0));
    const i = t * (arr.length - 1), a = Math.floor(i);
    return mix(arr[a], arr[Math.min(arr.length - 1, a + 1)], i - a);
  }
  /* Readable ink for a given fill. */
  function ink(hex) {
    const p = i => parseInt(hex.slice(i, i + 2), 16) / 255;
    const f = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * f(p(1)) + 0.7152 * f(p(3)) + 0.0722 * f(p(5)) < 0.42 ? '#fff' : INK;
  }
  /* Text that has to sit over marks: stroke the glyphs in the page ground first. */
  function halo(t) {
    t.setAttribute('stroke', '#fff');
    t.setAttribute('stroke-width', 3.2);
    t.setAttribute('paint-order', 'stroke');
    return t;
  }
  function gridY(s, L, R, Y, ticks, fmt) {
    ticks.forEach(g => {
      el('line', { x1: L, x2: R, y1: Y(g), y2: Y(g), stroke: GRID }, s);
      txt(s, L - 10, Y(g), fmt ? fmt(g) : String(g), { anchor: 'end', base: 'middle', size: 12, fill: MID });
    });
  }
  function gridX(s, top, B, X, ticks, fmt) {
    ticks.forEach(g => {
      el('line', { x1: X(g), x2: X(g), y1: top, y2: B, stroke: GRID }, s);
      txt(s, X(g), B + 20, fmt ? fmt(g) : String(g), { anchor: 'middle', size: 11.5, fill: MID });
    });
  }
  /* Swatch legend. Returns the y below it. */
  function legend(s, x, y, items, opts) {
    opts = opts || {};
    const size = opts.size || 12.5, box = opts.box || 15;
    if (opts.column) {
      items.forEach(([c, l, k]) => {
        el('rect', { x: x, y: y - box + 3, width: box, height: box, rx: 2, fill: c, key: k }, s);
        txt(s, x + box + 9, y - 3, l, { size: size, fill: DARK, key: k });
        y += box + 8;
      });
      return y;
    }
    let lx = x;
    items.forEach(([c, l, k]) => {
      el('rect', { x: lx, y: y - box + 3, width: box, height: box, rx: 2, fill: c, key: k }, s);
      txt(s, lx + box + 8, y - 3, l, { size: size, fill: DARK, key: k });
      lx += box + 22 + String(l).length * size * 0.545;
    });
    return y + box + 8;
  }
  /* Split a series at nulls so a gap stays a gap. */
  /* Keep a column of labels from landing on each other: walk them in y order and push
     each one down to at least minGap below its neighbour. */
  function spread(ys, minGap) {
    const idx = ys.map((y, i) => i).sort((a, b) => ys[a] - ys[b]);
    const out = ys.slice();
    for (let k = 1; k < idx.length; k++) {
      const prev = out[idx[k - 1]];
      if (out[idx[k]] - prev < minGap) out[idx[k]] = prev + minGap;
    }
    return out;
  }
  function segs(vals, xs, X, Y) {
    const out = [];
    let cur = [];
    vals.forEach((v, i) => {
      if (v === null || v === undefined) { if (cur.length) out.push(cur); cur = []; }
      else cur.push([X(xs[i]), Y(v)]);
    });
    if (cur.length) out.push(cur);
    return out.map(g => (g.length === 1
      ? `M${g[0][0]},${g[0][1]}l0.01,0`
      : 'M' + g.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L')));
  }

  // ---------------------------------------------------------------- f02
  function f02(host, D) {
    const d = D.f02_indexed, yrs = d.years;
    const series = [
      ['Africa (GCA/CPI)', TEAL, 3.4, null],
      ['Global adaptation (CPI)', LIME, 3, null],
      ['OECD adaptation, developed to developing', '#6E9E94', 2.4, null],
      ['UNEP developing-country series', MID, 2.4, '8 6'],
      ['Africa NDC-costed need', DARK, 2.2, '2 6']
    ];
    const W = 1000, pad = 26, s = svg(host, W, 560);
    const top = chrome(s, W, 'Africa outran every comparator to 2022, then gave back more of the gain than any of them',
      'Index, 2019 = 100. A flat line is finance standing still against a need that has moved', d.source, pad) + 10;
    const L = 60, R = W - 300, B = 460, lo = 80, hi = 220;
    const X = v => L + (v - yrs[0]) / (yrs[yrs.length - 1] - yrs[0]) * (R - L);
    const Y = v => B - (v - lo) / (hi - lo) * (B - top);
    gridY(s, L, R, Y, [80, 100, 120, 140, 160, 180, 200, 220]);
    el('line', { x1: L, x2: R, y1: Y(100), y2: Y(100), stroke: MID, 'stroke-dasharray': '3 4' }, s);
    yrs.forEach(y => txt(s, X(y), B + 22, String(y), { anchor: 'middle', size: 13, weight: 600, fill: DARK }));
    const lastOf = k => { let li = -1; d[k].forEach((v, i) => { if (v !== null) li = i; }); return li; };
    const labY = spread(series.map(([k]) => Y(d[k][lastOf(k)])), 17);
    bands(s, top, B, yrs.map(X), i => yrs[i] + '\n'
      + series.filter(([k]) => d[k][i] !== null).map(([k]) => k + '  ' + Math.round(d[k][i])).join('\n'));
    series.forEach(([k, c, w, dash], si) => {
      segs(d[k], yrs, X, Y).forEach(p => el('path', {
        d: p, fill: 'none', stroke: c, 'stroke-width': w, 'stroke-dasharray': dash,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round', key: k
      }, s));
      d[k].forEach((v, i) => {
        if (v !== null) el('circle', { cx: X(yrs[i]), cy: Y(v), r: w > 3 ? 4.6 : 3.4, fill: c, key: k,
          tip: k + '\n' + yrs[i] + '  index ' + Math.round(v) + '  (2019 = 100)' }, s);
      });
      // park the label beside the series' last observed point, nudged clear of its neighbours
      const li = lastOf(k), ly = labY[si];
      el('line', { x1: X(yrs[li]) + 6, y1: Y(d[k][li]), x2: R + 10, y2: ly, stroke: c, 'stroke-width': 1, opacity: 0.45 }, s);
      txt(s, R + 16, ly, Math.round(d[k][li]), { base: 'middle', size: 12.5, weight: 700, fill: c, key: k });
      txt(s, R + 52, ly, k, { base: 'middle', size: 12, fill: DARK, key: k });
    });
    txt(s, 16, (top + B) / 2, 'Index, 2019 = 100', { anchor: 'middle', size: 12.5, fill: GREY })
      .setAttribute('transform', `rotate(-90 16 ${(top + B) / 2})`);
    finish(s, W, footer(s, W, B + 34, d.source, pad));
  }

  // ---------------------------------------------------------------- f03
  function f03(host, D) {
    const c = D.f03_adaptation_vs_mitigation.cpi, m = D.f03_adaptation_vs_mitigation.mdb;
    const W = 1000, pad = 26, s = svg(host, W, 560);
    const top = chrome(s, W, 'Mitigation stays ahead of adaptation on both counts, and the dual-benefit slice is doing the growing',
      'Left: all climate finance to Africa, USD bn. Right: MDB commitments to Africa, USD m', c.source, pad) + 16;
    // left panel: CPI, two periods, three categories
    const L1 = 62, R1 = 452, B = 450;
    const cats = [['adaptation', 'Adaptation', TEAL], ['mitigation', 'Mitigation', MID], ['dual', 'Dual benefits', LIME]];
    const ymax = 22, Y = v => B - v / ymax * (B - top);
    gridY(s, L1, R1, Y, [0, 5, 10, 15, 20]);
    txt(s, L1, top - 12, 'CPI, all climate finance to Africa (USD bn)', { size: 12.5, weight: 600, fill: DARK });
    const gw = (R1 - L1) / c.periods.length;
    c.periods.forEach((p, i) => {
      const bw = gw * 0.22;
      cats.forEach(([k, , col], j) => {
        const x = L1 + i * gw + gw * 0.14 + j * bw * 1.12;
        el('rect', { x: x, y: Y(c[k][i]), width: bw, height: B - Y(c[k][i]), fill: col, rx: 2, key: k,
          tip: cats[j][1] + '\n' + p + '  USD ' + c[k][i].toFixed(1) + 'bn a year' }, s);
        txt(s, x + bw / 2, Y(c[k][i]) - 7, c[k][i].toFixed(1), { anchor: 'middle', size: 11.5, weight: 700, fill: col === MID ? GREY : col });
      });
      txt(s, L1 + i * gw + gw / 2, B + 22, p, { anchor: 'middle', size: 13, weight: 600, fill: DARK });
    });
    // right panel: MDB series
    const L2 = 590, R2 = W - 30;
    const mmax = 10000, MY = v => B - v / mmax * (B - top);
    [0, 2500, 5000, 7500, 10000].forEach(g => {
      el('line', { x1: L2, x2: R2, y1: MY(g), y2: MY(g), stroke: GRID }, s);
      txt(s, L2 - 10, MY(g), nice(g / 1000) + 'bn', { anchor: 'end', base: 'middle', size: 12, fill: MID });
    });
    txt(s, L2, top - 12, 'MDB climate finance to Africa (USD m)', { size: 12.5, weight: 600, fill: DARK });
    const MX = y => L2 + (y - m.years[0]) / (m.years[m.years.length - 1] - m.years[0]) * (R2 - L2);
    bands(s, top, B, m.years.map(MX), i => m.years[i] + '\nMDB adaptation  USD ' + nice(m.adaptation[i]) + 'm'
      + '\nMDB mitigation  USD ' + nice(m.mitigation[i]) + 'm');
    [['adaptation', TEAL], ['mitigation', MID]].forEach(([k, col]) => {
      el('path', { d: segs(m[k], m.years, MX, MY)[0], fill: 'none', stroke: col, 'stroke-width': 3.2, 'stroke-linejoin': 'round', key: k }, s);
      m[k].forEach((v, i) => el('circle', { cx: MX(m.years[i]), cy: MY(v), r: 4, fill: col, key: k,
        tip: 'MDB ' + k + '\n' + m.years[i] + '  USD ' + nice(v) + 'm' }, s));
    });
    m.years.forEach((y, i) => { if (i % 2 === 0) txt(s, MX(y), B + 22, String(y), { anchor: 'middle', size: 11.5, weight: 600, fill: DARK }); });
    const ly = legend(s, L1, B + 52, cats.map(x => [x[2], x[1], x[0]]));
    finish(s, W, footer(s, W, ly + 2, c.source + '. MDB panel: ' + m.source, pad));
  }

  // ---------------------------------------------------------------- f05
  function f05(host, D) {
    const d = D.f05_sankey_2023;
    const W = 1000, pad = 26, s = svg(host, W, 820);
    const top = chrome(s, W, 'Where 2023 money came from, what shape it took, and where it landed',
      'USD bn committed to adaptation in Africa. Band width is value', d.source, pad) + 26;
    const H = 560, NW = 17, GAP = 11;
    const ICOL = { 'Grants': LIME, 'Concessional debt': '#6E9E94', 'Market-rate debt': TEAL, 'Equity': '#24534A' };
    const cols = [
      { items: Object.entries(d.sources), x: 196, anchor: 'left' },
      { items: Object.entries(d.instruments), x: 486, anchor: 'mid' },
      { items: Object.entries(d.sectors), x: W - 236, anchor: 'right' }
    ];
    cols.forEach(c => {
      const tot = c.items.reduce((a, b) => a + b[1], 0);
      const span = H - (c.items.length - 1) * GAP;
      let y = top;
      c.nodes = {};
      c.items.forEach(([k, v]) => { const h = v / tot * span; c.nodes[k] = { y0: y, y1: y + h, v: v, out: y, in: y }; y += h + GAP; });
      c.total = tot;
    });
    function band(x1, a1, b1, x2, a2, b2, fill, tip) {
      const mx = (x1 + x2) / 2;
      el('path', {
        d: `M${x1},${a1}C${mx},${a1} ${mx},${a2} ${x2},${a2}L${x2},${b2}C${mx},${b2} ${mx},${b1} ${x1},${b1}Z`,
        fill: fill, opacity: 0.42, tip: tip
      }, s);
    }
    // sources -> instruments, taken straight from the published joint splits
    const order = Object.keys(d.sources);
    order.forEach(src => {
      Object.keys(d.instruments).forEach(ins => {
        const v = d.flows_si[src + ' -> ' + ins];
        if (!v) return;
        const A = cols[0].nodes[src], B = cols[1].nodes[ins];
        const ha = v / cols[0].total * (H - (cols[0].items.length - 1) * GAP);
        const hb = v / cols[1].total * (H - (cols[1].items.length - 1) * GAP);
        band(cols[0].x + NW, A.out, A.out + ha, cols[1].x, B.in, B.in + hb, ICOL[ins],
          src + ' \u2192 ' + ins + '\nUSD ' + v.toFixed(2) + 'bn');
        A.out += ha; B.in += hb;
      });
    });
    // instruments -> sectors: the source publishes no joint split, so each instrument is
    // spread across sectors in the sector totals' own proportions
    Object.keys(d.instruments).forEach(ins => {
      const B = cols[1].nodes[ins];
      Object.keys(d.sectors).forEach(sec => {
        const v = d.instruments[ins] * d.sectors[sec] / cols[2].total;
        const hb = v / cols[1].total * (H - (cols[1].items.length - 1) * GAP);
        const hc = v / cols[2].total * (H - (cols[2].items.length - 1) * GAP);
        const C = cols[2].nodes[sec];
        band(cols[1].x + NW, B.out, B.out + hb, cols[2].x, C.in, C.in + hc, ICOL[ins],
          ins + ' \u2192 ' + sec + '\nUSD ' + v.toFixed(2) + 'bn (allocated pro rata)');
        B.out += hb; C.in += hc;
      });
    });
    cols.forEach((c, ci) => {
      c.items.forEach(([k, v]) => {
        const n = c.nodes[k];
        el('rect', { x: c.x, y: n.y0, width: NW, height: Math.max(2, n.y1 - n.y0), rx: 2, fill: ci === 1 ? (ICOL[k] || TEAL) : INK,
          tip: k + '\nUSD ' + v.toFixed(2) + 'bn  \u2014  ' + (v / c.total * 100).toFixed(0) + '% of the '
            + ['sources', 'instruments', 'sectors'][ci] + ' column' }, s);
        const lbl = `${k}  ${v.toFixed(1)}`;
        if (ci === 0) txt(s, c.x - 9, (n.y0 + n.y1) / 2, lbl, { anchor: 'end', base: 'middle', size: 11.5, fill: DARK });
        else if (ci === 1) halo(txt(s, c.x + NW + 8, (n.y0 + n.y1) / 2, lbl, { base: 'middle', size: 11.5, weight: 600, fill: DARK }));
        else txt(s, c.x + NW + 9, (n.y0 + n.y1) / 2, lbl, { base: 'middle', size: 11.5, fill: DARK });
      });
    });
    ['Sources', 'Instruments', 'Sectors'].forEach((t, i) => {
      const x = i === 0 ? cols[0].x - 9 : cols[i].x + (i === 2 ? NW + 9 : NW + 8);
      txt(s, x, top - 14, t, { anchor: i === 0 ? 'end' : 'start', size: 12, weight: 700, fill: GREY, track: '.06em' });
    });
    finish(s, W, footer(s, W, top + H + 16, d.source, pad));
  }

  // ---------------------------------------------------------------- f06
  function f06(host, D) {
    const d = D.f06_institution_shares;
    const sets = [['2019/20', MID], ['2017-23', '#6E9E94'], ['2023', TEAL]];
    const W = 1000, pad = 26, s = svg(host, W, 560);
    const top = chrome(s, W, 'Multilateral DFIs and bilateral governments provide four fifths of the money, and the private share barely moves',
      'Share of adaptation finance to Africa, per cent, on three vintages of the same accounting', d.source, pad) + 22;
    const L = 250, R = W - 60, rh = 52, bh = 13;
    const X = v => L + v / 60 * (R - L);
    gridX(s, top - 8, top + d.types.length * rh - 18, X, [0, 10, 20, 30, 40, 50, 60], g => g + '%');
    d.types.forEach((t, i) => {
      const y = top + i * rh;
      txt(s, L - 14, y + 20, t, { anchor: 'end', base: 'middle', size: 12.5, weight: 600, fill: DARK });
      sets.forEach(([k, col], j) => {
        const v = d[k][i], by = y + j * (bh + 3);
        el('rect', { x: L, y: by, width: Math.max(1, X(v) - L), height: bh, fill: col, rx: 2, key: k,
          tip: t + '\n' + k + '  ' + v + '% of adaptation finance to Africa' }, s);
        txt(s, X(v) + 7, by + bh / 2 + 1, v + '%', { base: 'middle', size: 11, fill: GREY });
      });
    });
    const ly = legend(s, L, top + d.types.length * rh + 24, sets.map(x => [x[1], x[0], x[0]]));
    finish(s, W, footer(s, W, ly, d.source, pad));
  }

  // ---------------------------------------------------------------- f07
  function f07(host, D) {
    const d = D.f07_institution_stage_matrix;
    const W = 1000, pad = 26, s = svg(host, W, 620);
    const top = chrome(s, W, 'Everyone crowds into implementation; operations, maintenance and MRV are left to domestic budgets',
      'Shading is presence and intensity of activity, from absent to dominant. Cell notes give the order of magnitude',
      'Analyst synthesis of the fund and MDB reporting cited throughout Part III', pad) + 58;
    const L = 210, cw = (W - pad - L) / d.stages.length, rh = 60;
    const LV = ['absent', 'marginal', 'active', 'dominant'];
    d.stages.forEach((st, j) => {
      const x = L + j * cw + cw / 2;
      txt(s, x, top - 12, st, { anchor: 'middle', size: 11.5, weight: 600, fill: DARK });
    });
    d.types.forEach((t, i) => {
      const y = top + i * rh;
      txt(s, L - 12, y + rh / 2, t, { anchor: 'end', base: 'middle', size: 12, weight: 600, fill: DARK });
      d.stages.forEach((st, j) => {
        const v = d.intensity[i][j], fill = v === 0 ? '#F3F1EE' : ramp(0.18 + v / 3 * 0.82);
        el('rect', { x: L + j * cw + 2, y: y + 2, width: cw - 4, height: rh - 6, rx: 3, fill: fill,
          tip: t + '\n' + st + '\nActivity: ' + LV[v] + (d.labels[i][j] ? '\n' + d.labels[i][j] : '') }, s);
        const lab = d.labels[i][j];
        if (lab) txt(s, L + j * cw + cw / 2, y + rh / 2, lab,
          { anchor: 'middle', base: 'middle', size: 10.5, weight: 600, fill: ink(fill) });
      });
    });
    let ly = top + d.types.length * rh + 26;
    ['Absent', 'Marginal', 'Active', 'Dominant'].forEach((l, v) => {
      const fill = v === 0 ? '#F3F1EE' : ramp(0.18 + v / 3 * 0.82);
      el('rect', { x: L + v * 130, y: ly - 12, width: 16, height: 16, rx: 2, fill: fill }, s);
      txt(s, L + v * 130 + 24, ly - 4, l, { size: 12, fill: DARK });
    });
    finish(s, W, footer(s, W, ly + 10, 'Analyst synthesis of the fund and MDB reporting cited throughout Part III. *South-South figure is indicative', pad));
  }

  // ---------------------------------------------------------------- f08
  function f08(host, D) {
    const d = D.f08_instrument_mix;
    const keys = [['Grants', LIME], ['Concessional debt', '#8AB01C'], ['Market-rate debt', TEAL],
      ['Equity', '#24534A'], ['Unknown', PALE]];
    const W = 1000, pad = 26, s = svg(host, W, 560);
    const top = chrome(s, W, 'Grants still carry the mix, but market-rate debt went from nothing to a quarter in six years',
      'Adaptation finance to Africa by instrument, USD bn committed', d.source, pad) + 14;
    const L = 60, R = W - 40, B = 450, ymax = 16;
    const Y = v => B - v / ymax * (B - top);
    gridY(s, L, R, Y, [0, 4, 8, 12, 16]);
    const n = d.years.length, gw = (R - L) / n, bw = gw * 0.58;
    d.years.forEach((yr, i) => {
      let acc = 0;
      const x = L + i * gw + (gw - bw) / 2;
      keys.forEach(([k, col]) => {
        const v = d[k][i];
        if (v <= 0) return;
        el('rect', { x: x, y: Y(acc + v), width: bw, height: Y(acc) - Y(acc + v), fill: col, key: k,
          tip: k + '\n' + yr + '  USD ' + v.toFixed(1) + 'bn' }, s);
        if (v >= 1.2) txt(s, x + bw / 2, (Y(acc) + Y(acc + v)) / 2, v.toFixed(1),
          { anchor: 'middle', base: 'middle', size: 11.5, weight: 600, fill: ink(col) });
        acc += v;
      });
      txt(s, L + i * gw + gw / 2, B + 22, String(yr), { anchor: 'middle', size: 13, weight: 600, fill: DARK });
      txt(s, L + i * gw + gw / 2, Y(acc) - 9, acc.toFixed(1), { anchor: 'middle', size: 12, weight: 700, fill: INK });
    });
    const ly = legend(s, L, B + 52, keys.map(k => [k[1], k[0], k[0]]));
    txt(s, 16, (top + B) / 2, 'USD billion', { anchor: 'middle', size: 12.5, fill: GREY })
      .setAttribute('transform', `rotate(-90 16 ${(top + B) / 2})`);
    finish(s, W, footer(s, W, ly, d.source, pad));
  }

  // ---------------------------------------------------------------- f09
  function f09(host, D) {
    const d = D.f09_grant_share_debt_share, rows = d.dumbbell, deb = d.debt;
    const W = 1000, pad = 26, s = svg(host, W, 520);
    const top = chrome(s, W, 'Africa keeps a high grant share, and still carries the highest debt share of any region',
      'Left: grant share of adaptation finance, per cent, earliest to latest reading', deb.source, pad) + 18;
    const L = 300, R = 700, rh = 56;
    const X = v => L + v / 80 * (R - L);
    gridX(s, top - 10, top + rows.length * rh - 22, X, [0, 20, 40, 60, 80], g => g + '%');
    rows.forEach(([label, a, b, ta, tb], i) => {
      const y = top + i * rh;
      txt(s, L - 16, y, label, { anchor: 'end', base: 'middle', size: 12.5, weight: 600, fill: DARK });
      el('line', { x1: X(Math.min(a, b)), x2: X(Math.max(a, b)), y1: y, y2: y, stroke: '#DDD9D4', 'stroke-width': 6, 'stroke-linecap': 'round' }, s);
      el('circle', { cx: X(a), cy: y, r: 7.5, fill: MID, tip: label + '\nGrant share ' + a + '% in ' + ta }, s);
      el('circle', { cx: X(b), cy: y, r: 7.5, fill: b >= a ? TEAL : LIME,
        tip: label + '\nGrant share ' + b + '% in ' + tb + '\n' + (b >= a ? 'up ' : 'down ') + Math.abs(b - a) + ' points since ' + ta }, s);
      txt(s, X(a), y - 15, `${a}% (${ta})`, { anchor: 'middle', size: 11, fill: MID });
      txt(s, X(b), y + 22, `${b}% (${tb})`, { anchor: 'middle', size: 11, weight: 600, fill: b >= a ? TEAL : '#6E8F16' });
    });
    // debt-share panel
    const py = top + rows.length * rh + 18, pl = 300, pr = 700;
    txt(s, pl, py, 'Debt share of climate finance, latest reading', { size: 12.5, weight: 700, fill: INK });
    const regs = ['Africa', 'Latin America & Caribbean', 'East Asia & Pacific'];
    regs.forEach((r, i) => {
      const y = py + 24 + i * 30;
      txt(s, pl - 16, y + 8, r, { anchor: 'end', base: 'middle', size: 12, fill: DARK });
      const w = deb[r] / 60 * (pr - pl);
      el('rect', { x: pl, y: y, width: w, height: 16, rx: 2, fill: i === 0 ? TEAL : PALE,
        tip: r + '\nDebt is ' + deb[r] + '% of climate finance' }, s);
      txt(s, pl + w + 8, y + 8, deb[r] + '%', { base: 'middle', size: 11.5, weight: 600, fill: i === 0 ? TEAL : GREY });
    });
    const ly = py + 24 + regs.length * 30 + 6;
    finish(s, W, footer(s, W, ly, 'CPI Landscape of Climate Finance in Africa 2024; GCA & CPI 2025; OECD 2026', pad));
  }

  // ---------------------------------------------------------------- f10
  function f10(host, D) {
    const d = D.f10_fund_instruments;
    const keys = [['Grants', LIME], ['Concessional loans', TEAL], ['Equity', '#24534A'],
      ['Guarantees', '#6E9E94'], ['Results-based payments', MID]];
    const W = 1000, pad = 26, s = svg(host, W, 470);
    const top = chrome(s, W, 'Three of the five dedicated funds are grant-only; the GCF is the one running a real balance sheet',
      'Share of committed volume by instrument, per cent', d.source, pad) + 12;
    const L = 300, R = W - 60, bh = 36, gap = 22;
    d.funds.forEach((f, i) => {
      const y = top + i * (bh + gap);
      txt(s, L - 14, y + bh / 2, f, { anchor: 'end', base: 'middle', size: 12.5, weight: 600, fill: DARK });
      let x = L;
      keys.forEach(([k, col]) => {
        const v = d[k][i];
        if (!v) return;
        const w = v / 100 * (R - L);
        el('rect', { x: x, y: y, width: w, height: bh, fill: col, key: k, tip: f + '\n' + k + '  ' + v + '% of committed volume' }, s);
        if (w > 38) txt(s, x + w / 2, y + bh / 2, v + '%', { anchor: 'middle', base: 'middle', size: 12, weight: 600, fill: ink(col) });
        x += w;
      });
    });
    const ly = legend(s, L, top + d.funds.length * (bh + gap) + 10, keys.map(k => [k[1], k[0], k[0]]), { size: 12 });
    finish(s, W, footer(s, W, ly, d.source, pad));
  }

  // ---------------------------------------------------------------- f11
  function f11(host, D) {
    const a = D.f11_arc_rsf.arc, rsf = D.f11_arc_rsf.rsf;
    const W = 1000, pad = 26, s = svg(host, W, 640);
    const top = chrome(s, W, 'Parametric payouts stay small and lumpy while the IMF facility moves an order of magnitude more',
      'Left: ARC payouts by year, USD m. Right: IMF Resilience and Sustainability Facility arrangements, USD m',
      a.source, pad) + 18;
    // ARC columns
    const L = 62, R = 470, B = 300, ymax = 50;
    const Y = v => B - v / ymax * (B - top);
    gridY(s, L, R, Y, [0, 10, 20, 30, 40, 50]);
    const gw = (R - L) / a.years.length, bw = gw * 0.62;
    a.years.forEach((yr, i) => {
      const v = a.payout[i], x = L + i * gw + (gw - bw) / 2;
      if (v > 0) {
        el('rect', { x: x, y: Y(v), width: bw, height: B - Y(v), fill: TEAL, rx: 2,
          tip: 'ARC payout, ' + yr + '\nUSD ' + v.toFixed(1) + 'm' }, s);
        txt(s, x + bw / 2, Y(v) - 7, v.toFixed(1), { anchor: 'middle', size: 10.5, weight: 700, fill: TEAL });
      }
      txt(s, x + bw / 2, B + 18, String(yr).slice(2), { anchor: 'middle', size: 11, fill: MID });
    });
    txt(s, L, B + 44, 'Cumulative ARC payouts: USD 206m against USD 1.74bn of cover',
      { size: 11.5, fill: GREY });
    // RSF bars
    const RL = 660, RR = W - 74, rh = 27;
    const rows = rsf.slice().sort((p, q) => q[1] - p[1]);
    const rmax = 1000;
    txt(s, RL - 14, top - 12, 'IMF RSF arrangements, USD m', { anchor: 'end', size: 12, weight: 700, fill: GREY });
    rows.forEach((r, i) => {
      const y = top + i * rh;
      txt(s, RL - 12, y + 9, r[0], { anchor: 'end', base: 'middle', size: 11.5, fill: DARK });
      const w = r[1] / rmax * (RR - RL);
      el('rect', { x: RL, y: y + 2, width: Math.max(1.5, w), height: 15, rx: 2, fill: ramp(0.35 + r[1] / rmax * 0.55),
        tip: r[0] + '\nIMF RSF arrangement  USD ' + nice(r[1]) + 'm' }, s);
      txt(s, RL + w + 7, y + 9, nice(r[1]), { base: 'middle', size: 10.5, fill: GREY });
    });
    const tot = rsf.reduce((x, r) => x + r[1], 0);
    const bottom = Math.max(B + 60, top + rows.length * rh + 14);
    txt(s, RL - 12, bottom, `18 arrangements, USD ${nice(tot)}m committed`, { anchor: 'end', size: 11.5, weight: 600, fill: INK });
    finish(s, W, footer(s, W, bottom + 8, a.source + '. RSF: IMF arrangement listings to April 2026', pad));
  }

  // ---------------------------------------------------------------- f12
  function squarify(items, x, y, w, h) {
    const out = [];
    let rest = items.slice().sort((a, b) => b.value - a.value);
    let X = x, Y = y, W = w, H = h;
    const total = rest.reduce((a, b) => a + b.value, 0);
    const k = (W * H) / total;
    const worst = (row, len) => {
      const sum = row.reduce((a, b) => a + b.value * k, 0);
      const mx = Math.max.apply(null, row.map(r => r.value * k));
      const mn = Math.min.apply(null, row.map(r => r.value * k));
      return Math.max(len * len * mx / (sum * sum), (sum * sum) / (len * len * mn));
    };
    while (rest.length) {
      const vertical = W >= H, len = vertical ? H : W;
      const row = [rest[0]];
      let i = 1;
      while (i < rest.length && worst(row.concat([rest[i]]), len) <= worst(row, len)) { row.push(rest[i]); i++; }
      const sum = row.reduce((a, b) => a + b.value * k, 0), thick = sum / len;
      let off = 0;
      row.forEach(r => {
        const side = r.value * k / thick;
        out.push(vertical
          ? { name: r.name, value: r.value, x: X, y: Y + off, w: thick, h: side }
          : { name: r.name, value: r.value, x: X + off, y: Y, w: side, h: thick });
        off += side;
      });
      if (vertical) { X += thick; W -= thick; } else { Y += thick; H -= thick; }
      rest = rest.slice(row.length);
    }
    return out;
  }

  function f12(host, D) {
    const d = D.f12_sector_treemap;
    const items = Object.keys(d).map(k => ({ name: k, value: d[k] }));
    const W = 1000, pad = 26, s = svg(host, W, 660);
    const top = chrome(s, W, 'A quarter goes to agriculture, a fifth to policy and budget support, and another fifth is unspecified',
      'Share of adaptation finance to Africa by sector, per cent. Area is share',
      'GCA & CPI 2025, Figure 8', pad) + 8;
    const H = 470;
    const rects = squarify(items, pad, top, W - pad * 2, H);
    const mx = Math.max.apply(null, items.map(i => i.value));
    rects.forEach(r => {
      const fill = ramp(0.15 + r.value / mx * 0.85);
      el('rect', { x: r.x + 1.5, y: r.y + 1.5, width: Math.max(0, r.w - 3), height: Math.max(0, r.h - 3), rx: 3, fill: fill,
        tip: r.name + '\n' + r.value + '% of adaptation finance\nUSD ' + (14.8 * r.value / 100).toFixed(2) + 'bn of the USD 14.8bn tracked in 2023' }, s);
      if (r.w < 74 || r.h < 52) return;                  // no room for a legible label
      const c = ink(fill), sz = r.w > 150 ? 13 : 11;
      const room = Math.max(1, Math.floor((r.h - 40) / (sz + 3)));
      const lines = wrap(r.name, r.w - 20, sz, 600).slice(0, room);
      let ty = r.y + sz + 9;
      lines.forEach(l => { txt(s, r.x + 11, ty, l, { size: sz, weight: 600, fill: c }); ty += sz + 3; });
      txt(s, r.x + 11, ty + (r.w > 150 ? 16 : 11), r.value + '%', { size: r.w > 150 ? 20 : 14, weight: 700, fill: c });
    });
    finish(s, W, footer(s, W, top + H + 8, 'GCA & CPI 2025, Figure 8. Shares are of USD 14.8bn tracked in 2023', pad));
  }

  // ---------------------------------------------------------------- f13
  function f13(host, D) {
    const d = D.f13_sector_trend;
    const keys = [['Cross-sectoral (policy, DRM, other)', TEAL], ['Agriculture, forestry, land use', LIME],
      ['Water and wastewater', '#6E9E94'], ['Transport', '#24534A'], ['Buildings and energy', MID]];
    const W = 1000, pad = 26, s = svg(host, W, 560);
    const top = chrome(s, W, 'Every sector grew, but cross-sectoral policy and budget support grew fastest and now leads',
      'Adaptation finance to Africa by sector, USD bn. Gaps are unreported, filled by interpolation', d.source, pad) + 14;
    const L = 62, R = W - 320, B = 450, ymax = 16;
    const n = d.periods.length;
    const X = i => L + i / (n - 1) * (R - L);
    const Y = v => B - v / ymax * (B - top);
    gridY(s, L, R, Y, [0, 4, 8, 12, 16]);
    // fill unreported points so the stack stays continuous
    const vals = keys.map(([k]) => d[k].map((v, i) => {
      if (v !== null) return v;
      let a = null, b = null;
      for (let j = i - 1; j >= 0; j--) if (d[k][j] !== null) { a = [j, d[k][j]]; break; }
      for (let j = i + 1; j < n; j++) if (d[k][j] !== null) { b = [j, d[k][j]]; break; }
      if (a && b) return a[1] + (b[1] - a[1]) * (i - a[0]) / (b[0] - a[0]);
      return (a || b || [0, 0])[1];
    }));
    const acc = new Array(n).fill(0);
    // label positions first: the thin bands would otherwise stack their labels
    let probe = 0;
    const labY = spread(keys.map((x, j) => { const m = probe + vals[j][n - 1] / 2; probe += vals[j][n - 1]; return Y(m); }), 34);
    keys.forEach(([k, col], j) => {
      const lower = acc.slice();
      const upper = acc.map((a, i) => a + vals[j][i]);
      const up = upper.map((v, i) => `${X(i)},${Y(v)}`).join('L');
      const dn = lower.map((v, i) => `${X(i)},${Y(v)}`).reverse().join('L');
      el('path', { d: `M${up}L${dn}Z`, fill: col, opacity: 0.9, key: k }, s);
      const li = n - 1, ly = labY[j];
      el('line', { x1: R + 2, y1: (Y(upper[li]) + Y(lower[li])) / 2, x2: R + 10, y2: ly, stroke: col, 'stroke-width': 1.4 }, s);
      txt(s, R + 14, ly, k, { base: 'middle', size: 12, weight: 600, fill: DARK, key: k });
      txt(s, R + 14, ly + 15, 'USD ' + vals[j][li].toFixed(1) + 'bn ' + (d[k][li] === null ? '(est.)' : ''),
        { base: 'middle', size: 11, fill: MID, key: k });
      upper.forEach((v, i) => { acc[i] = v; });
    });
    d.periods.forEach((p, i) => {
      el('line', { x1: X(i), x2: X(i), y1: top, y2: B, stroke: '#fff', 'stroke-width': 1, opacity: 0.5 }, s);
      txt(s, X(i), B + 22, p, { anchor: 'middle', size: 13, weight: 600, fill: DARK });
    });
    // the stack is read by period, since a single band tells you little on its own
    bands(s, top, B, d.periods.map((p, i) => X(i)), i => d.periods[i] + '\n'
      + keys.map(([k], j) => k + '  USD ' + vals[j][i].toFixed(1) + 'bn' + (d[k][i] === null ? ' (est.)' : '')).join('\n')
      + '\nTotal  USD ' + vals.reduce((a, v) => a + v[i], 0).toFixed(1) + 'bn');
    txt(s, L, B + 46, 'Total, ' + d.periods[n - 1] + ': USD ' + acc[n - 1].toFixed(1) + 'bn', { size: 12, weight: 600, fill: INK });
    finish(s, W, footer(s, W, B + 62, d.source, pad));
  }

  // ---------------------------------------------------------------- f14
  function f14(host, D) {
    const d = D.f14_fund_fingerprint, names = Object.keys(d.rows);
    const W = 1000, pad = 26, s = svg(host, W, 560);
    const top = chrome(s, W, 'Each fund has its own sector fingerprint; agriculture and water are the only constants',
      'Share of each portfolio by sector, per cent. Rows sum to 100', d.source, pad) + 66;
    const L = 250, cw = (W - pad - L) / d.cols.length, rh = 54;
    d.cols.forEach((c, j) => {
      const x = L + j * cw + cw / 2;
      wrap(c, 92, 11, 600).forEach((l, li) => txt(s, x, top - 30 + li * 13, l, { anchor: 'middle', size: 11, weight: 600, fill: DARK }));
    });
    names.forEach((nm, i) => {
      const y = top + i * rh, row = d.rows[nm];
      txt(s, L - 12, y + rh / 2, nm, { anchor: 'end', base: 'middle', size: 12, weight: 600, fill: DARK });
      row.forEach((v, j) => {
        const fill = v === 0 ? '#F3F1EE' : ramp(0.12 + v / 45 * 0.88);
        el('rect', { x: L + j * cw + 2, y: y + 2, width: cw - 4, height: rh - 6, rx: 3, fill: fill,
          tip: nm + '\n' + d.cols[j] + '\n' + (v > 0 ? v.toFixed(1) + '% of the portfolio' : 'Nothing in this sector') }, s);
        if (v > 0) txt(s, L + j * cw + cw / 2, y + rh / 2, v.toFixed(v < 10 ? 1 : 0),
          { anchor: 'middle', base: 'middle', size: 12, weight: 600, fill: ink(fill) });
      });
    });
    let ly = top + names.length * rh + 26;
    txt(s, L, ly - 4, 'Share of portfolio', { size: 11.5, fill: GREY });
    for (let i = 0; i <= 40; i += 1) el('rect', { x: L + 130 + i * 4, y: ly - 17, width: 4, height: 14, fill: ramp(0.12 + (i / 40) * 0.88) }, s);
    txt(s, L + 128, ly - 4, '0', { anchor: 'end', size: 11, fill: MID });
    txt(s, L + 298, ly - 4, '45%', { size: 11, fill: MID });
    finish(s, W, footer(s, W, ly + 6, d.source, pad));
  }

  // ---------------------------------------------------------------- f15
  function f15(host, D) {
    const rows = D.f15_project_size.slice().sort((a, b) => a[1] - b[1]);
    const W = 1000, pad = 26, s = svg(host, W, 640);
    const top = chrome(s, W, 'Climate-fund projects are one to two orders of magnitude smaller than the MDB projects they sit beside',
      'Median or average project size, USD m, log scale',
      'CFU/ODI climate funds database 2025; GCF portfolio dashboard 2026; WRI AdapTDR 2025', pad) + 12;
    const L = 330, R = W - 90, rh = 30;
    const lo = Math.log10(2), hi = Math.log10(2000);
    const X = v => L + (Math.log10(Math.max(v, 2)) - lo) / (hi - lo) * (R - L);
    gridX(s, top - 8, top + rows.length * rh - 12, X, [2, 10, 100, 1000], g => nice(g));
    rows.forEach(([label, v, kind], i) => {
      const y = top + i * rh;
      txt(s, L - 12, y + 11, label, { anchor: 'end', base: 'middle', size: 11.5, fill: DARK });
      const col = kind === 'fund' ? LIME : TEAL;
      el('rect', { x: L, y: y + 4, width: Math.max(2, X(v) - L), height: 15, rx: 2, fill: col, key: kind,
        tip: label + '\nUSD ' + nice(v) + 'm typical project\n' + (kind === 'fund' ? 'Dedicated climate fund' : 'MDB adaptation project') }, s);
      txt(s, X(v) + 8, y + 11, nice(v), { base: 'middle', size: 11, weight: 600, fill: kind === 'fund' ? '#6E8F16' : TEAL });
    });
    const ly = legend(s, L, top + rows.length * rh + 26,
      [[LIME, 'Dedicated climate funds', 'fund'], [TEAL, 'MDB adaptation projects (WRI AdapTDR)', 'mdb']]);
    finish(s, W, footer(s, W, ly, 'CFU/ODI climate funds database 2025; GCF portfolio dashboard 2026; WRI AdapTDR 2025', pad));
  }

  // ---------------------------------------------------------------- f18
  function f18(host, D) {
    const f = D.f18_gcf_funnel.funnel, t = D.f18_gcf_funnel.times;
    const W = 1000, pad = 26, s = svg(host, W, 560);
    const top = chrome(s, W, 'The GCF pipeline is deep and the disbursement end is narrow: a third of approvals has reached the ground',
      'Left: projects and proposals, counts. Right: months from first contact to first disbursement',
      'GCF portfolio dashboard and pipeline, July 2026; Adaptation Fund APR 2025; GEF AMR FY24 and FY25', pad) + 16;
    const keys = Object.keys(f);
    const L = 330, R = 640, rh = 54, mx = 320;
    keys.forEach((k, i) => {
      const y = top + i * rh, v = f[k];
      txt(s, L - 12, y + 16, k, { anchor: 'end', base: 'middle', size: 12, weight: 600, fill: DARK });
      const w = v / mx * (R - L);
      el('rect', { x: L, y: y, width: Math.max(2, w), height: 32, rx: 3, fill: ramp(0.3 + v / mx * 0.6),
        tip: k + '\n' + v + ' projects'
          + (i ? '\n' + (v / f[keys[0]] * 100).toFixed(0) + '% of the ' + f[keys[0]] + ' in the pipeline' : '') }, s);
      txt(s, L + w + 9, y + 16, String(v), { base: 'middle', size: 13, weight: 700, fill: TEAL });
    });
    // approval-to-disbursement times
    const TL = 760, TR = W - 40, tmax = 42;
    txt(s, TL, top - 12, 'Months, approval cycle', { size: 11.5, weight: 700, fill: GREY });
    t.forEach((r, i) => {
      const y = top + i * rh;
      wrap(r[0], 300, 11.5, 500).forEach((l, li) => txt(s, TL - 12, y + 8 + li * 13, l, { anchor: 'end', size: 11.5, fill: DARK }));
      const w1 = r[1] / tmax * (TR - TL), w2 = (r[2] || 0) / tmax * (TR - TL);
      el('rect', { x: TL, y: y, width: w1, height: 15, rx: 2, fill: TEAL, key: 'appr',
        tip: r[0] + '\nTo approval  ' + r[1].toFixed(1) + ' months' }, s);
      if (w2) el('rect', { x: TL + w1, y: y, width: w2, height: 15, rx: 2, fill: LIME, key: 'disb',
        tip: r[0] + '\nApproval to first disbursement  ' + r[2].toFixed(1) + ' months' }, s);
      txt(s, TL + w1 + w2 + 8, y + 8, (r[1] + (r[2] || 0)).toFixed(1), { base: 'middle', size: 11, weight: 600, fill: GREY });
    });
    let ly = top + Math.max(keys.length, t.length) * rh + 16;
    ly = legend(s, TL - 250, ly, [[TEAL, 'To approval', 'appr'], [LIME, 'Approval to first disbursement', 'disb']], { size: 11.5 });
    finish(s, W, footer(s, W, ly, 'GCF portfolio dashboard and pipeline, July 2026; Adaptation Fund APR 2025; GEF AMR FY24 and FY25', pad));
  }

  // ---------------------------------------------------------------- f19
  function f19(host, D) {
    const rows = D.f19_prep_facilities.map(r => ({ name: r[0], spend: r[1], unlocked: r[2], note: r[3], lev: r[2] / r[1] }))
      .sort((a, b) => b.lev - a.lev);
    const W = 1000, pad = 26, s = svg(host, W, 500);
    const top = chrome(s, W, 'Preparation money is the cheapest leverage in the system, and the facilities are all small',
      'Investment unlocked per dollar of preparation spend. Labels give the preparation budget and what it unlocked, USD m',
      'Facility annual reports 2024 and 2025; GCF PPF portfolio; PIDG results 2024', pad) + 14;
    const L = 340, R = W - 260, rh = 48, mx = 130;
    const X = v => L + v / mx * (R - L);
    gridX(s, top - 8, top + rows.length * rh - 16, X, [0, 25, 50, 75, 100, 125], g => g + 'x');
    rows.forEach((r, i) => {
      const y = top + i * rh;
      txt(s, L - 14, y + 14, r.name, { anchor: 'end', base: 'middle', size: 12.5, weight: 600, fill: DARK });
      txt(s, L - 14, y + 29, r.note, { anchor: 'end', base: 'middle', size: 10.5, fill: MID });
      el('rect', { x: L, y: y + 4, width: Math.max(2, X(r.lev) - L), height: 21, rx: 2, fill: ramp(0.3 + r.lev / mx * 0.6),
        tip: r.name + '\n' + r.lev.toFixed(0) + 'x leverage\nUSD ' + nice(r.spend) + 'm spent unlocked USD ' + nice(r.unlocked) + 'm\n' + r.note }, s);
      txt(s, X(r.lev) + 9, y + 15, r.lev.toFixed(0) + 'x', { base: 'middle', size: 13, weight: 700, fill: TEAL });
      txt(s, R + 40, y + 15, `USD ${nice(r.spend)}m to unlock USD ${nice(r.unlocked)}m`, { base: 'middle', size: 11, fill: GREY });
    });
    finish(s, W, footer(s, W, top + rows.length * rh + 10, 'Facility annual reports 2024 and 2025; GCF PPF portfolio; PIDG results 2024', pad));
  }

  // ---------------------------------------------------------------- f20
  function f20(host, D) {
    const d = D.f20_disaster_finance, f = d.frld, dd = d.cat_ddo;
    const W = 1000, pad = 26, s = svg(host, W, 520);
    const top = chrome(s, W, 'The loss and damage fund has pledges, an envelope, and nothing allocated to Africa yet',
      'Left: Fund for responding to Loss and Damage, USD m. Right: World Bank Cat DDO contingent credit lines, USD m',
      d.source, pad) + 16;
    const L = 260, R = 560, rh = 56, mx = 3000;
    const items = [['Requested by countries', f.requested, MID], ['Pledged', f.pledged, TEAL],
      ['Board-approved envelope', f.envelope, '#6E9E94'], ['Allocated to African countries', f.africa_allocated, LIME]];
    items.forEach(([k, v, col], i) => {
      const y = top + i * rh;
      txt(s, L - 14, y + 15, k, { anchor: 'end', base: 'middle', size: 12.5, weight: 600, fill: DARK });
      const w = v / mx * (R - L);
      if (v > 0) el('rect', { x: L, y: y, width: w, height: 30, rx: 3, fill: col,
        tip: k + '\nUSD ' + nice(v) + 'm' }, s);
      else el('rect', { x: L, y: y + 12, width: 26, height: 5, rx: 2.5, fill: '#C9C4BE',
        tip: k + '\nNothing allocated yet' }, s);
      txt(s, L + Math.max(w, 30) + 10, y + 15, v > 0 ? 'USD ' + nice(v) + 'm' : 'nil',
        { base: 'middle', size: 12.5, weight: 700, fill: v > 0 ? col : GREY });
    });
    const TL = 780, TR = W - 40, trh = 30, tmax = 300;
    txt(s, TL, top - 12, 'Cat DDO lines, USD m', { size: 11.5, weight: 700, fill: GREY });
    dd.forEach((r, i) => {
      const y = top + i * trh;
      txt(s, TL - 12, y + 9, r[0], { anchor: 'end', base: 'middle', size: 11.5, fill: DARK });
      const w = r[1] / tmax * (TR - TL);
      el('rect', { x: TL, y: y + 2, width: Math.max(2, w), height: 15, rx: 2, fill: ramp(0.35 + r[1] / tmax * 0.55),
        tip: r[0] + '\nCat DDO contingent credit line  USD ' + nice(r[1]) + 'm' }, s);
      txt(s, TL + w + 7, y + 9, String(r[1]), { base: 'middle', size: 10.5, fill: GREY });
    });
    const tot = dd.reduce((a, r) => a + r[1], 0);
    const bottom = Math.max(top + items.length * rh, top + dd.length * trh) + 16;
    txt(s, TL - 12, bottom, `Nine countries, USD ${nice(tot)}m of contingent credit`, { anchor: 'end', size: 11.5, weight: 600, fill: INK });
    finish(s, W, footer(s, W, bottom + 8, d.source, pad));
  }

  // ---------------------------------------------------------------- f21
  function f21(host, D) {
    const rows = D.f21_programme_timeline.slice().sort((a, b) => a[1] - b[1]);
    const KIND = {
      'climate fund': TEAL, 'social protection': LIME, 'landscape': '#6E9E94', 'insurance': '#24534A',
      'farmer-led': '#8AB01C', 'research': MID, 'water fund': '#417A70', 'MDB': '#C3DA7C',
      'platform': '#9FC2BA', 'devolved fund': '#657F14'
    };
    const NOW = 2026;
    const W = 1000, pad = 26, s = svg(host, W, 720);
    const top = chrome(s, W, 'The programmes with the strongest evidence are the old ones; most climate-fund vintages are under ten years',
      'Start to close. An open bar is a programme still running in 2026',
      'Programme documents and evaluations as cited in Parts V and VI', pad) + 16;
    const L = 330, R = W - 60, rh = 32, y0 = 1983, y1 = 2031;
    const X = v => L + (v - y0) / (y1 - y0) * (R - L);
    gridX(s, top - 8, top + rows.length * rh - 14, X, [1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025, 2030]);
    el('line', { x1: X(NOW), x2: X(NOW), y1: top - 8, y2: top + rows.length * rh - 14, stroke: LIME, 'stroke-width': 2, 'stroke-dasharray': '4 4' }, s);
    txt(s, X(NOW), top - 16, '2026', { anchor: 'middle', size: 11, weight: 700, fill: '#6E8F16' });
    rows.forEach(([name, a, b, kind], i) => {
      const y = top + i * rh, col = KIND[kind] || MID, open = b === null;
      txt(s, L - 14, y + 11, name, { anchor: 'end', base: 'middle', size: 11.5, fill: DARK });
      const x1 = X(a), x2 = X(open ? NOW : b);
      el('rect', { x: x1, y: y + 4, width: Math.max(3, x2 - x1), height: 15, rx: 3, fill: col, key: kind,
        tip: name + '\n' + (open ? a + ' to date, ' + (NOW - a) + ' years running' : a + ' to ' + b + ', ' + (b - a) + ' years') + '\n' + kind }, s);
      if (open) el('path', { d: `M${x2},${y + 4}L${x2 + 11},${y + 11.5}L${x2},${y + 19}Z`, fill: col, opacity: 0.55 }, s);
      txt(s, x2 + (open ? 17 : 8), y + 11, open ? a + ' to date' : a + '-' + b, { base: 'middle', size: 10.5, fill: MID });
    });
    let ly = top + rows.length * rh + 22;
    ly = legend(s, L - 300, ly, Object.keys(KIND).slice(0, 5).map(k => [KIND[k], k, k]), { size: 11.5 });
    ly = legend(s, L - 300, ly + 4, Object.keys(KIND).slice(5).map(k => [KIND[k], k, k]), { size: 11.5 });
    finish(s, W, footer(s, W, ly, 'Programme documents and evaluations as cited in Parts V and VI', pad));
  }

  // ---------------------------------------------------------------- f22
  function f22(host, D) {
    const raw = D.f22_bcr_range;
    const groups = [];
    raw.forEach(r => {
      let g = groups.find(x => x.name === r[1]);
      if (!g) { g = { name: r[1], rows: [] }; groups.push(g); }
      g.rows.push(r);
    });
    groups.forEach(g => g.rows.sort((a, b) => a[2] - b[2]));
    const W = 1000, pad = 26, s = svg(host, W, 700);
    const top = chrome(s, W, 'Every appraisal in the evidence base clears one to one; the spread runs from 1.1 to 12',
      'Benefit-cost ratio. A bar is a published range, a dot a point estimate',
      'As cited in Part VI. Evidence type is the appraisal basis, not a quality ranking', pad) + 16;
    const L = 400, R = W - 130, rh = 30, mx = 13;
    const X = v => L + v / mx * (R - L);
    let y = top;
    const rows = [];
    groups.forEach(g => { rows.push({ head: g.name }); g.rows.forEach(r => rows.push({ r: r })); });
    gridX(s, top - 8, top + rows.length * rh - 10, X, [0, 2, 4, 6, 8, 10, 12], g => g + ':1');
    el('line', { x1: X(1), x2: X(1), y1: top - 8, y2: top + rows.length * rh - 10, stroke: LIME, 'stroke-width': 2 }, s);
    rows.forEach(item => {
      if (item.head) {
        txt(s, L - 14, y + 15, item.head, { anchor: 'end', base: 'middle', size: 12, weight: 700, fill: INK, track: '.02em' });
        y += rh; return;
      }
      const [name, , lo, hi, ev] = item.r;
      txt(s, L - 14, y + 11, name, { anchor: 'end', base: 'middle', size: 11.5, fill: DARK });
      const col = ev === 'ex post' ? TEAL : (ev === 'modelled' ? '#6E9E94' : LIME);
      if (hi > lo) {
        el('rect', { x: X(lo), y: y + 5, width: X(hi) - X(lo), height: 13, rx: 6.5, fill: col, key: ev,
          tip: name + '\nBenefit-cost ratio ' + lo + ' to ' + hi + ':1\n' + ev + ', ' + item.r[1] }, s);
        txt(s, X(hi) + 9, y + 11, `${lo} to ${hi}`, { base: 'middle', size: 10.5, fill: GREY });
      } else {
        el('circle', { cx: X(lo), cy: y + 11.5, r: 6.5, fill: col, key: ev,
          tip: name + '\nBenefit-cost ratio ' + lo.toFixed(lo % 1 ? 2 : 1) + ':1\n' + ev + ', ' + item.r[1] }, s);
        txt(s, X(lo) + 12, y + 11, lo.toFixed(lo % 1 ? 2 : 1), { base: 'middle', size: 10.5, weight: 600, fill: GREY });
      }
      txt(s, R + 16, y + 11, ev, { base: 'middle', size: 10.5, fill: MID });
      y += rh;
    });
    const ly = legend(s, L - 300, y + 20,
      [[LIME, 'Ex ante appraisal', 'ex ante'], [TEAL, 'Ex post evaluation', 'ex post'], ['#6E9E94', 'Modelled', 'modelled']]);
    finish(s, W, footer(s, W, ly, 'As cited in Part VI. Ranges are the published low and high; a dot is a single published figure', pad));
  }

  // ---------------------------------------------------------------- f23
  function f23(host, D) {
    const d = D.f23_tdr_shares;
    const names = Object.keys(d).filter(k => k !== 'source');
    const parts = [['Avoided losses', TEAL], ['Induced economic benefits', LIME], ['Social and environmental co-benefits', '#6E9E94']];
    const W = 1000, pad = 26, s = svg(host, W, 560);
    const top = chrome(s, W, 'The benchmark splits the triple dividend three ways; almost every real appraisal collapses into one or two',
      'Share of monetised benefits by dividend, per cent', d.source, pad) + 14;
    const L = 330, R = W - 60, bh = 34, gap = 20;
    names.forEach((nm, i) => {
      const y = top + i * (bh + gap), row = d[nm];
      txt(s, L - 14, y + bh / 2, nm, { anchor: 'end', base: 'middle', size: 12, weight: i === 0 ? 700 : 600, fill: i === 0 ? INK : DARK });
      let x = L;
      row.forEach((v, j) => {
        if (!v) return;
        const w = v / 100 * (R - L);
        el('rect', { x: x, y: y, width: w, height: bh, fill: parts[j][1], key: parts[j][0],
          tip: nm + '\n' + parts[j][0] + '  ' + v.toFixed(v % 1 ? 1 : 0) + '% of monetised benefits' }, s);
        if (w > 40) txt(s, x + w / 2, y + bh / 2, v.toFixed(v % 1 ? 1 : 0) + '%',
          { anchor: 'middle', base: 'middle', size: 12, weight: 600, fill: ink(parts[j][1]) });
        x += w;
      });
      if (i === 0) el('line', { x1: L - 6, x2: R + 6, y1: y + bh + gap / 2, y2: y + bh + gap / 2, stroke: GRID }, s);
    });
    const ly = legend(s, L, top + names.length * (bh + gap) + 12, parts.map(p => [p[1], p[0], p[0]]), { size: 12 });
    finish(s, W, footer(s, W, ly, d.source, pad));
  }

  // ---------------------------------------------------------------- f25
  function f25(host, D) {
    const rows = D.f25_need_funnel;
    const W = 1000, pad = 26, s = svg(host, W, 560);
    const top = chrome(s, W, 'From USD 70bn of costed need, roughly one per cent is reaching the local level',
      'USD bn a year. The last two steps are illustrative ratios, not tracked figures',
      'GCA & CPI 2025 for need and commitments; disbursement and local-level ratios are illustrative', pad) + 20;
    const mx = rows[0][1], cx = W / 2, maxW = 640, rh = 96;
    rows.forEach((r, i) => {
      const [label, v, kind] = r;
      const y = top + i * rh;
      const wd = x => 190 + x / mx * (maxW - 190);      // floor the width so labels always fit
      const wTop = wd(v);
      const wBot = wd(i + 1 < rows.length ? rows[i + 1][1] : v * 0.7);
      const fill = kind === 'observed' ? ramp(0.35 + i * 0.2) : '#8AB01C';
      el('path', {
        d: `M${cx - wTop / 2},${y}L${cx + wTop / 2},${y}L${cx + wBot / 2},${y + rh - 16}L${cx - wBot / 2},${y + rh - 16}Z`,
        fill: fill, opacity: kind === 'observed' ? 1 : 0.75,
        tip: label + '\nUSD ' + v.toFixed(1) + 'bn a year\n' + (v / rows[0][1] * 100).toFixed(1) + '% of the USD '
          + rows[0][1].toFixed(0) + 'bn costed need\n' + (kind === 'observed' ? 'Tracked figure' : 'Illustrative ratio, not tracked')
      }, s);
      const c = ink(fill);
      txt(s, cx, y + 30, 'USD ' + v.toFixed(1) + 'bn', { anchor: 'middle', size: 22, weight: 700, fill: c });
      txt(s, cx, y + 52, label, { anchor: 'middle', size: 12, fill: c });
      if (i) {
        const drop = (1 - v / rows[i - 1][1]) * 100;
        txt(s, cx + maxW / 2 + 30, y + 10, '-' + drop.toFixed(0) + '%', { size: 13, weight: 700, fill: '#6E8F16' });
      }
    });
    const ly = top + rows.length * rh + 6;
    finish(s, W, footer(s, W, ly, 'Need: GCA & CPI 2025 (USD 70bn). Commitments: GCA & CPI 2025 for 2023. Disbursement and local-level shares are illustrative ratios drawn from the literature, not tracked data', pad));
  }

  // ---------------------------------------------------------------- f27
  function f27(host, D) {
    const d = D.f27_challenge_heat;
    const W = 1000, pad = 26, s = svg(host, W, 700);
    const top = chrome(s, W, 'Fragile states score acute on nine of thirteen constraints; middle-income countries face a different, narrower set',
      'Analyst coding, 1 low to 4 acute', d.source, pad) + 30;
    const L = 330, cw = 150, rh = 40;
    const LAB = { 1: 'low', 2: 'moderate', 3: 'high', 4: 'acute' };
    d.cols.forEach((c, j) => txt(s, L + j * cw + cw / 2, top - 14, c, { anchor: 'middle', size: 12.5, weight: 700, fill: DARK }));
    d.rows.forEach((r, i) => {
      const y = top + i * rh;
      txt(s, L - 14, y + rh / 2, r, { anchor: 'end', base: 'middle', size: 12, weight: 600, fill: DARK });
      d.cols.forEach((c, j) => {
        const v = d.values[i][j], fill = ramp((v - 1) / 3 * 0.86 + 0.14);
        el('rect', { x: L + j * cw + 2, y: y + 2, width: cw - 4, height: rh - 5, rx: 3, fill: fill,
          tip: r + '\n' + c + '\n' + v + ' \u2014 ' + LAB[v] }, s);
        txt(s, L + j * cw + cw / 2, y + rh / 2, LAB[v], { anchor: 'middle', base: 'middle', size: 11.5, weight: 600, fill: ink(fill) });
      });
    });
    let ly = top + d.rows.length * rh + 26;
    [1, 2, 3, 4].forEach(v => {
      const fill = ramp((v - 1) / 3 * 0.86 + 0.14);
      el('rect', { x: L + (v - 1) * 120, y: ly - 13, width: 16, height: 16, rx: 2, fill: fill }, s);
      txt(s, L + (v - 1) * 120 + 24, ly - 5, v + ' ' + LAB[v], { size: 12, fill: DARK });
    });
    finish(s, W, footer(s, W, ly + 8, d.source, pad));
  }

  // ---------------------------------------------------------------- f28
  function f28(host, D) {
    const sc = D.f28_urban_rural.sectors, gp = D.f28_urban_rural.gap;
    const W = 1000, pad = 26, s = svg(host, W, 620);
    const top = chrome(s, W, 'Rural sectors take the bulk of what can be split, and cities get far less than their share of people',
      'Left: allocable adaptation finance by sector, USD m. Right: urban share of population against urban share of finance',
      sc.source, pad) + 24;
    const cx = 460, half = 200, rh = 44, mx = 3800;
    txt(s, cx - half - 10, top - 12, 'Urban', { anchor: 'end', size: 12, weight: 700, fill: TEAL });
    txt(s, cx + half + 10, top - 12, 'Rural', { size: 12, weight: 700, fill: '#6E8F16' });
    sc.sectors.forEach((sec, i) => {
      const y = top + i * rh, u = sc.urban[i], r = sc.rural[i];
      txt(s, cx, y + 13, sec, { anchor: 'middle', base: 'middle', size: 11.5, weight: 600, fill: DARK });
      const wu = u / mx * half, wr = r / mx * half;
      if (u) {
        el('rect', { x: cx - 60 - wu, y: y + 22, width: wu, height: 15, rx: 2, fill: TEAL,
          tip: sec + '\nUrban  USD ' + nice(u) + 'm' }, s);
        txt(s, cx - 66 - wu, y + 29, nice(u), { anchor: 'end', base: 'middle', size: 10.5, fill: GREY });
      }
      if (r) {
        el('rect', { x: cx + 60, y: y + 22, width: wr, height: 15, rx: 2, fill: LIME,
          tip: sec + '\nRural  USD ' + nice(r) + 'm' }, s);
        txt(s, cx + 66 + wr, y + 29, nice(r), { base: 'middle', size: 10.5, fill: GREY });
      }
    });
    txt(s, cx, top + sc.sectors.length * rh + 12,
      `A further USD ${nice(sc.mixed_total)}m is genuinely mixed and cannot be split`,
      { anchor: 'middle', size: 11.5, fill: GREY });
    // gap panel
    const GL = 760, GR = W - 40, gy = top;
    const gitems = [['Urban share of population', gp.population_urban_share, MID],
      ['Directly tracked as urban', gp.direct_tracked, TEAL],
      ['Sector proxy estimate', gp.sector_proxy, '#6E9E94'],
      ['High case', gp.high_case, LIME]];
    txt(s, GL, gy - 12, 'Per cent', { size: 11.5, weight: 700, fill: GREY });
    gitems.forEach(([k, v, col], i) => {
      const y = gy + i * 62;
      wrap(k, 200, 11.5, 500).forEach((l, li) => txt(s, GL, y + li * 13, l, { size: 11.5, fill: DARK }));
      el('rect', { x: GL, y: y + 22, width: v / 50 * (GR - GL), height: 18, rx: 2, fill: col, tip: k + '\n' + v + '%' }, s);
      txt(s, GL + v / 50 * (GR - GL) + 8, y + 31, v + '%', { base: 'middle', size: 12, weight: 700, fill: col === MID ? GREY : col });
    });
    const bottom = Math.max(top + sc.sectors.length * rh + 26, gy + gitems.length * 62);
    finish(s, W, footer(s, W, bottom, sc.source + '. Gap panel: ' + gp.source, pad));
  }

  // ---------------------------------------------------------------- f29
  function f29(host, D) {
    const d = D.f29_urban_regions;
    const rows = Object.keys(d).map(k => [k, d[k]]).sort((a, b) => b[1] - a[1]);
    const W = 1000, pad = 26, s = svg(host, W, 460);
    const top = chrome(s, W, 'Sub-Saharan Africa gets a quarter of what Latin America gets for urban adaptation',
      'Urban adaptation finance by world region, USD bn a year',
      'CCFLA / CPI, State of Cities Climate Finance 2024', pad) + 12;
    const L = 300, R = W - 120, rh = 40, mx = 3.2;
    const X = v => L + v / mx * (R - L);
    gridX(s, top - 8, top + rows.length * rh - 12, X, [0, 1, 2, 3], g => nice(g));
    rows.forEach(([k, v], i) => {
      const y = top + i * rh, hit = k === 'Sub-Saharan Africa';
      txt(s, L - 14, y + 14, k, { anchor: 'end', base: 'middle', size: 12.5, weight: hit ? 700 : 600, fill: hit ? INK : DARK });
      el('rect', { x: L, y: y + 4, width: Math.max(2, X(v) - L), height: 21, rx: 2, fill: hit ? LIME : ramp(0.3 + v / mx * 0.5),
        tip: k + '\nUSD ' + v.toFixed(2) + 'bn a year of urban adaptation finance' }, s);
      txt(s, X(v) + 9, y + 14, 'USD ' + v.toFixed(2) + 'bn', { base: 'middle', size: 12, weight: hit ? 700 : 500, fill: hit ? '#6E8F16' : GREY });
    });
    finish(s, W, footer(s, W, top + rows.length * rh + 12, 'CCFLA / CPI, State of Cities Climate Finance 2024', pad));
  }

  // ---------------------------------------------------------------- f35
  function f35(host, D) {
    const rows = D.f35_vulnerability_scatter.filter(r =>
      r.ndgain_vulnerability_score !== null && r.multilateral_funds_per_capita_usd !== null && r.population_2023);
    const W = 1000, pad = 26, s = svg(host, W, 640);
    const top = chrome(s, W, 'Vulnerability barely predicts what a country receives; the biggest populations sit at the bottom',
      'ND-GAIN vulnerability against multilateral climate-fund finance per person. Bubble area is population',
      'ND-GAIN 2025; CFU/ODI, GCF, Adaptation Fund, LDCF and PPCR portfolio data; UN WPP 2023', pad) + 16;
    const L = 70, R = W - 250, B = 500;
    const X = v => L + (v - 0.33) / (0.68 - 0.33) * (R - L);
    const lo = Math.log10(0.4), hi = Math.log10(120);
    const Y = v => B - (Math.log10(Math.max(v, 0.4)) - lo) / (hi - lo) * (B - top);
    gridY(s, L, R, Y, [0.4, 1, 3, 10, 30, 100], g => (g < 1 ? '<1' : nice(g)));
    gridX(s, top, B, X, [0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65], g => g.toFixed(2));
    // least-squares fit through log finance, to show how flat the relation is
    const xs = rows.map(r => r.ndgain_vulnerability_score), ys = rows.map(r => Math.log10(Math.max(r.multilateral_funds_per_capita_usd, 0.4)));
    const mxx = xs.reduce((a, b) => a + b, 0) / xs.length, myy = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0, den = 0;
    xs.forEach((x, i) => { num += (x - mxx) * (ys[i] - myy); den += (x - mxx) * (x - mxx); });
    const bslope = num / den, a0 = myy - bslope * mxx;
    const fy = x => B - (a0 + bslope * x - lo) / (hi - lo) * (B - top);
    el('line', { x1: X(0.34), y1: fy(0.34), x2: X(0.67), y2: fy(0.67), stroke: MID, 'stroke-width': 2, 'stroke-dasharray': '7 6' }, s);
    const pmax = Math.max.apply(null, rows.map(r => r.population_2023));
    rows.slice().sort((a, b) => b.population_2023 - a.population_2023).forEach(r => {
      const rr = 5 + 26 * Math.sqrt(r.population_2023 / pmax);
      const col = REGCOL[r.au_region] || MID;
      el('circle', {
        cx: X(r.ndgain_vulnerability_score), cy: Y(r.multilateral_funds_per_capita_usd),
        r: rr, fill: col, opacity: 0.62, stroke: '#fff', 'stroke-width': 1.2, key: r.au_region,
        tip: r.country + '\nVulnerability  ' + r.ndgain_vulnerability_score.toFixed(3)
          + '\nUSD ' + r.multilateral_funds_per_capita_usd.toFixed(2) + ' per person'
          + '\nPopulation  ' + nice(r.population_2023 / 1e6) + 'm  \u2014  ' + r.au_region + ' Africa'
      }, s);
    });
    [['NGA', 'Nigeria'], ['ETH', 'Ethiopia'], ['COD', 'DR Congo'], ['EGY', 'Egypt'],
     ['GMB', 'Gambia'], ['MRT', 'Mauritania'], ['NER', 'Niger'], ['ZAF', 'South Africa']].forEach(([iso, nm]) => {
      const r = rows.find(x => x.iso3 === iso);
      if (!r) return;
      halo(txt(s, X(r.ndgain_vulnerability_score), Y(r.multilateral_funds_per_capita_usd) - 12, nm,
        { anchor: 'middle', size: 11, weight: 600, fill: INK }));
    });
    txt(s, (L + R) / 2, B + 44, 'ND-GAIN vulnerability score, higher is more vulnerable', { anchor: 'middle', size: 12.5, fill: GREY });
    txt(s, 16, (top + B) / 2, 'USD per person, log scale', { anchor: 'middle', size: 12.5, fill: GREY })
      .setAttribute('transform', `rotate(-90 16 ${(top + B) / 2})`);
    legend(s, R + 40, top + 10, Object.keys(REGCOL).map(k => [REGCOL[k], k + ' Africa', k]), { column: true, size: 12 });
    txt(s, R + 40, top + 190, 'Bubble area is population', { size: 11, fill: MID });
    finish(s, W, footer(s, W, B + 58, 'ND-GAIN 2025; CFU/ODI, GCF, Adaptation Fund, LDCF and PPCR portfolio data; UN WPP 2023', pad));
  }

  // --------------------------------------------------------------- maps
  /* Equirectangular, fitted to the African bounding box. Good enough at this scale and
     it keeps the page free of a projection library. */
  function africaProj(x0, y0, w, h) {
    const lo0 = -26, lo1 = 64, la0 = -36.5, la1 = 38.5;
    const k = Math.cos((la0 + la1) / 2 * Math.PI / 180);
    const sx = w / ((lo1 - lo0) * k), sy = h / (la1 - la0), sc = Math.min(sx, sy);
    const ox = x0 + (w - (lo1 - lo0) * k * sc) / 2, oy = y0 + (h - (la1 - la0) * sc) / 2;
    return (lon, lat) => [ox + (lon - lo0) * k * sc, oy + (la1 - lat) * sc];
  }
  function geoPath(rings, P) {
    return rings.map(r => 'M' + r.map(c => { const p = P(c[0], c[1]); return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L') + 'Z').join('');
  }
  /* Somaliland is a separate Natural Earth unit; the finance data reports it inside Somalia. */
  const ISO_ALIAS = { SOL: 'SOM' };
  function drawAfrica(s, P, fillFor, tipFor) {
    const G = window.AFRICA || {};
    Object.keys(G).forEach(iso => {
      const key = ISO_ALIAS[iso] || iso;
      const f = fillFor(key) || '#F0EEEB';
      el('path', {
        d: geoPath(G[iso], P), fill: f, stroke: '#fff', 'stroke-width': 0.8, 'stroke-linejoin': 'round',
        tip: tipFor ? tipFor(key) : null
      }, s);
    });
  }
  function regionOf(D) {
    const m = {};
    (D.f31_map_per_capita || []).forEach(r => { m[r.iso3] = r.au_region; });
    return m;
  }
  /* The geometry is keyed by ISO3 and carries no names, so borrow them from f31. */
  function nameOf(D) {
    const m = {};
    (D.f31_map_per_capita || []).forEach(r => { m[r.iso3] = r.country; });
    return m;
  }
  /* Without africa_geo.js there is nothing to draw, so throw and let index.html fall
     back to the PNG rather than leave an empty card. */
  function needGeo() {
    if (!window.AFRICA) throw new Error('africa_geo.js not loaded');
  }

  // ---------------------------------------------------------------- f30
  function f30(host, D) {
    needGeo();
    const d = D.f30_map_regions, reg = d.regions, top5 = d.top;
    const rmap = regionOf(D);
    const W = 1000, pad = 26, s = svg(host, W, 700);
    const top = chrome(s, W, 'East and West Africa take two thirds of the money; Central Africa takes under a tenth',
      'Adaptation finance by region, USD bn committed in 2023. Countries shaded by their region total', reg.source, pad) + 8;
    const names = ['East', 'West', 'Southern', 'North', 'Central'];
    const mx = Math.max.apply(null, names.map(n => reg[n]));
    const P = africaProj(240, top, 520, 480);
    const cname = nameOf(D);
    drawAfrica(s, P, iso => {
      const r = rmap[iso];
      return r ? ramp(0.18 + reg[r] / mx * 0.8) : '#F0EEEB';
    }, iso => {
      const r = rmap[iso];
      if (!r) return null;
      return (cname[iso] || iso) + '\n' + r + ' Africa\nRegion total USD ' + reg[r].toFixed(2) + 'bn in 2023'
        + '\nLargest recipient: ' + top5[r];
    });
    // biggest recipient in each region, pinned to that country's centroid
    const G = window.AFRICA || {};
    const isoOf = {};
    (D.f31_map_per_capita || []).forEach(r => { isoOf[r.country] = r.iso3; });
    const NAMEISO = { Ethiopia: 'ETH', Nigeria: 'NGA', 'DR Congo': 'COD', Mozambique: 'MOZ', Egypt: 'EGY' };
    names.forEach(n => {
      const iso = NAMEISO[top5[n]];
      const rings = G[iso];
      if (!rings) return;
      let sx = 0, sy = 0, c = 0;
      rings[0].forEach(pt => { const p = P(pt[0], pt[1]); sx += p[0]; sy += p[1]; c++; });
      halo(txt(s, sx / c, sy / c, top5[n], { anchor: 'middle', base: 'middle', size: 11, weight: 700, fill: INK }));
    });
    let ly = top + 20;
    txt(s, pad, ly, 'USD bn, 2023', { size: 12, weight: 700, fill: GREY });
    names.forEach((n, i) => {
      const y = ly + 20 + i * 34;
      el('rect', { x: pad, y: y, width: 22, height: 22, rx: 3, fill: ramp(0.18 + reg[n] / mx * 0.8) }, s);
      txt(s, pad + 32, y + 12, `${n} Africa`, { base: 'middle', size: 12.5, weight: 600, fill: DARK });
      txt(s, pad + 32, y + 26, `USD ${reg[n].toFixed(2)}bn — largest: ${top5[n]}`, { base: 'middle', size: 10.5, fill: MID });
    });
    finish(s, W, footer(s, W, top + 492, reg.source, pad));
  }

  // ---------------------------------------------------------------- f31
  function f31(host, D) {
    needGeo();
    const rows = D.f31_map_per_capita;
    const val = {};
    rows.forEach(r => { if (r.multilateral_funds_per_capita_usd !== null) val[r.iso3] = r.multilateral_funds_per_capita_usd; });
    const BINS = [0, 2, 5, 10, 20, 40];
    const W = 1000, pad = 26, s = svg(host, W, 700);
    const top = chrome(s, W, 'Per person, the small and the least developed do best; the largest economies receive almost nothing',
      'Multilateral climate-fund finance per person, USD, cumulative to 2025',
      'CFU/ODI climate funds database; GCF, Adaptation Fund, LDCF and PPCR portfolios; UN WPP 2023', pad) + 8;
    const binOf = v => { let b = 0; BINS.forEach((t, i) => { if (v >= t) b = i; }); return b; };
    const P = africaProj(240, top, 520, 480);
    const nm = {};
    rows.forEach(r => { nm[r.iso3] = r.country; });
    drawAfrica(s, P, iso => (iso in val ? ramp(0.16 + binOf(val[iso]) / (BINS.length - 1) * 0.84) : '#E2DED8'),
      iso => (nm[iso] ? nm[iso] + '\n' + (iso in val ? 'USD ' + val[iso].toFixed(2) + ' per person' : 'No data') : null));
    let ly = top + 20;
    txt(s, pad, ly, 'USD per person', { size: 12, weight: 700, fill: GREY });
    BINS.forEach((b, i) => {
      const y = ly + 20 + i * 28;
      el('rect', { x: pad, y: y, width: 22, height: 20, rx: 3, fill: ramp(0.16 + i / (BINS.length - 1) * 0.84) }, s);
      const hi = BINS[i + 1];
      txt(s, pad + 32, y + 10, hi ? `${b} to ${hi}` : `${b} and over`, { base: 'middle', size: 12, fill: DARK });
    });
    el('rect', { x: pad, y: ly + 20 + BINS.length * 28, width: 22, height: 20, rx: 3, fill: '#E2DED8' }, s);
    txt(s, pad + 32, ly + 30 + BINS.length * 28, 'No data', { base: 'middle', size: 12, fill: MID });
    // the extremes, in words
    const ranked = Object.keys(val).map(k => [k, val[k]]).sort((a, b) => b[1] - a[1]);
    const RX = W - 250;
    txt(s, RX, top + 20, 'Highest per person', { size: 12, weight: 700, fill: GREY });
    ranked.slice(0, 5).forEach((r, i) => txt(s, RX, top + 42 + i * 20, `${nm[r[0]]}  USD ${r[1].toFixed(0)}`, { size: 12, fill: DARK }));
    txt(s, RX, top + 176, 'Lowest per person', { size: 12, weight: 700, fill: GREY });
    ranked.slice(-5).reverse().forEach((r, i) => txt(s, RX, top + 198 + i * 20, `${nm[r[0]]}  USD ${r[1].toFixed(2)}`, { size: 12, fill: DARK }));
    finish(s, W, footer(s, W, top + 492, 'CFU/ODI climate funds database; GCF, Adaptation Fund, LDCF and PPCR portfolios; UN WPP 2023', pad));
  }

  // ---------------------------------------------------------------- f32
  function f32(host, D) {
    needGeo();
    const rows = D.f32_map_bivariate;
    /* 3x3 built by bilinear mix between four corners, so both axes stay readable:
       lightness carries finance, the lime cast carries vulnerability. */
    const C00 = '#E6E3DE', C10 = '#24534A', C01 = '#C3DA7C', C11 = '#4C6B22';
    const cell = (v, f) => mix(mix(C00, C10, f / 2), mix(C01, C11, f / 2), v / 2);
    const W = 1000, pad = 26, s = svg(host, W, 700);
    const top = chrome(s, W, 'The countries that are most vulnerable and least funded are the deep-lime block across the Sahel and the Horn',
      'ND-GAIN vulnerability against multilateral finance per person, each in terciles',
      'ND-GAIN 2025; CFU/ODI, GCF, Adaptation Fund, LDCF and PPCR portfolio data', pad) + 8;
    const by = {};
    rows.forEach(r => { by[r.iso3] = r; });
    const P = africaProj(250, top, 520, 480);
    const TER = ['low', 'middle', 'high'];
    drawAfrica(s, P, iso => (by[iso] ? cell(by[iso].vt, by[iso].ft) : '#F3F1EE'),
      iso => (by[iso] ? by[iso].country + '\nVulnerability: ' + TER[by[iso].vt]
        + ' tercile\nFinance per person: ' + TER[by[iso].ft] + ' tercile' : null));
    // legend grid
    const gx = pad + 14, gy = top + 60, gs = 40;
    for (let v = 0; v < 3; v++) for (let f = 0; f < 3; f++) {
      el('rect', { x: gx + f * gs, y: gy + (2 - v) * gs, width: gs - 2, height: gs - 2, fill: cell(v, f) }, s);
    }
    txt(s, gx, gy - 14, 'Finance per person, terciles', { size: 11, weight: 600, fill: GREY });
    el('path', { d: `M${gx},${gy + 3 * gs + 6}L${gx + 3 * gs - 4},${gy + 3 * gs + 6}`, stroke: MID, 'stroke-width': 1.4, 'marker-end': '' }, s);
    txt(s, gx, gy + 3 * gs + 22, 'low', { size: 10.5, fill: MID });
    txt(s, gx + 3 * gs - 4, gy + 3 * gs + 22, 'high', { anchor: 'end', size: 10.5, fill: MID });
    txt(s, gx - 10, gy + 3 * gs, 'low', { anchor: 'end', size: 10.5, fill: MID });
    txt(s, gx - 10, gy + 8, 'high', { anchor: 'end', size: 10.5, fill: MID });
    txt(s, gx - 26, gy + 1.5 * gs, 'Vulnerability', { anchor: 'middle', size: 11, weight: 600, fill: GREY })
      .setAttribute('transform', `rotate(-90 ${gx - 26} ${gy + 1.5 * gs})`);
    // the block that matters: high vulnerability, low finance
    const worst = rows.filter(r => r.vt === 2 && r.ft === 0).map(r => r.country);
    const RX = W - 232;
    txt(s, RX, top + 60, 'Most vulnerable, least funded', { size: 12, weight: 700, fill: INK });
    wrap(worst.length ? worst.join(', ') : 'None in this cell', 210, 11.5, 500)
      .forEach((l, i) => txt(s, RX, top + 82 + i * 16, l, { size: 11.5, fill: DARK }));
    finish(s, W, footer(s, W, top + 492, 'ND-GAIN 2025; CFU/ODI, GCF, Adaptation Fund, LDCF and PPCR portfolio data. Terciles are computed across the 48 countries with both readings', pad));
  }

  // ---------------------------------------------------------------- f33
  function f33(host, D) {
    needGeo();
    const d = D.f33_map_cities;
    const W = 1000, pad = 26, s = svg(host, W, 700);
    const top = chrome(s, W, 'City adaptation money clusters in a dozen coastal and capital cities, and Nairobi is still only a pipeline',
      'Identified city-level adaptation finance, USD m. Circle area is value',
      'C40 Cities Finance Facility; project documents and city climate action plans, 2025', pad) + 8;
    const P = africaProj(250, top, 520, 480);
    drawAfrica(s, P, () => '#EFEDEA');
    const names = Object.keys(d);
    const mx = Math.max.apply(null, names.map(k => d[k][2]));
    const drawn = names.slice().sort((a, b) => d[b][2] - d[a][2]).map(k => {
      const lon = d[k][0], lat = d[k][1], v = d[k][2], p = P(lon, lat);
      const r = v > 0 ? 5 + 26 * Math.sqrt(v / mx) : 5;
      el('circle', {
        cx: p[0], cy: p[1], r: r, fill: v > 0 ? TEAL : 'none', opacity: v > 0 ? 0.62 : 1,
        stroke: v > 0 ? '#fff' : LIME, 'stroke-width': v > 0 ? 1.4 : 2.2, 'stroke-dasharray': v > 0 ? null : '3 3',
        tip: k + (v > 0 ? '\nUSD ' + nice(v) + 'm identified' : '\nPipeline only, nothing committed')
      }, s);
      return { k: k, v: v, p: p, r: r, left: lon < 20 };
    });
    // labels get nudged off their marker, with a leader line where the nudge shows
    ['left', 'right'].forEach(side => {
      const set = drawn.filter(c => (side === 'left') === c.left).sort((a, b) => a.p[1] - b.p[1]);
      const ys = spread(set.map(c => c.p[1]), 15);
      set.forEach((c, i) => {
        const x = c.p[0] + (c.left ? -(c.r + 7) : c.r + 7);
        if (Math.abs(ys[i] - c.p[1]) > 3) el('line', { x1: c.p[0], y1: c.p[1], x2: x, y2: ys[i], stroke: MID, 'stroke-width': 0.9 }, s);
        halo(txt(s, x, ys[i], c.k + (c.v > 0 ? '  ' + nice(c.v) : ''),
          { anchor: c.left ? 'end' : 'start', base: 'middle', size: 10.5, weight: 600, fill: INK }));
      });
    });
    let ly = top + 40;
    txt(s, pad, ly, 'USD m identified', { size: 12, weight: 700, fill: GREY });
    [50, 200, 500].forEach((v, i) => {
      const r = 5 + 26 * Math.sqrt(v / mx), y = ly + 40 + i * 62;
      el('circle', { cx: pad + 34, cy: y, r: r, fill: TEAL, opacity: 0.62, stroke: '#fff', 'stroke-width': 1.4 }, s);
      txt(s, pad + 74, y, 'USD ' + v + 'm', { base: 'middle', size: 11.5, fill: DARK });
    });
    const tot = names.reduce((a, k) => a + d[k][2], 0);
    txt(s, pad, ly + 232, `Thirteen cities, USD ${nice(tot)}m in total`, { size: 11.5, weight: 600, fill: INK });
    finish(s, W, footer(s, W, top + 492, 'C40 Cities Finance Facility; project documents and city climate action plans, 2025. Nairobi is pipeline only', pad));
  }

  window.CHARTS = {
    f01_headline_series: f01,
    f02_indexed: f02,
    f03_adaptation_vs_mitigation: f03,
    f04_oda_vs_adaptation: f04,
    f05_sankey_2023: f05,
    f06_institution_shares: f06,
    f07_institution_stage_matrix: f07,
    f08_instrument_mix: f08,
    f09_grant_share_debt_share: f09,
    f10_fund_instruments: f10,
    f11_arc_rsf: f11,
    f12_sector_treemap: f12,
    f13_sector_trend: f13,
    f14_fund_fingerprint: f14,
    f15_project_size: f15,
    f16_ggw_waffle: f16,
    f17_stage_split: f17,
    f18_gcf_funnel: f18,
    f19_prep_facilities: f19,
    f20_disaster_finance: f20,
    f21_programme_timeline: f21,
    f22_bcr_range: f22,
    f23_tdr_shares: f23,
    f24_appraisal_waffle: f24,
    f25_need_funnel: f25,
    f26_pledge_delivery: f26,
    f27_challenge_heat: f27,
    f28_urban_rural: f28,
    f29_urban_regions: f29,
    f30_map_regions: f30,
    f31_map_per_capita: f31,
    f32_map_bivariate: f32,
    f33_map_cities: f33,
    f34_region_dumbbell: f34,
    f35_vulnerability_scatter: f35
  };
})();
