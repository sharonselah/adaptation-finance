"""Build the BRP-01 slide deck from the figure pack.

Every headline, bullet and source note is a native PowerPoint text box, so the deck is
editable in place. The only bitmaps are the plots themselves, taken from figures_fsd_sharp/
with their baked-in title and source cropped off by deck_figures.py - so the words on a
slide are all live text, and a figure can be swapped without touching the layout.

    python make_deck.py            ->  BRP-01_adaptation_finance.pptx

Palette and type follow the site: FSD Africa teal and lime, Montserrat throughout.
"""
import os

from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

import deck_figures

# ----------------------------------------------------------------- brand
TEAL = RGBColor(0x38, 0x71, 0x67)
LIME = RGBColor(0x98, 0xC1, 0x1F)
INK = RGBColor(0x12, 0x3B, 0x33)
BODY = RGBColor(0x2B, 0x2B, 0x2B)
MUTED = RGBColor(0x6B, 0x66, 0x60)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
PALE = RGBColor(0xF3, 0xF6, 0xF4)
FONT = 'Montserrat'

W, H = 13.333, 7.5                      # 16:9
MARGIN = 0.62

# The figures with their baked-in title, subtitle and source note cropped off, so the deck
# can set that text natively instead of saying everything twice. deck_figures.py makes them.
FIGDIR = '_deckfig/'

if not os.path.isdir(FIGDIR):
    deck_figures.main()

prs = Presentation()
prs.slide_width = Inches(W)
prs.slide_height = Inches(H)
BLANK = prs.slide_layouts[6]


# ----------------------------------------------------------------- helpers
def slide():
    return prs.slides.add_slide(BLANK)


def rect(s, x, y, w, h, fill, line=None):
    from pptx.enum.shapes import MSO_SHAPE
    sh = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    sh.fill.solid()
    sh.fill.fore_color.rgb = fill
    if line is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = line
    sh.shadow.inherit = False
    return sh


def text(s, x, y, w, h, runs, size=14, color=BODY, bold=False, align=PP_ALIGN.LEFT,
         spacing=1.25, space_after=0, anchor=MSO_ANCHOR.TOP, italic=False, track=None):
    """runs may be a string or a list of paragraphs (strings, or (text, opts) pairs)."""
    tb = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    paras = runs if isinstance(runs, list) else [runs]
    for i, p in enumerate(paras):
        opts = {}
        if isinstance(p, tuple):
            p, opts = p
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        para.alignment = opts.get('align', align)
        para.line_spacing = opts.get('spacing', spacing)
        para.space_after = Pt(opts.get('space_after', space_after))
        r = para.add_run()
        r.text = p
        f = r.font
        f.name = FONT
        f.size = Pt(opts.get('size', size))
        f.bold = opts.get('bold', bold)
        f.italic = opts.get('italic', italic)
        f.color.rgb = opts.get('color', color)
    return tb


def bullets(s, x, y, w, h, items, size=13, color=BODY, gap=9):
    """A dash-led list. The dash is its own lime run so it reads as a mark, not punctuation."""
    tb = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    for i, item in enumerate(items):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        para.line_spacing = 1.3
        para.space_after = Pt(gap)
        d = para.add_run()
        d.text = '—  '
        d.font.name, d.font.size, d.font.bold = FONT, Pt(size), True
        d.font.color.rgb = LIME
        r = para.add_run()
        r.text = item
        r.font.name, r.font.size = FONT, Pt(size)
        r.font.color.rgb = color
    return tb


def picture(s, name, x, y, box_w, box_h):
    """Drop a figure in, fitted to the box and centred in it."""
    path = FIGDIR + name + '.png'
    iw, ih = Image.open(path).size
    scale = min(box_w / iw, box_h / ih)
    w, h = iw * scale, ih * scale
    return s.shapes.add_picture(path, Inches(x + (box_w - w) / 2), Inches(y + (box_h - h) / 2),
                                Inches(w), Inches(h))


def chrome(s, n, section=None):
    """Footer rule, section label and slide number - the furniture every slide shares."""
    rect(s, 0, H - 0.30, W, 0.035, RGBColor(0xE6, 0xE4, 0xE1))
    if section:
        text(s, MARGIN, H - 0.24, 7, 0.22, section.upper(), size=8, color=MUTED, bold=True)
    text(s, W - MARGIN - 1.2, H - 0.24, 1.2, 0.22, str(n), size=8, color=MUTED,
         bold=True, align=PP_ALIGN.RIGHT)


