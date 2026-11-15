// From ascii-animals (https://github.com/DesignerStephen1/ascii-animals), MIT License, Copyright (c) 2026 drewdi. See LICENSE.txt
import { SHARED_TUNING } from "../flock.js";
import { INK_DARK, INK_SCALE, ink } from "../ink.js";
import { frac, hash3, lerp, rand, TAU } from "../math.js";
import { inEllipse } from "./shapes.js";
const DEFAULTS = {
    ...SHARED_TUNING,
    detail: 1.7,
    density: 0.8,
    speed: 1.5,
    sway: 0,
    spread: 0,
    farthest: 0.35,
    farBias: 1.3,
    grip: 3,
    separation: 150,
    trail: 0,
    shimmer: 0.1,
    sparkle: 0.04,
    wingbeat: 1,
    glide: 1,
    foldFlap: false
};
const ROOT = 0.045;
const WRIST = 0.25;
const TIP = 0.5;
const WHITE = [
    236,
    238,
    242
];
const BLACK = [
    32,
    32,
    38
];
const NECK = [
    78,
    78,
    92
];
const CROWN = [
    226,
    36,
    36
];
const EYE = [
    14,
    12,
    16
];
const GLINT = [
    255,
    252,
    246
];
const BILL = [
    196,
    196,
    150
];
const LEGS = [
    60,
    60,
    66
];
const at = {
    x: 0,
    y: 0
};
const wing = {
    s: 0,
    q: 0
};
function onWing(u, vw) {
    if (vw < ROOT || vw > TIP) return false;
    const s = (vw - ROOT) / (TIP - ROOT);
    const le = 0.12 + 0.03 * s - 0.09 * s * s;
    let te0 = (-0.075 + 0.03 * s) * 1.2;
    if (s < 0.78) te0 += 0.012 * (0.5 + 0.5 * Math.cos(s * TAU * 9));
    const te = s > 0.72 ? lerp(te0, le - 0.015, Math.pow((s - 0.72) / 0.28, 1.4)) : te0;
    if (u > le || u < te) return false;
    const q = (u - te) / (le - te);
    if (s > 0.78 && q < 0.92 && frac(q * 6) < 0.24) return false;
    wing.s = s;
    wing.q = q;
    return true;
}
const stroke = {
    arm: 1,
    hand: 1,
    sweep: 0,
    lift: 0
};
const DOWN = 0.6;
const UP_ANGLE = 0.85;
const DOWN_ANGLE = -0.6;
function evenStroke(c) {
    const beat = Math.pow(0.5 + 0.5 * Math.cos(c.phase), 0.8);
    const open = Math.max(0.12, 0.25 + 0.75 * (beat * (1 - c.glide) + c.glide));
    stroke.arm = open;
    stroke.hand = open;
    stroke.sweep = 0;
    stroke.lift = 0;
}
function foldingStroke(c) {
    const p = frac(c.phase / TAU);
    const ease = (x)=>0.5 - 0.5 * Math.cos(Math.PI * x);
    let elev;
    let sweep;
    let handRaise;
    if (p < DOWN) {
        const x = p / DOWN;
        elev = lerp(UP_ANGLE, DOWN_ANGLE, ease(x));
        sweep = -0.12 * Math.sin(Math.PI * x);
        handRaise = 0;
        stroke.lift = Math.sin(Math.PI * x);
    } else {
        const x = (p - DOWN) / (1 - DOWN);
        elev = lerp(DOWN_ANGLE, UP_ANGLE, ease(x));
        sweep = 1.05 * Math.sin(Math.PI * x);
        handRaise = 0.45 * Math.sin(Math.PI * x);
        stroke.lift = 0;
    }
    const g = c.glide;
    elev = lerp(elev, 0.1, g);
    stroke.sweep = lerp(sweep, 0, g);
    stroke.arm = Math.cos(elev);
    stroke.hand = Math.max(0.2, Math.cos(elev + Math.sign(elev || 1) * handRaise * (1 - g)));
    stroke.lift *= 1 - g;
}
const flat = {
    u: 0,
    v: 0
};
function unfold(u, av) {
    const wristV = ROOT + (WRIST - ROOT) * stroke.arm;
    const pu = 0.03;
    const du = u - pu;
    const dv = av - wristV;
    const cs = Math.cos(stroke.sweep);
    const sn = Math.sin(stroke.sweep);
    const dv0 = -du * sn + dv * cs;
    if (av <= wristV || dv0 < 0) {
        flat.u = u;
        flat.v = ROOT + (av - ROOT) / stroke.arm;
    } else {
        flat.u = pu + du * cs + dv * sn;
        flat.v = WRIST + dv0 / stroke.hand;
    }
    return flat;
}
export const cranes = {
    key: "cranes",
    label: "Crane",
    swatch: [
        214,
        220,
        238
    ],
    defaults: DEFAULTS,
    controls: [
        [
            "Flight",
            [
                {
                    key: "wingbeat",
                    label: "Wingbeat",
                    min: 0.3,
                    max: 2.5,
                    step: 0.05,
                    hint: "How fast they flap."
                },
                {
                    key: "glide",
                    label: "Glide",
                    min: 0,
                    max: 4,
                    step: 0.05,
                    hint: "How often they stop flapping and glide."
                },
                {
                    key: "foldFlap",
                    label: "Folding flap",
                    toggle: true,
                    hint: "Off: the wings open and close evenly from the body. On: a slow downstroke and a quick upstroke that folds the wings back at the wrist."
                }
            ]
        ]
    ],
    area: 55000,
    scale: 1.45,
    speed: 85,
    trail: {
        light: [
            150,
            152,
            170
        ],
        dark: [
            200,
            204,
            226
        ]
    },
    create: (c)=>({
            ...c,
            phase: rand(0, TAU),
            pace: 0.8 + 0.4 * hash3(c.id, 5, 9),
            glide: 0,
            glideUntil: 0
        }),
    update (c, flock, dt) {
        const k = flock.tuning;
        const t = flock.time;
        const cruise = flock.cruise(c);
        const course = flock.heading + c.bias * k.spread;
        flock.begin();
        flock.steer(c, course, cruise, k.grip);
        flock.separate(c, k.separation, 0.45);
        flock.move(c, dt, cruise * 1.6);
        if (flock.passed(c)) flock.reenter(c);
        flock.face(c, dt, 2, course);
        if (c.glide < 0.5 && t > c.glideUntil && Math.random() < 0.25 * k.glide * dt) c.glideUntil = t + rand(1, 2.5);
        c.glide += ((t < c.glideUntil ? 1 : 0) - c.glide) * Math.min(1, dt * 3);
        c.phase += dt * TAU * 1.25 * k.wingbeat * c.pace * (1 - 0.92 * c.glide);
    },
    draw (c, pen, flock) {
        if (flock.tuning.foldFlap) foldingStroke(c);
        else evenStroke(c);
        const S = c.span * (1 + 0.025 * stroke.lift);
        const out = pen.ink;
        const pose = {
            x: c.x,
            y: c.y,
            heading: c.heading,
            span: S,
            depth: c.depth,
            id: c.id
        };
        const neckW = Math.max(0.018, pen.cw * 0.45 / S);
        const headR = Math.max(0.032, pen.cw * 0.6 / S);
        for (const side of [
            -1,
            1
        ])pen.lineBody(pose, -0.2, 0.014 * side, -0.62, 0.022 * side, LEGS);
        pen.lineBody(pose, 0.47, 0, 0.6, 0, BILL);
        pen.shape(pose, 0.66, (u, v)=>{
            const av = Math.abs(v);
            if (Math.hypot(u - 0.44, av) < headR) return ink(out, ...BLACK, INK_DARK);
            if (u > 0.12 && u < 0.43 && av < neckW) return u > 0.28 ? ink(out, ...NECK, INK_DARK) : ink(out, ...WHITE);
            if (inEllipse(u, av, -0.19, 0, 0.08, 0.045 + 0.4 * Math.max(0, -0.12 - u) ** 1.2)) return ink(out, ...WHITE);
            if (inEllipse(u, av, 0, 0, 0.16, 0.055)) return ink(out, ...WHITE);
            if (av <= ROOT) return false;
            const { u: fu, v: fv } = unfold(u, av);
            if (!onWing(fu, fv)) return false;
            if (wing.q < 0.42 && wing.s < 0.7) return ink(out, ...BLACK, INK_DARK);
            const k = 0.9 + 0.1 * wing.q;
            return ink(out, WHITE[0] * k, WHITE[1] * k, WHITE[2] * k, INK_SCALE);
        }, {
            light: 0.82 + 0.18 * stroke.arm
        });
        pen.toWorld(pose, 0.445, 0, at);
        pen.spot(at.x, at.y, "@", [
            255,
            214,
            200
        ], CROWN, c.depth);
        if (0.064 * S >= pen.cw * 1.2) {
            const eyeV = Math.max(0.032, pen.cw / S);
            for (const side of [
                -1,
                1
            ]){
                pen.toWorld(pose, 0.44, eyeV * side, at);
                pen.spot(at.x, at.y, "●", GLINT, EYE, c.depth);
            }
        }
    }
};
