# Adaptation finance flows to Africa — BRP-01 figure pack

A 35-figure pack on climate adaptation finance to Africa, published as a static site in the
FSD Africa palette.

Open `index.html`. No build step, no server required — it works over `file://` too.

## What's here

| Path | Purpose |
|---|---|
| `index.html` | The site: five sections, 35 figures, lightbox |
| `charts.js` | Native SVG renderers + the `CHARTS` registry |
| `figure_data.js` | Data as a script tag — generated, do not edit |
| `africa_geo.js` | Africa boundaries for the four maps — generated, do not edit |
| `make_data_js.py` | Regenerates `figure_data.js` from the JSON |
| `figures/figure_data.json` | **Source of truth** for every figure |
| `figures/` | Original delivered PNGs (red/orange palette) |
| `figures_fsd_sharp/` | PNGs recoloured to the FSD palette — what the site serves |
| `recolor_figures.py` | The recolouring tool |

## How figures render

Each figure is drawn one of two ways, decided per figure at load:

1. **Native SVG** if `charts.js` exports a renderer for its id — vector, so it stays sharp at
   any zoom, inherits the page's Montserrat, and has a transparent ground.
2. **PNG fallback** from `figures_fsd_sharp/` otherwise.

All 35 are native. The PNG path is still wired up, so a renderer that throws falls back to
the image for that figure alone rather than breaking the page.

The four maps (`f30`–`f33`) join the data to boundaries by `iso3` — the JSON carries the
codes but no geometry. `africa_geo.js` supplies it: Natural Earth 110m admin-0 filtered to
`CONTINENT=Africa`, coordinates rounded to two decimals and rings under 0.6 deg² dropped,
which gets the whole continent into 31KB. Projection is equirectangular, fitted to the
African bounding box in `charts.js`, so the page needs no mapping library. Somaliland is a
separate Natural Earth unit and is aliased onto `SOM`, matching the finance reporting.

## Changing the data

```bash
# edit figures/figure_data.json, then
python make_data_js.py
```

Every figure updates. `figures_fsd_sharp/` is a static build of the same 35 charts, kept for
print and slide use; regenerate it with `recolor_figures.py` if the data moves.

Note: `figures/figure_data.json` contains bare `NaN` values (missing PPCR and ND-GAIN
entries in `f31`), which makes it invalid strict JSON — `JSON.parse` rejects it. That is why
the page loads a generated script rather than fetching the JSON; `make_data_js.py` converts
those to `null`.

## Palette

| Role | Hex |
|---|---|
| Primary | `#387167` teal |
| Accent | `#98C11F` lime |
| Title ink | `#123B33` |

Two brand colours cover three source families (the originals used dark red, orange **and** a
green), so one pair shares a hue and separates by lightness instead.

`recolor_figures.py` treats figures in two ways, because the pack encodes colour two ways:
graded scales of a single hue (heatmaps, choropleths, waffles, the bivariate grid) are hue-
rotated with CIE L\* preserved, so a scale can never be reordered; figures using two colours
as independent categories get two brand hues.

```bash
python recolor_figures.py OUT --primary '#387167' --accent '#98C11F' \
  --semantic '#387167' --ramp-base accent --no-pin
```

`--no-pin` preserves the source lightness, which keeps text contrast at the original
12.9:1. Dropping it pins the exact brand hexes but costs ~38% of the contrast.

## Sources

GCA & CPI, *Adaptation Finance Flows to Africa* (2025); CPI *Global Landscape of Climate
Finance* (2026); OECD DAC; GCF, Adaptation Fund, GEF and CIF portfolio reporting; WRI (2025).
Per-figure sources are in `figure_data.json`.

Some breakdowns are analyst-derived rather than published — `f05`'s source-to-instrument
splits are an illustrative Bayes allocation, `f27` is analyst coding, `f28` uses a Bayes
sector proxy. The `source` string on each figure says which.
