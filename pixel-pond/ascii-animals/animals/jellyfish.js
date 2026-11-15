// From ascii-animals (https://github.com/DesignerStephen1/ascii-animals), MIT License, Copyright (c) 2026 drewdi. See LICENSE.txt
import { SHARED_TUNING } from "../flock.js";
import { INK_GLOW, INK_LIT, ink } from "../ink.js";
import { angleDiff, clamp, frac, hash3, rand, smoothstep, TAU } from "../math.js";
const DEFAULTS = {
    ...SHARED_TUNING,
    speed: 1.05,
    sway: 0.04,
    spread: 0.08,
    farthest: 0.3,
    farBias: 1.4,
    grip: 1.4,
    trail: 0.8,
    trailFade: 0.6,
    sparkle: 0.1,
    pulseRate: 1,
    pulsePower: 1,
    pulseGlow: 1,
    tentacles: 1
};
const CROWN = [
    255,
    168,
    230
];
const BODY = [
    232,
    56,
    182
];
const RIM = [
    255,
    200,
    240
];
const LOBES = [
    255,
    214,
    244
];
const DOTS = [
    255,
    240,
    250
];
const FRILL = [
    255,
    214,
    240
];
const CORE = [
    204,
    56,
    172
];
const TENTACLE = [
    232,
    100,
    204
];
const SNOW = [
    255,
    170,
    226
];
const SNOW_AREA = 6000;
const at = {
    x: 0,
    y: 0
};
const bt = {
    x: 0,
    y: 0
};
const mix = (a, b, f)=>[
        a[0] + (b[0] - a[0]) * f,
        a[1] + (b[1] - a[1]) * f,
        a[2] + (b[2] - a[2]) * f
    ];
