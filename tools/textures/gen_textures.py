"""Generates every texture the client uses (worn paper, stained cardstock, blood speckle, wood planks, blueprint grid,
hazard stripes, frost edges, slate, table felt, title backdrop) into public/textures/*.webp.

All output is made here from noise and simple shapes: nothing is traced or copied from any publisher art.
Run:  python tools/textures/gen_textures.py            (needs Pillow and numpy)
Deterministic: every texture has a fixed seed, so a re-run gives identical files.
"""
from __future__ import annotations

import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "textures")
os.makedirs(OUT, exist_ok=True)


# ---------- helpers ----------
def spectral(w: int, h: int, beta: float, seed: int, ax: float = 1.0, ay: float = 1.0) -> np.ndarray:
    """Tileable 1/f^beta noise in [0, 1]. ax/ay stretch the frequency axes (large ay = long streaks along y)."""
    rng = np.random.default_rng(seed)
    white = rng.standard_normal((h, w))
    f = np.fft.fft2(white)
    fy = np.fft.fftfreq(h)[:, None] * ay
    fx = np.fft.fftfreq(w)[None, :] * ax
    r = np.sqrt(fx * fx + fy * fy)
    r[0, 0] = 1.0
    f = f / (r ** (beta / 2.0))
    f[0, 0] = 0
    n = np.real(np.fft.ifft2(f))
    n -= n.min()
    n /= max(1e-9, n.max())
    return n


def fbm(w: int, h: int, seed: int, beta: float = 2.2, ax: float = 1.0, ay: float = 1.0) -> np.ndarray:
    return spectral(w, h, beta, seed, ax, ay)


def to_img(arr: np.ndarray) -> Image.Image:
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def save(img: Image.Image, name: str, quality: int = 80) -> None:
    path = os.path.join(OUT, name)
    img.save(path, "WEBP", quality=quality, method=6)
    print(f"  {name}  {img.size[0]}x{img.size[1]}  {os.path.getsize(path) // 1024} KB")


def mix(a: tuple[int, int, int], b: tuple[int, int, int], t: np.ndarray) -> np.ndarray:
    t = t[..., None]
    return np.array(a, dtype=np.float32) * (1 - t) + np.array(b, dtype=np.float32) * t


def edge_mask(w: int, h: int, width: float, power: float = 1.6) -> np.ndarray:
    """1 at the border fading to 0 `width` (fraction of the size) inside."""
    y = np.linspace(0, 1, h)[:, None]
    x = np.linspace(0, 1, w)[None, :]
    d = np.minimum(np.minimum(x, 1 - x), np.minimum(y, 1 - y))
    return np.clip(1 - d / width, 0, 1) ** power


# ---------- the textures ----------
def worn_paper(size: int = 512) -> None:
    n1 = fbm(size, size, 11, 2.4)
    n2 = fbm(size, size, 12, 1.2)
    fib = spectral(size, size, 0.6, 13, ax=0.15, ay=1.0)  # faint vertical fibres
    t = np.clip((0.55 * n1 + 0.25 * n2 + 0.2 * fib - 0.5) * 2.2 + 0.5, 0, 1)
    base = mix((238, 228, 202), (196, 178, 140), t)
    # darker, stained edges
    em = edge_mask(size, size, 0.16, 1.4) * (0.55 + 0.6 * n1)
    base = base * (1 - 0.34 * em[..., None]) + np.array([120, 92, 56], dtype=np.float32) * 0.34 * em[..., None]
    # tiny dark specks
    rng = np.random.default_rng(14)
    sp = rng.random((size, size)) > 0.9985
    base[sp] *= 0.45
    img = to_img(base).filter(ImageFilter.GaussianBlur(0.4))
    save(img, "paper-worn.webp", 82)


def stained_cardstock(size: int = 512) -> None:
    n1 = fbm(size, size, 21, 2.8)
    n2 = fbm(size, size, 22, 1.6)
    # coffee-ring style blotches: threshold a smooth field and keep only the rim
    s = fbm(size, size, 23, 3.4)
    ring = np.exp(-(((s - 0.62) / 0.035) ** 2))
    t = 0.6 * n1 + 0.4 * n2
    base = mix((214, 198, 160), (176, 152, 108), t)
    base = base * (1 - 0.28 * ring[..., None]) + np.array([96, 66, 36], dtype=np.float32) * 0.28 * ring[..., None]
    em = edge_mask(size, size, 0.12, 1.2) * (0.5 + 0.7 * n2)
    base = base * (1 - 0.42 * em[..., None]) + np.array([84, 58, 30], dtype=np.float32) * 0.42 * em[..., None]
    save(to_img(base).filter(ImageFilter.GaussianBlur(0.5)), "cardstock-stained.webp", 82)


