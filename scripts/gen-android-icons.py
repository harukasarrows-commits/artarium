#!/usr/bin/env python3
"""resources/ の元画像から Android 起動アイコン一式を android/app/src/main/res/ に生成する。

android/ は git 管理外なので、`npx cap add android` で再生成したあとは必ずこれを実行する。
  python3 scripts/gen-android-icons.py

入力（resources/）:
  icon-only.png        通常アイコン（角丸・四隅は透明）
  icon-foreground.png  マスク対応アイコンの前景（四隅まで塗り、モチーフは中央 61% 以内）
  icon-background.png  背景色の見本（左上ピクセルの色を @color/ic_launcher_background に書く）
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android/app/src/main/res"
SRC = ROOT / "resources"
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
LAUNCHER_DP, FOREGROUND_DP = 48, 108

icon = Image.open(SRC / "icon-only.png").convert("RGBA")
fg = Image.open(SRC / "icon-foreground.png").convert("RGBA")
bg_rgb = Image.open(SRC / "icon-background.png").convert("RGB").getpixel((0, 0))

def fit(im, px):
    return im.resize((px, px), Image.LANCZOS)

def circle(im):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, im.size[0] - 1, im.size[1] - 1), fill=255)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out

for name, scale in DENSITIES.items():
    d = RES / f"mipmap-{name}"
    d.mkdir(parents=True, exist_ok=True)
    lp, fp = int(LAUNCHER_DP * scale), int(FOREGROUND_DP * scale)
    fit(icon, lp).save(d / "ic_launcher.png")
    circle(fit(fg, lp)).save(d / "ic_launcher_round.png")
    fit(fg, fp).save(d / "ic_launcher_foreground.png")
    print(f"{name}: launcher {lp}px / foreground {fp}px")

color = "#{:02X}{:02X}{:02X}".format(*bg_rgb)
(RES / "values/ic_launcher_background.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    f'    <color name="ic_launcher_background">{color}</color>\n</resources>\n'
)
print("background color:", color)
