// From ascii-animals (https://github.com/DesignerStephen1/ascii-animals), MIT License, Copyright (c) 2026 drewdi. See LICENSE.txt
import { SHARED_TUNING } from "../flock.js";
import { INK_DARK, INK_SCALE, ink } from "../ink.js";
import { angleDiff, rand, TAU } from "../math.js";
import { inEllipse, spotted, toSegment } from "./shapes.js";
const EYE = [
    14,
    10,
    10
];
const GLINT = [
    255,
    252,
    246
];
const DEFAULTS = {
    ...SHARED_TUNING,
    detail: 1.7,
    fog: 0.12,
    density: 1.8,
    sway: 0,
    spread: 0,
    farthest: 0.25,
    farBias: 0.7,
    grip: 3,
    separation: 400,
    trail: 1.2,
    trailFade: 0.35,
    shimmer: 0.1,
    sparkle: 0.03,
    burst: 1,
    rest: 1,
    legSpeed: 1,
    scare: 0.55
};
const SHELL = [
    204,
    82,
    52
];
const PALE = [
    232,
    132,
    92
];
const FLECK = [
    140,
    46,
    32
];
const CLAW = [
    214,
    92,
    56
];
const TIP = [
    60,
    30,
    30
];
const LEG = [
    186,
    72,
    44
];
const HIPS = [
    0.07,
    -0.01,
    -0.08,
    -0.14
];
export const crabs = {
    key: "crabs",
    label: "Crab",
    swatch: [
        204,
        82,
        52
    ],
    defaults: DEFAULTS,
    controls: [
        [
            "Scuttling",
            [
                {
                    key: "burst",
                    label: "Burst length",
                    min: 0.2,
                    max: 4,
                    step: 0.05,
                    hint: "How long each scuttle lasts."
                },
                {
                    key: "rest",
                    label: "Pause length",
                    min: 0,
                    max: 4,
                    step: 0.05,
                    hint: "How long they pause between scuttles. 0 means they never stop."
                },
                {
                    key: "legSpeed",
                    label: "Leg speed",
                    min: 0.2,
                    max: 3,
                    step: 0.05,
                    hint: "How fast the legs step."
                },
                {
                    key: "scare",
                    label: "Scare",
                    min: 0,
                    max: 3,
                    step: 0.05,
                    hint: "How fast and far crabs bolt away when you tap near them."
                }
            ]
        ]
    ],
    area: 70000,
    scale: 0.8,
    speed: 95,
    trail: {
        light: [
            176,
            146,
            104
        ],
        dark: [
            206,
            178,
            136
        ]
    },
    create: (c)=>({
            ...c,
            running: true,
            until: 0,
            facing: Math.random() < 0.5 ? 1 : -1,
            gait: rand(0, TAU),
            alarm: 0,
            fleeDir: 0,
            fleeSpeed: 0,
            fleeFrom: 0
        }),
    enter (c, flock) {
        c.running = true;
        c.until = flock.time + rand(0.3, 1.2);
        c.heading = flock.course - c.facing * Math.PI / 2;
    },
    update (c, flock, dt) {
        const k = flock.tuning;
        const t = flock.time;
        if (t >= c.until) {
            c.running = !c.running || k.rest <= 0;
            c.until = t + (c.running ? rand(0.5, 1.6) * k.burst : rand(0.3, 1.4) * k.rest);
        }
        const cruise = flock.cruise(c);
        const course = flock.heading + c.bias * k.spread;
        const fleeing = t < c.startledUntil;
        const calm = fleeing ? (t - c.fleeFrom) / (c.startledUntil - c.fleeFrom) : 1;
        const walk = fleeing ? c.fleeDir : course;
        flock.begin();
        if (fleeing) flock.steer(c, c.fleeDir, Math.max(cruise, c.fleeSpeed * (1 - calm * calm)), 8);
        else flock.steer(c, course, c.running ? cruise : 0, k.grip * 2);
        flock.separate(c);
        const speed = flock.move(c, dt, fleeing ? Math.max(cruise * 2, c.fleeSpeed) : cruise * 2);
        if (flock.passed(c)) flock.reenter(c);
        const side = fleeing && Math.abs(angleDiff(c.heading + c.facing * Math.PI / 2, walk)) > Math.PI / 2 ? -c.facing : c.facing;
        const want = walk - side * Math.PI / 2;
        const turn = (fleeing ? 10 : 3) * dt;
        c.heading += Math.max(-turn, Math.min(turn, angleDiff(c.heading, want)));
        c.gait += dt * speed * k.legSpeed / Math.max(4, c.span * 0.09);
        c.alarm = Math.max(0, c.alarm - dt * 0.7);
    },
    startle (c, dx, dy, strength, flock) {
        const k = flock.tuning;
        if (k.scare <= 0) return;
        c.fleeDir = Math.atan2(dy, dx) + rand(-0.35, 0.35);
        c.fleeSpeed = flock.cruise(c) * (2.5 + 3 * strength) * k.scare;
        c.fleeFrom = flock.time;
        c.startledUntil = flock.time + (1 + 1.5 * strength) * Math.sqrt(k.scare);
        c.vx = Math.cos(c.fleeDir) * c.fleeSpeed;
        c.vy = Math.sin(c.fleeDir) * c.fleeSpeed;
        c.running = true;
        c.until = c.startledUntil + rand(0.3, 1);
        c.alarm = 1;
    },
    draw (c, pen) {
        const S = c.span;
        const out = pen.ink;
        const pose = {
            x: c.x,
            y: c.y,
            heading: c.heading,
            span: S,
            depth: c.depth,
            id: c.id
        };
        const at = {
            x: 0,
            y: 0
        };
        for (const side of [
            -1,
            1
        ]){
            HIPS.forEach((hu, i)=>{
                const ph = c.gait + i * Math.PI * 0.5 + (side > 0 ? Math.PI : 0);
                const lift = Math.max(0, Math.sin(ph));
                const reach = 0.04 * Math.cos(ph);
                const splay = (i - 1.5) * 0.06;
                const kneeU = hu + splay * 0.6;
                const kneeV = (0.36 - 0.03 * lift) * side;
                const tipU = hu + splay * 1.4 + reach;
                const tipV = (0.52 + 0.03 * Math.cos(ph) - 0.06 * lift) * side;
                pen.lineBody(pose, hu, 0.22 * side, kneeU, kneeV, LEG);
                pen.lineBody(pose, kneeU, kneeV, tipU, tipV, LEG);
                if (lift < 0.05 && Math.cos(ph) > 0.9) {
                    pen.toWorld(pose, tipU, tipV, at);
                    pen.shed(at.x, at.y, 0.12 * c.depth);
                }
            });
        }
        const raise = c.alarm;
        pen.shape(pose, 0.62, (u, v)=>{
            const av = Math.abs(v);
            const su = Math.abs(u / 0.17);
            const sv = av / 0.27;
            const teeth = u > 0.06 ? 0.06 * (0.5 + 0.5 * Math.cos(sv * Math.PI * 7)) : 0;
            if (Math.pow(su, 2.2) + Math.pow(sv, 2.4) <= 1 - teeth) {
                if (spotted(u, v, 0.05, 0.012, c.id)) return ink(out, ...FLECK, INK_DARK);
                if (Math.abs(av - 0.08) < 0.01 && u > -0.08 && u < 0.05) return ink(out, ...FLECK, INK_DARK, "|");
                return inEllipse(u, av, 0.01, 0, 0.1, 0.13) ? ink(out, ...PALE) : ink(out, ...SHELL);
            }
            const armU = 0.26 + 0.07 * raise;
            const armV = 0.25 + 0.05 * raise;
            if (toSegment(u, av, 0.12, 0.17, armU, armV) < 0.034) return ink(out, ...CLAW, INK_SCALE);
            const cu = 0.34 + 0.08 * raise;
            const cv = 0.19 + 0.04 * raise;
            const size = 1 + 0.15 * raise;
            const ang = 0.55;
            const lx = ((u - cu) * Math.cos(ang) - (av - cv) * Math.sin(ang)) / size;
            const ly = ((u - cu) * Math.sin(ang) + (av - cv) * Math.cos(ang)) / size;
            if ((lx / 0.09) ** 2 + (ly / 0.055) ** 2 <= 1) {
                const gap = 0.15 + 0.55 * raise;
                if (lx > 0.02 && Math.abs(ly) < gap * (lx - 0.02)) return false;
                return lx > 0.06 ? ink(out, ...TIP, INK_DARK) : ink(out, ...CLAW, INK_SCALE);
            }
            return false;
        });
        const eyeV = Math.min(0.14, Math.max(0.06, pen.cw * 0.55 / S));
        for (const side of [
            -1,
            1
        ]){
            pen.toWorld(pose, 0.2, eyeV * side, at);
            pen.spot(at.x, at.y, "●", GLINT, EYE, c.depth);
        }
    }
};
