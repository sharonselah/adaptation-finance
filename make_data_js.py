"""Regenerate figure_data.js from figures/figure_data.json.

Two reasons the page loads its data from a script tag rather than fetch():
  1. fetch() is blocked by CORS when index.html is opened over file://.
  2. figure_data.json is not strictly valid JSON - it carries 73 bare NaN values (missing
     PPCR and ND-GAIN entries in f31), which JSON.parse rejects outright. Those are
     converted to null here, so renderers can test them with == null.
"""
import json
import math

def clean(o):
    if isinstance(o, float):
        return None if (math.isnan(o) or math.isinf(o)) else o
    if isinstance(o, dict):
        return {k: clean(v) for k, v in o.items()}
    if isinstance(o, list):
        return [clean(v) for v in o]
    return o

with open('figures/figure_data.json', encoding='utf-8') as f:
    d = clean(json.load(f))

with open('figure_data.js', 'w', encoding='utf-8') as f:
    f.write("/* Generated from figures/figure_data.json - do not edit by hand.\n")
    f.write("   Regenerate:  python make_data_js.py\n")
    f.write("   Loaded via a script tag, not fetch(): the page must work over file://, and\n")
    f.write("   the source JSON contains bare NaN (invalid JSON) which is nulled out here. */\n")
    f.write("window.FIGDATA = ")
    json.dump(d, f, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
    f.write(";\n")

n = sum(1 for _ in open('figure_data.js', encoding='utf-8'))
print(f"figure_data.js written, NaN -> null, {n} lines")
