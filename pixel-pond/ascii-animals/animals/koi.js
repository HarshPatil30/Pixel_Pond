// From ascii-animals (https://github.com/DesignerStephen1/ascii-animals), MIT License, Copyright (c) 2026 drewdi. See LICENSE.txt
import { SHARED_TUNING } from "../flock.js";
import { INK_DARK, INK_GLASS, INK_SHIMMER, ink } from "../ink.js";
import { angleDiff, clamp, hash3, lerp, rand, smoothstep, TAU } from "../math.js";
const NODES = 14;
const DEFAULTS = {
    ...SHARED_TUNING,
    fog: 0.64,
    density: 1.6,
    speed: 1.6,
    spread: 0,
    sway: 0,
    farthest: 0.33,
    farBias: 1.3,
    grip: 2.65,
    separation: 780,
    trail: 4,
    trailFade: 0.4,
    shimmer: 0.35,
    sparkle: 0.08,
    meander: 0.4,
    foodRange: 200,
    tailBeat: 1
};
const WHITE = [
    244,
    240,
    230
];
const RED = [
    222,
    66,
    40
];
const BLACK = [
    34,
    34,
    40
];
const GOLD = [
    238,
    182,
    64
];
const ORANGE = [
    236,
    124,
    44
];
const FIN = [
    236,
    226,
    214
];
const VARIETIES = [
    "kohaku",
    "sanke",
    "showa",
    "ogon",
    "chagoi"
];
function halfWidth(s) {
    if (s < 0.12) return 0.1 * Math.pow(Math.sin(s / 0.12 * Math.PI / 2), 0.6);
    if (s < 0.35) return 0.1 + 0.016 * Math.sin((s - 0.12) / 0.23 * (Math.PI / 2));
    if (s < 0.82) return 0.116 - 0.088 * smoothstep(0.35, 0.82, s);
    return 0.028 + (s - 0.82) / 0.18 * 0.1;
}
function blotch(s, a, seed) {
    return Math.sin(s * 11 + seed) * Math.cos(a * 22 + seed * 1.3) + 0.6 * Math.sin(s * 23 + a * 15 + seed * 2.1) + 0.35 * Math.sin(s * 5 - seed * 0.7);
}
const PELLET_LIFE = 14;
const FOOD = [
    232,
    178,
    104
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
const pantries = new WeakMap();
const pantry = (flock)=>{
    let food = pantries.get(flock);
    if (!food) pantries.set(flock, food = []);
    return food;
};
let pull = 0;
function nearestFood(f, flock, range) {
    let best = null;
    let bestD = range;
    for (const p of pantry(flock)){
        const d = Math.hypot(p.x - f.x, p.y - f.y);
        if (d < bestD) {
            bestD = d;
            best = p;
        }
    }
    pull = best ? 1 - bestD / range : 0;
    return best;
}
export const koi = {
    key: "koi",
    label: "Koi",
    swatch: [
        244,
        196,
        44
    ],
    defaults: DEFAULTS,
    controls: [
        [
            "Swimming",
            [
                {
                    key: "meander",
                    label: "Meander",
                    min: 0,
                    max: 3,
                    step: 0.05,
                    hint: "How much they weave in lazy S-curves."
                },
                {
                    key: "tailBeat",
                    label: "Tail beat",
                    min: 0.2,
                    max: 3,
                    step: 0.05,
                    hint: "How fast and wide the tail swishes."
                }
            ]
        ],
        [
            "Feeding",
            [
                {
                    key: "foodRange",
                    label: "Food range",
                    min: 0,
                    max: 500,
                    step: 10,
                    hint: "How close a koi has to be to notice food you drop. The closer it is, the harder it turns and the faster it swims over."
                }
            ]
        ]
    ],
    area: 75000,
    scale: 1.15,
    speed: 50,
    trail: {
        light: [
            90,
            140,
            190
        ],
        dark: [
            110,
            170,
            220
        ]
    },
    create: (c)=>({
            ...c,
            nodes: new Float32Array(NODES * 2),
            phase: rand(0, TAU),
            variety: Math.floor(hash3(c.id, 7, 3) * VARIETIES.length)
        }),
    enter (f) {
        const seg = f.span / (NODES - 1);
        for(let k = 0; k < NODES; k++){
            f.nodes[k * 2] = f.x - Math.cos(f.heading) * seg * k;
            f.nodes[k * 2 + 1] = f.y - Math.sin(f.heading) * seg * k;
        }
    },
    prepare (flock, dt) {
        const food = pantry(flock);
        for (const p of food){
            p.vx *= Math.exp(-dt * 0.8);
            p.vy *= Math.exp(-dt * 0.8);
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
        const t = flock.time;
        for(let i = food.length - 1; i >= 0; i--)if (t - food[i].born > PELLET_LIFE) food.splice(i, 1);
    },
    tap (x, y, flock) {
        const food = pantry(flock);
        const n = 7 + Math.floor(Math.random() * 5);
        for(let i = 0; i < n; i++){
            const a = rand(0, TAU);
            const r = 70 * Math.sqrt(Math.random());
            const p = {
                x: x + Math.cos(a) * r,
                y: y + Math.sin(a) * r,
                vx: Math.cos(a) * rand(4, 14),
                vy: Math.sin(a) * rand(4, 14),
                born: flock.time
            };
            food.push(p);
            flock.events.push({
                x: p.x,
                y: p.y,
                radius: 1,
                amount: 0.5
            });
        }
        if (food.length > 60) food.splice(0, food.length - 60);
    },
    // [Pixel Pond change] koi dart away from a hovering cursor: quick turn plus a burst of speed
    startle (f, ux, uy, strength, flock) {
        f.scareDir = Math.atan2(uy, ux);
        f.scareUntil = flock.time + 0.5 + 0.5 * strength;
        f.scareBoost = 1.6 + 1.4 * strength;
    },
    update (f, flock, dt) {
        const k = flock.tuning;
        const t = flock.time;
        const meal = nearestFood(f, flock, k.foodRange);
        f.hungry = !!meal; // [Pixel Pond change] lets the cursor-scatter leave feeding koi alone
        const hunger = meal ? 0.25 + 0.75 * pull : 0;
        const scared = !meal && t < (f.scareUntil || 0); // [Pixel Pond change]
        let want = scared ? f.scareDir : meal ? Math.atan2(meal.y - f.y, meal.x - f.x) : flock.heading + f.bias * k.spread + k.meander * 0.6 * Math.sin(t * 0.35 + f.id * 1.7);
        const acc = flock.begin();
        flock.separate(f, k.separation, 0.5);
        if (acc.x || acc.y) {
            const cruise = flock.cruise(f);
            want = Math.atan2(Math.sin(want) * cruise + acc.y * 0.3, Math.cos(want) * cruise + acc.x * 0.3);
        }
        const turn = (scared ? 7 : lerp(0.9 * k.grip, 2.6, hunger)) * dt;
        f.heading += clamp(angleDiff(f.heading, want), -turn, turn);
        let speed = flock.cruise(f) * lerp(0.85 + 0.25 * Math.sin(t * 0.5 + f.id), 1.8, hunger);
        if (scared) speed *= 1 + (f.scareBoost - 1) * Math.min(1, (f.scareUntil - t) / 0.5); // burst that eases off
        f.vx = Math.cos(f.heading) * speed;
        f.vy = Math.sin(f.heading) * speed;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.phase += dt * (2 + speed / 25) * k.tailBeat;
        const n = f.nodes;
        const seg = f.span / (NODES - 1);
        n[0] = f.x;
        n[1] = f.y;
        let prev = f.heading + Math.PI;
        for(let i = 1; i < NODES; i++){
            let a = Math.atan2(n[i * 2 + 1] - n[i * 2 - 1], n[i * 2] - n[i * 2 - 2]);
            a = prev + clamp(angleDiff(prev, a), -0.22, 0.22);
            n[i * 2] = n[i * 2 - 2] + Math.cos(a) * seg;
            n[i * 2 + 1] = n[i * 2 - 1] + Math.sin(a) * seg;
            prev = a;
        }
        if (meal && Math.hypot(meal.x - f.x, meal.y - f.y) < f.span * 0.1 + 6) {
            const food = pantry(flock);
            food.splice(food.indexOf(meal), 1);
            flock.events.push({
                x: meal.x,
                y: meal.y,
                radius: 1,
                amount: 0.7
            });
        }
        if (flock.passed(f, f.span * 1.3)) flock.reenter(f);
    },
    drawAll (flock, pen) {
        drawFood(flock, pen);
        for (const f of flock.creatures)drawKoi(f, pen, flock);
    }
};
function drawFood(flock, pen) {
    const t = flock.time;
    for (const p of pantry(flock)){
        const age = (t - p.born) / PELLET_LIFE;
        pen.dot(p.x, p.y, age < 0.7 ? "o" : ".", FOOD, 1, Math.min(0.9, Math.max(0, age - 0.5) * 1.6));
    }
}
function drawKoi(f, pen, flock) {
    const k = flock.tuning;
    const L = f.span;
    const n = f.nodes;
    const out = pen.ink;
    const variety = VARIETIES[f.variety];
    const seed = f.id * 1.37;
    const white = pen.theme === "light" ? [
        222,
        217,
        206
    ] : WHITE;
    const fin = pen.theme === "light" ? [
        206,
        196,
        182
    ] : FIN;
    const spine = new Float32Array(NODES * 2);
    const arc = new Float32Array(NODES);
    for(let i = 0; i < NODES; i++){
        const s = i / (NODES - 1);
        const a = Math.max(0, i - 1);
        const b = Math.min(NODES - 1, i + 1);
        let tx = n[a * 2] - n[b * 2];
        let ty = n[a * 2 + 1] - n[b * 2 + 1];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        const off = L * 0.06 * Math.pow(s, 1.6) * Math.sin(f.phase - s * 4.5) * Math.min(1.5, k.tailBeat);
        spine[i * 2] = n[i * 2] - ty * off;
        spine[i * 2 + 1] = n[i * 2 + 1] + tx * off;
        if (i > 0) arc[i] = arc[i - 1] + Math.hypot(spine[i * 2] - spine[i * 2 - 2], spine[i * 2 + 1] - spine[i * 2 - 1]);
    }
    const total = arc[NODES - 1] || 1;
    const mid = NODES / 2 | 0;
    const pose = {
        x: spine[mid * 2],
        y: spine[mid * 2 + 1],
        heading: f.heading,
        span: L,
        depth: f.depth,
        id: f.id
    };
    const finBeat = 0.8 + 0.2 * Math.sin(f.phase * 0.7);
    pen.shape(pose, 0.72, (_u, _v, px, py)=>{
        let best = Infinity;
        let s = 0;
        let a = 0;
        let past = 0;
        for(let i = 0; i < NODES - 1; i++){
            const ax = spine[i * 2];
            const ay = spine[i * 2 + 1];
            const sx = spine[i * 2 + 2] - ax;
            const sy = spine[i * 2 + 3] - ay;
            const len2 = sx * sx + sy * sy || 1;
            const raw = ((px - ax) * sx + (py - ay) * sy) / len2;
            const q = clamp(raw, 0, 1);
            const sl = Math.sqrt(len2);
            if (i === NODES - 2 && raw > 1) {
                const across = Math.abs(sx * (py - ay) - sy * (px - ax)) / sl;
                if (across * across < best) {
                    best = across * across;
                    s = 1;
                    past = (raw - 1) * sl / L;
                    a = across / L * (sx * (py - ay) - sy * (px - ax) >= 0 ? 1 : -1);
                }
                continue;
            }
            const d2 = (px - ax - sx * q) ** 2 + (py - ay - sy * q) ** 2;
            if (d2 < best) {
                best = d2;
                s = (arc[i] + q * sl) / total;
                a = Math.sqrt(d2) / L * (sx * (py - ay) - sy * (px - ax) >= 0 ? 1 : -1);
                past = 0;
            }
        }
        const aa = Math.abs(a);
        const w = halfWidth(s);
        out.au = s;
        out.av = a;
        if (past > 0) return false;
        const pect = s > 0.17 && s < 0.34 && aa < w + 0.1 * finBeat * Math.sin((s - 0.17) / 0.17 * Math.PI);
        const pelvic = s > 0.48 && s < 0.6 && aa < w + 0.05 * Math.sin((s - 0.48) / 0.12 * Math.PI);
        if (aa > w) return (pect || pelvic) && ink(out, ...fin, INK_GLASS, "-=");
        if (s > 0.82) {
            if (s > 0.93 && aa < (s - 0.93) / 0.07 * 0.06) return false;
            return ink(out, ...fin, INK_GLASS, s > 0.9 ? "/\\" : "=");
        }
        const patch = blotch(s, a, seed) > 0.25;
        const across = aa / w;
        switch(variety){
            case "kohaku":
                return patch && s < 0.8 ? ink(out, ...RED) : ink(out, ...white);
            case "sanke":
                if (hash3(Math.round(s * 30), Math.round(a * 60), f.id) > 0.9 && s > 0.15) return ink(out, ...BLACK, INK_DARK);
                return patch && s < 0.8 ? ink(out, ...RED) : ink(out, ...white);
            case "showa":
                if (blotch(s, a, seed + 4) > 0.55) return ink(out, ...white);
                return patch ? ink(out, ...RED) : ink(out, ...BLACK, INK_DARK, "%#");
            case "ogon":
                return ink(out, ...GOLD, INK_SHIMMER);
            default:
                return ink(out, ORANGE[0] * (1 - 0.15 * across), ORANGE[1] * (1 - 0.15 * across), ORANGE[2], INK_SHIMMER);
        }
    });
    const across = halfWidth(0.09) * 0.55 * L;
    if (2 * across >= pen.cw) {
        const along = 0.09 * total;
        let i = 0;
        while(i < NODES - 2 && arc[i + 1] < along)i++;
        const sl = arc[i + 1] - arc[i] || 1;
        const q = (along - arc[i]) / sl;
        const dx = (spine[i * 2 + 2] - spine[i * 2]) / sl;
        const dy = (spine[i * 2 + 3] - spine[i * 2 + 1]) / sl;
        const hx = spine[i * 2] + dx * q * sl;
        const hy = spine[i * 2 + 1] + dy * q * sl;
        for (const side of [
            -1,
            1
        ])pen.spot(hx - dy * across * side, hy + dx * across * side, "●", GLINT, EYE, f.depth);
    }
    pen.shed(spine[(NODES - 2) * 2], spine[(NODES - 2) * 2 + 1], 0.02 * f.depth);
}