def source(s, y, txt):
    text(s, MARGIN, y, W - MARGIN * 2, 0.5, 'Source: ' + txt, size=8, color=MUTED, spacing=1.2)


# ----------------------------------------------------------------- slide types
def title_slide():
    s = slide()
    rect(s, 0, 0, W, H, INK)
    rect(s, 0, 0, 0.16, H, LIME)
    text(s, MARGIN + 0.5, 1.75, 10.6, 0.4, 'FSD AFRICA  ·  BRP-01', size=10.5,
         color=LIME, bold=True)
    text(s, MARGIN + 0.5, 2.25, 11.0, 2.2, 'Adaptation finance flows to Africa',
         size=45, color=WHITE, bold=True, spacing=1.02)
    text(s, MARGIN + 0.5, 4.15, 9.6, 1.0,
         'What the money is, where it lands, and the distance between the '
         'costed need and what reaches the ground',
         size=15, color=RGBColor(0xC9, 0xD6, 0xD2), spacing=1.35)
    rect(s, MARGIN + 0.5, 5.35, 1.5, 0.045, LIME)
    text(s, MARGIN + 0.5, 5.62, 9.0, 0.6,
         '35 figures on the 2017 to 2024 record, drawn from GCA & CPI, OECD DAC, '
         'the climate funds and the MDBs',
         size=10.5, color=RGBColor(0x9F, 0xB2, 0xAD), spacing=1.3)
    return s


def numbers_slide(n):
    s = slide()
    text(s, MARGIN, 0.62, 11.5, 0.5, 'The argument in four numbers', size=27,
         color=INK, bold=True)
    rect(s, MARGIN, 1.32, 1.3, 0.04, LIME)

    stats = [
        ('USD 70bn', 'a year is the costed need in Africa’s own NDCs',
         'What the continent says it requires'),
        ('USD 14.8bn', 'was tracked as committed in 2023, down from a 2022 peak',
         'A fifth of the need, and falling'),
        ('51%', 'of climate finance to Africa arrives as debt',
         'The highest share of any region'),
        ('~1%', 'of the costed need is estimated to reach the local level',
         'Illustrative ratio, not a tracked figure'),
    ]
    cw = (W - MARGIN * 2 - 0.6) / 4
    for i, (big, mid, small) in enumerate(stats):
        x = MARGIN + i * (cw + 0.2)
        rect(s, x, 1.95, cw, 3.5, PALE)
        rect(s, x, 1.95, cw, 0.05, LIME if i % 2 else TEAL)
        text(s, x + 0.28, 2.35, cw - 0.56, 0.75, big, size=26, color=TEAL, bold=True,
             spacing=1.0, anchor=MSO_ANCHOR.TOP)
        text(s, x + 0.28, 3.3, cw - 0.56, 1.4, mid, size=12.5, color=INK, spacing=1.35)
        text(s, x + 0.28, 4.75, cw - 0.56, 0.7, small, size=9.5, color=MUTED, spacing=1.25)

    text(s, MARGIN, 5.75, W - MARGIN * 2, 0.8,
         'The pack that follows takes those four numbers apart: how the flow has moved, '
         'who provides it and on what terms, where it lands by sector and stage, what the '
         'appraisal evidence says it is worth, and which countries are left out.',
         size=12.5, color=BODY, spacing=1.4)
    source(s, 6.55, 'GCA & CPI 2025; CPI Landscape of Climate Finance in Africa 2024; '
                    'analyst estimate for the local-level ratio')
    chrome(s, n)
    return s


def divider(n, numeral, title, blurb, figures):
    s = slide()
    rect(s, 0, 0, W, H, TEAL)
    rect(s, 0, 0, 0.16, H, LIME)
    text(s, MARGIN + 0.5, 2.5, 2.0, 0.9, numeral, size=52, color=LIME, bold=True, spacing=1.0)
    text(s, MARGIN + 0.5, 3.45, 9.8, 0.9, title, size=33, color=WHITE, bold=True, spacing=1.05)
    text(s, MARGIN + 0.5, 4.5, 8.6, 1.1, blurb, size=14,
         color=RGBColor(0xD3, 0xE0, 0xDC), spacing=1.4)
    text(s, W - MARGIN - 3.4, 4.5, 3.4, 0.4, figures, size=10, color=LIME, bold=True,
         align=PP_ALIGN.RIGHT)
    return s


