"""Recolour the BRP-01 figure pack to a brand palette.

    python recolor_figures.py OUTDIR --primary '#1863DC' --accent '#98C21F' --semantic '#387167'

Two modes, because the pack encodes colour in two different ways:

  shade  - the figure uses a graded scale: 3+ monotonic steps of ONE hue standing for a
           quantity (heatmaps, choropleths, treemaps, waffles, funnels, the bivariate
           grid). Handled as a hue rotation that PRESERVES CIE L* and rescales chroma,
           so both the lightness axis and the chroma axis survive. Cannot reorder a scale.
  duo    - the figure uses the dark red and the orange as two independent CATEGORIES
           (line/bar/scatter series). Those get two different brand hues so the
           categorical contrast is kept.

Only 'duo' figures are listed below; everything else defaults to 'shade'. That is the
safe default: pushing a graded scale through two hues invents category boundaries and can
reorder the scale, whereas pushing two categories through one hue merely weakens their
contrast. Override per figure with --force-shade / --force-duo.
"""
import os, glob, time, argparse
import numpy as np
from PIL import Image

BG = np.array([250, 246, 241], float)
C_REF = 76.6          # chroma of the source's most saturated fill (#E8641F)
L_REF = 58.4          # L* of that same fill; the anchor graded scales are pinned to
WARM = (330.0, 95.0)  # source warm family, Lab hue degrees (wraps through 0)
GREEN = (100.0, 260.0)  # source semantic green

# figures whose two warm colours are two independent categories, not a scale
DUO = {
    "f01_headline_series", "f02_indexed", "f03_adaptation_vs_mitigation",
    "f04_oda_vs_adaptation", "f05_sankey_2023", "f08_instrument_mix",
    "f09_grant_share_debt_share", "f10_fund_instruments", "f11_arc_rsf",
    "f13_sector_trend",
    "f15_project_size", "f16_ggw_waffle", "f17_stage_split", "f19_prep_facilities",
    "f20_disaster_finance", "f26_pledge_delivery", "f28_urban_rural",
    "f29_urban_regions", "f33_map_cities", "f34_region_dumbbell",
    "f35_vulnerability_scatter",
}

# ---------- sRGB <-> CIE Lab (D65) ----------
_D = 6.0 / 29.0
WP = np.array([0.95047, 1.0, 1.08883])
M = np.array([[0.4124564, 0.3575761, 0.1804375],
              [0.2126729, 0.7151522, 0.0721750],
              [0.0193339, 0.1191920, 0.9503041]])
MI = np.linalg.inv(M)


def _f(t):
    return np.where(t > _D ** 3, np.cbrt(np.maximum(t, 0)), t / (3 * _D * _D) + 4.0 / 29.0)


def _fi(t):
    return np.where(t > _D, t ** 3, 3 * _D * _D * (t - 4.0 / 29.0))


def rgb2lab(rgb):
    s = np.asarray(rgb, float) / 255.0
    lin = np.where(s <= 0.04045, s / 12.92, ((s + 0.055) / 1.055) ** 2.4)
    xyz = lin @ M.T / WP
    fx, fy, fz = _f(xyz[..., 0]), _f(xyz[..., 1]), _f(xyz[..., 2])
    return np.stack([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)], axis=-1)


def lab2rgb_raw(lab):
    lab = np.asarray(lab, float)
    fy = (lab[..., 0] + 16) / 116
    fx = fy + lab[..., 1] / 500
    fz = fy - lab[..., 2] / 200
    xyz = np.stack([_fi(fx), _fi(fy), _fi(fz)], axis=-1) * WP
    lin = xyz @ MI.T
    srgb = np.where(lin <= 0.0031308, 12.92 * lin,
                    1.055 * np.clip(lin, 0, None) ** (1 / 2.4) - 0.055)
    return srgb * 255


def lab2rgb_gamut(L, C, h):
    """sRGB for L*,C,h; chroma reduced (hue and lightness held) until inside gamut."""
    lo = np.zeros_like(C)
    hi = np.asarray(C, float).copy()
    for _ in range(18):
        mid = (lo + hi) / 2
        rgb = lab2rgb_raw(np.stack([L, mid * np.cos(h), mid * np.sin(h)], axis=-1))
        ok = (rgb > -0.5).all(-1) & (rgb < 255.5).all(-1)
        lo = np.where(ok, mid, lo)
        hi = np.where(ok, hi, mid)
    return np.clip(lab2rgb_raw(np.stack([L, lo * np.cos(h), lo * np.sin(h)], axis=-1)), 0, 255)


def hex2rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def chroma_of(rgb):
    lab = rgb2lab(rgb)
    return float(np.hypot(lab[1], lab[2]))


def hue_of(rgb):
    lab = rgb2lab(rgb)
    return float(np.arctan2(lab[2], lab[1]))


def in_range(hdeg, lo, hi):
    return (hdeg >= lo) | (hdeg <= hi) if lo > hi else (hdeg >= lo) & (hdeg <= hi)