export const jellyfish = {
    key: "jellyfish",
    label: "Jellyfish",
    swatch: [
        232,
        56,
        182
    ],
    defaults: DEFAULTS,
    hide: [
        "shimmer"
    ],
    controls: [
        [
            "Swimming",
            [
                {
                    key: "pulseRate",
                    label: "Pulse rate",
                    min: 0.2,
                    max: 3,
                    step: 0.05,
                    hint: "How often the bell pulses."
                },
                {
                    key: "pulsePower",
                    label: "Pulse power",
                    min: 0.2,
                    max: 3,
                    step: 0.05,
                    hint: "How far each pulse pushes it forward."
                },
                {
                    key: "pulseGlow",
                    label: "Pulse glow",
                    min: 0,
                    max: 3,
                    step: 0.05,
                    hint: "How much the bell lights up on each pulse. 0 turns it off."
                },
                {
                    key: "tentacles",
                    label: "Arm length",
                    min: 0,
                    max: 2.5,
                    step: 0.05,
                    hint: "Length of the frilly arms and the thin tentacles."
                }
            ]
        ]
    ],
    area: 95000,
    scale: 1.6,
    speed: 55,
    trail: {
        light: [
            200,
            80,
            170
        ],
        dark: [
            255,
            130,
            214
        ]
    },
    create: (c)=>({
            ...c,
            phase: rand(0, TAU),
            squeeze: 0,
            turn: 0
        }),
    update (j, flock, dt) {
        const k = flock.tuning;
        j.phase += dt * TAU * 0.6 * k.pulseRate * (0.9 + 0.2 * j.roll);
        const p = frac(j.phase / TAU);
        j.squeeze = p < 0.22 ? smoothstep(0, 0.22, p) : 1 - smoothstep(0.22, 1, p);
        const want = flock.heading + j.bias * k.spread;
        const before = j.heading;
        j.heading += clamp(angleDiff(j.heading, want), -0.6 * k.grip * dt, 0.6 * k.grip * dt);
        j.turn += (angleDiff(before, j.heading) / dt - j.turn) * Math.min(1, dt * 3);
        const cruise = flock.cruise(j);
        const acc = flock.begin();
        const thrust = p < 0.22 ? 6.2 * cruise * k.pulsePower : 0;
        acc.x += Math.cos(j.heading) * thrust - j.vx * 1.4;
        acc.y += Math.sin(j.heading) * thrust - j.vy * 1.4;
        flock.separate(j, k.separation, 0.5);
        flock.move(j, dt, cruise * 3);
        if (flock.passed(j, j.span * 1.4)) flock.reenter(j);
    },
    startle (j, _dx, _dy, strength, flock) {
        j.phase = Math.floor(j.phase / TAU) * TAU + TAU;
        const boost = 260 * strength * j.depth;
        j.vx += Math.cos(j.heading) * boost;
        j.vy += Math.sin(j.heading) * boost;
        j.startledUntil = flock.time + 0.8;
    },
    drawAll (flock, pen) {
        drawSnow(flock, pen);
        for (const j of flock.creatures)drawJelly(j, pen, flock);
    }
};
function pulseGlow(j) {
    const p = frac(j.phase / TAU);
    return p < 0.16 ? smoothstep(0, 0.16, p) : Math.exp(-(p - 0.16) * 4.5);
}
function drawJelly(j, pen, flock) {
    const k = flock.tuning;
    const S = j.span;
    const sq = j.squeeze;
    const t = pen.t;
    const pose = {
        x: j.x,
        y: j.y,
        heading: j.heading,
        span: S,
        depth: j.depth,
        id: j.id
    };
    const len = k.tentacles;
    const base = pen.fogFor(j.depth);
    const a = 0.32 * (1 + 0.14 * sq);
    const b = 0.3 * (1 - 0.2 * sq);
    const u0 = -0.04;
    const sway = clamp(-j.turn * 0.5, -0.5, 0.5);
    const flash = pulseGlow(j) * k.pulseGlow;
    for(let n = 0; n < 8; n++){
        const v0 = (n / 7 - 0.5) * 2 * b * 0.6;
        let pu = u0 - 0.02;
        let pv = v0;
        const segs = 14;
        const length = 1.5 * len * (0.75 + 0.35 * hash3(j.id, n, 4));
        for(let i = 1; i <= segs; i++){
            const f = i / segs;
            const u = u0 - 0.02 - f * length * (1 - 0.12 * sq);
            const v = v0 * (1 - 0.3 * f) + 0.04 * Math.sin(j.phase - f * 3.5 + n * 1.3) * f + sway * f * f * 0.4;
            pen.toWorld(pose, pu, pv, at);
            pen.toWorld(pose, u, v, bt);
            pen.line(at.x, at.y, bt.x, bt.y, TENTACLE, j.depth, undefined, Math.min(0.95, base + 0.45 + 0.35 * f));
            pu = u;
            pv = v;
        }
    }
    for(let n = 0; n < 4; n++){
        const v0 = (n / 3 - 0.5) * 0.11;
        const segs = 26;
        const length = 1.05 * len * (0.8 + 0.3 * hash3(j.id, n, 7));
        for(let i = 1; i <= segs; i++){
            const f = i / segs;
            const u = u0 - f * length;
            const v = v0 * (1 - 0.4 * f) + 0.05 * Math.sin(j.phase * 0.9 - f * 4.5 + n * 1.7) * f + sway * f * 0.25;
            const w = 0.055 * (1 - 0.5 * f) * Math.cos(f * 9 + n * 1.3 + t * 0.6);
            const fog = Math.min(0.95, base + 0.3 * f);
            pen.toWorld(pose, u, v, at);
            pen.dot(at.x, at.y, i % 3 ? ":" : "|", CORE, j.depth, Math.min(0.95, fog + 0.15));
            for (const side of [
                -1,
                1
            ]){
                pen.toWorld(pose, u, v + w * side, at);
                pen.dot(at.x, at.y, "{}~§"[(i + n + (side > 0 ? 1 : 0)) % 4], FRILL, j.depth, fog);
            }
        }
        pen.toWorld(pose, u0 - length, v0, at);
        pen.shed(at.x, at.y, 0.015 * j.depth);
    }
    const out = pen.ink;
    const h = 1.3 * (1 + 0.18 * flash);
    pen.shape(pose, 0.32 * h + 0.1, (u, v)=>{
        const r = Math.hypot((u - u0) / (a * h), v / (b * h));
        return r < 1 && u > u0 - 0.08 && ink(out, ...RIM, INK_GLOW, ".");
    }, {
        fog: clamp(base + 0.55 - 0.3 * flash, 0, 0.95)
    });
    pen.shape(pose, 0.42, (u, v)=>{
        const du = (u - u0) / a;
        const dv = v / b;
        const r2 = du * du + dv * dv;
        const margin = u0 - 0.04 * dv * dv;
        if (r2 > 1 || u < margin) {
            if (Math.abs(dv) > 1 || u > margin || u < margin - 0.04) return false;
            const lobe = 0.04 * Math.sin(frac((dv + 1) * 5.5) * Math.PI);
            return u > margin - lobe && ink(out, ...LOBES, INK_LIT, "o");
        }
        const r = Math.sqrt(r2);
        if (r > 0.88) return ink(out, ...RIM, INK_LIT, ":;");
        const th = Math.atan2(dv, du);
        if (du > 0.3) {
            const gu = Math.round(du * 11);
            const gv = Math.round(dv * 13);
            const near = Math.hypot(du * 11 - gu, dv * 13 - gv) < 0.32;
            if (near && hash3(gu, gv, j.id) > 0.45) return ink(out, ...DOTS, INK_LIT, ".'");
        }
        if (r > 0.35 && frac(th / Math.PI * 6) < 0.1) return ink(out, ...RIM, INK_LIT, "|");
        const glow = 0.75 + 0.25 * Math.max(clamp(du, 0, 1), r * r);
        const c = mix(BODY, CROWN, clamp(du, 0, 1) * 0.8);
        return ink(out, c[0] * glow, c[1] * glow, c[2] * glow, INK_LIT, " .");
    }, {
        light: (0.92 + 0.18 * sq) * (1 + 0.6 * flash)
    });
}
function drawSnow(flock, pen) {
    const { width: W, height: H } = flock;
    const n = Math.round(W * H / SNOW_AREA);
    const t = pen.t;
    for(let i = 0; i < n; i++){
        const rise = 3 + 9 * hash3(i, 3, 1);
        const x = hash3(i, 1, 1) * W + Math.sin(t * 0.25 + i) * 6;
        const y = ((hash3(i, 2, 1) * H - t * rise) % H + H) % H;
        const twinkle = 0.5 + 0.5 * Math.sin(t * (0.8 + 1.6 * hash3(i, 4, 1)) + i);
        const big = hash3(i, 5, 1) > 0.92;
        pen.dot(x, y, big ? "*" : ".", SNOW, 1, Math.min(0.95, 0.35 + 0.5 * (1 - twinkle) + (big ? 0 : 0.15)));
    }
}
