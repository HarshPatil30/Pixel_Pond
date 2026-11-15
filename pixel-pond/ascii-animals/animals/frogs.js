// From ascii-animals (https://github.com/DesignerStephen1/ascii-animals), MIT License, Copyright (c) 2026 drewdi. See LICENSE.txt
import { SHARED_TUNING } from "../flock.js";
import { INK_DARK, INK_GLASS, INK_LIT, ink } from "../ink.js";
import { angleDiff, clamp, frac, lerp, rand, smoothstep } from "../math.js";
import { seg, spotted, toSegment } from "./shapes.js";
const DEFAULTS = {
    ...SHARED_TUNING,
    fog: 0,
    size: 1.2,
    density: 1.3,
    sway: 0,
    spread: 0,
    farthest: 0.35,
    farBias: 1.4,
    separation: 450,
    trail: 3.45,
    trailFade: 0.4,
    shimmer: 0.15,
    sparkle: 0.05,
    hop: 1,
    leap: 0.45,
    height: 1
};
const SKIN = [
    104,
    184,
    76
];
const LEG = [
    92,
    164,
    66
];
const SPOT = [
    30,
    70,
    30
];
const HALO = [
    190,
    222,
    130
];
const RIDGE = [
    206,
    226,
    150
];
const BAND = [
    36,
    80,
    32
];
const EYE_WHITE = [
    240,
    240,
    228
];
const PUPIL = [
    16,
    16,
    12
];
const LID = [
    20,
    30,
    16
];
const WEB = [
    120,
    190,
    90
];
const HIND_REST = [
    [
        -0.16,
        0.11
    ],
    [
        0.0,
        0.22
    ],
    [
        -0.19,
        0.25
    ],
    [
        -0.04,
        0.31
    ]
];
const HIND_KICK = [
    [
        -0.17,
        0.09
    ],
    [
        -0.38,
        0.15
    ],
    [
        -0.56,
        0.13
    ],
    [
        -0.68,
        0.15
    ]
];
const HIND_RADII = [
    0.056,
    0.04,
    0.026
];
const FRONT_REST = [
    [
        0.06,
        0.1
    ],
    [
        0.09,
        0.19
    ],
    [
        0.18,
        0.2
    ]
];
const FRONT_AIR = [
    [
        0.06,
        0.1
    ],
    [
        0.02,
        0.16
    ],
    [
        -0.06,
        0.15
    ]
];
const FRONT_REACH = [
    [
        0.08,
        0.11
    ],
    [
        0.16,
        0.19
    ],
    [
        0.27,
        0.19
    ]
];
const FRONT_RADII = [
    0.028,
    0.022
];
const EYE = [
    0.18,
    0.1
];
const blend = (a, b, t)=>a.map(([u, v], i)=>[
            lerp(u, b[i][0], t),
            lerp(v, b[i][1], t)
        ]);
