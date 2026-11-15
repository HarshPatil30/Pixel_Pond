// From ascii-animals (https://github.com/DesignerStephen1/ascii-animals), MIT License, Copyright (c) 2026 drewdi. See LICENSE.txt
export const TAU = Math.PI * 2;
export const clamp = (v, lo, hi)=>v < lo ? lo : v > hi ? hi : v;
export const rand = (lo, hi)=>lo + Math.random() * (hi - lo);
export const frac = (x)=>x - Math.floor(x);
export const lerp = (a, b, t)=>a + (b - a) * t;
export function smoothstep(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
}
export function angleDiff(a, b) {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
}
export function hash3(x, y, z) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1442695041);
    h = Math.imul(h ^ h >>> 13, 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}