def blood_speckle(size: int = 512) -> None:
    rng = np.random.default_rng(31)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    bias = fbm(size, size, 32, 2.0)

    def drop(x: float, y: float, r: float, a: int) -> None:
        col = (int(120 + rng.integers(0, 40)), int(rng.integers(8, 24)), int(rng.integers(10, 26)), a)
        d.ellipse((x - r, y - r, x + r, y + r), fill=col)
        if r > 3 and rng.random() < 0.5:  # a short streak
            ang = rng.uniform(-0.6, 0.6) + math.pi / 2
            ln = r * rng.uniform(1.5, 4)
            d.line((x, y, x + math.cos(ang) * ln, y + math.sin(ang) * ln), fill=col, width=max(1, int(r * 0.6)))

    for _ in range(1000):
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        # denser near the bottom and the edges
        edge = min(x, size - x, y, size - y) / size
        keep = (0.25 + 0.9 * (y / size) ** 2) * (1.0 - min(1.0, edge * 3.0) * 0.6) * (0.5 + bias[int(y) % size][int(x) % size])
        if rng.random() > keep:
            continue
        r = abs(rng.normal(0, 1.8)) + 0.6
        if rng.random() < 0.02:
            r *= 3.2
        drop(x, y, r, int(rng.integers(120, 235)))
    for _ in range(7):  # a few larger splashes with satellites
        cx, cy = rng.uniform(0, size), rng.uniform(size * 0.4, size)
        drop(cx, cy, rng.uniform(5, 11), 200)
        for _k in range(rng.integers(6, 16)):
            a = rng.uniform(0, 2 * math.pi)
            rr = rng.uniform(8, 38)
            drop(cx + math.cos(a) * rr, cy + math.sin(a) * rr, rng.uniform(0.8, 2.6), 190)
    save(img.filter(ImageFilter.GaussianBlur(0.35)), "blood-speckle.webp", 84)