# ---------- mode 1: single-hue graded scale ----------
def pin_L(L, src_L, brand_L):
    """Piecewise-linear lightness remap sending src_L exactly to brand_L.

    Monotonic and fixes both endpoints (0 and 100), so the brand swatch appears verbatim
    at its anchor without reordering anything above or below it.
    """
    L = np.asarray(L, float)
    lo = L * (brand_L / max(src_L, 1e-6))
    hi = brand_L + (L - src_L) * ((100.0 - brand_L) / max(100.0 - src_L, 1e-6))
    return np.clip(np.where(L <= src_L, lo, hi), 0.0, 100.0)


def neutral_mask(uniq, tol=6.0):
    """True for the paper colour, the greys, and anti-aliased blends between them.

    The cream ground (#FAF6F1) and the warm greys carry a little chroma at a warm hue, so
    a naive hue rotation tints the whole page cool. Everything within `tol` of a
    background-to-grey segment is held back instead.
    """
    keep = np.zeros(len(uniq), bool)
    D = uniq - BG
    keep |= np.linalg.norm(D, axis=1) < tol
    for n in NEUTRALS:
        u = np.array(n, float) - BG
        t = np.clip((D @ u) / max(u @ u, 1e-9), 0, 1)
        keep |= np.linalg.norm(D - t[:, None] * u, axis=1) < tol
    return keep


def lut_shade(uniq, primary, accent, semantic, ramp_base, pin=True):
    lab = rgb2lab(uniq)
    L = lab[..., 0]
    C = np.hypot(lab[..., 1], lab[..., 2])
    hdeg = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])) % 360.0
    out = uniq.copy()
    base = {'primary': primary, 'accent': accent, 'semantic': semantic}[ramp_base]
    chromatic = (C > 2.0) & ~neutral_mask(uniq)
    warm = chromatic & in_range(hdeg, *WARM)
    green = chromatic & in_range(hdeg, *GREEN)
    if warm.any():
        k = chroma_of(base) / C_REF
        Lw = pin_L(L[warm], L_REF, rgb2lab(base)[0]) if pin else L[warm]
        out[warm] = lab2rgb_gamut(Lw, C[warm] * k, np.full(int(warm.sum()), hue_of(base)))
    if green.any():
        g_src = np.array([45, 122, 79], float)
        k = chroma_of(semantic) / max(chroma_of(g_src), 1e-6)
        Lg = pin_L(L[green], rgb2lab(g_src)[0], rgb2lab(semantic)[0]) if pin else L[green]
        out[green] = lab2rgb_gamut(Lg, C[green] * k, np.full(int(green.sum()), hue_of(semantic)))
    return np.clip(np.rint(out), 0, 255).astype(np.uint8)


# ---------- mode 2: two categorical hues ----------
NEUTRALS = [(171, 161, 155), (120, 111, 105), (107, 107, 107), (42, 42, 42),
            (222, 215, 209), (218, 212, 206), (232, 228, 223), (199, 191, 185)]
SRC_DUO = [((142, 22, 23), 'P'), ((91, 14, 16), 'P'), ((147, 34, 34), 'P'),
           ((245, 227, 218), 'P'), ((250, 237, 231), 'P'),
           ((232, 100, 31), 'A'), ((184, 57, 27), 'A'), ((171, 47, 26), 'A'),
           ((45, 122, 79), 'S'), ((56, 128, 87), 'S')]


# principal source colour of each family; these land on the brand hex verbatim
PRINCIPAL = {'P': (142, 22, 23), 'A': (232, 100, 31), 'S': (45, 122, 79)}


def family_target(base_rgb, principal_rgb, src_rgb, pin=True):
    """Brand hue, chroma scaled by the family's ratio, lightness remapped so the
    family's principal source colour lands exactly on the brand hex."""
    bl = rgb2lab(base_rgb)
    pl = rgb2lab(np.array(principal_rgb, float))
    sl = rgb2lab(np.array(src_rgb, float))
    hue = np.arctan2(bl[2], bl[1])
    kC = np.hypot(bl[1], bl[2]) / max(np.hypot(pl[1], pl[2]), 1e-6)
    L = pin_L(sl[0], pl[0], bl[0]) if pin else sl[0]
    C = np.hypot(sl[1], sl[2]) * kC
    return lab2rgb_gamut(np.array([L]), np.array([C]), np.array([hue]))[0]


def lut_duo(uniq, primary, accent, semantic, pin=True):
    base = {'P': primary, 'A': accent, 'S': semantic}
    anchors = [(s, tuple(family_target(base[r], PRINCIPAL[r], s, pin))) for s, r in SRC_DUO]
    anchors += [(c, c) for c in NEUTRALS]
    src = np.array([a for a, _ in anchors], float)
    tgt = np.array([t for _, t in anchors], float)
    U, V = src - BG, tgt - BG
    K, N = len(anchors), len(uniq)
    D = uniq - BG
    best = np.full(N, np.inf)
    out = np.repeat(BG[None, :], N, axis=0)
    for i in range(K):
        for j in range(i, K):
            u, v = U[i], U[j]
            uu, uv, vv = u @ u, u @ v, v @ v
            det = uu * vv - uv * uv
            du, dv = D @ u, D @ v
            if i == j or abs(det) < 1e-9:
                a = np.clip(du / max(uu, 1e-9), 0, 1)
                b = np.zeros(N)
            else:
                a = (vv * du - uv * dv) / det
                b = (-uv * du + uu * dv) / det
                a = np.clip(a, 0, 1)
                b = np.clip(b, 0, 1)
                s = a + b
                ov = s > 1.0
                a = np.where(ov, a / np.maximum(s, 1e-9), a)
                b = np.where(ov, b / np.maximum(s, 1e-9), b)
            res = np.linalg.norm(uniq - (BG + a[:, None] * u + b[:, None] * v), axis=1)
            m = res < best
            if m.any():
                cand = BG + a[:, None] * V[i] + b[:, None] * V[j]
                out[m] = cand[m]
                best[m] = res[m]
    return np.clip(np.rint(out), 0, 255).astype(np.uint8)


