"""Generate AUREN application icons (ICO + PNG) from the brand mark.

The mark mirrors the in-app SVG: a diamond outline, a filled inner diamond,
and a vertical notch cut through the middle.
"""

from PIL import Image, ImageDraw, ImageFilter
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
os.makedirs(BUILD, exist_ok=True)

S = 1024  # master canvas
ACCENT = (167, 152, 255, 255)
ACCENT_DEEP = (139, 124, 246, 255)
BG_TOP = (26, 22, 40, 255)
BG_BOTTOM = (10, 9, 16, 255)


def diamond(cx, cy, half):
    return [(cx, cy - half), (cx + half, cy), (cx, cy + half), (cx - half, cy)]


def build_master():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # Rounded-square body with a vertical gradient.
    body = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    grad = Image.new("RGBA", (S, S))
    gd = grad.load()
    for y in range(S):
        t = y / (S - 1)
        r = round(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
        g = round(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
        b = round(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
        for x in range(S):
            gd[x, y] = (r, g, b, 255)
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=196, fill=255)
    body.paste(grad, (0, 0), mask)

    # Purple glow behind the mark.
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gdr = ImageDraw.Draw(glow)
    gdr.ellipse([S * 0.16, S * 0.16, S * 0.84, S * 0.84], fill=(139, 124, 246, 92))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    body = Image.alpha_composite(body, Image.composite(glow, Image.new("RGBA", (S, S), (0, 0, 0, 0)), mask))

    draw = ImageDraw.Draw(body)
    draw.rounded_rectangle([3, 3, S - 4, S - 4], radius=194, outline=(255, 255, 255, 34), width=5)
    draw.rounded_rectangle([10, 10, S - 11, S - 11], radius=188, outline=(255, 255, 255, 14), width=2)

    # Diamond outline.
    cx = cy = S / 2
    outer = diamond(cx, cy, S * 0.365)
    draw.line(outer + [outer[0]], fill=ACCENT, width=40, joint="curve")
    for point in outer:
        draw.ellipse([point[0] - 20, point[1] - 20, point[0] + 20, point[1] + 20], fill=ACCENT)

    # Inner filled diamond.
    inner = diamond(cx, cy, S * 0.175)
    draw.polygon(inner, fill=ACCENT)
    draw.line(inner + [inner[0]], fill=ACCENT_DEEP, width=6, joint="curve")

    # Vertical notch, echoing the in-app mark.
    draw.line([(cx, cy - S * 0.108), (cx, cy + S * 0.108)], fill=(22, 19, 33, 215), width=26)

    return body


master = build_master()
master.save(os.path.join(BUILD, "icon.png"))
master.resize((512, 512), Image.LANCZOS).save(os.path.join(BUILD, "icon-512.png"))

sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256]
frames = [master.resize((n, n), Image.LANCZOS) for n in sizes]
frames[-1].save(
    os.path.join(BUILD, "icon.ico"),
    format="ICO",
    sizes=[(n, n) for n in sizes],
    append_images=frames[:-1],
)

print("Wrote", os.path.join(BUILD, "icon.ico"))
print("Wrote", os.path.join(BUILD, "icon.png"))
