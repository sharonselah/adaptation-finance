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
  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
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
      'letter-spacing': o.track || '-0.005em'
    }, p);
    t.textContent = s;
    return t;
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
      el('circle', { cx: p[0], cy: p[1], r: 5.6, fill: TEAL }, s);
      txt(s, p[0], p[1] - 15, s0.nominal[i].toFixed(1), { anchor: 'middle', size: 13, weight: 700, fill: TEAL });
    });

    d.vintages.forEach(v => {
      const cx = X(v.x), cy = Y(v.value), r = 6.4;
      el('path', { d: `M${cx},${cy - r}L${cx + r},${cy}L${cx},${cy + r}L${cx - r},${cy}Z`, fill: DARK }, s);
    });

    const lastReal = s0.real_2017[s0.real_2017.length - 1];
    el('line', {
      x1: X(2023), y1: Y(lastReal), x2: X(d.ssa2024.year), y2: Y(d.ssa2024.value),
      stroke: LIME, 'stroke-width': 2.4, 'stroke-dasharray': '2 6', 'stroke-linecap': 'round'
    }, s);
    el('rect', { x: X(d.ssa2024.year) - 7, y: Y(d.ssa2024.value) - 7, width: 14, height: 14, fill: LIME }, s);
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
      el('rect', { x: X(i) - bw / 2, y: Y(v), width: bw, height: B - Y(v), fill: 'rgba(56,113,103,.30)', rx: 2 }, s);
      if (i % 2 === 0) txt(s, X(i), B + 20, String(o.years[i]), { anchor: 'middle', size: 11.5, fill: DARK, weight: 600 });
    });
    const rp = Object.keys(ratio).map(k => [X(o.years.indexOf(+k)), YR(ratio[k])]);
    el('path', { d: 'M' + rp.map(p => p.join(',')).join('L'), fill: 'none', stroke: LIME, 'stroke-width': 3.4, 'stroke-linejoin': 'round' }, s);
    rp.forEach(p => el('circle', { cx: p[0], cy: p[1], r: 5, fill: LIME }, s));
    const keys = Object.keys(ratio);
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
      el('rect', {
        x: pad + c * (cell + gap), y: top + r * (cell + gap),
        width: cell, height: cell, rx: 3, fill: fill
      }, s);
    }
    let ly = top + 5 * (cell + gap) + 22;
    [[TEAL, `Disbursed: USD ${d.disbursed}bn (${disb}%)`], [LIME, `Pledged, not yet disbursed (${pledged - disb}%)`],
     ['#E4E1DD', `Unfunded against the USD ${d.needed}bn need (${100 - pledged}%)`]].forEach(([c, l]) => {
      el('rect', { x: pad, y: ly - 11, width: 15, height: 15, rx: 3, fill: c }, s);
      txt(s, pad + 24, ly - 3, l, { size: 12.5, fill: DARK });
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
        el('rect', { x: x, y: y, width: w, height: bh, fill: cols[j] }, s);
        if (w > 46) txt(s, x + w / 2, y + bh / 2, (v[k][i] / tot * 100).toFixed(1) + '%',
          { anchor: 'middle', base: 'middle', size: 12, weight: 600, fill: j === 2 ? '#fff' : INK });
        x += w;
      });
      txt(s, R + 12, y + bh / 2, 'USD ' + nice(tot) + 'm total', { base: 'middle', size: 11.5, fill: MID });
    });
    let ly = top + v.funds.length * (bh + gap) + 12;
    let lx = L;
    keys.forEach((k, j) => {
      el('rect', { x: lx, y: ly - 11, width: 15, height: 15, rx: 2, fill: cols[j] }, s);
      txt(s, lx + 23, ly - 3, k, { size: 12.5, fill: DARK });
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
    cats.forEach(c => { for (let i = 0; i < c[1]; i++) seq.push(c[2]); });
    const ox = (W - (cols * cell + (cols - 1) * gap)) / 2;
    seq.forEach((c, i) => {
      const r = Math.floor(i / cols), cc = i % cols;
      el('rect', { x: ox + cc * (cell + gap), y: top + r * (cell + gap), width: cell, height: cell, rx: 2.5, fill: c }, s);
    });
    const rows = Math.ceil(seq.length / cols);
    let ly = top + rows * (cell + gap) + 24, lx = ox;
    cats.forEach(([n, cnt, c], i) => {
      if (i === 2) { ly += 24; lx = ox; }
      el('rect', { x: lx, y: ly - 11, width: 15, height: 15, rx: 2, fill: c }, s);
      const lbl = `${n}: ${cnt} (${Math.round(cnt / total * 100)}%)`;
      txt(s, lx + 23, ly - 3, lbl, { size: 12.5, fill: DARK });
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
      el('rect', { x: L, y: y, width: (R - L) * pct / 100, height: bh, fill: TEAL, rx: 3 }, s);
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
      el('circle', { cx: X(p), cy: y, r: 7.5, fill: MID }, s);
      el('circle', { cx: X(f), cy: y, r: 7.5, fill: TEAL }, s);
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

  window.CHARTS = {
    f01_headline_series: f01,
    f04_oda_vs_adaptation: f04,
    f16_ggw_waffle: f16,
    f17_stage_split: f17,
    f24_appraisal_waffle: f24,
    f26_pledge_delivery: f26,
    f34_region_dumbbell: f34
  };
})();
