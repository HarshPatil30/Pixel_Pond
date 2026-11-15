// From ascii-animals (https://github.com/DesignerStephen1/ascii-animals), MIT License, Copyright (c) 2026 drewdi. See LICENSE.txt
export const INK_SCALE = 0;
export const INK_DARK = 1;
export const INK_SPOT = 2;
export const INK_SHIMMER = 3;
export const INK_GLASS = 4;
export const INK_GLOW = 5;
export const INK_BODY = 6;
export const INK_LIT = 7;
export function ink(out, r, g, b, kind = INK_SCALE, glyphs = null) {
    out.r = r;
    out.g = g;
    out.b = b;
    out.kind = kind;
    out.glyphs = glyphs;
    return true;
}
