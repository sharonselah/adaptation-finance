"""Strip the baked-in title, subtitle and source note off a figure PNG.

The deck sets those in native PowerPoint text, so leaving them in the bitmap would say
everything twice - and the bitmap copy would not be editable. What is left is the plot.

Bands are found from row ink density rather than fixed offsets, because the figures differ
in height and in how many lines their titles run to:

  top     the last run of blank rows inside the top fifth - i.e. the gap between the title
          block and the plot
  bottom  scanning up from the base, the gap that sits above the source note

    python deck_figures.py          ->  _deckfig/*.png
"""
import os

import numpy as np
from PIL import Image

SRC = 'figures_fsd_sharp/'
OUT = '_deckfig/'

# Two figures put content where the scan expects the title gap - f22's first sector group
# starts high, and f35's highest bubbles (Seychelles at USD 340 a head) sit near the top of
# the plot. Both are cropped to a measured row instead, or the loose scan eats real data.
OVERRIDE_TOP = {'f22': 106, 'f35': 118}


def blank_runs(ink, tol=2):
    """Start and length of every run of near-empty rows."""
    runs, i, n = [], 0, len(ink)
    while i < n:
        if ink[i] <= tol:
            j = i
            while j < n and ink[j] <= tol:
                j += 1
            runs.append((i, j - i))
            i = j
        else:
            i += 1
    return runs


def bands(path):
    a = np.asarray(Image.open(path).convert('L'))
    ink = (a < 238).sum(axis=1)
    h, w = a.shape
    gap = max(5, int(h * 0.006))

    # The title zone is read with a looser idea of "empty": the rows between a subtitle and
    # the plot can still carry an axis spine or a stray gridline, and a strict test would
    # miss the gap and leave the subtitle in the bitmap.
    loose = [r for r in blank_runs(ink, max(2, int(w * 0.012))) if r[1] >= gap]
    zone = int(h * 0.20)
    tops = [r for r in loose if r[0] < zone]
    top = tops[-1][0] + tops[-1][1] if tops else 0

    # The source note is read strictly, so an axis label is never mistaken for it.
    strict = [r for r in blank_runs(ink) if r[1] >= gap]
    tail = [r for r in strict if r[0] + r[1] < h - 1]
    bottom = tail[-1][0] if tail else h
    return top, bottom, h


def main():
    os.makedirs(OUT, exist_ok=True)
    for name in sorted(os.listdir(SRC)):
        if not name.endswith('.png'):
            continue
        path = SRC + name
        top, bottom, h = bands(path)
        top = OVERRIDE_TOP.get(name[:3], top)
        im = Image.open(path)
        im.crop((0, top, im.size[0], bottom)).save(OUT + name)
        print(f'{name[:24]:26} {h:5} ->{bottom - top:5}   cut {top} top, {h - bottom} bottom')


if __name__ == '__main__':
    main()