def chart_slide(n, section, headline, fig, points, src, tall=False):
    """Headline across the top, figure on the left, the reading of it on the right."""
    s = slide()
    text(s, MARGIN, 0.5, 8.2, 0.35, section.upper(), size=9, color=TEAL, bold=True)
    text(s, MARGIN, 0.82, W - MARGIN * 2 - 0.2, 0.85, headline, size=21, color=INK,
         bold=True, spacing=1.12)
    rect(s, MARGIN, 1.78, 0.9, 0.035, LIME)

    # Cropping the chrome off left the plots wide and short, so they need the full width of
    # the slide's left side or they float in white space.
    img_w = 8.15 if not tall else 7.0
    picture(s, fig, MARGIN, 1.9, img_w, 4.6)

    bx = MARGIN + img_w + 0.4
    bw = W - bx - MARGIN
    text(s, bx, 1.95, bw, 0.3, 'WHAT IT SHOWS', size=8.5, color=MUTED, bold=True)
    bullets(s, bx, 2.35, bw, 3.9, points, size=11.5)

    source(s, 6.62, src)
    chrome(s, n, section)
    return s


def closing(n):
    s = slide()
    rect(s, 0, 0, W, H, INK)
    rect(s, 0, 0, 0.16, H, LIME)
    text(s, MARGIN + 0.5, 0.85, 10.5, 0.6, 'What the 35 figures add up to', size=30,
         color=WHITE, bold=True)
    rect(s, MARGIN + 0.5, 1.72, 1.3, 0.04, LIME)
    items = [
        ('The flow has turned down, not up.', 'Commitments peaked at USD 16.4bn in 2022 and '
         'fell to USD 14.8bn in 2023; sub-Saharan Africa fell a further 15% in 2024, against '
         'a costed need of USD 70bn a year.'),
        ('The terms are the problem as much as the volume.', 'Market-rate debt went from '
         'nothing in 2018 to a quarter of the mix, and debt is 51% of climate finance to '
         'Africa - the highest share of any region.'),
        ('The pipeline is not the constraint; conversion is.', 'The GCF has 314 approvals and '
         '231 proposals behind them, but a third of approvals has disbursed, on a 10 to 27 '
         'month cycle.'),
        ('Preparation money is the cheapest leverage in the system.', 'Facilities return '
         '10x to 105x on preparation spend, and every one of them is small.'),
        ('The case is not the obstacle either.', 'Every appraisal in the evidence base clears '
         '1:1, up to 12:1 - but only 27 of 320 put a value on all three resilience dividends.'),
    ]
    y = 2.15
    for head, body in items:
        rect(s, MARGIN + 0.5, y + 0.09, 0.075, 0.075, LIME)
        text(s, MARGIN + 0.78, y, 10.6, 0.32, head, size=13.5, color=WHITE, bold=True)
        text(s, MARGIN + 0.78, y + 0.31, 10.6, 0.6, body, size=11,
             color=RGBColor(0xB8, 0xC8, 0xC4), spacing=1.32)
        y += 0.98
    return s


# ----------------------------------------------------------------- the deck
title_slide()
n = 2
numbers_slide(n)

n += 1
divider(n, 'I', 'Flows and the gap',
        'How much adaptation finance Africa actually receives, how that has moved since '
        '2017, and how far it sits from the costed need.', 'FIGURES 01–05')
n += 1
chart_slide(n, 'I · Flows and the gap',
            'Adaptation finance to Africa rose to a 2022 peak and has fallen for two years',
            'f01_headline_series',
            ['Nominal commitments ran USD 6.3bn (2017) to a peak of USD 16.4bn (2022), '
             'then fell to USD 14.8bn in 2023.',
             'In 2017 dollars the fall is sharper: USD 13.9bn to USD 12.1bn.',
             'Sub-Saharan Africa fell a further 15% in 2024, to USD 11.0bn.',
             'Earlier vintages of the same accounting sit higher, so the peak is partly a '
             'measurement artefact - the direction is not.'],
            'GCA & CPI, Adaptation Finance Flows to Africa, 2025, Figures 1 and 4; '
            'CPI Global Landscape of Climate Finance 2026')