def wood_planks(w: int = 512, h: int = 512, planks: int = 4, name: str = "wood-planks.webp", dark: bool = False) -> None:
    grain = spectral(w, h, 1.4, 41, ax=0.05, ay=1.0)  # long streaks along x
    grain2 = spectral(w, h, 2.2, 42, ax=0.2, ay=1.0)
    blot = fbm(w, h, 43, 2.6)
    base = np.zeros((h, w, 3), dtype=np.float32)
    ph = h // planks
    rng = np.random.default_rng(44)
    for p in range(planks):
        tone = rng.uniform(0.85, 1.12)
        lo, hi = ((54, 42, 34), (96, 74, 54)) if dark else ((112, 88, 62), (160, 126, 88))
        t = 0.55 * grain + 0.3 * grain2 + 0.15 * blot
        plank = mix(lo, hi, t) * tone
        y0, y1 = p * ph, (p + 1) * ph
        base[y0:y1] = plank[y0:y1]
        base[y0 : y0 + 3] *= 0.45  # seam shadow
        base[y0 + 3 : y0 + 5] *= 1.12  # lit lip
        # butt joint
        jx = int(rng.integers(w // 5, w - w // 5))
        base[y0:y1, jx : jx + 2] *= 0.5
        # nails
        for nx in (jx - 40, jx + 44):
            ny = y0 + ph // 2
            base[ny - 2 : ny + 2, nx - 2 : nx + 2] = (36, 30, 26)
    # wear: pale scuffs
    wear = spectral(w, h, 1.0, 45, ax=0.04, ay=1.0)
    base += np.clip((wear - 0.7) * 120, 0, 40)[..., None]
    save(to_img(base).filter(ImageFilter.GaussianBlur(0.3)), name, 80)


def blueprint(size: int = 512) -> None:
    n = fbm(size, size, 51, 2.2)
    n2 = fbm(size, size, 52, 1.1)
    base = mix((24, 58, 104), (34, 78, 134), 0.25 * n + 0.15 * n2 + 0.3)
    img = to_img(base).convert("RGB")
    d = ImageDraw.Draw(img, "RGBA")
    minor, major = 16, 64
    for i in range(0, size + 1, minor):
        a = 70 if i % major == 0 else 28
        wd = 2 if i % major == 0 else 1
        d.line((i, 0, i, size), fill=(170, 205, 245, a), width=wd)
        d.line((0, i, size, i), fill=(170, 205, 245, a), width=wd)
    arr = np.asarray(img).astype(np.float32)
    # chalky dust and creases
    crease = np.clip((spectral(size, size, 3.0, 53) - 0.55) * 4, 0, 1)
    arr += (crease[..., None] * 26)
    save(to_img(arr), "blueprint.webp", 82)


def hazard_stripes(w: int = 256, h: int = 64) -> None:
    img = np.zeros((h, w, 3), dtype=np.float32)
    period = 64  # horizontal period of one yellow + one black band; divides w so it tiles
    yy, xx = np.mgrid[0:h, 0:w]
    band = ((xx + yy) % period) < period / 2
    yellow = np.array((222, 176, 38), dtype=np.float32)
    black = np.array((26, 24, 22), dtype=np.float32)
    img[:] = np.where(band[..., None], yellow, black)
    n = fbm(w, h, 61, 1.6)
    img *= (0.78 + 0.34 * n)[..., None]
    rng = np.random.default_rng(62)
    scr = rng.random((h, w)) > 0.985  # worn flecks show bare paint
    img[scr] = np.minimum(img[scr] + 55, 255)
    save(to_img(img), "hazard-stripes.webp", 82)


def frost_edge(size: int = 512) -> None:
    n = fbm(size, size, 71, 1.2)
    n2 = fbm(size, size, 72, 0.5)
    em = edge_mask(size, size, 0.2, 1.3)
    crystal = np.clip((n2 - 0.45) * 3.0, 0, 1)
    a = np.clip(em * (0.25 + 0.9 * n) * (0.45 + crystal), 0, 1)
    a = np.clip(a * 1.5, 0, 1)
    rgba = np.zeros((size, size, 4), dtype=np.float32)
    rgba[..., 0] = 226 + 20 * n
    rgba[..., 1] = 240 + 12 * n
    rgba[..., 2] = 255
    rgba[..., 3] = a * 255
    img = Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), "RGBA").filter(ImageFilter.GaussianBlur(0.6))
    save(img, "frost-edge.webp", 80)


def slate(size: int = 512) -> None:
    n = fbm(size, size, 81, 2.4)
    n2 = fbm(size, size, 82, 1.0)
    base = mix((28, 38, 54), (52, 66, 88), 0.6 * n + 0.4 * n2)
    img = to_img(base).convert("RGB")
    d = ImageDraw.Draw(img, "RGBA")
    rng = np.random.default_rng(83)
    for _ in range(90):  # chalk scratches
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        a = rng.uniform(0, 2 * math.pi)
        ln = rng.uniform(10, 70)
        d.line((x, y, x + math.cos(a) * ln, y + math.sin(a) * ln), fill=(205, 220, 240, int(rng.integers(10, 34))), width=1)
    arr = np.asarray(img).astype(np.float32)
    em = edge_mask(size, size, 0.08, 1.4)
    arr *= (1 - 0.35 * em)[..., None]
    save(to_img(arr), "slate.webp", 80)


def table_felt(size: int = 512) -> None:
    n = fbm(size, size, 91, 1.8)
    n2 = fbm(size, size, 92, 0.7)
    base = mix((18, 24, 32), (34, 44, 56), 0.5 * n + 0.5 * n2)
    save(to_img(base), "table-felt.webp", 78)


def snow_flecks(size: int = 256) -> None:
    """A tiling overlay of soft white snow flecks used over card art panels and the title screen."""
    rng = np.random.default_rng(95)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for _ in range(260):
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        r = rng.uniform(0.6, 2.4)
        a = int(rng.integers(40, 170))
        for ox in (-size, 0, size):
            for oy in (-size, 0, size):
                d.ellipse((x + ox - r, y + oy - r, x + ox + r, y + oy + r), fill=(246, 250, 255, a))
    save(img.filter(ImageFilter.GaussianBlur(0.7)), "snow-flecks.webp", 80)


