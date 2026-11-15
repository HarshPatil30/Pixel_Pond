// From ascii-animals (https://github.com/DesignerStephen1/ascii-animals), MIT License, Copyright (c) 2026 drewdi. See LICENSE.txt
import { angleDiff, clamp, rand } from "./math.js";
export const SHARED_TUNING = {
    density: 1,
    corner: false,
    direction: 49,
    speed: 1,
    sway: 0.04,
    spread: 0.06,
    size: 1,
    farthest: 0.45,
    farBias: 1.6,
    grip: 2,
    separation: 300,
    hueShift: 0,
    shimmer: 0.3,
    sparkle: 0.12,
    fog: 0.75,
    trail: 1,
    trailFade: 1.3,
    grid: 1.05,
    detail: 1.3,
    // [Pixel Pond change] pond: each animal wanders its own way and wraps round the edges
    // instead of the whole group crossing on one course; the cursor scatters animals it hovers near.
    pond: true
};
export const SHARED_CONTROLS = {
    movement: [
        {
            key: "density",
            label: "Density",
            min: 0.1,
            max: 4,
            step: 0.05,
            hint: "How many are on screen."
        },
        {
            key: "corner",
            label: "Corner to corner",
            toggle: true,
            hint: "Cross from the bottom-left corner to the top-right, whatever the window's shape. Turn off to set Direction yourself."
        },
        {
            key: "direction",
            label: "Direction (°)",
            min: 0,
            max: 360,
            step: 1,
            disabledWhen: "corner",
            hint: "Which way they travel, in degrees: 0 is right, 90 is up. Only used when Corner to corner is off."
        },
        {
            key: "speed",
            label: "Speed",
            min: 0.1,
            max: 3,
            step: 0.05,
            hint: "How fast they travel."
        },
        {
            key: "sway",
            label: "Sway",
            min: 0,
            max: 0.6,
            step: 0.01,
            hint: "How much the whole group slowly drifts left and right off course. 0 is a dead-straight line."
        },
        {
            key: "spread",
            label: "Spread",
            min: 0,
            max: 0.8,
            step: 0.01,
            hint: "How far each one's own path can stray from the group's. 0 means everyone keeps exactly the same line."
        },
        {
            key: "size",
            label: "Size",
            min: 0.3,
            max: 2.5,
            step: 0.05,
            hint: "How big they are."
        },
        {
            key: "farthest",
            label: "Farthest depth",
            min: 0.1,
            max: 1,
            step: 0.01,
            hint: "How small and faint the farthest ones get. 1 makes them all equally close."
        },
        {
            key: "farBias",
            label: "Far bias",
            min: 0.3,
            max: 3,
            step: 0.05,
            hint: "How many sit far away versus close. Higher puts more of them in the distance."
        },
        {
            key: "grip",
            label: "Hold course",
            min: 0.2,
            max: 5,
            step: 0.05,
            hint: "How hard they steer back onto course after drifting. Higher is stricter."
        },
        {
            key: "separation",
            label: "Separation",
            min: 0,
            max: 1000,
            step: 10,
            hint: "How strongly neighbours keep their distance from each other."
        }
    ],
    look: [
        {
            key: "hueShift",
            label: "Hue shift (°)",
            min: -180,
            max: 180,
            step: 1,
            hint: "Turns the animal's colour around the colour wheel, in degrees. Find one you like and tell me the number to make it permanent."
        },
        {
            key: "shimmer",
            label: "Shimmer",
            min: 0,
            max: 1,
            step: 0.01,
            hint: "How much iridescent surfaces roll brighter and darker as the animal turns."
        },
        {
            key: "sparkle",
            label: "Sparkle",
            min: 0,
            max: 0.5,
            step: 0.01,
            hint: "How often cells flash white, like light catching scales or wings."
        },
        {
            key: "fog",
            label: "Distance fade",
            min: 0,
            max: 1,
            step: 0.01,
            hint: "How much far-away ones fade into the background."
        },
        {
            key: "trail",
            label: "Trail",
            min: 0,
            max: 4,
            step: 0.05,
            hint: "How much they leave behind: scales, ripples, footprints or glow."
        },
        {
            key: "trailFade",
            label: "Trail fade",
            min: 0.05,
            max: 6,
            step: 0.05,
            hint: "How quickly that trail fades. Lower lingers longer."
        },
        {
            key: "grid",
            label: "Grid",
            min: 0,
            max: 4,
            step: 0.05,
            hint: "How visible the background grid lines are."
        },
        {
            key: "detail",
            label: "ASCII detail",
            min: 0.5,
            max: 2,
            step: 0.05,
            hint: "ASCII resolution. Higher means smaller characters and finer animals."
        }
    ]
};
const STARTLE_RADIUS = 240;
const REFERENCE_SIZE = 160;
export class Flock {
    animal;
    tuning;
    count;
    width = 0;
    height = 0;
    time = 0;
    creatures = [];
    events = [];
    base = 120;
    acc = {
        x: 0,
        y: 0
    };
    nextId = 1;
    constructor(animal, tuning, count){
        this.animal = animal;
        this.tuning = tuning;
        this.count = count;
    }
    resize(width, height) {
        const first = this.width === 0;
        this.width = width;
        this.height = height;
        this.base = clamp(Math.min(width, height) * 0.2, 80, 190) * this.animal.scale;
        if (first) this.populate(true);
    }
    // [Pixel Pond change] while an animal is being updated, course/heading are its own wander angle
    cur = null;
    pointer = null;
    wanderOf(c) {
        if (c.wander === undefined) {
            c.wander = rand(0, Math.PI * 2);
            c.wturn = 0;
        }
        return c.wander;
    }
    get course() {
        const k = this.tuning;
        if (k.pond && this.cur) return this.wanderOf(this.cur);
        return k.corner ? Math.atan2(-this.height, this.width) : -k.direction * Math.PI / 180;
    }
    get heading() {
        if (this.tuning.pond && this.cur) return this.wanderOf(this.cur);
        const t = this.time;
        return this.course + this.tuning.sway * (Math.sin(t * 0.13) + 0.5 * Math.sin(t * 0.31 + 1.7));
    }
    // [Pixel Pond change] slow random turning, plus scatter away from a hovering cursor
    wander(dt) {
        if (this.tuning.pond) for (const c of this.creatures) {
            this.wanderOf(c);
            c.wturn += rand(-1, 1) * dt * 2.4;
            c.wturn *= Math.pow(0.3, dt);
            c.wturn = clamp(c.wturn, -0.9, 0.9);
            c.wander += c.wturn * dt;
        }
        const p = this.pointer;
        if (!p || !p.on) return;
        for (const c of this.creatures) {
            if (c.hungry) continue; // koi heading for food stay put
            const dx = c.x - p.x;
            const dy = c.y - p.y;
            const d = Math.hypot(dx, dy) || 1;
            const R = 150 + c.span * 0.6;
            if (d > R) continue;
            const s = 1 - d / R;
            const away = Math.atan2(dy, dx);
            c.wander += angleDiff(c.wander, away) * Math.min(1, dt * 9 * s + 0.03);
            c.vx += dx / d * s * 1700 * c.depth * dt;
            c.vy += dy / d * s * 1700 * c.depth * dt;
            c.startledUntil = Math.max(c.startledUntil, this.time + 0.45);
            // animals with their own startle move (crabs bolt, frogs leap) use it too, with a cooldown
            if (this.animal.startle && this.time > (c.hoverCool || 0)) {
                this.animal.startle(c, dx / d, dy / d, Math.max(0.5, s), this);
                c.hoverCool = this.time + 0.9;
            }
        }
    }
    get target() {
        const { width: W, height: H, animal } = this;
        const shrink = (this.base / animal.scale / REFERENCE_SIZE) ** 2;
        return this.count ?? clamp(Math.round(W * H / (animal.area * shrink) * this.tuning.density), 1, animal.max ?? 200);
    }
    depthOf(roll) {
        const k = this.tuning;
        return k.farthest + (1 - k.farthest) * Math.pow(roll, k.farBias);
    }
    cruise(c) {
        return this.animal.speed * (0.55 + 0.45 * c.depth) * this.tuning.speed;
    }
    startle(x, y) {
        if (this.animal.tap) {
            this.animal.tap(x, y, this);
            return;
        }
        this.events.push({
            x,
            y,
            radius: 6,
            amount: 1.4
        });
        for (const c of this.creatures){
            const dx = c.x - x;
            const dy = c.y - y;
            const d = Math.hypot(dx, dy) || 1;
            if (d > STARTLE_RADIUS) continue;
            const strength = 1 - d / STARTLE_RADIUS;
            if (this.animal.startle) {
                this.animal.startle(c, dx / d, dy / d, strength, this);
            } else {
                const k = strength * 420 * c.depth;
                c.vx += dx / d * k;
                c.vy += dy / d * k;
                c.startledUntil = this.time + rand(0.6, 1.2);
            }
        }
    }
    step(dt) {
        this.time += dt;
        this.populate(false);
        for (const c of this.creatures){
            c.depth = this.depthOf(c.roll);
            c.span = this.base * c.depth * this.tuning.size;
        }
        this.wander(dt); // pond turning (when on) + cursor scatter (always)
        this.animal.prepare?.(this, dt);
        for (const c of this.creatures) {
            this.cur = c;
            this.animal.update(c, this, dt);
        }
        this.cur = null;
    }
    populate(scatter) {
        const target = this.target;
        while(this.creatures.length > target){
            const [c] = this.creatures.splice(Math.floor(Math.random() * this.creatures.length), 1);
            c.gone = true;
        }
        while(this.creatures.length < target){
            const c = this.spawn();
            if (scatter || Math.random() < 0.5) {
                c.x = rand(0, this.width);
                c.y = rand(0, this.height);
                this.animal.enter?.(c, this);
            }
            this.insert(c);
        }
    }
    insert(c) {
        const at = this.creatures.findIndex((o)=>o.roll > c.roll);
        this.creatures.splice(at < 0 ? this.creatures.length : at, 0, c);
    }
    spawn() {
        const base = {
            id: this.nextId++,
            roll: Math.random(),
            depth: 1,
            span: 0,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            heading: 0,
            bias: 0,
            startledUntil: 0,
            gone: false
        };
        base.depth = this.depthOf(base.roll);
        base.span = this.base * base.depth * this.tuning.size;
        const c = this.animal.create(base, this);
        this.reenter(c);
        return c;
    }
    reenter(c) {
        if (this.tuning.pond) {
            // [Pixel Pond change] first time: anywhere on screen; after that: wrap to the opposite edge
            const prev = this.cur;
            this.cur = c;
            const { width: W, height: H } = this;
            const m = c.span * 0.5;
            if (!c.placed) {
                c.placed = true;
                c.x = rand(0, W);
                c.y = rand(0, H);
            } else {
                if (c.x < 0) c.x = W + m; else if (c.x > W) c.x = -m;
                if (c.y < 0) c.y = H + m; else if (c.y > H) c.y = -m;
            }
            const h = this.wanderOf(c);
            const cruise = this.cruise(c);
            c.heading = h;
            c.vx = Math.cos(h) * cruise;
            c.vy = Math.sin(h) * cruise;
            c.bias = rand(-1, 1);
            this.animal.enter?.(c, this);
            this.cur = prev;
            return;
        }
        const { width: W, height: H, course } = this;
        const m = c.span * 0.6;
        const cos = Math.cos(course);
        const sin = Math.sin(course);
        const sideways = H * Math.abs(cos);
        const vertical = W * Math.abs(sin);
        if (Math.random() * (sideways + vertical) < sideways) {
            c.x = cos >= 0 ? -m : W + m;
            c.y = rand(0, H);
        } else {
            c.x = rand(0, W);
            c.y = sin <= 0 ? H + m : -m;
        }
        const cruise = this.cruise(c);
        c.heading = course;
        c.vx = cos * cruise;
        c.vy = sin * cruise;
        c.bias = rand(-1, 1);
        this.animal.enter?.(c, this);
    }
    passed(c, margin = c.span) {
        if (this.tuning.pond) {
            // [Pixel Pond change] gone past any edge (it wraps round in reenter)
            const { width: W, height: H } = this;
            return c.x < -margin || c.x > W + margin || c.y < -margin || c.y > H + margin;
        }
        const { width: W, height: H, course } = this;
        const cos = Math.cos(course);
        const sin = Math.sin(course);
        const out = cos > 0.05 && c.x > W + margin || cos < -0.05 && c.x < -margin || sin < -0.05 && c.y < -margin || sin > 0.05 && c.y > H + margin;
        const lost = c.x < -3 * margin || c.x > W + 3 * margin || c.y < -3 * margin || c.y > H + 3 * margin;
        return out || lost;
    }
    begin() {
        this.acc.x = 0;
        this.acc.y = 0;
        return this.acc;
    }
    steer(c, dir, speed, grip) {
        this.acc.x += (Math.cos(dir) * speed - c.vx) * grip;
        this.acc.y += (Math.sin(dir) * speed - c.vy) * grip;
    }
    separate(c, strength = this.tuning.separation, range = 0.42) {
        if (strength <= 0) return;
        for (const o of this.creatures){
            if (o === c || Math.abs(o.depth - c.depth) > 0.18) continue;
            const ox = c.x - o.x;
            const oy = c.y - o.y;
            const d = Math.hypot(ox, oy);
            const r = (c.span + o.span) * range;
            if (d < r && d > 1e-3) {
                const w = (1 - d / r) * strength;
                this.acc.x += ox / d * w;
                this.acc.y += oy / d * w;
            }
        }
    }
    move(c, dt, max) {
        c.vx += this.acc.x * dt;
        c.vy += this.acc.y * dt;
        let speed = Math.hypot(c.vx, c.vy);
        const cap = max + (this.time < c.startledUntil ? 300 : 0);
        if (speed > cap) {
            c.vx *= cap / speed;
            c.vy *= cap / speed;
            speed = cap;
        }
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        return speed;
    }
    face(c, dt, rate = 7, angle = Math.atan2(c.vy, c.vx)) {
        const turn = rate * dt;
        c.heading += clamp(angleDiff(c.heading, angle), -turn, turn);
    }
}
