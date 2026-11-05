#!/usr/bin/env python3
"""Empacota tiles/sprites escolhidos dos packs CC0 do Kenney (Tiny Town + Tiny Dungeon)
em um único atlas 16 colunas e gera src/art/atlas.ts.

Uso: python3 tools/build_art.py "<pasta Tiny Dungeon/Tiles>" "<pasta Tiny Town/Tiles>"
Arte original: Kenney (www.kenney.nl), licença CC0.
"""
import sys, os
from PIL import Image, ImageDraw

DUN, TOWN = sys.argv[1], sys.argv[2]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def D(i): return Image.open(f'{DUN}/tile_{i:04d}.png').convert('RGBA')
def T(i): return Image.open(f'{TOWN}/tile_{i:04d}.png').convert('RGBA')

def over(base, top):
    return Image.alpha_composite(base.copy(), top)

def mul(img, rgb):
    out = img.copy(); px = out.load()
    for y in range(16):
        for x in range(16):
            r, g, b, a = px[x, y]
            px[x, y] = (int(r * rgb[0]), int(g * rgb[1]), int(b * rgb[2]), a)
    return out

def hexrgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

def swap(img, mapping):
    m = {hexrgb(k): hexrgb(v) for k, v in mapping.items()}
    out = img.copy(); px = out.load()
    for y in range(16):
        for x in range(16):
            r, g, b, a = px[x, y]
            if a and (r, g, b) in m:
                nr, ng, nb = m[(r, g, b)]; px[x, y] = (nr, ng, nb, a)
    return out

def skin(light, mid, shade):
    return {'#f7c282': light, '#eaa56c': mid, '#e19a65': shade}

def water():
    im = Image.new('RGBA', (16, 16), hexrgb('#3b5dc9') + (255,))
    d = ImageDraw.Draw(im)
    for (x, y) in [(2, 3), (3, 3), (9, 2), (10, 2), (5, 8), (6, 8), (7, 8), (12, 11), (13, 11), (1, 13), (2, 13)]:
        d.point((x, y), fill=hexrgb('#41a6f6') + (255,))
    for (x, y) in [(3, 2), (10, 1), (6, 7), (13, 10)]:
        d.point((x, y), fill=hexrgb('#73eff7') + (255,))
    return im

def sand():
    return swap(T(25), {})  # base; recolorido abaixo

def lighten_dirt(img):
    out = img.copy(); px = out.load()
    for y in range(16):
        for x in range(16):
            r, g, b, a = px[x, y]
            px[x, y] = (min(255, int(r * 0.45 + 245 * 0.55)), min(255, int(g * 0.45 + 218 * 0.55)), min(255, int(b * 0.45 + 150 * 0.55)), a)
    return out

def crown(img):
    out = img.copy(); px = out.load()
    gold, dark = hexrgb('#ffcd75') + (255,), hexrgb('#ef7d57') + (255,)
    for x in (4, 6, 8, 10): px[x, 1] = gold
    for x in range(4, 11): px[x, 2] = gold
    px[7, 2] = dark; px[5, 2] = dark; px[9, 2] = dark
    return out

def pebbles(img, seed):
    out = img.copy(); px = out.load()
    dark, light = hexrgb('#a9b4c8') + (255,), hexrgb('#d9e2f0') + (255,)
    spots = [(3, 4), (4, 4), (11, 9), (12, 9), (7, 13), (8, 13)] if seed == 1 else [(10, 3), (11, 3), (2, 10), (3, 10), (13, 14), (6, 7)]
    for i, (x, y) in enumerate(spots):
        px[x, y] = dark if i % 2 == 0 else light
        if i % 2 == 0 and y + 1 < 16: px[x, y + 1] = light
    return out

grass0, grass1 = T(0), T(1)
forest_ground = mul(grass0, (0.55, 0.78, 0.62))
stone = mul(T(109), (0.55, 0.55, 0.72))
red = D(0)

E = []  # (nome, imagem)
def add(n, im): E.append((n, im))

