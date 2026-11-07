import sys
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
BG = (18, 22, 25)  # #121619, sampled from the logo's own background

im = Image.open(src).convert('RGB')
# Glyph (JR + kettlebell + arrow, with glow) sits inside the drawn frame.
glyph = im.crop((440, 140, 935, 495))

# Un-composite the glyph from its near-black background into a transparent RGBA layer.
w, h = glyph.size
rgba = Image.new('RGBA', (w, h))
px, opx = glyph.load(), rgba.load()
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        a = max(0.0, min(1.0, (max(r, g, b) - 48) / 100))
        if a == 0:
            opx[x, y] = (0, 0, 0, 0)
            continue
        c = [max(0, min(255, int((v - bv * (1 - a)) / a))) for v, bv in zip((r, g, b), BG)]
        opx[x, y] = (*c, int(a * 255))
# Fade edges so any glow clipped by the crop doesn't leave a hard line.
fade = Image.new('L', (w, h), 0)
fade.paste(255, (12, 12, w - 12, h - 12))
fade = fade.filter(ImageFilter.GaussianBlur(8))
alpha = Image.composite(rgba.getchannel('A'), Image.new('L', (w, h), 0), fade)
rgba.putalpha(alpha)
bbox = rgba.getbbox()
rgba = rgba.crop(bbox)


def place(canvas_size, glyph_width_ratio, bg):
    canvas = Image.new('RGBA', (canvas_size, canvas_size), bg)
    gw = int(canvas_size * glyph_width_ratio)
    gh = int(rgba.height * gw / rgba.width)
    g = rgba.resize((gw, gh), Image.LANCZOS)
    canvas.alpha_composite(g, ((canvas_size - gw) // 2, (canvas_size - gh) // 2))
    return canvas


icon = place(1024, 0.74, (*BG, 255)).convert('RGB')
icon.save(f'{out}/icon.png')
icon.resize((48, 48), Image.LANCZOS).save(f'{out}/favicon.png')

# Android adaptive: foreground must keep content within the central 66% safe circle.
fg = place(1024, 0.58, (0, 0, 0, 0))
fg.save(f'{out}/android-icon-foreground.png')
Image.new('RGB', (1024, 1024), BG).save(f'{out}/android-icon-background.png')
mono = Image.new('RGBA', fg.size, (255, 255, 255, 0))
mono.putalpha(fg.getchannel('A'))
mono.save(f'{out}/android-icon-monochrome.png')

# Splash: transparent glyph on the app's splash background colour.
rgba.save(f'{out}/splash-icon.png')
