#!/usr/bin/env python3
"""Generate two pixel art character icons for Claude Scouter."""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'src-tauri', 'icons')

def draw_pixel(img, x, y, color, pixel_size=8):
    """Draw a single 'pixel' block."""
    draw = ImageDraw.Draw(img)
    draw.rectangle([x*pixel_size, y*pixel_size, (x+1)*pixel_size-1, (y+1)*pixel_size-1], fill=color)

def make_scouter_character():
    """DBZ Scouter-style character - tech warrior with eye piece."""
    size = 256
    ps = 8  # pixel size (32x32 grid)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    
    # Colors
    SKIN = (235, 195, 155)
    HAIR = (100, 60, 180)  # purple hair
    DARK_HAIR = (70, 40, 140)
    EYE = (40, 40, 60)
    SCOUTER = (0, 255, 180)  # green glow
    SCOUTER_FRAME = (80, 80, 100)
    ARMOR = (60, 50, 80)
    ARMOR_LIGHT = (90, 75, 120)
    CAPE = (140, 60, 200)
    CAPE_DARK = (100, 40, 160)
    MOUTH = (200, 140, 120)
    
    # Hair (spiky, anime style)
    hair_pixels = [
        (13,4),(14,4),(15,4),(16,4),(17,4),(18,4),
        (12,5),(13,5),(14,5),(15,5),(16,5),(17,5),(18,5),(19,5),
        (11,6),(12,6),(13,6),(14,6),(15,6),(16,6),(17,6),(18,6),(19,6),(20,6),
        (11,7),(12,7),(13,7),(14,7),(15,7),(16,7),(17,7),(18,7),(19,7),(20,7),
        (11,8),(12,8),(19,8),(20,8),(21,8),
        (10,9),(11,9),(20,9),(21,9),
        (10,10),(11,10),(20,10),
    ]
    for x,y in hair_pixels:
        draw_pixel(img, x, y, HAIR, ps)
    # Spiky tips
    for x,y in [(12,3),(17,3),(19,3),(10,5),(21,7),(22,8)]:
        draw_pixel(img, x, y, DARK_HAIR, ps)
    
    # Face
    face_pixels = []
    for y in range(8, 14):
        for x in range(12, 20):
            face_pixels.append((x, y))
    for x,y in face_pixels:
        draw_pixel(img, x, y, SKIN, ps)
    
    # Eyes
    draw_pixel(img, 13, 10, EYE, ps)
    draw_pixel(img, 14, 10, EYE, ps)
    draw_pixel(img, 17, 10, EYE, ps)
    draw_pixel(img, 18, 10, EYE, ps)
    
    # Scouter (left eye piece)
    draw_pixel(img, 11, 9, SCOUTER_FRAME, ps)
    draw_pixel(img, 11, 10, SCOUTER_FRAME, ps)
    draw_pixel(img, 11, 11, SCOUTER_FRAME, ps)
    draw_pixel(img, 12, 9, SCOUTER, ps)
    draw_pixel(img, 12, 10, SCOUTER, ps)  # the lens - bright green
    draw_pixel(img, 13, 9, SCOUTER_FRAME, ps)
    
    # Mouth
    draw_pixel(img, 15, 12, MOUTH, ps)
    draw_pixel(img, 16, 12, MOUTH, ps)
    
    # Armor body
    for y in range(14, 22):
        for x in range(12, 20):
            c = ARMOR_LIGHT if x in (15,16) else ARMOR
            draw_pixel(img, x, y, c, ps)
    # Shoulders
    for x,y in [(11,14),(11,15),(20,14),(20,15)]:
        draw_pixel(img, x, y, ARMOR_LIGHT, ps)
    
    # Cape
    for y in range(15, 24):
        draw_pixel(img, 10, y, CAPE if y % 2 == 0 else CAPE_DARK, ps)
        draw_pixel(img, 21, y, CAPE if y % 2 == 0 else CAPE_DARK, ps)
    for y in range(20, 26):
        draw_pixel(img, 9, y, CAPE_DARK, ps)
        draw_pixel(img, 22, y, CAPE_DARK, ps)
    
    # Arms
    for y in range(16, 21):
        draw_pixel(img, 11, y, SKIN, ps)
        draw_pixel(img, 20, y, SKIN, ps)
    
    # Legs
    for y in range(22, 27):
        draw_pixel(img, 13, y, ARMOR, ps)
        draw_pixel(img, 14, y, ARMOR, ps)
        draw_pixel(img, 17, y, ARMOR, ps)
        draw_pixel(img, 18, y, ARMOR, ps)
    # Boots
    for x in [12,13,14,17,18,19]:
        draw_pixel(img, x, 27, DARK_HAIR, ps)
    
    # Scouter glow effect
    for x,y in [(12,8),(10,10),(12,11)]:
        draw_pixel(img, x, y, (*SCOUTER[:3], 80), ps)
    
    return img