n += 1
chart_slide(n, 'I · Flows and the gap',
            'From USD 70bn of costed need, roughly one per cent is reaching the local level',
            'f25_need_funnel',
            ['Africa’s NDCs cost the need at about USD 70bn a year.',
             'USD 14.8bn was tracked as committed in 2023 - a 79% drop at the first step.',
             'On an illustrative 46% disbursement ratio, USD 6.8bn is actually paid out.',
             'Under 10% of that is estimated to reach the local level: USD 0.7bn, or ~1% of '
             'the need. The last two steps are ratios from the literature, not tracked data.'],
            'GCA & CPI 2025 for need and commitments; disbursement and local-level shares are '
            'illustrative ratios drawn from the literature')

n += 1
divider(n, 'II', 'Institutions and instruments',
        'Who provides the finance, and on what terms - grants, concessional debt, '
        'market-rate debt, equity and risk transfer.', 'FIGURES 06–11')
n += 1
chart_slide(n, 'II · Institutions and instruments',
            'Multilateral DFIs and bilateral governments provide four fifths of the money',
            'f06_institution_shares',
            ['Multilateral DFIs 49% and bilateral governments 30% in 2023 - 79% between them.',
             'Multilateral climate funds, the instruments most associated with adaptation, '
             'provide 5%.',
             'Private and domestic finance is 3%, and barely moves across three vintages of '
             'the same accounting.',
             'The shares are stable over 2019/20, 2017–23 and 2023, so this is structure, '
             'not noise.'],
            'GCA, State and Trends in Adaptation 2023; GCA & CPI 2025')
n += 1
chart_slide(n, 'II · Institutions and instruments',
            'Grants still carry the mix, but market-rate debt went from nothing to a quarter '
            'in six years',
            'f08_instrument_mix',
            ['Grants are USD 7.3bn of the USD 14.8bn tracked in 2023 - just under half.',
             'Market-rate debt was zero in 2017 and 2018; it is USD 4.0bn by 2023.',
             'Concessional debt grew steadily to USD 3.2bn.',
             'Equity is negligible throughout, so risk capital is not arriving.'],
            'GCA & CPI 2025, Figure 4')
n += 1
chart_slide(n, 'II · Institutions and instruments',
            'Africa keeps a high grant share, and still carries the highest debt share of '
            'any region',
            'f09_grant_share_debt_share',
            ['Africa’s adaptation grant share held at about 48–49% between 2019 '
             'and 2023.',
             'African LDCs went the other way: 69% down to 61%.',
             'Yet debt is 51% of all climate finance to Africa, against 20% for Latin America '
             'and 18% for East Asia.',
             'A high grant share within adaptation does not offset a debt-heavy whole.'],
            'CPI Landscape of Climate Finance in Africa 2024; GCA & CPI 2025; OECD 2026')

n += 1
divider(n, 'III', 'Sectors and delivery',
        'Where the money lands by sector, project size and pipeline stage, and how much '
        'survives the journey from readiness to implementation.', 'FIGURES 12–21')
n += 1
chart_slide(n, 'III · Sectors and delivery',
            'A quarter goes to agriculture, a fifth to policy and budget support, and '
            'another fifth is unspecified',
            'f12_sector_treemap',
            ['Agriculture, forestry and land use take 25% of the USD 14.8bn tracked.',
             'Policy, budget support and capacity take 21%; water and wastewater 16%.',
             '"Other / unspecified" is 22% - the second largest block on the chart is a '
             'reporting gap.',
             'Energy systems, industry and biodiversity are each 1% or less.'],
            'GCA & CPI 2025, Figure 8. Shares are of USD 14.8bn tracked in 2023')
