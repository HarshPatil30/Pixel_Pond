// From ascii-animals (https://github.com/DesignerStephen1/ascii-animals), MIT License, Copyright (c) 2026 drewdi. See LICENSE.txt
import { clamp, hash3 } from "../math.js";
export const seg = {
    t: 0
};
export function toSegment(px, py, ax, ay, bx, by) {
    const sx = bx - ax;
    const sy = by - ay;
    const t = clamp(((px - ax) * sx + (py - ay) * sy) / (sx * sx + sy * sy || 1), 0, 1);
    seg.t = t;
    return Math.hypot(px - ax - sx * t, py - ay - sy * t);
}
export function inEllipse(u, v, cu, cv, a, b) {
    const x = (u - cu) / a;
    const y = (v - cv) / b;
    return x * x + y * y <= 1;
}
export function spotted(u, v, cell, radius, seed) {
    const gu = u / cell;
    const gv = v / cell;
    const cu = Math.floor(gu);
    const cv = Math.floor(gv);
    const jx = 0.25 + 0.5 * hash3(cu, cv, seed);
    const jy = 0.25 + 0.5 * hash3(cu, cv, seed + 11);
    const r = radius / cell * (0.6 + 0.6 * hash3(cu, cv, seed + 23));
    return (gu - cu - jx) ** 2 + (gv - cv - jy) ** 2 < r * r;
}
