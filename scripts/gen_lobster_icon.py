#!/usr/bin/env python3
"""Recreate the first 32x32 pixel art OpenClaw lobster with scouter."""
from PIL import Image, ImageDraw
import os

BASE = "/Users/jaehwan/.openclaw/workspace/apps/claude-code-monitor"
OUT = os.path.join(BASE, "src-tauri", "icons")
PUBLIC = os.path.join(BASE, "public")

def draw_px(img, x, y, color, ps=8):
    draw = ImageDraw.Draw(img)
    x0, y0 = x * ps, y * ps
    draw.rectangle([x0, y0, x0 + ps - 1, y0 + ps - 1], fill=color)

def make_lobster_scouter():
    """32x32 pixel art OpenClaw lobster with DBZ scouter."""
    size = 256
    ps = 8
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))

    RED = (220, 50, 40)
    RED_LIGHT = (240, 90, 70)
    RED_DARK = (170, 35, 25)
    RED_DEEP = (140, 25, 15)
    ORANGE = (240, 140, 60)
    WHITE = (255, 255, 255)
    BLACK = (20, 20, 30)
    EYE_WHITE = (240, 240, 240)
    PUPIL = (15, 15, 25)
    SCOUTER_FRAME = (70, 75, 90)
    SCOUTER_LENS = (0, 255, 180)
    SCOUTER_GLOW = (0, 255, 180, 80)
    ANTENNA = (180, 40, 30)
    MOUTH = (140, 25, 20)
    CLAW = (230, 70, 50)
    CLAW_DARK = (180, 45, 30)
    CLAW_LIGHT = (245, 120, 90)
    SEGMENT = (200, 45, 35)
    LEG = (190, 50, 35)
    SHINE = (255, 200, 180, 160)

    # Antennae
    for x, y in [(14,2),(13,3),(12,4),(13,5),(18,2),(19,3),(20,4),(19,5)]:
        draw_px(img, x, y, ANTENNA, ps)
    draw_px(img, 14, 1, ORANGE, ps)
    draw_px(img, 18, 1, ORANGE, ps)

    # Head
    for x in range(13, 20): draw_px(img, x, 5, RED, ps)
    for x in range(12, 21): draw_px(img, x, 6, RED, ps)
    for x in range(11, 22):
        for y in range(7, 10): draw_px(img, x, y, RED, ps)
    for x in range(12, 21): draw_px(img, x, 10, RED, ps)
    for x in range(13, 20): draw_px(img, x, 11, RED, ps)
    draw_px(img, 13, 6, RED_LIGHT, ps)
    draw_px(img, 14, 6, RED_LIGHT, ps)
    draw_px(img, 12, 7, RED_LIGHT, ps)

    # Eyes
    for dx, dy in [(13,8),(14,8),(13,9),(14,9)]:
        draw_px(img, dx, dy, EYE_WHITE, ps)
    draw_px(img, 14, 8, PUPIL, ps)
    draw_px(img, 14, 9, PUPIL, ps)
    for dx, dy in [(18,8),(19,8),(18,9),(19,9)]:
        draw_px(img, dx, dy, EYE_WHITE, ps)
    draw_px(img, 18, 8, PUPIL, ps)
    draw_px(img, 18, 9, PUPIL, ps)

    # Smirk
    for x in range(15, 19): draw_px(img, x, 10, MOUTH, ps)
    draw_px(img, 19, 9, MOUTH, ps)

    # Scouter
    draw_px(img, 11, 7, SCOUTER_FRAME, ps)
    draw_px(img, 11, 8, SCOUTER_FRAME, ps)
    draw_px(img, 11, 9, SCOUTER_FRAME, ps)
    draw_px(img, 11, 10, SCOUTER_FRAME, ps)
    draw_px(img, 12, 7, SCOUTER_FRAME, ps)
    draw_px(img, 12, 10, SCOUTER_FRAME, ps)
    draw_px(img, 10, 8, SCOUTER_FRAME, ps)
    draw_px(img, 10, 9, SCOUTER_FRAME, ps)
    draw_px(img, 12, 8, SCOUTER_LENS, ps)
    draw_px(img, 12, 9, SCOUTER_LENS, ps)
    draw_px(img, 13, 7, SCOUTER_FRAME, ps)  # top connector
    draw_px(img, 11, 6, SCOUTER_GLOW, ps)
    draw_px(img, 10, 7, SCOUTER_GLOW, ps)
    draw_px(img, 10, 10, SCOUTER_GLOW, ps)
    draw_px(img, 11, 11, SCOUTER_GLOW, ps)
    draw_px(img, 13, 7, (0, 255, 180, 40), ps)

    # Big right claw (raised)
    draw_px(img, 22, 9, RED, ps)
    draw_px(img, 23, 8, RED, ps)
    draw_px(img, 24, 7, RED, ps)
    for x, y in [(24,5),(25,5),(26,5),(24,6),(25,6),(26,6),(27,6),
                  (25,7),(26,7),(27,7),(24,8),(25,8),(24,9),(25,9),(26,9)]:
        draw_px(img, x, y, CLAW, ps)
    draw_px(img, 26, 8, BLACK, ps)
    draw_px(img, 25, 5, CLAW_LIGHT, ps)
    draw_px(img, 25, 6, CLAW_LIGHT, ps)
    draw_px(img, 24, 9, CLAW_DARK, ps)
    draw_px(img, 27, 7, CLAW_DARK, ps)

    # Small left claw
    draw_px(img, 10, 11, RED, ps)
    draw_px(img, 9, 12, RED, ps)
    draw_px(img, 8, 12, CLAW, ps)
    draw_px(img, 7, 12, CLAW, ps)
    draw_px(img, 8, 13, CLAW, ps)
    draw_px(img, 7, 13, CLAW_DARK, ps)
    draw_px(img, 9, 11, RED_DARK, ps)

    # Body (segmented)
    for y in range(12, 20):
        width = 4 if y < 15 else (3 if y < 18 else 2)
        for dx in range(-width, width + 1):
            x = 16 + dx
            c = SEGMENT if y % 2 == 0 else RED
            if dx == -width or dx == width: c = RED_DARK
            draw_px(img, x, y, c, ps)
    for y in range(12, 20):
        draw_px(img, 16, y, RED_LIGHT if y % 2 == 0 else RED, ps)
    draw_px(img, 14, 12, SHINE, ps)
    draw_px(img, 14, 14, SHINE, ps)

    # Legs
    for y_base in [14, 16, 18]:
        draw_px(img, 11, y_base, LEG, ps)
        draw_px(img, 10, y_base + 1, LEG, ps)
        draw_px(img, 21, y_base, LEG, ps)
        draw_px(img, 22, y_base + 1, LEG, ps)

    # Tail
    for x, y in [(15,20),(16,20),(17,20),(14,21),(15,21),(16,21),(17,21),(18,21),
                  (13,22),(14,22),(18,22),(19,22),(12,23),(13,23),(19,23),(20,23)]:
        draw_px(img, x, y, RED_DARK if y >= 22 else RED, ps)
    draw_px(img, 16, 21, RED_LIGHT, ps)
    for x in [15,16,17]: draw_px(img, x, 22, RED, ps)

    # Power reading glow
    for x, y in [(8,5),(9,5),(8,6)]:
        draw_px(img, x, y, (0, 255, 180, 120), ps)

    return img


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(PUBLIC, exist_ok=True)

    img = make_lobster_scouter()

    # Save as app icon (all required sizes)
    img.save(os.path.join(OUT, 'icon.png'))
    img.save(os.path.join(OUT, 'char_lobster_scouter.png'))

    # 128x128
    img128 = img.resize((128, 128), Image.NEAREST)
    img128.save(os.path.join(OUT, '128x128.png'))

    # 128x128@2x (256)
    img.save(os.path.join(OUT, '128x128@2x.png'))

    # 32x32
    img32 = img.resize((32, 32), Image.NEAREST)
    img32.save(os.path.join(OUT, '32x32.png'))

    # 512 for preview
    img512 = img.resize((512, 512), Image.NEAREST)
    img512.save(os.path.join(OUT, 'char_lobster_scouter_512.png'))
    img512.save(os.path.join(PUBLIC, 'char_lobster_scouter_512.png'))

    # ICO for windows
    img.save(os.path.join(OUT, 'icon.ico'), format='ICO', sizes=[(256, 256)])

    # ICNS for macOS
    try:
        import subprocess
        iconset = os.path.join(OUT, 'icon.iconset')
        os.makedirs(iconset, exist_ok=True)
        for sz in [16, 32, 64, 128, 256, 512]:
            resized = img.resize((sz, sz), Image.NEAREST if sz <= 256 else Image.LANCZOS)
            resized.save(os.path.join(iconset, f'icon_{sz}x{sz}.png'))
            if sz <= 256:
                resized2x = img.resize((sz*2, sz*2), Image.NEAREST if sz*2 <= 256 else Image.LANCZOS)
                resized2x.save(os.path.join(iconset, f'icon_{sz}x{sz}@2x.png'))
        subprocess.run(['iconutil', '-c', 'icns', iconset, '-o', os.path.join(OUT, 'icon.icns')], check=True)
        import shutil
        shutil.rmtree(iconset)
        print("Generated icon.icns")
    except Exception as e:
        print(f"ICNS generation: {e}")

    print("Done! Lobster scouter set as app icon.")