TITLE_INK = np.array([0x5B, 0x0E, 0x10], float)


def title_band(im, gap=20, min_px=40):
    """Row range of the title's own text block, as (y0, y1).

    Targeting the text rows rather than "everything above the plot" matters: in six of the
    graded figures the title ink `#5B0E10` is ALSO the dark end of the colour scale, so a
    colour-only remap would corrupt the scale, while a region-based band over-extends
    across pale plot areas (f24's waffle reaches 68% of the image). The title block is the
    first contiguous run of rows carrying title ink, closed by `gap` clear rows.
    """
    d = np.linalg.norm(im.astype(float) - TITLE_INK, axis=2)
    rows = (d < 30.0).sum(axis=1)
    hit = np.flatnonzero(rows >= min_px)
    if not len(hit):
        return 0, 0
    y0 = int(hit[0])
    y1 = y0
    for y in hit:
        if y - y1 > gap:
            break
        y1 = int(y)
    return y0, min(y1 + 4, im.shape[0])


def main():
    p = argparse.ArgumentParser()
    p.add_argument('outdir')
    p.add_argument('--primary', required=True)
    p.add_argument('--accent', required=True)
    p.add_argument('--semantic', required=True)
    p.add_argument('--ramp-base', default='primary',
                   choices=['primary', 'accent', 'semantic'],
                   help='which brand colour the graded scales are built from')
    p.add_argument('--force-shade', default='', help='comma-separated stems forced to shade')
    p.add_argument('--force-duo', default='', help='comma-separated stems forced to duo')
    p.add_argument('--no-unify-titles', action='store_true',
                   help='leave titles in the graded figures taking the ramp hue')
    p.add_argument('--no-pin', action='store_true',
                   help='do not pin brand hexes; preserve source lightness exactly instead')
    p.add_argument('--src', default='figures')
    p.add_argument('files', nargs='*')
    a = p.parse_args()

    P, A, S = hex2rgb(a.primary), hex2rgb(a.accent), hex2rgb(a.semantic)
    fsh = {x for x in a.force_shade.split(',') if x}
    fdu = {x for x in a.force_duo.split(',') if x}
    os.makedirs(a.outdir, exist_ok=True)
    files = a.files or sorted(glob.glob(os.path.join(a.src, '*.png')))
    t0 = time.time()
    counts = {'shade': 0, 'duo': 0}
    bands = {}
    for f in files:
        stem = os.path.splitext(os.path.basename(f))[0]
        mode = 'duo' if (stem in DUO or stem in fdu) else 'shade'
        if stem in fsh:
            mode = 'shade'
        im = np.asarray(Image.open(f).convert('RGB'))
        h, w, _ = im.shape
        fp = im.reshape(-1, 3)
        pk = ((fp[:, 0].astype(np.int32) << 16) | (fp[:, 1].astype(np.int32) << 8)
              | fp[:, 2].astype(np.int32))
        vals, inv = np.unique(pk, return_inverse=True)
        uniq = np.stack([(vals >> 16) & 255, (vals >> 8) & 255, vals & 255], axis=1).astype(float)
        lut = (lut_shade(uniq, P, A, S, a.ramp_base, not a.no_pin) if mode == 'shade'
               else lut_duo(uniq, P, A, S, not a.no_pin))
        res = lut[inv].reshape(h, w, 3)
        if mode == 'shade' and not a.no_unify_titles and a.ramp_base != 'primary':
            y0, y1 = title_band(im)
            if y1 > y0:
                tl = lut_shade(uniq, P, A, S, 'primary', not a.no_pin)
                res[y0:y1] = tl[inv].reshape(h, w, 3)[y0:y1]
                bands[os.path.basename(f)[:-4]] = (y0, y1)
        Image.fromarray(res).save(os.path.join(a.outdir, os.path.basename(f)), optimize=True)
        counts[mode] += 1
    print(f"{len(files)} figures -> {a.outdir}/  in {time.time() - t0:.1f}s")
    print(f"  shade (graded, single hue from {a.ramp_base}): {counts['shade']}")
    print(f"  duo   (two categorical hues):                 {counts['duo']}")
    print(f"  primary {a.primary}  accent {a.accent}  semantic {a.semantic}")
    if bands:
        print(f"  titles unified to primary in {len(bands)} graded figures")


if __name__ == '__main__':
    main()