# ---- terreno ----
add('grass', grass0); add('grass2', grass1); add('flowers', T(2))
add('dirt', T(25)); add('dirt2', T(42)); add('dirt3', T(40)); add('plaza', T(109)); add('plaza2', pebbles(T(109), 1)); add('plaza3', pebbles(T(109), 2)); add('water', water()); add('sand', lighten_dirt(T(25)))
add('tree', over(grass0, T(4))); add('tree2', over(grass1, T(16))); add('bush', over(grass0, T(5)))
add('forest', forest_ground); add('ftree', over(forest_ground, T(4))); add('ftree2', over(forest_ground, T(16)))
add('red', red); add('red_rock', D(24)); add('red_tree', over(red, T(27))); add('bones', D(12))
add('stone', stone); add('grave', over(stone, D(64))); add('grave2', over(stone, D(65)))
add('roof_l', T(52)); add('roof', T(53)); add('roof_r', T(54))
add('wall_l', T(72)); add('wall', T(73)); add('wall_w', T(84)); add('wall_r', T(75)); add('door', T(85))

# ---- heróis (base para cada classe) ----
for n, i in [('c_barbarian', 87), ('c_bard', 99), ('c_cleric', 98), ('c_druid', 100), ('c_fighter', 96), ('c_monk', 86),
             ('c_paladin', 97), ('c_ranger', 112), ('c_rogue', 88), ('c_sorcerer', 85), ('c_warlock', 111), ('c_wizard', 84)]:
    add(n, D(i))

# ---- monstros ----
add('m_rat', D(123)); add('m_wolf', D(124)); add('m_slime', D(108))
add('m_kobold', swap(D(85), skin('#e8743f', '#d4683a', '#a8482a')))
add('m_goblin', swap(D(88), skin('#8ed05a', '#7bbd4a', '#4f8a35')))
add('m_skeleton', swap(D(86), skin('#f2ecd8', '#d4cdb8', '#b5ad98')))
add('m_zombie', swap(D(100), skin('#a8bd86', '#8fa66f', '#6e8a56')))
add('m_orc', swap(D(98), skin('#7db35a', '#6fa050', '#4a7a38')))
add('m_bugbear', swap(D(86), skin('#d89a5a', '#c88a4e', '#9a5e30')))
add('m_ogre', D(109))
add('m_gnarlmaw', crown(swap(D(109), skin('#f08070', '#e0655a', '#a83d3a'))))

# ---- ícones de itens ----
for n, im in [('i_dagger', D(103)), ('i_sword', D(104)), ('i_sword2', D(106)), ('i_hammer', D(117)), ('i_axe', D(118)),
              ('i_axe2', D(119)), ('i_staff', D(129)), ('i_wand', D(130)), ('i_spear', D(131)), ('i_bow', T(118)),
              ('i_shield', D(101)), ('i_stone', D(102)), ('i_pot_red', D(115)), ('i_pot_blue', D(116)), ('i_chest', D(89))]:
    add(n, im)

COLS = 16
rows = (len(E) + COLS - 1) // COLS
sheet = Image.new('RGBA', (COLS * 16, rows * 16), (0, 0, 0, 0))
for k, (_, im) in enumerate(E):
    sheet.paste(im, ((k % COLS) * 16, (k // COLS) * 16))
os.makedirs(f'{ROOT}/src/assets', exist_ok=True)
sheet.save(f'{ROOT}/src/assets/art.png', optimize=True)

with open(f'{ROOT}/src/art/atlas.ts', 'w') as f:
    f.write('// GERADO por tools/build_art.py — não edite à mão.\n')
    f.write('// Arte: Kenney (www.kenney.nl), packs Tiny Town e Tiny Dungeon, licença CC0.\n')
    f.write('export const F = {\n')
    for k, (n, _) in enumerate(E):
        f.write(f'  {n}: {k},\n')
    f.write('} as const;\n')
    f.write(f'export const ART_COLUMNS = {COLS};\n')
print(f'{len(E)} frames, atlas {sheet.size}')
