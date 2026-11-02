"""Generate AUREN application icons from the supplied brand artwork.

Source: build/icon-source.png (transparent PNG, purple document with the A mark).
The artwork is cropped to its visible alpha bounds, padded onto a square
transparent canvas, and exported as a multi-resolution Windows ICO plus the
PNG assets used by the renderer and the release folder.
"""

from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
ASSETS = os.path.join(ROOT, "src", "assets")
SOURCE = os.path.join(BUILD, "icon-source.png")
MASTER_SIZE = 1024
PADDING = 0.055  # fraction of the artwork's longest side

os.makedirs(BUILD, exist_ok=True)
os.makedirs(ASSETS, exist_ok=True)

image = Image.open(SOURCE).convert("RGBA")

# Crop away the transparent canvas and the faint clipped shadow tail.
alpha = image.getchannel("A")
visible = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
if not visible:
    raise SystemExit("icon-source.png has no visible pixels")
content = image.crop(visible)

width, height = content.size
side = round(max(width, height) * (1 + PADDING * 2))
master = Image.new("RGBA", (side, side), (0, 0, 0, 0))
master.alpha_composite(content, ((side - width) // 2, (side - height) // 2))
master = master.resize((MASTER_SIZE, MASTER_SIZE), Image.LANCZOS)

master.save(os.path.join(BUILD, "icon.png"))
master.resize((512, 512), Image.LANCZOS).save(os.path.join(BUILD, "icon-512.png"))
master.resize((256, 256), Image.LANCZOS).save(os.path.join(ASSETS, "auren-logo.png"))

sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256]
master.save(
    os.path.join(BUILD, "icon.ico"),
    format="ICO",
    sizes=[(size, size) for size in sizes],
)

print("Wrote", os.path.join(BUILD, "icon.ico"))
print("Wrote", os.path.join(BUILD, "icon.png"))
print("Wrote", os.path.join(BUILD, "icon-512.png"))
print("Wrote", os.path.join(ASSETS, "auren-logo.png"))