function halfWidth(u, breathe) {
    const trunk = 0.155 * Math.sqrt(Math.max(0, 1 - ((u + 0.1) / 0.18) ** 2));
    let head = 0.15 * breathe * Math.sqrt(Math.max(0, 1 - ((u - 0.12) / 0.18) ** 2));
    if (u > 0.18) head *= 1 - 0.5 * ((u - 0.18) / 0.12) ** 2;
    return Math.max(trunk, head);
}
function onLimb(joints, radii, u, v) {
    for(let i = 0; i < joints.length - 1; i++){
        const [au, av] = joints[i];
        const [bu, bv] = joints[i + 1];
        if (toSegment(u, v, au, av, bu, bv) <= radii[i] * (1 - 0.25 * seg.t)) {
            seg.t = (i + seg.t) / (joints.length - 1);
            return true;
        }
    }
    return false;
}
const at = {
    x: 0,
    y: 0
};
const STRAY = 0.35;
const LENGTHS = [
    1,
    0.8,
    1.2,
    0.65,
    1.35
];
export const frogs = {
    key: "frogs",
    label: "Frog",
    swatch: [
        104,
        184,
        76
    ],
    defaults: DEFAULTS,
    hide: [
        "grip"
    ],
    controls: [
        [
            "Leaping",
            [
                {
                    key: "hop",
                    label: "How often",
                    min: 0.2,
                    max: 4,
                    step: 0.05,
                    hint: "How often they leap."
                },
                {
                    key: "leap",
                    label: "Leap length",
                    min: 0.3,
                    max: 2.5,
                    step: 0.05,
                    hint: "How far each leap goes."
                },
                {
                    key: "height",
                    label: "Leap height",
                    min: 0,
                    max: 2.5,
                    step: 0.05,
                    hint: "How high each leap arcs: they draw bigger at the top and the shadow slides further away."
                }
            ]
        ]
    ],
    area: 75000,
    scale: 0.95,
    speed: 80,
    trail: {
        light: [
            80,
            150,
            170
        ],
        dark: [
            110,
            200,
            220
        ]
    },
    create: (c)=>({
            ...c,
            leaping: false,
            until: 0,
            aim: 0,
            s: 0,
            dur: 0.5,
            fromX: 0,
            fromY: 0,
            toX: 0,
            toY: 0
        }),
    enter (f, flock) {
        f.leaping = false;
        f.s = 0;
        f.vx = 0;
        f.vy = 0;
        f.aim = flock.heading + f.bias * flock.tuning.spread;
        f.heading = f.aim;
        f.until = flock.time + rand(0, 1.5);
    },
    update (f, flock, dt) {
        const k = flock.tuning;
        const t = flock.time;
        if (!f.leaping) {
            f.vx = 0;
            f.vy = 0;
            flock.face(f, dt, 2.5, f.aim);
            if (t >= f.until) leap(f, flock, f.aim, 1);
            return;
        }
        f.s += dt / f.dur;
        if (f.s >= 1) {
            f.leaping = false;
            f.x = f.toX;
            f.y = f.toY;
            f.vx = 0;
            f.vy = 0;
            f.until = t + rand(0.5, 2.2) / (k.hop * k.speed);
            f.aim = flock.heading + (f.bias + rand(-0.7, 0.7)) * k.spread;
            flock.events.push({
                x: f.x,
                y: f.y,
                radius: 2,
                amount: 0.7 * f.depth * k.trail
            });
            if (flock.passed(f)) flock.reenter(f);
            return;
        }
        f.x = lerp(f.fromX, f.toX, f.s);
        f.y = lerp(f.fromY, f.toY, f.s);
    },
    startle (f, dx, dy, strength, flock) {
        if (f.leaping) return;
        leap(f, flock, Math.atan2(dy, dx), 1 + strength, false);
        f.startledUntil = flock.time + f.dur;
    },
    draw: (f, pen, flock)=>drawFrog(f, pen, flock)
};
function leap(f, flock, dir, boost, onCourse = true) {
    const k = flock.tuning;
    if (onCourse) dir = flock.heading + clamp(angleDiff(flock.heading, dir), -STRAY, STRAY);
    const cos = Math.cos(dir);
    const sin = Math.sin(dir);
    const reach = f.span * rand(2.4, 3.6) * k.leap * k.speed * boost;
    let dist = reach;
    if (onCourse && k.separation > 0) {
        let best = -1;
        for (const m of LENGTHS){
            const x = f.x + cos * reach * m;
            const y = f.y + sin * reach * m;
            let clear = Infinity;
            for (const o of flock.creatures){
                if (o === f || Math.abs(o.depth - f.depth) > 0.2) continue;
                const ox = o.leaping ? o.toX : o.x;
                const oy = o.leaping ? o.toY : o.y;
                clear = Math.min(clear, Math.hypot(x - ox, y - oy) / (f.span + o.span));
            }
            if (clear > best) {
                best = clear;
                dist = reach * m;
            }
            if (clear >= 0.6 * (k.separation / 300)) break;
        }
    }
    f.leaping = true;
    f.s = 0;
    f.dur = rand(0.42, 0.55) * Math.sqrt(k.leap) * (boost > 1 ? 0.8 : 1);
    f.heading = dir;
    f.fromX = f.x;
    f.fromY = f.y;
    f.toX = f.x + cos * dist;
    f.toY = f.y + sin * dist;
    f.vx = (f.toX - f.fromX) / f.dur;
    f.vy = (f.toY - f.fromY) / f.dur;
}
function drawFrog(f, pen, flock) {
    const k = flock.tuning;
    const s = f.leaping ? f.s : 0;
    const h = 4 * s * (1 - s) * k.height;
    const S = f.span * (1 + 0.35 * h);
    const pose = {
        x: f.x,
        y: f.y,
        heading: f.heading,
        span: S,
        depth: f.depth,
        id: f.id
    };
    const out = pen.ink;
    const kick = f.leaping ? smoothstep(0, 0.16, s) * (1 - smoothstep(0.72, 1, s)) : 0;
    const hind = blend(HIND_REST, HIND_KICK, kick);
    const front = f.leaping ? s < 0.6 ? blend(FRONT_REST, FRONT_AIR, smoothstep(0, 0.2, s)) : blend(FRONT_AIR, FRONT_REACH, smoothstep(0.6, 0.95, s)) : FRONT_REST;
    const breathe = f.leaping ? 1 : 1 + 0.045 * Math.sin(pen.t * 6 + f.id);
    const blinking = !f.leaping && frac(pen.t * 0.21 + f.id * 0.37) < 0.035;
    for (const side of [
        -1,
        1
    ]){
        const toes = (from, to, n, len, fan)=>{
            const dir = Math.atan2(to[1] - from[1], to[0] - from[0]);
            for(let i = 0; i < n; i++){
                const a = dir + (i / (n - 1) - 0.5) * fan;
                pen.lineBody(pose, to[0], to[1] * side, to[0] + Math.cos(a) * len, (to[1] + Math.sin(a) * len) * side, WEB);
            }
        };
        toes(hind[2], hind[3], 4, 0.075, 1.2);
        toes(front[1], front[2], 3, 0.045, 1.1);
    }
    pen.shape(pose, 0.9, (u, v)=>{
        const av = Math.abs(v);
        const hw = halfWidth(u, breathe);
        if (av <= hw && u > -0.29 && u < 0.3) {
            if (Math.abs(av - 0.11) < 0.012 && u > -0.22 && u < 0.14) return ink(out, ...RIDGE, INK_LIT);
            if (u < 0.1) {
                if (spotted(u, v, 0.085, 0.024, f.id)) return ink(out, ...SPOT, INK_DARK);
                if (spotted(u, v, 0.085, 0.036, f.id)) return ink(out, ...HALO, INK_LIT);
            }
            const g = 0.9 + 0.2 * (1 - av / Math.max(hw, 1e-3));
            return ink(out, SKIN[0] * g, SKIN[1] * g, SKIN[2] * g, INK_LIT);
        }
        const [fu, fv] = hind[3];
        const [au, av2] = hind[2];
        const dir = Math.atan2(fv - av2, fu - au);
        const off = Math.atan2(av - fv, u - fu) - dir;
        if (Math.hypot(u - fu, av - fv) < 0.06 && Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) < 0.5) {
            return ink(out, ...WEB, INK_GLASS, ".");
        }
        if (onLimb(hind, HIND_RADII, u, av) || onLimb(front, FRONT_RADII, u, av)) {
            return frac(seg.t * 4.5) < 0.3 ? ink(out, ...BAND, INK_DARK) : ink(out, ...LEG, INK_LIT);
        }
        return false;
    }, {
        light: 1 + 0.15 * h
    });
    for (const side of [
        -1,
        1
    ]){
        pen.toWorld(pose, EYE[0], EYE[1] * side, at);
        if (blinking) pen.spot(at.x, at.y, "-", LID, SKIN, f.depth);
        else pen.spot(at.x, at.y, "●", PUPIL, EYE_WHITE, f.depth);
    }
}
