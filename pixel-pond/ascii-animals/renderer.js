// From ascii-animals (https://github.com/DesignerStephen1/ascii-animals), MIT License, Copyright (c) 2026 drewdi. See LICENSE.txt
import { INK_BODY, INK_DARK, INK_GLASS, INK_GLOW, INK_LIT, INK_SCALE, INK_SHIMMER, INK_SPOT } from "./ink.js";
import { clamp, hash3 } from "./math.js";
const ALPHA_LEVELS = 6;
const PALETTES = {
    light: {
        background: [
            246,
            243,
            236
        ],
        grid: [
            30,
            34,
            60,
            0.07
        ],
        trailAlpha: 0.7,
        ink: [
            42,
            42,
            59
        ]
    },
    dark: {
        background: [
            6,
            7,
            12
        ],
        grid: [
            255,
            255,
            255,
            0.055
        ],
        trailAlpha: 0.85,
        ink: [
            150,
            160,
            200
        ]
    }
};
const SCALE_RAMP = ".:;+=*%#";
const DARK_GLYPHS = "#%@";
const SPOT_GLYPHS = "o*";
const BODY_GLYPHS = "8#@";
const GLOW_RAMP = ".:+*";
const EDGE_HEAVY = ":;";
const EDGE_LIGHT = ".',`";
const SPARKLES = [
    [
        255,
        255,
        255
    ],
    [
        228,
        246,
        255
    ],
    [
        200,
        244,
        255
    ]
];
const CELL_NONE = 0;
const CELL_SOLID = 1;
const CELL_SOFT = 2;
const SUBSAMPLES = [
    0.25,
    0.3,
    0.75,
    0.3,
    0.25,
    0.72,
    0.75,
    0.72
];
function hueMatrix(degrees) {
    const a = Math.cos(degrees * Math.PI / 180);
    const s = Math.sin(degrees * Math.PI / 180);
    return [
        0.213 + a * 0.787 - s * 0.213,
        0.715 - a * 0.715 - s * 0.715,
        0.072 - a * 0.072 + s * 0.928,
        0.213 - a * 0.213 + s * 0.143,
        0.715 + a * 0.285 + s * 0.14,
        0.072 - a * 0.072 - s * 0.283,
        0.213 - a * 0.213 - s * 0.787,
        0.715 - a * 0.715 + s * 0.715,
        0.072 + a * 0.928 + s * 0.072
    ];
}
export function paintGrid(g, W, H, cw, ch, dpr, stroke = "rgba(30,34,60,0.07)") {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.strokeStyle = stroke;
    g.lineWidth = 1;
    g.beginPath();
    for(let c = 0; c <= Math.ceil(W / cw); c++){
        const x = Math.round(c * cw * dpr) + 0.5;
        g.moveTo(x, 0);
        g.lineTo(x, H * dpr);
    }
    for(let r = 0; r <= Math.ceil(H / ch); r++){
        const y = Math.round(r * ch * dpr) + 0.5;
        g.moveTo(0, y);
        g.lineTo(W * dpr, y);
    }
    g.stroke();
}
const rgb = (r, g, b)=>`rgb(${clamp(Math.round(r), 0, 255)},${clamp(Math.round(g), 0, 255)},${clamp(Math.round(b), 0, 255)})`;
const pack = (r, g, b)=>clamp(Math.round(r), 0, 255) << 16 | clamp(Math.round(g), 0, 255) << 8 | clamp(Math.round(b), 0, 255);
export function lineGlyph(angle) {
    let a = angle % Math.PI;
    if (a < 0) a += Math.PI;
    return a < Math.PI / 8 || a >= 7 * Math.PI / 8 ? "-" : a < 3 * Math.PI / 8 ? "\\" : a < 5 * Math.PI / 8 ? "|" : "/";
}
export class Pen {
    r;
    ink = {
        r: 0,
        g: 0,
        b: 0,
        kind: 0,
        glyphs: null,
        au: 0,
        av: 0
    };
    t = 0;
    theme = "light";
    constructor(r){
        this.r = r;
    }
    get cw() {
        return this.r.cw;
    }
    get ch() {
        return this.r.ch;
    }
    get cols() {
        return this.r.cols;
    }
    get rows() {
        return this.r.rows;
    }
    get contrast() {
        return this.r.palette.ink;
    }
    toWorld(p, u, v, out) {
        const c = Math.cos(p.heading);
        const s = Math.sin(p.heading);
        out.x = p.x + (u * c - v * s) * p.span;
        out.y = p.y + (u * s + v * c) * p.span;
        return out;
    }
    fogFor(depth) {
        return (1 - depth) * this.r.tuning.fog;
    }
    shape(p, reach, sample, opts = {}) {
        this.r.shape(p, reach, sample, opts);
    }
    line(x0, y0, x1, y1, color, depth, tip, fog = this.fogFor(depth)) {
        this.r.line(x0, y0, x1, y1, color, fog, tip);
    }
    a = {
        x: 0,
        y: 0
    };
    b = {
        x: 0,
        y: 0
    };
    lineBody(p, u0, v0, u1, v1, color, tip) {
        const a = this.toWorld(p, u0, v0, this.a);
        const b = this.toWorld(p, u1, v1, this.b);
        this.r.line(a.x, a.y, b.x, b.y, color, this.fogFor(p.depth), tip);
    }
    dot(x, y, glyph, color, depth, fog = this.fogFor(depth)) {
        this.r.dot(x, y, glyph, color, fog);
    }
    spot(x, y, glyph, color, fill, depth) {
        this.r.spot(x, y, glyph, color, fill, this.fogFor(depth));
    }
    shed(x, y, amount) {
        this.r.shed(x, y, amount);
    }
    cellIndex(x, y) {
        return this.r.cellIndex(x, y);
    }
}
export class AsciiRenderer {
    canvas;
    tuning;
    cw = 12;
    ch = 18;
    cols = 0;
    rows = 0;
    palette = PALETTES.light;
    pen = new Pen(this);
    ctx;
    bg;
    dpr = 1;
    width = 0;
    height = 0;
    fontFamily = "ui-monospace, Menlo, monospace";
    theme = "light";
    animal = null;
    energy = new Float32Array(0);
    energyTmp = new Float32Array(0);
    trailStyles = [];
    hue = hueMatrix(0);
    hueOn = false;
    cellFlag = new Uint8Array(0);
    cellFill = new Uint32Array(0);
    cellColor = new Uint32Array(0);
    cellGlyph = new Uint16Array(0);
    constructor(canvas, tuning){
        this.canvas = canvas;
        this.tuning = tuning;
        const ctx = canvas.getContext("2d", {
            alpha: false
        });
        if (!ctx) throw new Error("2D canvas unavailable");
        this.ctx = ctx;
        this.bg = document.createElement("canvas");
        this.setTheme("light");
    }
    setFontFamily(family) {
        if (family) this.fontFamily = family;
    }
    setTheme(theme) {
        this.theme = theme;
        this.pen.theme = theme;
        this.palette = PALETTES[theme];
        this.restyle();
    }
    setAnimal(animal, tuning) {
        this.animal = animal;
        this.tuning = tuning;
        this.energy.fill(0);
        this.restyle();
    }
    restyle() {
        const palette = this.palette;
        const base = this.animal?.trail[this.theme] ?? palette.ink;
        this.hue = hueMatrix(this.tuning.hueShift);
        this.hueOn = this.tuning.hueShift % 360 !== 0;
        const [r, g, b] = this.turn(base[0], base[1], base[2]);
        this.trailStyles = [];
        for(let l = 0; l < ALPHA_LEVELS; l++){
            this.trailStyles.push(`rgba(${r},${g},${b},${(palette.trailAlpha * (l + 1) / ALPHA_LEVELS).toFixed(3)})`);
        }
        this.paintBackground();
    }
    turn(r, g, b) {
        if (!this.hueOn) return [
            r,
            g,
            b
        ];
        const m = this.hue;
        return [
            m[0] * r + m[1] * g + m[2] * b,
            m[3] * r + m[4] * g + m[5] * b,
            m[6] * r + m[7] * g + m[8] * b
        ];
    }
    fade(r, g, b, f) {
        const [br, bg, bb] = this.palette.background;
        return pack(r + (br - r) * f, g + (bg - g) * f, b + (bb - b) * f);
    }
    resize(width, height, dpr) {
        const prevCols = this.cols;
        const prevRows = this.rows;
        this.width = width;
        this.height = height;
        this.dpr = dpr;
        this.cw = clamp(Math.round(width / 124 / this.tuning.detail), 5, 24);
        this.ch = Math.round(this.cw * 1.45);
        this.cols = Math.ceil(width / this.cw);
        this.rows = Math.ceil(height / this.ch);
        this.canvas.width = Math.round(width * dpr);
        this.canvas.height = Math.round(height * dpr);
        this.bg.width = this.canvas.width;
        this.bg.height = this.canvas.height;
        const n = this.cols * this.rows;
        if (this.cols !== prevCols || this.rows !== prevRows) {
            this.energy = new Float32Array(n);
            this.energyTmp = new Float32Array(n);
            this.cellFlag = new Uint8Array(n);
            this.cellFill = new Uint32Array(n);
            this.cellColor = new Uint32Array(n);
            this.cellGlyph = new Uint16Array(n);
        }
        this.paintBackground();
    }
    paintBackground() {
        const g = this.bg.getContext("2d");
        if (!g) return;
        const { width: W, height: H, dpr, cw, ch } = this;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.fillStyle = rgb(...this.palette.background);
        g.fillRect(0, 0, W, H);
        const [gr, gg, gb, ga] = this.palette.grid;
        paintGrid(g, W, H, cw, ch, dpr, `rgba(${gr},${gg},${gb},${(ga * this.tuning.grid).toFixed(3)})`);
    }
    render(flock, dt) {
        const { ctx, dpr, cols, ch } = this;
        if (cols === 0) return;
        this.pen.t = flock.time;
        for (const e of flock.events)this.stamp(e.x, e.y, e.radius, e.amount);
        flock.events.length = 0;
        this.diffuse(dt);
        this.cellFlag.fill(CELL_NONE);
        const animal = flock.animal;
        if (animal.drawAll) animal.drawAll(flock, this.pen);
        else if (animal.draw) for (const c of flock.creatures)animal.draw(c, this.pen, flock);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(this.bg, 0, 0);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.drawTrail(flock.time);
        ctx.font = `600 ${Math.round(ch * 0.74)}px ${this.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        this.drawCells();
    }
    cellIndex(x, y) {
        const c = Math.floor(x / this.cw);
        const r = Math.floor(y / this.ch);
        if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
        return r * this.cols + c;
    }
    shed(x, y, amount) {
        const i = this.cellIndex(x, y);
        if (i >= 0) this.energy[i] = Math.min(1.6, this.energy[i] + amount * this.tuning.trail);
    }
    stamp(x, y, radius, amount) {
        const field = this.energy;
        const c0 = Math.floor(x / this.cw);
        const r0 = Math.floor(y / this.ch);
        for(let r = r0 - radius; r <= r0 + radius; r++){
            for(let c = c0 - radius; c <= c0 + radius; c++){
                if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
                const d = Math.hypot(c - c0, (r - r0) * 1.4);
                if (d > radius + 0.5) continue;
                const i = r * this.cols + c;
                field[i] = Math.min(1.6, field[i] + amount * (1 - d / (radius + 1)));
            }
        }
    }
    diffuse(dt) {
        const { cols, rows, energy, energyTmp: tmp } = this;
        const decay = Math.exp(-dt * this.tuning.trailFade);
        for(let r = 0; r < rows; r++){
            for(let c = 0; c < cols; c++){
                const i = r * cols + c;
                const l = c > 0 ? energy[i - 1] : energy[i];
                const rt = c < cols - 1 ? energy[i + 1] : energy[i];
                const u = r > 0 ? energy[i - cols] : energy[i];
                const d = r < rows - 1 ? energy[i + cols] : energy[i];
                tmp[i] = (energy[i] * 4 + l + rt + u + d) * 0.125 * decay;
            }
        }
        this.energy = tmp;
        this.energyTmp = energy;
    }
    drawTrail(t) {
        const { ctx, cols, cw, ch, energy, cellFlag } = this;
        const small = Math.max(2, Math.round(cw * 0.19));
        for(let level = 0; level < ALPHA_LEVELS; level++){
            ctx.fillStyle = this.trailStyles[level];
            for(let i = 0; i < energy.length; i++){
                const e = energy[i];
                if (e < 0.12 || cellFlag[i] === CELL_SOLID) continue;
                const col = i % cols;
                const row = i / cols | 0;
                const twinkle = 0.75 + 0.25 * Math.sin(t * 5 + hash3(col, row, 3) * 40);
                if (clamp(Math.floor(e * twinkle * 4 * ALPHA_LEVELS) - 1, 0, ALPHA_LEVELS - 1) !== level) continue;
                const size = e > 0.6 ? small + 1 : small;
                ctx.fillRect(Math.round(col * cw + cw * 0.5 - size / 2), Math.round(row * ch + ch * 0.6 - size / 2), size, size);
            }
        }
    }
    probe(sample, p, hc, hs, px, py) {
        const ink = this.pen.ink;
        const dx = px - p.x;
        const dy = py - p.y;
        const u = (dx * hc + dy * hs) / p.span;
        const v = (dy * hc - dx * hs) / p.span;
        ink.glyphs = null;
        ink.au = u;
        ink.av = v;
        return sample(u, v, px, py);
    }
    shape(p, reach, sample, { light = 1, tilt = 0, fog = (1 - p.depth) * this.tuning.fog }) {
        const { cellFlag, cellFill, cellColor, cellGlyph, cw, ch, cols, rows } = this;
        const ink = this.pen.ink;
        const t = this.pen.t;
        const { shimmer, sparkle } = this.tuning;
        const S = p.span;
        const hc = Math.cos(p.heading);
        const hs = Math.sin(p.heading);
        const R = reach * S;
        const c0 = Math.max(0, Math.floor((p.x - R) / cw));
        const c1 = Math.min(cols - 1, Math.floor((p.x + R) / cw));
        const r0 = Math.max(0, Math.floor((p.y - R) / ch));
        const r1 = Math.min(rows - 1, Math.floor((p.y + R) / ch));
        for(let r = r0; r <= r1; r++){
            for(let c = c0; c <= c1; c++){
                const x = c * cw;
                const y = r * ch;
                const center = this.probe(sample, p, hc, hs, x + cw / 2, y + ch / 2);
                let hits = center ? 1 : 0;
                let ir = ink.r;
                let ig = ink.g;
                let ib = ink.b;
                const kind = ink.kind;
                const glyphs = ink.glyphs;
                const au = ink.au;
                const av = ink.av;
                for(let k = 0; k < SUBSAMPLES.length; k += 2){
                    if (this.probe(sample, p, hc, hs, x + SUBSAMPLES[k] * cw, y + SUBSAMPLES[k + 1] * ch)) {
                        if (hits === 0) {
                            ir = ink.r;
                            ig = ink.g;
                            ib = ink.b;
                        }
                        hits++;
                    }
                }
                if (hits === 0) continue;
                const coverage = hits / 5;
                const i = r * cols + c;
                const solid = center && coverage >= 0.6;
                if (!solid && cellFlag[i] === CELL_SOLID) continue;
                [ir, ig, ib] = this.turn(ir, ig, ib);
                let k = light * (1 + (hash3(c, r, Math.floor(t * 6)) - 0.5) * 0.06);
                if (solid && kind === INK_SHIMMER) {
                    k *= 1 - 0.4 * shimmer + shimmer * Math.sin(t * 2.2 + au * 9 + av * 6 + tilt + p.heading * 2);
                }
                ir *= k;
                ig *= k;
                ib *= k;
                const key = hash3(Math.round(au * S / (cw * 0.9)), Math.round(av * S / (cw * 0.9)), p.id) * 4294967295 >>> 0;
                if (!solid) {
                    const set = coverage >= 0.5 ? EDGE_HEAVY : EDGE_LIGHT;
                    cellFlag[i] = CELL_SOFT;
                    cellColor[i] = this.fade(ir, ig, ib, Math.min(1, fog + 0.55 - 0.45 * coverage));
                    cellGlyph[i] = set.charCodeAt((key >>> 8) % set.length);
                    continue;
                }
                if (kind === INK_GLOW) {
                    if (cellFlag[i] === CELL_SOLID) continue;
                    const lum = (0.3 * ir + 0.59 * ig + 0.11 * ib) / 255;
                    const set = glyphs ?? GLOW_RAMP;
                    cellFlag[i] = CELL_SOFT;
                    cellColor[i] = this.fade(ir, ig, ib, fog);
                    cellGlyph[i] = set.charCodeAt(glyphs ? (key >>> 8) % set.length : clamp(Math.floor(lum * set.length), 0, set.length - 1));
                    continue;
                }
                cellFlag[i] = CELL_SOLID;
                const roll = hash3(key, Math.floor(t * 2.4 + key % 997 / 97), 7);
                let set;
                let gr;
                let gg;
                let gb;
                if (kind === INK_GLASS) {
                    cellFill[i] = this.fade(ir, ig, ib, Math.min(1, 0.62 + fog * 0.38));
                    set = glyphs ?? SCALE_RAMP;
                    cellColor[i] = this.fade(ir, ig, ib, fog);
                    cellGlyph[i] = set.charCodeAt((key >>> 8) % set.length);
                    if (roll < sparkle) cellColor[i] = pack(...SPARKLES[key % SPARKLES.length]);
                    continue;
                }
                if (kind === INK_LIT) {
                    cellFill[i] = this.fade(ir * 0.58, ig * 0.58, ib * 0.58, fog);
                    set = glyphs ?? ".:*";
                    cellColor[i] = roll < sparkle ? pack(...SPARKLES[key % SPARKLES.length]) : this.fade(Math.min(255, ir * 1.05 + 50), Math.min(255, ig * 1.05 + 50), Math.min(255, ib * 1.05 + 50), fog);
                    cellGlyph[i] = set.charCodeAt((key >>> 8) % set.length);
                    continue;
                }
                const fill = this.fade(ir, ig, ib, fog);
                cellFill[i] = fill;
                const fr = fill >>> 16;
                const fg = fill >>> 8 & 255;
                const fb = fill & 255;
                if (kind === INK_BODY) {
                    set = glyphs ?? BODY_GLYPHS;
                    [gr, gg, gb] = [
                        fr * 1.6 + 44,
                        fg * 1.6 + 40,
                        fb * 1.6 + 36
                    ];
                } else if (kind === INK_DARK) {
                    set = glyphs ?? DARK_GLYPHS;
                    [gr, gg, gb] = [
                        fr * 1.7 + 34,
                        fg * 1.7 + 30,
                        fb * 1.7 + 30
                    ];
                } else if (kind === INK_SPOT) {
                    set = glyphs ?? SPOT_GLYPHS;
                    [gr, gg, gb] = [
                        fr * 0.4,
                        fg * 0.4,
                        fb * 0.4
                    ];
                } else {
                    set = glyphs ?? SCALE_RAMP;
                    [gr, gg, gb] = [
                        fr * 0.42,
                        fg * 0.42,
                        fb * 0.42
                    ];
                }
                let glyph;
                if (glyphs || kind !== INK_SCALE && kind !== INK_SHIMMER) {
                    glyph = set.charCodeAt((key >>> 8) % set.length);
                } else {
                    const lum = (0.3 * fr + 0.59 * fg + 0.11 * fb) / 255;
                    const jitter = (key >>> 4) % 3 - 1;
                    glyph = set.charCodeAt(clamp(Math.floor((1 - lum) * (set.length - 0.01)) + jitter, 0, set.length - 1));
                }
                cellGlyph[i] = glyph;
                const glints = kind === INK_SHIMMER ? sparkle : kind === INK_SCALE ? sparkle / 3 : 0;
                cellColor[i] = roll < glints ? pack(...SPARKLES[key % SPARKLES.length]) : pack(gr, gg, gb);
            }
        }
    }
    line(x0, y0, x1, y1, color, fog, tip) {
        const { cellFlag, cellColor, cellGlyph, cw } = this;
        const [r, g, b] = this.turn(color[0], color[1], color[2]);
        const packed = this.fade(r, g, b, fog);
        const glyph = lineGlyph(Math.atan2(y1 - y0, x1 - x0)).charCodeAt(0);
        const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (cw * 0.5)));
        let last = -1;
        for(let s = 1; s <= steps; s++){
            const i = this.cellIndex(x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps);
            if (i < 0 || cellFlag[i] === CELL_SOLID) continue;
            cellFlag[i] = CELL_SOFT;
            cellColor[i] = packed;
            cellGlyph[i] = glyph;
            last = i;
        }
        if (tip && last >= 0) cellGlyph[last] = tip.charCodeAt(0);
    }
    dot(x, y, glyph, color, fog) {
        const i = this.cellIndex(x, y);
        if (i < 0 || this.cellFlag[i] === CELL_SOLID) return;
        const [r, g, b] = this.turn(color[0], color[1], color[2]);
        this.cellFlag[i] = CELL_SOFT;
        this.cellColor[i] = this.fade(r, g, b, fog);
        this.cellGlyph[i] = glyph.charCodeAt(0);
    }
    spot(x, y, glyph, color, fill, fog) {
        const i = this.cellIndex(x, y);
        if (i < 0) return;
        const [r, g, b] = this.turn(color[0], color[1], color[2]);
        const [fr, fg, fb] = this.turn(fill[0], fill[1], fill[2]);
        this.cellFlag[i] = CELL_SOLID;
        this.cellFill[i] = this.fade(fr, fg, fb, fog);
        this.cellColor[i] = this.fade(r, g, b, fog);
        this.cellGlyph[i] = glyph.charCodeAt(0);
    }
    drawCells() {
        const { ctx, cols, rows, cw, ch, cellFlag, cellFill, cellColor, cellGlyph } = this;
        const n = cols * rows;
        for(let i = 0; i < n; i++){
            const flag = cellFlag[i];
            if (!flag) continue;
            const x = i % cols * cw;
            const y = (i / cols | 0) * ch;
            if (flag === CELL_SOLID) {
                const f = cellFill[i];
                ctx.fillStyle = rgb(f >>> 16, f >>> 8 & 255, f & 255);
                ctx.fillRect(x + 1, y + 1, cw - 1, ch - 1);
            }
            const g = cellColor[i];
            ctx.fillStyle = rgb(g >>> 16, g >>> 8 & 255, g & 255);
            ctx.fillText(String.fromCharCode(cellGlyph[i]), x + cw / 2, y + ch / 2 + 1);
        }
    }
}
