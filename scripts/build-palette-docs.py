"""
Builds public/docs/asset-builder-color-palettes.pdf from the Asset Builder's palette sources:
src/asset-builder/ColorPalette.tsx and src/asset-builder/heatmapPalettes.ts.

    python3 -m pip install reportlab
    python3 scripts/build-palette-docs.py
"""

import re
from datetime import date
from pathlib import Path

from reportlab.lib.colors import HexColor, Color
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent.parent
PALETTE_SOURCE = ROOT / "src/asset-builder/ColorPalette.tsx"
MULTI_HUE_SOURCE = ROOT / "src/asset-builder/heatmapPalettes.ts"
OUTPUT = ROOT / "public/docs/asset-builder-color-palettes.pdf"

FONT_FILES = {
    "Body": "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "Bold": "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
}
MONO = "Courier"

PAGE_W, PAGE_H = A4
MARGIN = 48
INK = HexColor("#111318")
MUTED = HexColor("#5b616e")
FAINT = HexColor("#8b909a")
RULE = HexColor("#e3e5ea")
ACCENT = HexColor("#2b61f5")


# --- Reading the palettes ---------------------------------------------------------------------

def read_presets(source: str, block: str) -> list[dict]:
    body = re.search(rf"const {block}: PalettePreset\[\] = \[(.*?)\n\];", source, re.S).group(1)
    presets = []
    for line in body.splitlines():
        match = re.search(r'name: "([^"]+)", type: "(\w+)"(?:, sequentialMode: "([\w-]+)")?, colors: (.+?) \}', line)
        if not match:
            continue
        name, kind, mode, colors = match.groups()
        presets.append({"name": name, "type": kind, "mode": mode, "colors": colors})
    return presets


def resolve_colors(expression: str, source: str) -> list[str]:
    if expression.startswith("["):
        return re.findall(r'"(#[0-9a-fA-F]{6,8})"', expression)
    if expression == "LLUX_CATEGORICAL":
        block = re.search(r"const LLUX_CATEGORICAL = \[(.*?)\];", source, re.S).group(1)
        return re.findall(r'"(#[0-9a-fA-F]{6})"', block)
    base = re.fullmatch(r'opacityPalette\("(#[0-9a-fA-F]{6})"\)', expression)
    if base:
        levels = re.findall(r'"([0-9a-f]{2})"', re.search(r"OPACITY_LEVELS = \[(.*?)\]", source).group(1))
        return [base.group(1) if i == 0 else f"{base.group(1)}{alpha}" for i, alpha in enumerate(levels)]
    raise ValueError(f"Unknown palette expression: {expression}")


def load_palettes() -> list[dict]:
    source = PALETTE_SOURCE.read_text()
    palettes = []
    for block in ("PRESETS", "OPACITY_PRESETS"):
        for preset in read_presets(source, block):
            preset["colors"] = resolve_colors(preset["colors"], source)
            palettes.append(preset)
    multi = MULTI_HUE_SOURCE.read_text()
    for name, colors in re.findall(r'\{ name: "([^"]+)", colors: (\[[^\]]+\]) \}', multi):
        palettes.append({"name": name, "type": "Sequential", "mode": "Multi-hue", "colors": resolve_colors(colors, multi)})
    return palettes


SECTIONS = [
    ("Sequential · Shades", lambda p: p["type"] == "Sequential" and p["mode"] == "Shades",
     "One hue from its full strength to near white. Use for ordered values (low → high, or high → low). "
     "Stop 1 is the strongest colour."),
    ("Sequential · Opacity", lambda p: p["mode"] == "Opacity",
     "One base colour at falling opacity. Each step is 8-digit hex (#RRGGBBAA). Stop 1 is fully opaque; "
     "beyond the last stop the opacity keeps falling by the same step."),
    ("Sequential · Multi-hue", lambda p: p["mode"] == "Multi-hue",
     "Ordered ramps that move through several hues for more contrast between steps. "
     "Gradients sample 5 stops from the 7 colours by default."),
    ("Categorical", lambda p: p["type"] == "Categorical",
     "Unordered colours for distinct categories, assigned in order. Every palette, including the wrap from the "
     "last colour back to the first, is checked at ΔE2000 ≥ 20.2 and WCAG contrast ≥ 1.51."),
    ("Diverging", lambda p: p["type"] == "Diverging",
     "Two hues meeting at a neutral midpoint (stop 4). Use for values above and below a reference, "
     "such as change from a baseline."),
]