def title_backdrop(w: int = 1280, h: int = 720) -> None:
    rng = np.random.default_rng(101)
    yy = np.linspace(0, 1, h)[:, None]
    sky = np.zeros((h, w, 3), dtype=np.float32)
    top, mid, low = np.array((10, 16, 30)), np.array((38, 54, 82)), np.array((150, 164, 178))
    t = np.clip(yy / 0.72, 0, 1)
    sky[:] = (top * (1 - t) + mid * t)[..., None, :].reshape(h, 1, 3)
    glow = np.clip((yy - 0.55) / 0.45, 0, 1) ** 2
    sky += (low * 0.55)[None, None, :] * glow[..., None]
    cloud = fbm(w, h, 102, 2.6)
    sky *= (0.82 + 0.35 * cloud)[..., None]
    img = to_img(sky).convert("RGB")
    d = ImageDraw.Draw(img, "RGBA")
    # a far tree line and a ruined silhouette: pure shapes, nothing traced
    horizon = int(h * 0.74)
    for layer, (col, amp, step) in enumerate([((22, 30, 44, 255), 60, 14), ((12, 16, 24, 255), 90, 22)]):
        pts = [(0, h)]
        x = 0
        while x <= w + step:
            peak = horizon - (layer * 6) - rng.uniform(0.2, 1.0) * amp * (0.4 + 0.6 * abs(math.sin(x / 140.0 + layer)))
            pts += [(x, horizon + 10 - layer * 6), (x + step * 0.5, peak)]
            x += step
        pts.append((w, h))
        d.polygon(pts, fill=col)
    # a low building block with lit windows
    bx, bw = int(w * 0.58), int(w * 0.22)
    d.rectangle((bx, horizon - 70, bx + bw, h), fill=(10, 13, 20, 255))
    d.polygon([(bx - 8, horizon - 70), (bx + bw / 2, horizon - 112), (bx + bw + 8, horizon - 70)], fill=(10, 13, 20, 255))
    for i in range(5):
        wx = bx + 22 + i * (bw - 44) // 4
        lit = rng.random() < 0.55
        d.rectangle((wx, horizon - 40, wx + 14, horizon - 22), fill=(236, 176, 80, 230 if lit else 40))
    # snow ground
    d.rectangle((0, horizon + 22, w, h), fill=(168, 182, 198, 255))
    ground = fbm(w, h, 103, 2.0)
    arr = np.asarray(img).astype(np.float32)
    mask = (np.arange(h)[:, None] > horizon + 22).astype(np.float32)
    arr = arr * (1 - mask[..., None] * (0.0)) + mask[..., None] * (ground[..., None] - 0.5) * 48
    # falling snow: soft round flakes on their own layer
    flakes = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    fd = ImageDraw.Draw(flakes)
    for r_, n_, a_ in ((1.2, 700, 120), (2.0, 300, 170), (3.4, 70, 215)):
        for _ in range(n_):
            x, y = rng.uniform(0, w), rng.uniform(0, h)
            fd.ellipse((x - r_, y - r_, x + r_, y + r_), fill=(248, 250, 255, a_))
    flakes = flakes.filter(ImageFilter.GaussianBlur(0.9))
    img2 = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGBA")
    arr = np.asarray(Image.alpha_composite(img2, flakes).convert("RGB")).astype(np.float32)
    vig = edge_mask(w, h, 0.38, 1.3)
    arr *= (1 - 0.6 * vig)[..., None]
    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    # blood on the corners
    tile = Image.open(os.path.join(OUT, "blood-speckle.webp")).convert("RGBA")
    blood = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for ox in range(0, w, tile.size[0]):
        for oy in range(0, h, tile.size[1]):
            blood.paste(tile, (ox, oy))
    ba = np.asarray(blood).astype(np.float32)
    ba[..., 3] *= (edge_mask(w, h, 0.3, 1.8) * 0.8)
    blood = Image.fromarray(ba.astype(np.uint8), "RGBA")
    out = Image.alpha_composite(out.convert("RGBA"), blood).convert("RGB")
    save(out, "title-backdrop.webp", 74)


def main() -> None:
    print(f"writing to {OUT}")
    worn_paper()
    stained_cardstock()
    blood_speckle()
    wood_planks()
    wood_planks(1024, 1024, 8, "table-wood.webp", dark=True)
    blueprint()
    hazard_stripes()
    frost_edge()
    slate()
    table_felt()
    snow_flecks()
    title_backdrop()


if __name__ == "__main__":
    sys.exit(main())