n += 1
chart_slide(n, 'III · Sectors and delivery',
            'The GCF pipeline is deep and the disbursement end is narrow',
            'f18_gcf_funnel',
            ['314 projects approved to date, with 161 concept notes and 70 funding proposals '
             'behind them.',
             'A third of approvals has disbursed - 106 projects.',
             'Only 35% of project preparation grants reach approval.',
             'The approval cycle runs 10 months at the GCF to 32 months at the GEF LDCF, '
             'before first disbursement.'],
            'GCF portfolio dashboard and pipeline, July 2026; Adaptation Fund APR 2025; '
            'GEF AMR FY24 and FY25')
n += 1
chart_slide(n, 'III · Sectors and delivery',
            'Preparation money is the cheapest leverage in the system, and the facilities '
            'are all small',
            'f19_prep_facilities',
            ['NEPAD-IPPF turned USD 124m of preparation spend into USD 13bn of investment '
             '- 105x.',
             'The African Water Facility returned about 21x, PPIAF about 73x.',
             'The GCF Project Preparation Facility committed USD 4.5m in its 2024 cohort.',
             'These are the smallest budgets in the system and the highest returns on them.'],
            'Facility annual reports 2024 and 2025; GCF PPF portfolio; PIDG results 2024')

n += 1
divider(n, 'IV', 'Value, appraisal and pledges',
        'The benefit-cost evidence, the triple dividend, the quality of appraisal, and the '
        'distance between pledges and delivery.', 'FIGURES 22–27')
n += 1
chart_slide(n, 'IV · Value and pledges',
            'Every appraisal in the evidence base clears one to one; the spread runs from '
            '1.1 to 12',
            'f22_bcr_range',
            ['Not one published appraisal in the base returns less than it costs.',
             'The range runs from 1.1:1 to about 12:1 across agriculture, water, DRM and '
             'urban work.',
             'Ex post evaluations sit inside the same range as ex ante appraisals - the '
             'returns survive contact with delivery.',
             'The economic case is not what is holding the money back.'],
            'As cited in Part VI. Ranges are the published low and high; evidence type is '
            'the appraisal basis, not a quality ranking')
n += 1
chart_slide(n, 'IV · Value and pledges',
            'Only 27 of 320 appraisals put a value on all three resilience dividends',
            'f24_appraisal_waffle',
            ['Of 320 real adaptation appraisals, 27 monetise all three dividends - 8%.',
             '157 monetise none at all - 49%.',
             'Avoided losses are the dividend that gets counted; induced economic benefits '
             'and co-benefits mostly do not.',
             'Under-counting the benefit side understates the case in the appraisals that '
             'decide whether projects proceed.'],
            'WRI, Strengthening the investment case for climate adaptation, 2025 '
            '(320 appraisals)')

n += 1
divider(n, 'V', 'Geography',
        'Regional and per-capita distribution, city-level activity, and finance set '
        'against vulnerability.', 'FIGURES 28–35')
n += 1
chart_slide(n, 'V · Geography',
            'Per person, the small and the least developed do best; the largest economies '
            'receive almost nothing',
            'f31_map_per_capita',
            ['Cumulative multilateral climate-fund finance per person spans more than two '
             'orders of magnitude.',
             'Small island and least-developed states top the ranking on a per-person basis.',
             'Nigeria, Egypt, DR Congo and South Africa sit near the bottom despite the '
             'largest exposed populations.',
             'Allocation tracks country count and access capacity more than it tracks people.'],
            'CFU/ODI climate funds database; GCF, Adaptation Fund, LDCF and PPCR portfolios; '
            'UN WPP 2023', tall=True)
n += 1
chart_slide(n, 'V · Geography',
            'Vulnerability barely predicts what a country receives',
            'f35_vulnerability_scatter',
            ['ND-GAIN vulnerability against finance per person is close to flat - the fitted '
             'line is nearly horizontal.',
             'The largest populations cluster at the bottom of the chart.',
             'Countries at similar vulnerability receive amounts that differ by a factor of '
             'ten or more.',
             'Need, as measured, is not the allocation rule.'],
            'ND-GAIN 2025; CFU/ODI, GCF, Adaptation Fund, LDCF and PPCR portfolio data; '
            'UN WPP 2023', tall=True)

n += 1
closing(n)

out = 'BRP-01_adaptation_finance.pptx'
prs.save(out)
print(f'{out}  —  {len(prs.slides.__iter__.__self__._sldIdLst)} slides')