def make_diablo_warrior():
    """Dark warrior - Diablo-inspired pixel art."""
    size = 256
    ps = 8
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    
    # Colors
    HELM = (60, 55, 70)
    HELM_LIGHT = (90, 80, 100)
    EYE_GLOW = (200, 50, 50)  # red glowing eyes
    EYE_GLOW2 = (255, 80, 40)
    ARMOR_DARK = (40, 35, 50)
    ARMOR = (70, 60, 85)
    ARMOR_ACCENT = (120, 80, 50)  # bronze/gold trim
    GOLD = (200, 160, 60)
    SKIN_DARK = (80, 65, 55)
    CLOAK = (30, 25, 40)
    CLOAK2 = (45, 35, 55)
    WEAPON = (150, 150, 170)
    WEAPON_GLOW = (100, 60, 200)
    RUNE = (0, 200, 255)  # cyan rune glow
    
    # Helmet
    for x in range(12, 20):
        draw_pixel(img, x, 4, HELM_LIGHT, ps)
    for y in range(5, 8):
        for x in range(11, 21):
            draw_pixel(img, x, y, HELM, ps)
    # Helmet horns
    for x,y in [(10,4),(10,3),(9,2),(21,4),(21,3),(22,2)]:
        draw_pixel(img, x, y, HELM_LIGHT, ps)
    # Helmet visor
    for x in range(12, 20):
        draw_pixel(img, x, 7, HELM_LIGHT, ps)
    
    # Glowing eyes behind visor
    draw_pixel(img, 13, 8, EYE_GLOW, ps)
    draw_pixel(img, 14, 8, EYE_GLOW2, ps)
    draw_pixel(img, 17, 8, EYE_GLOW, ps)
    draw_pixel(img, 18, 8, EYE_GLOW2, ps)
    # Eye glow bleed
    for x,y in [(12,8),(15,8),(16,8),(19,8)]:
        draw_pixel(img, x, y, (*EYE_GLOW[:3], 60), ps)
    
    # Face/neck area (dark, shadowed)
    for x in range(12, 20):
        for y in [8, 9, 10]:
            if (x,y) not in [(13,8),(14,8),(17,8),(18,8),(12,8),(15,8),(16,8),(19,8)]:
                draw_pixel(img, x, y, SKIN_DARK, ps)
    
    # Pauldrons (big shoulder armor)
    for y in range(10, 14):
        for x in range(8, 12):
            draw_pixel(img, x, y, ARMOR, ps)
        for x in range(20, 24):
            draw_pixel(img, x, y, ARMOR, ps)
    # Pauldron spikes
    draw_pixel(img, 8, 9, ARMOR_ACCENT, ps)
    draw_pixel(img, 7, 8, ARMOR_ACCENT, ps)
    draw_pixel(img, 23, 9, ARMOR_ACCENT, ps)
    draw_pixel(img, 24, 8, ARMOR_ACCENT, ps)
    # Gold trim on pauldrons
    for x in [8,9,10,11]:
        draw_pixel(img, x, 10, GOLD, ps)
    for x in [20,21,22,23]:
        draw_pixel(img, x, 10, GOLD, ps)
    
    # Chest armor
    for y in range(11, 20):
        for x in range(12, 20):
            c = ARMOR if (x + y) % 3 != 0 else ARMOR_DARK
            draw_pixel(img, x, y, c, ps)
    # Gold belt
    for x in range(12, 20):
        draw_pixel(img, x, 19, GOLD, ps)
    # Chest rune (glowing symbol)
    for x,y in [(15,14),(16,14),(15,15),(16,15),(14,15),(17,15),(15,16),(16,16)]:
        draw_pixel(img, x, y, RUNE, ps)
    # Rune glow
    for x,y in [(14,14),(17,14),(14,16),(17,16),(15,13),(16,13)]:
        draw_pixel(img, x, y, (*RUNE[:3], 50), ps)
    
    # Cloak/cape
    for y in range(12, 27):
        w = min(y - 10, 4)
        for dx in range(w):
            draw_pixel(img, 11 - dx, y, CLOAK if dx % 2 == 0 else CLOAK2, ps)
            draw_pixel(img, 20 + dx, y, CLOAK if dx % 2 == 0 else CLOAK2, ps)
    
    # Arms
    for y in range(14, 19):
        draw_pixel(img, 11, y, ARMOR_DARK, ps)
        draw_pixel(img, 20, y, ARMOR_DARK, ps)
    
    # Weapon (glowing sword on right side)
    for y in range(3, 22):
        draw_pixel(img, 23, y, WEAPON if y > 10 else WEAPON_GLOW, ps)
    draw_pixel(img, 22, 10, GOLD, ps)
    draw_pixel(img, 24, 10, GOLD, ps)
    draw_pixel(img, 23, 10, GOLD, ps)
    # Weapon glow
    for y in range(3, 10):
        draw_pixel(img, 22, y, (*WEAPON_GLOW[:3], 40), ps)
        draw_pixel(img, 24, y, (*WEAPON_GLOW[:3], 40), ps)
    
    # Legs
    for y in range(20, 27):
        draw_pixel(img, 13, y, ARMOR_DARK, ps)
        draw_pixel(img, 14, y, ARMOR_DARK, ps)
        draw_pixel(img, 17, y, ARMOR_DARK, ps)
        draw_pixel(img, 18, y, ARMOR_DARK, ps)
    # Boots
    for x in [12,13,14,15,17,18,19]:
        draw_pixel(img, x, 27, ARMOR, ps)
    for x in [12,13,14,17,18,19]:
        draw_pixel(img, x, 28, HELM, ps)
    
    return img


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    
    scouter = make_scouter_character()
    scouter.save(os.path.join(OUT, 'char_scouter.png'))
    print(f"Saved char_scouter.png (scouter warrior)")
    
    diablo = make_diablo_warrior()
    diablo.save(os.path.join(OUT, 'char_diablo.png'))
    print(f"Saved char_diablo.png (diablo warrior)")
    
    # Also save larger versions for preview
    scouter_big = scouter.resize((512, 512), Image.NEAREST)
    scouter_big.save(os.path.join(OUT, 'char_scouter_512.png'))
    
    diablo_big = diablo.resize((512, 512), Image.NEAREST)
    diablo_big.save(os.path.join(OUT, 'char_diablo_512.png'))
    
    print("Done! Preview the 512px versions.")
