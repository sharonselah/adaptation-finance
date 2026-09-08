"""Flood the cream ground (#FAF6F1) of the BRP-01 PNGs to pure white.

    python whiten_bg.py figures figures_fsd

Pixels at the cream land exactly on white; pixels near it (the antialiased fringe of
every line, glyph and marker, which was composited against cream) are lifted by a
proportion of the same shift, so no halo is left behind. Anything further than THRESHOLD
away in RGB - the ink, the fills, the warm grid greys - is untouched.
"""
import os, sys, shutil
import numpy as np
from PIL import Image

BG = np.array([250.0, 246.0, 241.0])
SHIFT = 255.0 - BG
THRESHOLD = 48.0


def whiten(path):
    im = Image.open(path)
    mode = im.mode
    im = im.convert("RGBA" if mode in ("RGBA", "LA", "P") and "transparency" in im.info
                    or mode in ("RGBA", "LA") else "RGB")
    a = np.asarray(im, dtype=np.float64).copy()
    rgb = a[..., :3]
    d = np.linalg.norm(rgb - BG, axis=-1)
    w = np.clip(1.0 - d / THRESHOLD, 0.0, 1.0)[..., None]
    rgb += SHIFT * w
    a[..., :3] = np.clip(rgb, 0, 255)
    Image.fromarray(a.round().astype(np.uint8), im.mode).save(path, optimize=True)
    return float(w.mean())


def main(dirs):
    for d in dirs:
        backup = d + "_cream_backup"
        if not os.path.isdir(backup):
            os.makedirs(backup)
            for f in sorted(os.listdir(d)):
                if f.endswith(".png"):
                    shutil.copy2(os.path.join(d, f), os.path.join(backup, f))
        n = 0
        for f in sorted(os.listdir(d)):
            if f.endswith(".png"):
                cov = whiten(os.path.join(d, f))
                n += 1
                print("  %-38s %5.1f%% of pixels lifted" % (f, cov * 100))
        print("%s: %d files (originals in %s)" % (d, n, backup))


if __name__ == "__main__":
    main(sys.argv[1:] or ["figures", "figures_fsd"])