# --- Colour helpers ---------------------------------------------------------------------------

def rgb(hex_value: str) -> tuple[int, int, int]:
    return tuple(int(hex_value[i : i + 2], 16) for i in (1, 3, 5))


def alpha_percent(hex_value: str) -> int:
    return round(int(hex_value[7:9], 16) / 255 * 100) if len(hex_value) == 9 else 100


def fill_for(hex_value: str) -> Color:
    r, g, b = rgb(hex_value)
    return Color(r / 255, g / 255, b / 255, alpha=alpha_percent(hex_value) / 100)


# --- Drawing ----------------------------------------------------------------------------------

class Doc:
    def __init__(self, path: Path):
        for name, file in FONT_FILES.items():
            pdfmetrics.registerFont(TTFont(name, file))
        path.parent.mkdir(parents=True, exist_ok=True)
        self.c = canvas.Canvas(str(path), pagesize=A4)
        self.c.setTitle("Llumen Asset Builder — Color Palettes")
        self.c.setAuthor("Llumen")
        self.c.setSubject("Every Asset Builder colour palette, with the hex value of each colour")
        self.page = 0
        self.y = 0
        self.new_page()

    def new_page(self):
        if self.page:
            self.footer()
            self.c.showPage()
        self.page += 1
        self.y = PAGE_H - MARGIN

    def footer(self):
        self.c.setFont("Body", 8)
        self.c.setFillColor(FAINT)
        self.c.drawString(MARGIN, 28, "Llumen Asset Builder · Color Palettes")
        self.c.drawRightString(PAGE_W - MARGIN, 28, f"Page {self.page}")

    def room(self, height: float):
        if self.y - height < MARGIN + 20:
            self.new_page()

    def text(self, value: str, size: float, font="Body", color=INK, leading=None, x=MARGIN, width=None):
        width = width or PAGE_W - 2 * MARGIN
        leading = leading or size * 1.4
        self.c.setFont(font, size)
        self.c.setFillColor(color)
        line = ""
        for word in value.split(" "):
            trial = f"{line} {word}".strip()
            if pdfmetrics.stringWidth(trial, font, size) > width and line:
                self.c.drawString(x, self.y - size, line)
                self.y -= leading
                line = word
            else:
                line = trial
        if line:
            self.c.drawString(x, self.y - size, line)
            self.y -= leading

    def checker(self, x, y, w, h, cell=4):
        self.c.saveState()
        path = self.c.beginPath()
        path.rect(x, y, w, h)
        self.c.clipPath(path, stroke=0, fill=0)
        self.c.setFillColor(HexColor("#ffffff"))
        self.c.rect(x, y, w, h, stroke=0, fill=1)
        self.c.setFillColor(HexColor("#d9dce2"))
        rows, cols = int(h // cell) + 1, int(w // cell) + 1
        for row in range(rows):
            for col in range(cols):
                if (row + col) % 2 == 0:
                    self.c.rect(x + col * cell, y + row * cell, cell, cell, stroke=0, fill=1)
        self.c.restoreState()

    def swatch(self, x, y, w, h, hex_value, radius=0):
        if len(hex_value) == 9:
            self.checker(x, y, w, h)
        self.c.setFillColor(fill_for(hex_value))
        self.c.setStrokeColor(RULE)
        self.c.setLineWidth(0.5)
        if radius:
            self.c.roundRect(x, y, w, h, radius, stroke=1, fill=1)
        else:
            self.c.rect(x, y, w, h, stroke=0, fill=1)

    def strip(self, colors, x, y, w, h):
        step = w / len(colors)
        for i, value in enumerate(colors):
            self.swatch(x + i * step, y, step, h, value)
        self.c.setStrokeColor(RULE)
        self.c.setLineWidth(0.5)
        self.c.roundRect(x, y, w, h, 3, stroke=1, fill=0)

    def palette(self, palette: dict):
        colors = palette["colors"]
        opacity = palette["mode"] == "Opacity"
        row_h = 17
        block_h = 20 + 26 + 18 + len(colors) * row_h + 22
        self.room(block_h)

        self.c.setFont("Bold", 12)
        self.c.setFillColor(INK)
        self.c.drawString(MARGIN, self.y - 12, palette["name"])
        label = f'{palette["type"]}{" · " + palette["mode"] if palette["mode"] else ""} · {len(colors)} colours'
        self.c.setFont("Body", 8.5)
        self.c.setFillColor(FAINT)
        self.c.drawRightString(PAGE_W - MARGIN, self.y - 11, label)
        self.y -= 20

        self.strip(colors, MARGIN, self.y - 22, PAGE_W - 2 * MARGIN, 22)
        self.y -= 34

        rgb_x, opacity_x, css_x = (MARGIN + 180, MARGIN + 270, MARGIN + 330) if opacity else (MARGIN + 200, 0, 0)
        columns = [("Stop", MARGIN), ("Colour", MARGIN + 38), ("HEX", MARGIN + 92), ("RGB", rgb_x)]
        if opacity:
            columns += [("Opacity", opacity_x), ("CSS", css_x)]
        self.c.setFont("Bold", 8)
        self.c.setFillColor(MUTED)
        for title, x in columns:
            self.c.drawString(x, self.y - 8, title.upper())
        self.y -= 14
        self.c.setStrokeColor(RULE)
        self.c.line(MARGIN, self.y, PAGE_W - MARGIN, self.y)

        for index, value in enumerate(colors, start=1):
            top = self.y
            self.swatch(MARGIN + 38, top - row_h + 3.5, 40, row_h - 7, value, radius=2)
            r, g, b = rgb(value)
            self.c.setFont("Body", 9)
            self.c.setFillColor(MUTED)
            self.c.drawString(MARGIN, top - 11.5, str(index))
            self.c.setFont(MONO, 9.5)
            self.c.setFillColor(INK)
            self.c.drawString(MARGIN + 92, top - 11.5, value.upper())
            self.c.setFillColor(MUTED)
            self.c.drawString(rgb_x, top - 11.5, f"{r}, {g}, {b}")
            if opacity:
                percent = alpha_percent(value)
                self.c.drawString(opacity_x, top - 11.5, f"{percent}%")
                self.c.drawString(css_x, top - 11.5, f"rgba({r}, {g}, {b}, {percent / 100:g})")
            self.y -= row_h
            self.c.setStrokeColor(RULE)
            self.c.line(MARGIN, self.y, PAGE_W - MARGIN, self.y)
        self.y -= 22

    def section(self, title: str, note: str, count: int):
        self.room(150)
        self.c.setFillColor(ACCENT)
        self.c.rect(MARGIN, self.y - 16, 3, 16, stroke=0, fill=1)
        self.c.setFont("Bold", 16)
        self.c.setFillColor(INK)
        self.c.drawString(MARGIN + 10, self.y - 15, title)
        self.c.setFont("Body", 9)
        self.c.setFillColor(FAINT)
        self.c.drawRightString(PAGE_W - MARGIN, self.y - 13, f"{count} palettes")
        self.y -= 26
        self.text(note, 9.5, color=MUTED)
        self.y -= 12

    def save(self):
        self.footer()
        self.c.save()


def cover(doc: Doc, palettes: list[dict]):
    c = doc.c
    c.setFont("Bold", 9)
    c.setFillColor(ACCENT)
    c.drawString(MARGIN, doc.y - 9, "LLUMEN ASSET BUILDER")
    doc.y -= 24
    doc.text("Color Palettes", 30, font="Bold", leading=38)
    doc.text(
        "Every palette in the Asset Builder's colour palette picker, with the hex value of each colour, "
        "for developers applying them in charts, maps and other visuals.",
        11,
        color=MUTED,
    )
    doc.y -= 6
    doc.text(f"{len(palettes)} palettes · Generated {date.today():%d %B %Y}", 9, color=FAINT)
    doc.y -= 18

    doc.text("How to apply them", 13, font="Bold")
    doc.y -= 2
    for line in [
        "Colours are listed in order. Stop 1 is the first colour the picker assigns: the lowest value of a "
        "gradient or step scale, or the first category.",
        "Sequential and diverging palettes run through the listed stops in order. When a visual needs more "
        "steps than the palette has, the colours in between are interpolated from neighbouring stops.",
        "Categorical palettes keep their colours in order. With more categories than colours, the extras "
        "repeat the palette mixed toward white (16%), then toward #0B1220, a little more on each pass.",
        "Opacity palettes repeat one base colour; only the alpha changes. Use the 8-digit hex or the rgba() value.",
        "Hex values are written as #RRGGBB, or #RRGGBBAA where the last two digits are the alpha.",
    ]:
        doc.room(40)
        c.setFillColor(ACCENT)
        c.circle(MARGIN + 3, doc.y - 6.5, 1.6, stroke=0, fill=1)
        doc.text(line, 9.5, color=INK, x=MARGIN + 12, width=PAGE_W - 2 * MARGIN - 12)
        doc.y -= 4
    doc.y -= 14

    doc.text("Contents", 13, font="Bold")
    doc.y -= 4
    for title, belongs, _ in SECTIONS:
        names = [p["name"] for p in palettes if belongs(p)]
        doc.room(34)
        c.setFont("Bold", 10)
        c.setFillColor(INK)
        c.drawString(MARGIN, doc.y - 10, title)
        doc.y -= 15
        doc.text(", ".join(names), 9, color=MUTED)
        doc.y -= 6


def reference(doc: Doc, palettes: list[dict]):
    doc.new_page()
    doc.text("Copy-ready arrays", 16, font="Bold")
    doc.text("Each palette's colours in order, ready to paste into code.", 9.5, color=MUTED)
    doc.y -= 10
    for title, belongs, _ in SECTIONS:
        doc.room(40)
        doc.text(title, 10.5, font="Bold", color=ACCENT)
        doc.y -= 2
        for palette in (p for p in palettes if belongs(p)):
            values = [f'"{value}",' for value in palette["colors"]]
            values[0] = f'"{palette["name"]}": [{values[0]}'
            line_h = 11
            width = PAGE_W - 2 * MARGIN
            lines, current = [], ""
            for part in values:
                trial = f"{current} {part}".strip()
                if pdfmetrics.stringWidth(trial, MONO, 8) > width and current:
                    lines.append(current)
                    current = "  " + part
                else:
                    current = trial
            lines.append(current.rstrip(",") + "]")
            doc.room(len(lines) * line_h + 6)
            doc.c.setFont(MONO, 8)
            doc.c.setFillColor(INK)
            for line in lines:
                doc.c.drawString(MARGIN, doc.y - 8, line)
                doc.y -= line_h
            doc.y -= 5
        doc.y -= 8


def main():
    palettes = load_palettes()
    doc = Doc(OUTPUT)
    cover(doc, palettes)
    for title, belongs, note in SECTIONS:
        members = [p for p in palettes if belongs(p)]
        doc.new_page()
        doc.section(title, note, len(members))
        for palette in members:
            doc.palette(palette)
    reference(doc, palettes)
    doc.save()
    print(f"{len(palettes)} palettes → {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
