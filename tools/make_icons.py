"""生成应用图标：紫色渐变圆角方块 + 白色 L。用 PIL 直接画，不依赖字体。"""

import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "build")
os.makedirs(OUT, exist_ok=True)

START = (109, 77, 255)
MID = (154, 92, 240)
END = (226, 113, 188)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x / size * 0.55 + y / size * 0.45)
            if t < 0.5:
                c = lerp(START, MID, t / 0.5)
            else:
                c = lerp(MID, END, (t - 0.5) / 0.5)
            px[x, y] = (c[0], c[1], c[2], 255)
    return img


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def make_icon(size):
    base = gradient(size)
    mask = rounded_mask(size, round(size * 0.24))
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    icon.paste(base, (0, 0), mask)

    d = ImageDraw.Draw(icon)
    # 白色 L：竖笔 + 横笔，圆角收边
    stroke = round(size * 0.115)
    left = round(size * 0.33)
    top = round(size * 0.245)
    bottom = round(size * 0.755)
    right = round(size * 0.685)
    d.rounded_rectangle(
        [left, top, left + stroke, bottom], radius=round(stroke * 0.42), fill=(255, 255, 255, 255)
    )
    d.rounded_rectangle(
        [left, bottom - stroke, right, bottom], radius=round(stroke * 0.42), fill=(255, 255, 255, 255)
    )
    return icon


icon256 = make_icon(256)
icon256.save(os.path.join(OUT, "icon.png"))
icon256.save(
    os.path.join(OUT, "icon.ico"),
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
make_icon(32).save(os.path.join(OUT, "tray.png"))
print("icons ->", OUT)
