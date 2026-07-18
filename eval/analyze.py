#!/usr/bin/env python3
"""Analyze journal template screenshots for POPEYE-metric scoring.

Metrics (matching POPEYE 36-page analysis methodology):
  - whitespace%: paper-colored pixels / total pixels
  - photo_area%: non-paper, non-text colored pixels / total pixels
  - text_ink%: dark pixels in text zones / total pixels
  - margins: top/right/bottom/left empty edge bands in pixels

Usage:
  python eval/analyze.py screenshot.png [--paper PAPER_HEX]
"""

import sys
from collections import Counter
from PIL import Image


def hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def color_dist(a: tuple[int, ...], b: tuple[int, ...]) -> float:
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def find_margins(img: Image.Image, paper: tuple[int, int, int]) -> dict:
    """Measure empty edge bands (continuous paper-colored pixels from edges)."""
    w, h = img.size
    px = img.load()
    THRESH = 38  # max color distance to count as "paper"

    # Top margin
    top = 0
    for y in range(h):
        row_colors = [px[x, y] for x in range(0, w, 4)]
        if any(color_dist(c, paper) > THRESH for c in row_colors):
            top = y
            break

    # Bottom margin
    bottom = 0
    for y in range(h - 1, -1, -1):
        row_colors = [px[x, y] for x in range(0, w, 4)]
        if any(color_dist(c, paper) > THRESH for c in row_colors):
            bottom = h - 1 - y
            break

    # Left margin
    left = 0
    for x in range(w):
        col_colors = [px[x, y] for y in range(0, h, 4)]
        if any(color_dist(c, paper) > THRESH for c in col_colors):
            left = x
            break

    # Right margin
    right = 0
    for x in range(w - 1, -1, -1):
        col_colors = [px[x, y] for y in range(0, h, 4)]
        if any(color_dist(c, paper) > THRESH for c in col_colors):
            right = w - 1 - x
            break

    return {"top": top, "right": right, "bottom": bottom, "left": left}


def analyze(path: str, paper_hex: str = "#faf6f0") -> dict:
    img = Image.open(path).convert("RGB")
    w, h = img.size
    paper = hex_to_rgb(paper_hex)
    px = img.load()

    PAPER_THRESH = 38
    TEXT_THRESH = 80  # luminance below this = "text ink"

    paper_px = 0
    text_ink_px = 0
    photo_px = 0

    for y in range(h):
        for x in range(w):
            c = px[x, y]
            lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
            if color_dist(c, paper) <= PAPER_THRESH:
                paper_px += 1
            elif lum < TEXT_THRESH:
                text_ink_px += 1
            else:
                photo_px += 1

    total = w * h
    margins = find_margins(img, paper)

    return {
        "width": w,
        "height": h,
        "whitespace_pct": round(paper_px / total * 100, 1),
        "photo_area_pct": round(photo_px / total * 100, 1),
        "text_ink_pct": round(text_ink_px / total * 100, 1),
        **margins,
    }


# ── POPEYE reference data (from 36-page analysis) ──
POPEYE_2022 = {"whitespace_pct": 40, "photo_area_pct": 57}
POPEYE_2026 = {
    "whitespace_pct": 67,
    "photo_area_pct": 38,
    "bottom_margin_px": 241,  # on 1080×1440 canvas
}


def compare(result: dict) -> str:
    """Score against POPEYE benchmarks."""
    lines = []
    ws = result["whitespace_pct"]

    # Whitespace closeness to 2026 (the target)
    dist_2026 = abs(ws - POPEYE_2026["whitespace_pct"])
    if dist_2026 <= 7:
        lines.append(f"✅ whitespace {ws}% ≈ POPEYE 2026 ({POPEYE_2026['whitespace_pct']}%)")
    elif dist_2026 <= 15:
        lines.append(f"⚠️  whitespace {ws}% — moderate deviation from POPEYE 2026")
    else:
        lines.append(f"🔴 whitespace {ws}% — far from POPEYE 2026 ({POPEYE_2026['whitespace_pct']}%)")

    # Bottom margin
    bm = result["bottom"]
    ref_bm = POPEYE_2026["bottom_margin_px"]
    if bm >= ref_bm * 0.7:
        lines.append(f"✅ bottom margin {bm}px ≈ reference {ref_bm}px")
    else:
        lines.append(f"🔴 bottom margin {bm}px < 70% of reference {ref_bm}px")

    return "\n".join(lines)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python eval/analyze.py <screenshot.png> [--paper HEX]")
        sys.exit(1)

    path = sys.argv[1]
    paper = "#faf6f0"
    for i, arg in enumerate(sys.argv):
        if arg == "--paper" and i + 1 < len(sys.argv):
            paper = sys.argv[i + 1]

    result = analyze(path, paper)
    print("═" * 50)
    print(f"  {result['width']}×{result['height']}")
    print(f"  whitespace:  {result['whitespace_pct']}%")
    print(f"  photo area:  {result['photo_area_pct']}%")
    print(f"  text ink:    {result['text_ink_pct']}%")
    print(f"  margins:     T:{result['top']} R:{result['right']} B:{result['bottom']} L:{result['left']}")
    print("═" * 50)
    print(compare(result))
