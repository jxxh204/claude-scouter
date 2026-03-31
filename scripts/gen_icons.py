#!/usr/bin/env python3
"""OpenClaw lobster scouter v4 - cute round blob + subtle lobster features."""
from PIL import Image, ImageDraw
import os, math

OUT = os.path.join(os.path.dirname(__file__), '..', 'src-tauri', 'icons')
PUBLIC = os.path.join(os.path.dirname(__file__), '..', 'public')


def make_lobster_v4():
    size = 512
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = 256, 255

    # Colors
    RED = (220, 50, 40)
    RED_LIGHT = (242, 95, 75)
    RED_DARK = (175, 38, 28)
    RED_DEEP = (145, 28, 18)
    ORANGE_TIP = (245, 155, 55)
    WHITE = (255, 255, 255)
    BLACK = (15, 15, 25)
    EYE_WHITE = (250, 250, 255)
    PUPIL = (12, 12, 22)

    SCOUTER_FRAME = (160, 165, 185)
    SCOUTER_FRAME_DARK = (105, 110, 130)
    SCOUTER_BODY = (195, 200, 215)
    SCOUTER_LENS = (125, 105, 190)
    SCOUTER_LENS_LIGHT = (165, 150, 225)
    SCOUTER_ACCENT = (215, 55, 45)
    SCOUTER_TEXT = (225, 220, 255, 165)
    CROSSHAIR = (235, 215, 105, 170)

    ANTENNA = (200, 45, 35)
    MOUTH = (150, 30, 22)
    CLAW = (235, 70, 50)
    CLAW_DARK = (185, 45, 30)
    CLAW_LIGHT = (250, 120, 95)

    def circle(cx, cy, r, fill):
        d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=fill)

    def ellipse(x0, y0, x1, y1, fill):
        d.ellipse([x0, y0, x1, y1], fill=fill)

    def rect(x0, y0, x1, y1, fill):
        d.rectangle([x0, y0, x1, y1], fill=fill)

    def rounded_rect(x0, y0, x1, y1, r, fill):
        d.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill)

    # === ANTENNAE (cute, curved) ===
    for pts in [
        [(cx-45, cy-145), (cx-58, cy-178), (cx-65, cy-210), (cx-55, cy-235)],
        [(cx+45, cy-145), (cx+58, cy-178), (cx+65, cy-210), (cx+55, cy-235)],
    ]:
        for i in range(len(pts)-1):
            x0,y0 = pts[i]; x1,y1 = pts[i+1]
            for t in range(25):
                tt = t/24
                px, py = x0+(x1-x0)*tt, y0+(y1-y0)*tt
                circle(int(px), int(py), int(7-i*1.5), ANTENNA)
        circle(pts[-1][0], pts[-1][1], 7, ORANGE_TIP)

    # === BODY - round blob with slight bottom taper ===
    # Main round body (slightly taller than wide for subtle lobster feel)
    body_w, body_h = 152, 160
    ellipse(cx-body_w, cy-body_h+20, cx+body_w, cy+body_h-20, RED)

    # Slight taper at bottom (not too lobster-y, just a hint)
    d.polygon([
        (cx-100, cy+body_h-45),
        (cx+100, cy+body_h-45),
        (cx+65, cy+body_h+25),
        (cx-65, cy+body_h+25),
    ], fill=RED)
    # Smooth the connection
    ellipse(cx-105, cy+body_h-60, cx+105, cy+body_h-25, RED)

    # Subtle tail fan (small, cute)
    for angle in [-25, -8, 8, 25]:
        rad = math.radians(angle)
        tx = cx + math.sin(rad) * 40
        ty = cy + body_h + 20 + abs(angle) * 0.3
        ellipse(int(tx)-16, int(ty), int(tx)+16, int(ty)+18, RED_DARK)

    # Subtle segment lines (very light, just a hint)
    for seg_y in [cy+body_h-30, cy+body_h]:
        w = int(75 - (seg_y - cy - 100) * 0.3)
        d.line([(cx-w, seg_y), (cx+w, seg_y)], fill=(200,42,32,50), width=2)

    # === BODY SHADING ===
    shade = Image.new('RGBA', (size, size), (0,0,0,0))
    sd = ImageDraw.Draw(shade)
    # Big highlight top-left
    sd.ellipse([cx-135, cy-140, cx-15, cy-50], fill=(255,255,255,40))
    sd.ellipse([cx-115, cy-125, cx-40, cy-70], fill=(255,255,255,55))
    sd.ellipse([cx-100, cy-110, cx-60, cy-85], fill=(255,255,255,35))
    # Darker bottom
    sd.ellipse([cx-140, cy+60, cx+140, cy+170], fill=(0,0,0,25))
    img = Image.alpha_composite(img, shade)
    d = ImageDraw.Draw(img)

    # === LEFT EYE (big, cute, like reference blob) ===
    lex, ley = cx - 62, cy - 30
    # Black outline
    circle(lex, ley, 46, BLACK)
    # White
    circle(lex, ley, 42, EYE_WHITE)
    # Big pupil
    circle(lex+8, ley+5, 25, PUPIL)
    # Eye shines (two highlights like anime)
    circle(lex-5, ley-15, 12, WHITE)
    circle(lex+15, ley+10, 6, WHITE)

    # === RIGHT EYE (behind scouter, visible through lens) ===
    rex, rey = cx + 62, cy - 30
    circle(rex, rey, 46, BLACK)
    circle(rex, rey, 42, EYE_WHITE)
    circle(rex-5, rey+5, 25, PUPIL)
    circle(rex-12, rey-15, 12, WHITE)
    circle(rex+10, rey+10, 6, WHITE)

    # === SCOUTER (right eye - like reference image) ===
    sx, sy = rex, rey

    # Lens - large, slightly rounded polygon
    lens_pts = [
        (sx-52, sy-42),
        (sx+48, sy-38),
        (sx+62, sy+8),
        (sx+52, sy+42),
        (sx-42, sy+38),
        (sx-58, sy+10),
    ]
    d.polygon(lens_pts, fill=SCOUTER_LENS)
    # Lighter upper portion
    d.polygon([
        (sx-48, sy-38),
        (sx+44, sy-34),
        (sx+52, sy-2),
        (sx-48, sy+2),
    ], fill=SCOUTER_LENS_LIGHT)
    # Border
    for i in range(len(lens_pts)):
        d.line([lens_pts[i], lens_pts[(i+1)%len(lens_pts)]], fill=SCOUTER_FRAME_DARK, width=5)

    # Crosshair on lens
    d.line([(sx-20, sy), (sx+40, sy)], fill=CROSSHAIR, width=2)
    d.line([(sx+10, sy-28), (sx+10, sy+28)], fill=CROSSHAIR, width=2)
    circle(sx+10, sy, 5, (235,215,105,50))

    # Data bars on lens
    for i, bx in enumerate(range(sx-30, sx+38, 15)):
        bw = 8 + (i%3)*4
        rect(bx, sy+18, bx+bw, sy+24, SCOUTER_TEXT)

    # Mechanical arm/housing (right side, like Nappa's reference)
    arm_x = sx + 58
    rounded_rect(arm_x, sy-38, arm_x+68, sy+32, 10, SCOUTER_BODY)
    rounded_rect(arm_x+4, sy-30, arm_x+60, sy+24, 6, SCOUTER_FRAME_DARK)
    # Grille
    for gy in range(sy-24, sy+20, 8):
        d.line([(arm_x+10, gy), (arm_x+54, gy)], fill=(135,140,160), width=2)
    # Red button
    circle(arm_x+60, sy-22, 13, SCOUTER_ACCENT)
    circle(arm_x+60, sy-22, 9, (245,82,68))
    circle(arm_x+60, sy-22, 4, (255,120,100))
    # White button
    circle(arm_x+60, sy+10, 9, (215,220,230))
    circle(arm_x+60, sy+10, 6, (235,240,248))

    # Ear hook
    d.polygon([
        (arm_x+58, sy-38), (arm_x+68, sy-55),
        (arm_x+52, sy-65), (arm_x+38, sy-58),
    ], fill=SCOUTER_FRAME)

    # Scouter glow
    glow = Image.new('RGBA', (size, size), (0,0,0,0))
    gd = ImageDraw.Draw(glow)
    gd.polygon([(p[0]-5, p[1]-5) for p in lens_pts], fill=(140,120,220,18))
    img = Image.alpha_composite(img, glow)
    d = ImageDraw.Draw(img)

    # === MOUTH (cute smirk) ===
    pts = []
    for t in range(30):
        tt = t/29
        mx = cx-30 + tt*55
        my = cy+60 + math.sin(tt*math.pi*0.8)*10 + tt*(-8)
        pts.append((int(mx), int(my)))
    for i in range(len(pts)-1):
        d.line([pts[i], pts[i+1]], fill=MOUTH, width=4)

    # === CLAWS (small, cute) ===
    # Left claw (raised slightly)
    for t in range(15):
        tt = t/14
        ax = cx - body_w + 5 - tt*22
        ay = cy - 10 - tt*35
        circle(int(ax), int(ay), int(9-tt*1.5), RED_DARK)
    pcx, pcy = cx - body_w - 20, cy - 50
    # Cute small pincer
    ellipse(pcx-28, pcy-18, pcx+5, pcy+2, CLAW_LIGHT)
    ellipse(pcx-28, pcy+4, pcx+5, pcy+20, CLAW)
    d.line([(pcx-25, pcy+1), (pcx+2, pcy+3)], fill=BLACK, width=2)

    # Right small claw (resting)
    for t in range(10):
        tt = t/9
        ax = cx + body_w - 5 + tt*15
        ay = cy + 30 + tt*20
        circle(int(ax), int(ay), int(8-tt*1.5), RED_DARK)
    pcx2, pcy2 = cx + body_w + 12, cy + 55
    ellipse(pcx2-18, pcy2-10, pcx2+12, pcy2+4, CLAW)
    ellipse(pcx2-18, pcy2+5, pcx2+12, pcy2+16, CLAW_DARK)

    # === TINY LEGS (bottom, cute stubs) ===
    for offset in [-45, -15, 15, 45]:
        lx = cx + offset
        ly = cy + body_h - 25
        ellipse(lx-8, ly, lx+8, ly+20, RED_DARK)

    return img


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(PUBLIC, exist_ok=True)

    img = make_lobster_v4()
    img.save(os.path.join(PUBLIC, 'char_lobster_scouter_512.png'))
    img.save(os.path.join(OUT, 'char_lobster_scouter_512.png'))
    img.resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, 'char_lobster_scouter.png'))
    print("Done! v4 - cute blob + subtle lobster + big cute eyes + scouter")
