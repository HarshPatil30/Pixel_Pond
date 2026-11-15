(() => {
  'use strict';

  /* ---------------- settings ---------------- */
  const KEY = 'pixelpond';
  const DEFAULTS = {
    v: 5, species: 'mix', style: 'tiles', count: 16, cell: 10, glow: false,
    sites: true, shortcuts: null, name: '', font: 'Inter Tight',
  };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  const migrate = saved.v !== 5;
  if (migrate) {
    Object.assign(saved, { v: 5, style: 'tiles', glow: false, cell: 10, count: 16 });
  }
  const S = Object.assign({}, DEFAULTS, saved);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };
  if (migrate) save();

  /* ---------------- helpers ---------------- */
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
  const ell = (g, x, y, rx, ry) => {
    g.beginPath();
    g.ellipse(x, y, Math.max(rx, 0.05), Math.max(ry, 0.05), 0, 0, TAU);
    g.fill();
  };
  const line = (g, pts) => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
  };

  /* ---------------- canvas ---------------- */
  const canvas = $('bg');
  const ctx = canvas.getContext('2d');
  const buf = document.createElement('canvas');
  const bctx = buf.getContext('2d', { willReadFrequently: true });
  let W = 1, H = 1, C = 10, dpr = 1;
  // cell layer for animals drawn tile by tile (butterfly, jellyfish)
  let tcol = [], gch = [], gcol = [], prio = new Int8Array(0);

  function resize() {
    C = S.cell;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(innerWidth * dpr));
    canvas.height = Math.max(1, Math.round(innerHeight * dpr));
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    W = Math.max(1, Math.ceil(innerWidth / C));
    H = Math.max(1, Math.ceil(innerHeight / C));
    buf.width = W;
    buf.height = H;
    tcol = new Array(W * H); gch = new Array(W * H); gcol = new Array(W * H); prio = new Int8Array(W * H);
    document.documentElement.style.setProperty('--cell', C + 'px');
  }

  const mouse = { x: -999, y: -999, on: false };
  const wake = [];
  const food = [];

  /* ---------------- creatures ---------------- */
  class Creature {
    constructor(x, y) {
      this.x = x != null ? x : rand(0, W);
      this.y = y != null ? y : rand(0, H);
      this.a = rand(0, TAU);
      this.t = rand(0, 100);
      this.s = 1;
      this.turn = 0;
      this.boost = 0;
      this.margin = 16;
      this.wake = 0;
      this.wakeCol = [175, 182, 195];
    }
    // local point (forward = +x) -> buffer coordinates
    at(lx, ly, rot) {
      const r = rot == null ? this.a : rot;
      const c = Math.cos(r), s = Math.sin(r);
      return [this.x + c * lx - s * ly, this.y + s * lx + c * ly];
    }
    eyes() { return []; }
    flee(dt) {
      this.boost = Math.max(0, this.boost - dt * 1.2);
      if (!mouse.on) return null;
      const dx = this.x - mouse.x, dy = this.y - mouse.y;
      const d = Math.hypot(dx, dy);
      const R = 12 + 9 * this.s;
      if (d < R) {
        this.boost = Math.min(1, this.boost + dt * 5 * (1 - d / R) + 0.02);
        return Math.atan2(dy, dx);
      }
      return null;
    }
    steer(dt, wander) {
      this.turn += rand(-1, 1) * wander * dt * 8;
      this.turn *= Math.pow(0.35, dt);
      this.turn = Math.max(-2, Math.min(2, this.turn));
      this.a += this.turn * dt;
      const away = this.flee(dt);
      if (away != null) this.a += angDiff(away, this.a) * Math.min(1, dt * 6);
    }
    move(dt, sp) {
      sp *= this.speedK || 1;
      this.x += Math.cos(this.a) * sp * dt;
      this.y += Math.sin(this.a) * sp * dt;
      if (this.wake && sp > 0.5) {
        this.wakeT = (this.wakeT || 0) - dt;
        if (this.wakeT <= 0) {
          this.wakeT = 0.05;
          const [wx, wy] = this.at(-this.wake * this.s, 0);
          wake.push({ x: wx + rand(-1.2, 1.2), y: wy + rand(-1.2, 1.2), life: 1, col: this.wakeCol });
        }
      }
      const m = this.margin * this.s;
      if (this.x < -m) this.x = W + m;
      else if (this.x > W + m) this.x = -m;
      if (this.y < -m) this.y = H + m;
      else if (this.y > H + m) this.y = -m;
    }
  }

  class Koi extends Creature {
    constructor(x, y) {
      super(x, y);
      this.s = rand(0.9, 1.5);
      this.sp = rand(5, 9);
      this.N = 11;
      this.pattern = Array.from({ length: this.N }, () => Math.random() < 0.45);
      this.base = pick(['hsl(6 82% 50%)', 'hsl(6 82% 50%)', 'hsl(20 90% 52%)', 'hsl(36 90% 52%)']);
      this.wake = 14;
      this.target = null;
    }
    update(dt) {
      this.t += dt * (1 + this.boost * 2);
      // look for food close by; hungry koi ignore the cursor
      let best = 30 * 30, target = null;
      for (const p of food) {
        if (p.eaten) continue;
        const dx = p.x - this.x, dy = p.y - this.y, d = dx * dx + dy * dy;
        if (d < best) { best = d; target = p; }
      }
      this.target = target;
      if (target) {
        this.boost = Math.max(0, this.boost - dt);
        const want = Math.atan2(target.y - this.y, target.x - this.x);
        this.a += angDiff(want, this.a) * Math.min(1, dt * 3.5);
        this.t += dt * 1.5;
        this.move(dt, this.sp * 1.9);
        const [hx, hy] = this.at(0.8 * this.s, 0);
        if (Math.hypot(target.x - hx, target.y - hy) < 1.1 + this.s * 0.8) target.eaten = true;
      } else {
        this.steer(dt, 1.0);
        this.move(dt, this.sp * (1 + 2.5 * this.boost));
      }
    }
    spine() {
      const s = this.s, seg = 1.25 * s, pts = [];
      for (let i = 0; i < this.N; i++) pts.push([-i * seg, Math.sin(this.t * 5 - i * 0.55) * i * 0.13 * s]);
      return pts;
    }
    draw(g) {
      const s = this.s, N = this.N, pts = this.spine();
      g.save();
      g.translate(this.x, this.y);
      g.rotate(this.a);
      g.fillStyle = 'hsl(215 8% 58%)';
      const [fx, fy] = pts[2];
      for (const side of [-1, 1]) {
        g.save();
        g.translate(fx, fy + side * 1.8 * s);
        g.rotate(side * (0.9 + 0.25 * Math.sin(this.t * 4)));
        ell(g, -1.2 * s, 0, 1.7 * s, 0.7 * s);
        g.restore();
      }
      const [tx, ty] = pts[N - 1];
      const sw = Math.sin(this.t * 5 - N * 0.55) * 1.6 * s;
      g.fillStyle = 'hsl(10 70% 55%)';
      g.beginPath();
      g.moveTo(tx + s, ty);
      g.lineTo(tx - 3.8 * s, ty - 2.4 * s + sw);
      g.lineTo(tx - 2.6 * s, ty + sw * 0.6);
      g.lineTo(tx - 3.8 * s, ty + 2.4 * s + sw);
      g.closePath();
      g.fill();
      for (let i = N - 1; i >= 0; i--) {
        const r = i < 2 ? s * (1.7 + i * 0.45) : s * (2.6 * (1 - (i - 2) / (N - 1)) + 0.4);
        g.fillStyle = this.pattern[i] ? 'hsl(30 15% 92%)' : this.base;
        ell(g, pts[i][0], pts[i][1], r, r);
      }
      g.restore();
    }
    eyes() { return [this.at(0.5 * this.s, -1.2 * this.s), this.at(0.5 * this.s, 1.2 * this.s)]; }
  }

  class Dragonfly extends Creature {
    constructor(x, y) {
      super(x, y);
      this.s = rand(1.0, 1.5);
      this.hue = pick([140, 150, 160, 128]);
      this.timer = 0;
      this.goal = this.a;
      this.v = 0;
      this.wake = 15;
    }
    update(dt) {
      this.t += dt;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = rand(0.6, 2.2);
        this.goal = this.a + rand(-1.7, 1.7);
        this.v = rand(16, 30);
      }
      const away = this.flee(dt);
      if (away != null) { this.goal = away; this.v = Math.max(this.v, 28); }
      this.a += angDiff(this.goal, this.a) * Math.min(1, dt * 6);
      this.v *= Math.pow(0.2, dt);
      this.move(dt, this.v + 1);
    }
    draw(g) {
      const s = this.s, h = this.hue;
      const flick = Math.sin(this.t * 55) * 0.22;
      g.save();
      g.translate(this.x, this.y);
      g.rotate(this.a);
      // see-through wings (show up as / \ outlines)
      g.fillStyle = `hsla(${h} 30% 75% / 0.24)`;
      for (const side of [-1, 1]) {
        for (const [wx, len] of [[0.7, 7], [-0.9, 6.2]]) {
          g.save();
          g.translate(wx * s, 0);
          g.rotate(side * (Math.PI / 2 + 0.2) + flick * side);
          ell(g, len * s / 2, 0, len * s / 2, 1.1 * s);
          g.restore();
        }
      }
      // long segmented tail
      g.strokeStyle = `hsl(${h} 75% 45%)`;
      g.lineWidth = 1.05 * s;
      const bend = Math.sin(this.t * 3) * 0.5;
      line(g, [[0, 0], [-6 * s, bend * 0.5], [-15 * s, bend]]);
      g.fillStyle = `hsl(${h} 80% 55%)`;
      ell(g, 0, 0, 1.8 * s, 1.05 * s);
      g.fillStyle = `hsl(${h} 70% 62%)`;
      ell(g, 2.5 * s, 0, 1.1 * s, 1.3 * s);
      g.restore();
    }
    eyes() { return [this.at(2.9 * this.s, -0.9 * this.s), this.at(2.9 * this.s, 0.9 * this.s)]; }
  }

  class Crab extends Creature {
    constructor(x, y) {
      super(x, y);
      this.s = rand(1.0, 1.5);
      this.hue = pick([5, 14, 352, 24]);
      this.dir = Math.random() < 0.5 ? -1 : 1;
      this.face = rand(-0.3, 0.3);
      this.timer = rand(2, 5);
      this.pause = 0;
      this.walking = true;
    }
    update(dt) {
      this.t += dt;
      this.timer -= dt;
      this.pause -= dt;
      if (this.timer < 0) {
        this.timer = rand(1.5, 5);
        if (Math.random() < 0.5) this.dir *= -1;
        this.face = rand(-0.5, 0.5);
        this.pause = Math.random() < 0.35 ? rand(0.5, 1.6) : 0;
      }
      if (this.flee(dt) != null) { this.dir = Math.sign(this.x - mouse.x) || 1; this.pause = 0; }
      this.walking = this.pause <= 0;
      this.a = this.face + (this.dir > 0 ? 0 : Math.PI);
      this.move(dt, this.walking ? 7 * (1 + 3 * this.boost) : 0);
    }
    draw(g) {
      const s = this.s, h = this.hue;
      const step = this.walking ? this.t * (14 + 20 * this.boost) : 0;
      const snip = 0.25 + 0.25 * Math.abs(Math.sin(this.t * 3));
      g.save();
      g.translate(this.x, this.y);
      g.rotate(this.face);
      for (const side of [-1, 1]) {
        g.strokeStyle = `hsl(${h} 80% 48%)`;
        g.lineWidth = 0.85;
        for (let k = 0; k < 3; k++) {
          const lift = Math.sin(step + k * 2.1 + (side > 0 ? 0 : Math.PI)) * 0.8 * s;
          const by = (k - 0.6) * 1.1 * s;
          line(g, [[side * 2.6 * s, by], [side * 4.4 * s, by - 0.6 * s + lift], [side * 5.3 * s, by + 1.6 * s + lift * 0.5]]);
        }
        g.lineWidth = 1;
        line(g, [[side * 2.2 * s, -1.6 * s], [side * 3.4 * s, -3.6 * s]]);
        g.fillStyle = `hsl(${h} 85% 55%)`;
        ell(g, side * 3.7 * s, -4.4 * s, 1.5 * s, 1.15 * s);
        g.fillStyle = '#000';
        g.beginPath();
        g.moveTo(side * 3.6 * s, -4.2 * s);
        g.lineTo(side * 3.0 * s, -5.6 * s);
        g.lineTo(side * (3.0 + snip * 2.4) * s, -5.6 * s);
        g.closePath();
        g.fill();
        g.strokeStyle = `hsl(${h} 70% 70%)`;
        g.lineWidth = 0.6;
        line(g, [[side * 0.8 * s, -2.2 * s], [side * 1.1 * s, -3.6 * s]]);
      }
      g.fillStyle = `hsl(${h} 80% 45%)`;
      ell(g, 0, 0, 3.6 * s, 2.6 * s);
      g.fillStyle = `hsl(${h + 15} 90% 66%)`;
      ell(g, 0, -0.8 * s, 2 * s, 1 * s);
      g.restore();
    }
    eyes() { return [this.at(-1.1 * this.s, -3.9 * this.s, this.face), this.at(1.1 * this.s, -3.9 * this.s, this.face)]; }
  }

  class Frog extends Creature {
    constructor(x, y) {
      super(x, y);
      this.s = rand(1.0, 1.5);
      this.hue = pick([110, 98, 125]);
      this.state = 'sit';
      this.timer = rand(0.5, 2);
      this.hop = 0;
      this.goal = this.a;
    }
    update(dt) {
      this.t += dt;
      this.timer -= dt;
      const away = this.flee(dt);
      if (this.state === 'sit') {
        if (away != null) { this.goal = away; this.a = away; this.timer = 0; }
        this.a += angDiff(this.goal, this.a) * Math.min(1, dt * 4);
        this.hop = Math.max(0, this.hop - dt * 5);
        if (this.timer <= 0) { this.state = 'hop'; this.timer = 0.32; }
      } else {
        this.hop = Math.min(1, this.hop + dt * 8);
        this.move(dt, 34 * (1 + this.boost));
        if (this.timer <= 0) {
          this.state = 'sit';
          this.timer = rand(0.6, 2.4);
          this.goal = this.a + rand(-1.4, 1.4);
        }
      }
    }
    draw(g) {
      const s = this.s, h = this.hue, e = this.hop;
      g.save();
      g.translate(this.x, this.y);
      g.rotate(this.a);
      g.fillStyle = `hsl(${h} 55% 34%)`;
      for (const side of [-1, 1]) {
        const len = 2.4 * s * (1 + e * 1.1);
        g.save();
        g.translate(-1.5 * s, side * 2 * s);
        g.rotate(side * (2.3 + e * 0.7));
        ell(g, len, 0, len, 0.9 * s);
        g.restore();
        g.save();
        g.translate(1.8 * s, side * 1.6 * s);
        g.rotate(side * (0.9 - e * 0.5));
        ell(g, 1.3 * s, 0, 1.3 * s, 0.55 * s);
        g.restore();
      }
      g.fillStyle = `hsl(${h} 55% 40%)`;
      ell(g, 0, 0, 3.5 * s, 2.8 * s);
      ell(g, 2.6 * s, 0, 1.7 * s, 2.1 * s);
      g.fillStyle = `hsl(${h - 40} 45% 60%)`; // speckles
      for (const [dx, dy, r] of [[-1.2, -0.8, 0.7], [0.4, 1, 0.6], [-0.2, -1.6, 0.5], [-2, 0.9, 0.5], [1, -0.4, 0.5]]) ell(g, dx * s, dy * s, r * s, r * s);
      g.restore();
    }
    eyes() { return [this.at(3 * this.s, -1.6 * this.s), this.at(3 * this.s, 1.6 * this.s)]; }
  }

  class Crane extends Creature {
    constructor(x, y) {
      super(x, y);
      this.s = rand(0.9, 1.3);
      this.sp = rand(8, 12);
      this.margin = 26;
      this.wake = 11;
    }
    update(dt) {
      this.t += dt;
      this.steer(dt, 0.7);
      this.move(dt, this.sp * (1 + 1.5 * this.boost));
    }
    draw(g) {
      const s = this.s;
      const f = Math.sin(this.t * 3.2 * (1 + this.boost));
      const span = 8.5 * s * (0.65 + 0.35 * f);
      g.save();
      g.translate(this.x, this.y);
      g.rotate(this.a);
      g.strokeStyle = 'hsl(45 30% 55%)';
      g.lineWidth = 0.55;
      for (const side of [-1, 1]) line(g, [[-3 * s, side * 0.4 * s], [-11 * s, side * 0.9 * s]]);
      for (const side of [-1, 1]) {
        g.fillStyle = 'hsl(220 10% 82%)';
        g.beginPath();
        g.moveTo(1.6 * s, 0);
        g.lineTo(-0.8 * s, side * span);
        g.lineTo(-3.2 * s, side * span * 0.95);
        g.lineTo(-2.4 * s, 0);
        g.closePath();
        g.fill();
        g.fillStyle = 'hsl(230 12% 38%)';
        g.beginPath();
        g.moveTo(-0.8 * s, side * span);
        g.lineTo(-3.2 * s, side * span * 0.95);
        g.lineTo(-2.6 * s, side * span * 0.68);
        g.lineTo(-0.6 * s, side * span * 0.74);
        g.closePath();
        g.fill();
      }
      g.fillStyle = 'hsl(0 0% 93%)';
      ell(g, 0, 0, 4 * s, 1.5 * s);
      g.strokeStyle = 'hsl(230 10% 60%)';
      g.lineWidth = 0.8;
      line(g, [[3 * s, 0], [7 * s, Math.sin(this.t * 1.5) * 0.4]]);
      g.fillStyle = 'hsl(0 0% 90%)';
      ell(g, 7.2 * s, 0, 1 * s, 0.8 * s);
      g.fillStyle = 'hsl(358 85% 52%)';
      ell(g, 7.4 * s, 0, 0.55 * s, 0.55 * s);
      g.strokeStyle = 'hsl(45 60% 62%)';
      g.lineWidth = 0.6;
      line(g, [[8 * s, 0], [10.2 * s, 0]]);
      g.restore();
    }
  }

  // Original orange fire dragon: flaps big wings, flame on its tail, leaves embers behind.
  class Dragon extends Creature {
    constructor(x, y) {
      super(x, y);
      this.s = rand(1.1, 1.5);
      this.sp = rand(7, 10);
      this.margin = 32;
      this.wake = 15;
      this.wakeCol = [255, 140, 40];
    }
    update(dt) {
      this.t += dt;
      this.steer(dt, 0.6);
      this.move(dt, this.sp * (1 + 1.5 * this.boost));
    }
    draw(g) {
      const s = this.s;
      const f = Math.sin(this.t * 2.4 * (1 + this.boost));
      const span = 9.5 * s * (0.65 + 0.35 * f);
      g.save();
      g.translate(this.x, this.y);
      g.rotate(this.a);
      // tail
      g.fillStyle = 'hsl(24 90% 50%)';
      let tipx = 0, tipy = 0;
      for (let i = 0; i < 10; i++) {
        tipx = -3 * s - i * 1.1 * s;
        tipy = Math.sin(this.t * 3 - i * 0.5) * i * 0.2 * s;
        ell(g, tipx, tipy, s * (1.2 - i * 0.08), s * (1.2 - i * 0.08));
      }
      const flick = 0.75 + 0.45 * Math.abs(Math.sin(this.t * 13));
      g.fillStyle = 'hsl(10 95% 50%)';
      ell(g, tipx - 1.2 * s, tipy, 1.7 * s * flick, 1.4 * s * flick);
      g.fillStyle = 'hsl(48 100% 62%)';
      ell(g, tipx - 1.0 * s, tipy, 0.8 * s * flick, 0.7 * s * flick);
      // wings
      for (const side of [-1, 1]) {
        g.fillStyle = 'hsl(18 70% 32%)';
        g.beginPath();
        g.moveTo(1 * s, side * 1 * s);
        g.lineTo(-0.6 * s, side * span);
        g.lineTo(-3.6 * s, side * span * 0.85);
        g.lineTo(-4.8 * s, side * span * 0.42);
        g.lineTo(-2.4 * s, side * 1.2 * s);
        g.closePath();
        g.fill();
        g.strokeStyle = 'hsl(26 95% 56%)';
        g.lineWidth = 0.75;
        line(g, [[1 * s, side * 1 * s], [-0.6 * s, side * span], [-3.6 * s, side * span * 0.85]]);
      }
      // body, belly, neck, head
      g.fillStyle = 'hsl(24 92% 55%)';
      ell(g, 0, 0, 3.6 * s, 1.9 * s);
      g.fillStyle = 'hsl(44 90% 74%)';
      ell(g, 0.3 * s, 0, 2.4 * s, 0.8 * s);
      g.fillStyle = 'hsl(24 92% 55%)';
      ell(g, 3.6 * s, 0, 1.2 * s, 1 * s);
      ell(g, 5.2 * s, 0, 1.7 * s, 1.4 * s);
      ell(g, 6.7 * s, 0, 0.9 * s, 0.8 * s);
      g.strokeStyle = 'hsl(40 55% 78%)';
      g.lineWidth = 0.6;
      for (const side of [-1, 1]) line(g, [[4.5 * s, side * 1 * s], [3.2 * s, side * 2.1 * s]]);
      g.restore();
    }
    eyes() { return [this.at(5.7 * this.s, -0.8 * this.s), this.at(5.7 * this.s, 0.8 * this.s)]; }
  }

  /* ---------------- cell-drawn animals (butterfly, jellyfish) ---------------- */
  const hash = (x, y, k) => (((x * 73856093) ^ (y * 19349663) ^ (k * 83492791)) >>> 0);
  const rnd = (x, y, k) => (hash(x, y, k) % 10007) / 10007;
  const pk = (arr, r) => arr[Math.floor(r * arr.length) % arr.length];
  // write one cell: higher priority wins
  function put(x, y, p, tile, ch, col) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (p < prio[i]) return;
    prio[i] = p; tcol[i] = tile; gch[i] = ch; gcol[i] = col;
  }
  // screen direction -> line symbol
  function dirChar(dx, dy) {
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    if (Math.abs(dy) > 0.92) return '|';
    if (Math.abs(dx) > 0.92) return '-';
    return dx * dy < 0 ? '/' : '\\';
  }

  /* ---------------- butterfly ---------------- */
  // Open pose copied tile by tile from the reference (12 wide x 11 tall, origin at the body junction):
  //   front wing block x -4..0, y -5..-1   (top row x -3..0)
  //   middle band      y -1..2, x -5..6    (row -1: x -4..5, row 2: x -5..5)
  //   hind wing block  y 3..5,  x -2..2    (bottom row x -1..1)
  //   body             x -1..1, y -1..2    (grey 8 and . cells)
  // Each wing has its own light centre, mid blue around it and a navy outline one tile wide.
  // White specks hop along the outline (mostly the front wing). Closing the wings squeezes the
  // whole shape toward the up-right diagonal until it is a thin sliver; the light centres grow
  // while closing and the mid blue grows back while opening.
  const LV = {
    navy:  { t: ['#232c62', '#26306a', '#2b3676'], g: ['@', '%', '#', '@'], c: '#8f95e2' },
    steel: { t: ['#2a5590', '#2c5b98', '#305fa0'], g: ['*', '%', '=', '#'], c: '#c4d6f4' },
    mid:   { t: ['#3a80d2', '#4189da', '#367ac8'], g: ['+', '=', '*', '%'], c: '#e3eefc' },
    light: { t: ['#66b1ec', '#6db8f2', '#77c0f5'], g: [':', ';', '+', '=', ':'], c: '#11223b' },
  };
  const WING_BOXES = [ // centre x, centre y, half width, half height, front?
    { cx: -2, cy: -3, hx: 2.5, hy: 2.5, front: true },
    { cx: -3.2, cy: 0.5, hx: 2.3, hy: 2, front: false },
    { cx: 3.8, cy: 0.5, hx: 2.7, hy: 2, front: false },
    { cx: 0, cy: 4, hx: 2.5, hy: 1.6, front: false },
  ];
  function inCross(x, y) {
    if (y === -5) return x >= -3 && x <= 0;
    if (y >= -4 && y <= -2) return x >= -4 && x <= 0;
    if (y === -1) return x >= -4 && x <= 5;
    if (y === 0 || y === 1) return x >= -5 && x <= 6;
    if (y === 2) return x >= -5 && x <= 5;
    if (y === 3 || y === 4) return x >= -2 && x <= 2;
    if (y === 5) return x >= -1 && x <= 1;
    return false;
  }
  const isBody = (x, y) => x >= 0 && x <= 1 && y >= -1 && y <= 1;
  function wingOf(x, y) {
    let best = null, bd = 9;
    for (const w of WING_BOXES) {
      const d = Math.max(Math.abs(x - w.cx) / w.hx, Math.abs(y - w.cy) / w.hy);
      if (d < bd) { bd = d; best = w; }
    }
    return [best, bd];
  }
  const DIAG = [Math.SQRT1_2, -Math.SQRT1_2]; // body axis: up and to the right
  const PERP = [Math.SQRT1_2, Math.SQRT1_2];
  const COURSE = -0.86;
  class Butterfly {
    constructor() {
      this.x = rand(0, W); this.y = rand(0, H);
      this.s = rand(0.95, 1.2); this.t = rand(0, 50); this.sp = rand(3, 5); this.id = Math.floor(rand(1, 9999));
      this.rate = rand(1.3, 1.8); this.phase = 0; this.close = 0;
      this.mode = 'glide'; this.timer = rand(0.2, 1.5); this.a = COURSE;
    }
    update(dt) {
      this.t += dt;
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.mode === 'flap') { this.mode = 'glide'; this.timer = rand(0.6, 1.4); }
        else { this.mode = 'flap'; this.timer = rand(1.2, 2.4); this.phase = 0; }
      }
      const prev = this.close;
      if (this.mode === 'flap') {
        this.phase += dt * this.rate * TAU;
        this.close = Math.pow(0.5 - 0.5 * Math.cos(this.phase), 1.4); // 0 open .. 1 shut
      } else {
        this.close += (0 - this.close) * Math.min(1, dt * 6);
      }
      this.closing = this.close > prev;
      this.a = COURSE + Math.sin(this.t * 0.7 + this.id) * 0.2;
      const sp = this.sp * (this.mode === 'glide' ? 0.8 : 1.1);
      this.x += Math.cos(this.a) * sp * dt; this.y += Math.sin(this.a) * sp * dt;
      const m = 12;
      if (this.x < -m) this.x = W + m; if (this.x > W + m) this.x = -m;
      if (this.y < -m) this.y = H + m; if (this.y > H + m) this.y = -m;
    }
    // screen cell -> open-pose cell (undo the squeeze toward the diagonal)
    toPose(cx, cy, squeeze) {
      const qx = (cx + 0.5 - this.x) / this.s, qy = (cy + 0.5 - this.y) / this.s;
      const al = qx * DIAG[0] + qy * DIAG[1], pe = (qx * PERP[0] + qy * PERP[1]) / squeeze;
      return [Math.round(al * DIAG[0] + pe * PERP[0]), Math.round(al * DIAG[1] + pe * PERP[1])];
    }
    render(tick, fast) {
      const squeeze = Math.max(0.14, 1 - 0.86 * this.close);
      const innerT = 0.38 + 0.4 * this.close; // light centres grow as the wings close
      const R = Math.ceil(9 * this.s), x0 = Math.floor(this.x) - R, y0 = Math.floor(this.y) - R, n = 2 * R + 1;
      const pose = new Array(n * n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const [px, py] = this.toPose(x0 + i, y0 + j, squeeze);
        pose[j * n + i] = inCross(px, py) ? [px, py] : null;
      }
      const filled = (i, j) => i >= 0 && j >= 0 && i < n && j < n && pose[j * n + i];
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const cx = x0 + i, cy = y0 + j, p = pose[j * n + i];
          const r = rnd(cx, cy, tick + this.id), r2 = rnd(cx + 7, cy + 3, tick * 3 + this.id);
          if (!p) {
            const dx = cx + 0.5 - this.x, dy = cy + 0.5 - this.y;
            if (dx * dx + dy * dy < 100 * this.s * this.s && r < 0.1) put(cx, cy, 0, null, '.', 'rgba(78,98,170,0.6)');
            continue;
          }
          const [px, py] = p;
          const [wing, d] = wingOf(px, py);
          const outline = !filled(i - 1, j) || !filled(i + 1, j) || !filled(i, j - 1) || !filled(i, j + 1);
          if (outline) {
            const chance = wing.front ? 0.2 : 0.07;
            if (rnd(cx, cy, fast + this.id) < chance) { put(cx, cy, 2, '#eef2fa', pk(['*', 'o', '*', ':'], r), '#1a2233'); continue; }
            put(cx, cy, 2, pk(LV.navy.t, r2), pk(LV.navy.g, r), LV.navy.c);
            continue;
          }
          if (isBody(px, py)) {
            if (r2 < 0.45) put(cx, cy, 2, '#3b3f4d', '8', '#8b909e');
            else put(cx, cy, 2, null, pk(['.', '`', ',', "'"], r), '#7d84a8');
            continue;
          }
          const dn = d + (r - 0.5) * 0.15;
          let lv;
          if (dn < innerT) lv = LV.light;
          else lv = r2 < 0.55 ? LV.mid : LV.steel;
          put(cx, cy, 2, pk(lv.t, r2), pk(lv.g, r), lv.c);
        }
      }
      // antennae just right of the front wing: | | o  and  / / o  (squeezed with the body)
      const A = (ax, ay, ch, col) => {
        const al = ax * DIAG[0] + ay * DIAG[1], pe = (ax * PERP[0] + ay * PERP[1]) * squeeze;
        const sx = (al * DIAG[0] + pe * PERP[0]) * this.s, sy = (al * DIAG[1] + pe * PERP[1]) * this.s;
        put(Math.floor(this.x + sx), Math.floor(this.y + sy), 3, null, ch, col);
      };
      A(1, -2, '|', '#a6abd6'); A(1, -3, '|', '#a6abd6'); A(1, -4, 'o', '#d9dcf2');
      A(2, -1, '/', '#a6abd6'); A(3, -2, '/', '#a6abd6'); A(4, -3, 'o', '#d9dcf2');
    }
  }

  /* ---------------- jellyfish ---------------- */
  class Jelly {
    constructor() {
      this.x = rand(0, W); this.y = rand(0, H); this.s = rand(0.75, 1.15); this.t = rand(0, 50);
      this.id = Math.floor(rand(1, 9999)); this.a = -Math.PI / 4;
    }
    get th() { return Math.max(0, Math.sin(this.t * 2)) ** 2; }
    update(dt) {
      this.t += dt;
      this.a = -Math.PI / 4 + Math.sin(this.t * 0.5 + this.id) * 0.12;
      const sp = (0.9 + 5.5 * this.th) * this.s;
      this.x += Math.cos(this.a) * sp * dt; this.y += Math.sin(this.a) * sp * dt;
      const m = 40 * this.s;
      if (this.x > W + m) this.x = -m; if (this.y < -m) this.y = H + m;
      if (this.x < -m) this.x = W + m; if (this.y > H + m) this.y = -m;
    }
    render(tick) {
      const s = this.s, th = this.th, p = Math.sin(this.t * 2);
      const R = 5.6 * s * (1 + 0.04 * p), L = 4.4 * R;
      const rot = this.a + Math.PI / 2, co = Math.cos(rot), si = Math.sin(rot); // local -v points forward
      const tdir = dirChar(-si, co);
      const lit = 9 * th; // glow while pushing
      const ext = Math.ceil(R + L + 4);
      const inB = (X, Y) => {
        const dx = X + 0.5 - this.x, dy = Y + 0.5 - this.y;
        const u = co * dx + si * dy, v = -si * dx + co * dy;
        if (v < 0) return (u / R) ** 2 + (v / (0.95 * R)) ** 2 <= 1;
        if (v <= 0.3 * R) return Math.abs(u) <= R * (1 - 0.5 * v / R);
        return false;
      };
      const x0 = Math.floor(this.x) - ext, y0 = Math.floor(this.y) - ext;
      for (let cy = y0; cy <= y0 + 2 * ext; cy++) {
        for (let cx = x0; cx <= x0 + 2 * ext; cx++) {
          const dx = cx + 0.5 - this.x, dy = cy + 0.5 - this.y;
          const u = co * dx + si * dy, v = -si * dx + co * dy;
          const r = rnd(cx, cy, tick + this.id), r2 = rnd(cx + 5, cy + 11, tick * 7 + this.id);
          // bell: tiles stay square to the screen; light row along the top, light column down the
          // right, o bubbles along the lower-left edge where the tentacle band comes out
          if (inB(cx, cy)) {
            if (!inB(cx, cy - 1)) { put(cx, cy, 2, `hsl(308 14% ${58 + lit}%)`, pk([':', ';', ':', "'"], r), '#2a1a28'); continue; }
            if (!inB(cx + 1, cy)) { put(cx, cy, 2, `hsl(310 16% ${54 + lit}%)`, pk([':', ';', ':'], r), '#2a1a28'); continue; }
            if ((!inB(cx - 1, cy) || !inB(cx, cy + 1)) && r < 0.55) { put(cx, cy, 2, '#c3b9c7', 'o', '#2b1f2d'); continue; }
            if (!inB(cx, cy - 2) && r < 0.5) { put(cx, cy, 2, `hsl(310 16% ${50 + lit}%)`, pk([':', ';', '|'], r), '#2a1a28'); continue; }
            if (r2 < 0.06) { put(cx, cy, 2, '#78717c', '|', '#f2f2f2'); continue; }
            if (r2 < 0.2) { put(cx, cy, 2, `hsl(314 24% ${44 + lit}%)`, pk(['|', "'", '.'], r), '#f0dcea'); continue; }
            put(cx, cy, 2, `hsl(318 52% ${29 + lit}%)`, pk(['.', '.', '.', "'", ':'], r), `hsl(318 45% ${68 + lit}%)`);
            continue;
          }
          // trailing band behind the bell: § ~ { } in the middle, / / / on both sides
          if (v > 0.15 * R && v < 0.3 * R + L) {
            const tt = (v - 0.3 * R) / L;
            const xc = Math.sin(this.t * 1.3 - v * 0.12) * 0.9 * Math.max(tt, 0);
            const wc = R * 0.42 * (1 - 0.35 * tt), wt = R * 0.95 * (1 - 0.2 * tt);
            const d = Math.abs(u - xc);
            if (d < wc) {
              if (r > 0.12) put(cx, cy, 1, null, pk(['§', '~', '{', '}', ':', '|', '§', '~', '{', '}', '('], r2), `rgba(236,206,226,${(0.95 - 0.45 * tt).toFixed(2)})`);
              continue;
            }
            if (d < wt) {
              if (r < 0.85) put(cx, cy, 1, null, tdir, `rgba(160,62,132,${(0.7 - 0.35 * tt).toFixed(2)})`);
              continue;
            }
          }
          // dotted halo round the bell
          let k2 = v < 0 ? Math.sqrt((u / (R + 1.8)) ** 2 + (v / (0.95 * R + 1.8)) ** 2) : Math.abs(u) / (R + 1.8);
          if (v < 0.3 * R + 1.5 && k2 <= 1 && r < 0.7) put(cx, cy, 0, null, '.', `rgba(175,110,160,${(0.55 + th * 0.3).toFixed(2)})`);
        }
      }
    }
  }

  for (const K of [Butterfly, Jelly]) { K.prototype.cell = true; K.prototype.eyes = () => []; K.prototype.draw = () => {}; }

  const KINDS = {
    butterfly: { cls: Butterfly, label: 'Butterfly', color: '#4d8dff' },
    koi: { cls: Koi, label: 'Koi', color: '#ff7a3d' },
    jellyfish: { cls: Jelly, label: 'Jellyfish', color: '#d65fd8' },
    dragonfly: { cls: Dragonfly, label: 'Dragonfly', color: '#3ed08a' },
    frog: { cls: Frog, label: 'Frog', color: '#6fd36a' },
    crane: { cls: Crane, label: 'Crane', color: '#e9edf2' },
    crab: { cls: Crab, label: 'Crab', color: '#ff5a4f' },
    dragon: { cls: Dragon, label: 'Dragon', color: '#ff8a2a' },
  };

  let pond = [];
  const spawn = (x, y) => {
    const k = S.species === 'mix' ? pick(Object.keys(KINDS)) : S.species;
    const c = new KINDS[k].cls(x, y);
    // depth: far animals are smaller, fainter and slower; most sit in the middle distance
    c.depth = Math.random();
    if (c.cell) { c.alpha = 1; return c; } // tile-by-tile animals keep their exact reference size
    c.s *= 0.78 * (1 - 0.25 * c.depth);
    c.alpha = 1 - 0.3 * c.depth;
    c.speedK = 1 - 0.3 * c.depth;
    return c;
  };
  const byDepth = () => pond.sort((p, q) => q.depth - p.depth); // far ones drawn first
  // big animals shown on their own get fewer copies so the screen isn't crowded
  const DENSITY = { butterfly: 0.45, jellyfish: 0.4, crane: 0.6, dragon: 0.4, frog: 0.8 };
  const target = () => Math.max(2, Math.round(S.count * (DENSITY[S.species] || 1)));
  const populate = () => { pond = Array.from({ length: target() }, () => spawn()); byDepth(); };
  const fitCount = () => {
    const n = target();
    while (pond.length < n) pond.push(spawn());
    if (pond.length > n) pond.splice(0, pond.length - n);
    byDepth();
  };

  /* ---------------- food ---------------- */
  function dropFood(cx, cy) {
    const n = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      food.push({ x: cx + rand(-4, 4), y: cy + rand(-3, 3), vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3), life: 14, eaten: false });
    }
    if (food.length > 90) food.splice(0, food.length - 90);
  }

  /* ---------------- render ---------------- */
  const RAMP = ' .:-=+*#%@';
  const SET_MAIN = ['=', '+', '#', '%', ':', '*', '@', '8', ';', '+', '!', '='];
  const SET_JELLY = ['§', '~', '{', '}', '(', ')', '-', '§', '~', '{'];
  const SET_BELL = ['.', ':', '|', '.', "'", ';', ':', '.'];
  let lum = new Float32Array(0);
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!ownActive) { requestAnimationFrame(frame); return; } // ascii-animals engine is drawing instead

    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.fillStyle = '#000';
    bctx.fillRect(0, 0, W, H);

    if (wake.length > 2200) wake.splice(0, wake.length - 2200);
    for (let i = wake.length - 1; i >= 0; i--) {
      const w = wake[i];
      w.life -= dt * 0.75;
      if (w.life <= 0) { wake.splice(i, 1); continue; }
      const c = w.col;
      bctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(w.life * 0.3).toFixed(3)})`;
      bctx.fillRect(w.x | 0, w.y | 0, 1, 1);
    }

    for (let i = food.length - 1; i >= 0; i--) {
      const p = food[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.eaten || p.life <= 0) food.splice(i, 1);
    }

    prio.fill(-1);
    const tickC = Math.floor(now / 320), fastC = Math.floor(now / 90);
    let anyCell = false;
    for (const c of pond) {
      c.update(dt);
      if (c.cell) { c.render(tickC, fastC); anyCell = true; continue; }
      bctx.globalAlpha = c.alpha;
      c.draw(bctx);
    }
    bctx.globalAlpha = 1;
    const px = bctx.getImageData(0, 0, W, H).data;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    if (S.glow) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.filter = `blur(${Math.round(C * 1.6)}px)`;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(buf, 0, 0, W * C, H * C);
      ctx.restore();
    }

    if (S.style === 'tiles') drawTiles(px, now);
    else drawSimple(px, S.style === 'ascii');
    drawOverlays();
    if (anyCell) drawCells();
    requestAnimationFrame(frame);
  }

  function drawCells() {
    const pad = C >= 8 ? 1 : 0.5, sz = C - pad * 2;
    ctx.font = `700 ${Math.max(6, Math.round(C * 0.92))}px ui-monospace, "Cascadia Mono", Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < W * H; i++) {
      if (prio[i] < 0) continue;
      const x = (i % W) * C, y = Math.floor(i / W) * C;
      if (tcol[i]) { ctx.fillStyle = tcol[i]; ctx.fillRect(x + pad, y + pad, sz, sz); }
      if (gch[i]) { ctx.fillStyle = gcol[i]; ctx.fillText(gch[i], x + C / 2, y + C / 2 + 0.5); }
    }
  }

  function drawTiles(px, now) {
    const n = W * H;
    if (lum.length !== n) lum = new Float32Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const r = px[j], g = px[j + 1], b = px[j + 2];
      lum[i] = r > g ? (r > b ? r : b) : (g > b ? g : b);
    }
    ctx.font = `700 ${Math.max(6, Math.round(C * 0.95))}px ui-monospace, "Cascadia Mono", Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tick = Math.floor(now / 380);
    const fast = Math.floor(now / 130);
    const pad = C >= 8 ? 1 : 0.5, sz = C - pad * 2;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, m = lum[i];
        if (m < 34) continue;
        const j = i * 4, k = 255 / m;
        const r = (px[j] * k) | 0, g = (px[j + 1] * k) | 0, b = (px[j + 2] * k) | 0;
        // magenta/pink tint = jellyfish: bell gets . : | symbols, tentacles get § { } ( ) ~
        const jelly = r > g + 20 && b > g + 20 && r >= 0.7 * b;
        const set = jelly ? SET_JELLY : SET_MAIN;
        const cx = x * C + C / 2, cy = y * C + C / 2 + 0.5;
        const hsh = ((x * 73856093) ^ (y * 19349663) ^ (tick * 83492791)) >>> 0;
        if (m >= 85) {
          // solid tile in its real shade, speckled per tile; dark tiles get light symbols, bright tiles dark ones
          const nf = 0.93 + 0.14 * (((hsh >>> 8) & 255) / 255);
          let tr = Math.min(255, px[j] * 1.15 * nf) | 0, tg = Math.min(255, px[j + 1] * 1.15 * nf) | 0, tb = Math.min(255, px[j + 2] * 1.15 * nf) | 0;
          // sparkle: a few bright tiles twinkle white for a moment
          const sp = ((x * 2654435761) ^ (y * 40503) ^ (fast * 97)) >>> 0;
          if (m >= 150 && sp % 1000 < 10) { tr = 238; tg = 242; tb = 250; }
          ctx.fillStyle = `rgb(${tr},${tg},${tb})`;
          ctx.fillRect(x * C + pad, y * C + pad, sz, sz);
          if (0.3 * tr + 0.59 * tg + 0.11 * tb > 135) ctx.fillStyle = 'rgba(0,0,0,0.55)';
          else ctx.fillStyle = `rgb(${((r + 102) / 1.4) | 0},${((g + 102) / 1.4) | 0},${((b + 102) / 1.4) | 0})`;
          const tset = jelly ? SET_BELL : SET_MAIN;
          ctx.fillText(tset[(m >= 150 ? hsh : hsh >>> 4) % tset.length], cx, cy);
        } else {
          const L = x > 0 ? lum[i - 1] : 0, R = x < W - 1 ? lum[i + 1] : 0;
          const U = y > 0 ? lum[i - W] : 0, D = y < H - 1 ? lum[i + W] : 0;
          const gx = R - L, gy = D - U;
          let ch;
          if (jelly && m > 48) ch = set[(hsh >>> 2) % set.length];
          else if (Math.abs(gx) > 45 && Math.abs(gy) > 45) ch = gx * gy > 0 ? '/' : '\\';
          else if (m > 62) ch = (hsh & 1) ? ':' : '-';
          else ch = (hsh & 3) ? '.' : "'";
          ctx.fillStyle = `rgba(${r},${g},${b},${(0.35 + m / 220).toFixed(2)})`;
          ctx.fillText(ch, cx, cy);
        }
      }
    }
  }

  function drawSimple(px, ascii) {
    if (ascii) {
      ctx.font = `bold ${C + 2}px ui-monospace, Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
    }
    const gap = C >= 7 ? 1 : 0.5;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const r = px[i], g = px[i + 1], b = px[i + 2];
        const m = r > g ? (r > b ? r : b) : (g > b ? g : b);
        if (m < 26) continue;
        if (ascii) {
          const k = 255 / m;
          ctx.fillStyle = `rgb(${(r * k) | 0},${(g * k) | 0},${(b * k) | 0})`;
          ctx.fillText(RAMP[Math.min(9, 1 + Math.floor((m / 255) * 9))], x * C + C / 2, y * C + C / 2 + 0.5);
        } else {
          const k = (Math.ceil((m / 255) * 4) / 4) * 255 / m;
          ctx.fillStyle = `rgb(${Math.min(255, r * k) | 0},${Math.min(255, g * k) | 0},${Math.min(255, b * k) | 0})`;
          ctx.fillRect(x * C + gap, y * C + gap, C - gap * 2, C - gap * 2);
        }
      }
    }
  }

  // eyes and food sit on top of the tiles
  function drawOverlays() {
    const pad = C >= 8 ? 1 : 0.5, sz = C - pad * 2;
    ctx.font = `700 ${Math.max(6, Math.round(C * 0.95))}px ui-monospace, "Cascadia Mono", Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const c of pond) {
      if (!c.marks) continue;
      ctx.globalAlpha = c.alpha;
      for (const mk of c.marks()) {
        const x = Math.floor(mk.x), y = Math.floor(mk.y);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        if (mk.tile) { ctx.fillStyle = mk.tile; ctx.fillRect(x * C + pad, y * C + pad, sz, sz); }
        ctx.fillStyle = mk.col;
        ctx.fillText(mk.ch, x * C + C / 2, y * C + C / 2 + 0.5);
      }
    }
    for (const c of pond) {
      ctx.globalAlpha = c.alpha;
      for (const [ex, ey] of c.eyes()) {
        const x = Math.floor(ex), y = Math.floor(ey);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        ctx.fillStyle = '#efefea';
        ctx.fillRect(x * C + pad, y * C + pad, sz, sz);
        ctx.fillStyle = '#0d0d0f';
        ctx.beginPath();
        ctx.arc(x * C + C / 2, y * C + C / 2, Math.max(1.2, C * 0.2), 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (food.length) {
      ctx.font = `700 ${Math.round(C * 1.1)}px ui-monospace, "Cascadia Mono", Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const p of food) {
        const a = Math.min(1, p.life / 2);
        ctx.fillStyle = `rgba(247,170,70,${a.toFixed(2)})`;
        ctx.fillText('o', Math.floor(p.x) * C + C / 2, Math.floor(p.y) * C + C / 2);
      }
    }
  }

  /* ---------------- pointer ---------------- */
  addEventListener('pointermove', (e) => { mouse.x = e.clientX / C; mouse.y = e.clientY / C; mouse.on = true; });
  document.addEventListener('pointerleave', () => { mouse.on = false; });
  canvas.addEventListener('pointerdown', (e) => { if (ownActive) dropFood(e.clientX / C, e.clientY / C); });
  document.querySelector('.center').addEventListener('pointerdown', (e) => {
    if (ownActive && e.target.classList.contains('center')) dropFood(e.clientX / C, e.clientY / C);
  });

  /* ---------------- ascii-animals engine (MIT, by drewdi) ---------------- */
  // Butterfly, Koi, Jellyfish, Dragonfly, Frog, Crane and Crab come from the ascii-animals repo;
  // Mix and Dragon keep running on this file's own engine.
  const ENGINE_KEYS = { butterfly: 'butterflies', koi: 'koi', jellyfish: 'jellyfish', dragonfly: 'dragonflies', frog: 'frogs', crane: 'cranes', crab: 'crabs' };
  const animalsCanvas = document.getElementById('animals');
  const SAME_WAY = new Set(['butterflies', 'jellyfish', 'cranes']);
  // Pixel size slider -> the engine's ASCII detail (10px tiles = its default 1.3; bigger tiles = less detail)
  const detailFor = () => Math.max(0.5, Math.min(2, 13 / S.cell));
  let engine = null;
  let ownActive = true;

  // Glow for the engine's animals: a blurred copy of its canvas, screen-blended on top
  const glowCanvas = document.getElementById('glow');
  const gctx = glowCanvas.getContext('2d');
  function glowFrame() {
    requestAnimationFrame(glowFrame);
    const on = !ownActive && S.glow && !animalsCanvas.hidden;
    if (glowCanvas.hidden === on) glowCanvas.hidden = !on;
    if (!on) return;
    const gw = Math.max(1, Math.round(innerWidth / 2)), gh = Math.max(1, Math.round(innerHeight / 2));
    if (glowCanvas.width !== gw || glowCanvas.height !== gh) { glowCanvas.width = gw; glowCanvas.height = gh; }
    gctx.clearRect(0, 0, gw, gh);
    gctx.filter = `blur(${Math.max(3, Math.round(S.cell * 0.7))}px)`;
    gctx.globalAlpha = 0.75;
    gctx.drawImage(animalsCanvas, 0, 0, gw, gh);
    gctx.filter = 'none';
    gctx.globalAlpha = 1;
  }
  requestAnimationFrame(glowFrame);
  function applyEngine() {
    const key = ENGINE_KEYS[S.species];
    const lib = window.AsciiAnimals;
    if (key && lib) {
      animalsCanvas.hidden = false;
      // butterflies, jellyfish and cranes travel together one way; the rest wander like a pond
      const tuning = { pond: !SAME_WAY.has(key), detail: detailFor(), density: S.count / 16 };
      if (!engine) engine = new lib.AnimalEngine(animalsCanvas, { animal: key, theme: 'dark', tuning });
      else if (engine.animal !== lib.ANIMALS[key]) engine.setAnimal(key, tuning);
      ownActive = false;
    } else {
      animalsCanvas.hidden = true;
      ownActive = true;
    }
    document.getElementById('tweaks').classList.toggle('engine-on', !ownActive);
  }
  addEventListener('ascii-animals-ready', applyEngine);

  /* ---------------- animals pill ---------------- */
  const nav = $('species');
  const speciesList = [['mix', 'Mix', '#9aa4ff'], ...Object.entries(KINDS).map(([k, v]) => [k, v.label, v.color])];
  for (const [key, label, color] of speciesList) {
    const b = el('button');
    b.type = 'button';
    b.dataset.key = key;
    const dot = el('span', 'dot');
    dot.style.setProperty('--c', color);
    b.append(dot, document.createTextNode(label));
    b.addEventListener('click', () => { S.species = key; save(); syncSpecies(); populate(); applyEngine(); });
    nav.append(b);
  }
  const syncSpecies = () => { for (const b of nav.children) b.classList.toggle('on', b.dataset.key === S.species); };

  /* ---------------- customize panel ---------------- */
  const panel = $('tweaks'), tBtn = $('tweaksBtn');
  tBtn.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    tBtn.setAttribute('aria-expanded', String(!panel.hidden));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) tBtn.click(); });

  const styleSeg = $('styleSeg');
  const syncStyle = () => { for (const b of styleSeg.children) b.classList.toggle('on', b.dataset.style === S.style); };
  styleSeg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    S.style = b.dataset.style; save(); syncStyle();
  });

  const count = $('count'), cell = $('cell');
  count.value = S.count; $('countVal').textContent = S.count;
  count.addEventListener('input', () => {
    S.count = +count.value; $('countVal').textContent = S.count; save(); fitCount();
    if (engine && !ownActive) engine.set('density', S.count / 16);
  });
  cell.value = S.cell; $('cellVal').textContent = S.cell + 'px';
  cell.addEventListener('input', () => {
    const old = C;
    S.cell = +cell.value; $('cellVal').textContent = S.cell + 'px'; save();
    if (engine && !ownActive) engine.set('detail', detailFor());
    resize();
    for (const c of pond) { c.x = c.x * old / C; c.y = c.y * old / C; }
    food.length = 0;
    wake.length = 0;
  });
  const glow = $('glowToggle');
  glow.checked = S.glow;
  glow.addEventListener('change', () => { S.glow = glow.checked; save(); });
  const sites = $('sites');
  sites.checked = S.sites;
  sites.addEventListener('change', () => { S.sites = sites.checked; save(); renderSites(); });
  $('resetSites').addEventListener('click', () => { S.shortcuts = null; save(); renderSites(); });

  /* ---------------- greeting (editable name) ---------------- */
  const gpart = $('gpart'), gname = $('gname'), gend = $('gend'), nameIn = $('nameIn');
  let editingName = false;
  function tick() {
    const hr = new Date().getHours();
    let part, end = '';
    // 11 pm to 5 am: "Still up, Name?"; otherwise morning / afternoon / evening by the clock
    if (hr < 5 || hr >= 23) { part = 'Still up'; end = '?'; }
    else if (hr < 12) part = 'Good morning';
    else if (hr < 17) part = 'Good afternoon';
    else part = 'Good evening';
    gpart.textContent = part + ', ';
    gend.textContent = end;
    if (!editingName) gname.textContent = S.name;
  }
  function setName(v) {
    S.name = (v || '').replace(/\s+/g, ' ').trim().slice(0, 30);
    save();
    nameIn.value = S.name;
    tick();
  }
  gname.addEventListener('click', () => {
    if (editingName) return;
    editingName = true;
    gname.contentEditable = 'true';
    gname.focus();
    const r = document.createRange();
    r.selectNodeContents(gname);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  });
  gname.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); gname.blur(); }
    if (e.key === 'Escape') { gname.textContent = S.name; gname.blur(); }
  });
  gname.addEventListener('blur', () => {
    if (!editingName) return;
    editingName = false;
    gname.contentEditable = 'false';
    setName(gname.textContent);
  });
  nameIn.value = S.name;
  nameIn.addEventListener('input', () => setName(nameIn.value));
  tick();
  setInterval(tick, 30000);

  /* ---------------- greeting font ---------------- */
  const FONTS = {
    'Inter Tight': 'Inter+Tight:wght@500',
    'Geist': 'Geist:wght@500',
    'Space Grotesk': 'Space+Grotesk:wght@500',
    'Sora': 'Sora:wght@500',
    'Instrument Serif': 'Instrument+Serif',
    'Fraunces': 'Fraunces:wght@500',
    'Silkscreen': 'Silkscreen',
    'JetBrains Mono': 'JetBrains+Mono:wght@500',
  };
  const fontSel = $('fontSel');
  for (const f of Object.keys(FONTS)) {
    const o = el('option');
    o.value = f;
    o.textContent = f;
    fontSel.append(o);
  }
  function applyFont() {
    if (!FONTS[S.font]) S.font = 'Inter Tight';
    let link = $('gfont');
    if (!link) { link = el('link'); link.id = 'gfont'; link.rel = 'stylesheet'; document.head.append(link); }
    link.href = `https://fonts.googleapis.com/css2?family=${FONTS[S.font]}&display=swap`;
    $('greeting').style.fontFamily = `"${S.font}", "Segoe UI Variable Display", "Segoe UI", sans-serif`;
    fontSel.value = S.font;
  }
  fontSel.addEventListener('change', () => { S.font = fontSel.value; save(); applyFont(); });
  applyFont();

  /* ---------------- search ---------------- */
  const q = $('q');
  const isUrl = (t) => !/\s/.test(t) && (/^[a-z]+:\/\//i.test(t) || /^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(t) || /^localhost(:\d+)?/.test(t));
  const go = (url) => { location.href = url; };
  function runSearch(ai) {
    const text = q.value.trim();
    if (ai) { go('https://www.google.com/search?udm=50' + (text ? '&q=' + encodeURIComponent(text) : '')); return; }
    if (!text) return;
    if (isUrl(text)) go(/^[a-z]+:\/\//i.test(text) ? text : 'https://' + text);
    else if (window.chrome && chrome.search && chrome.search.query) chrome.search.query({ text, disposition: 'CURRENT_TAB' });
    else go('https://www.google.com/search?q=' + encodeURIComponent(text));
  }
  $('search').addEventListener('submit', (e) => { e.preventDefault(); runSearch(false); });
  $('aiBtn').addEventListener('click', () => runSearch(true));
  $('plusBtn').addEventListener('click', () => go('https://lens.google.com/'));

  const mic = $('micBtn');
  mic.addEventListener('click', () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { go('https://www.google.com/'); return; }
    const rec = new SR();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    const done = () => { mic.classList.remove('listening'); q.placeholder = 'Ask anything…'; };
    rec.onresult = (ev) => {
      q.value = Array.from(ev.results).map((r) => r[0].transcript).join('');
      if (ev.results[ev.results.length - 1].isFinal) runSearch(false);
    };
    rec.onend = done;
    rec.onerror = done;
    mic.classList.add('listening');
    q.placeholder = 'Listening…';
    try { rec.start(); } catch (e) { done(); }
  });

  addEventListener('keydown', (e) => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !editingName) {
      e.preventDefault(); q.focus();
    }
  });

  /* ---------------- shortcuts ---------------- */
  const siteList = $('siteList');
  const MAX = 10;
  const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } };
  const inExtension = !!(window.chrome && chrome.runtime && chrome.runtime.id);
  const favicon = (url) => inExtension
    ? chrome.runtime.getURL('/_favicon/?pageUrl=' + encodeURIComponent(url) + '&size=64')
    : 'https://www.google.com/s2/favicons?sz=64&domain_url=' + encodeURIComponent(url);

  function loadShortcuts(cb) {
    if (Array.isArray(S.shortcuts)) { cb(S.shortcuts); return; }
    if (window.chrome && chrome.topSites) {
      chrome.topSites.get((list) => {
        S.shortcuts = (list || []).slice(0, 8).map((s) => ({
          name: ((s.title || '').split(/\s[|\-–·•]\s/)[0] || '').trim().slice(0, 30) || hostOf(s.url),
          url: s.url,
        }));
        save();
        cb(S.shortcuts);
      });
    } else {
      S.shortcuts = [
        { name: 'YouTube', url: 'https://www.youtube.com/' },
        { name: 'ChatGPT', url: 'https://chatgpt.com/' },
        { name: 'Gmail', url: 'https://mail.google.com/' },
      ];
      cb(S.shortcuts);
    }
  }

  function renderSites() {
    siteList.textContent = '';
    if (!S.sites) return;
    loadShortcuts((list) => {
      siteList.textContent = '';
      list.forEach((sc, idx) => {
        const a = el('a', 'site');
        a.href = sc.url;
        a.title = sc.name;
        const ico = el('div', 'ico');
        const img = el('img');
        img.alt = '';
        img.src = favicon(sc.url);
        img.onerror = () => { img.remove(); ico.textContent = (sc.name || '?')[0].toUpperCase(); };
        ico.append(img);
        const label = el('span');
        label.textContent = sc.name;
        const edit = el('button', 'edit');
        edit.type = 'button';
        edit.title = 'Edit shortcut';
        edit.setAttribute('aria-label', 'Edit shortcut ' + sc.name);
        edit.textContent = '⋮';
        edit.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openEditor(idx); });
        a.append(ico, label, edit);
        siteList.append(a);
      });
      if (list.length < MAX) {
        const add = el('button', 'site');
        add.type = 'button';
        const ico = el('div', 'ico');
        ico.textContent = '+';
        const label = el('span');
        label.textContent = 'Add shortcut';
        add.append(ico, label);
        add.addEventListener('click', () => openEditor(-1));
        siteList.append(add);
      }
    });
  }

  const dlg = $('scDialog'), dName = $('scName'), dUrl = $('scUrl'), dRemove = $('scRemove');
  let editing = -1;
  function openEditor(idx) {
    editing = idx;
    const sc = idx >= 0 ? S.shortcuts[idx] : { name: '', url: '' };
    $('scTitle').textContent = idx >= 0 ? 'Edit shortcut' : 'Add shortcut';
    dName.value = sc.name;
    dUrl.value = sc.url;
    dRemove.hidden = idx < 0;
    dlg.showModal();
    dName.focus();
  }
  $('scForm').addEventListener('submit', (e) => {
    e.preventDefault();
    let url = dUrl.value.trim();
    if (!url) return;
    if (!/^[a-z]+:\/\//i.test(url)) url = 'https://' + url;
    const sc = { name: dName.value.trim() || hostOf(url), url };
    if (editing >= 0) S.shortcuts[editing] = sc; else S.shortcuts.push(sc);
    save();
    dlg.close();
    renderSites();
  });
  $('scCancel').addEventListener('click', () => dlg.close());
  dRemove.addEventListener('click', () => {
    S.shortcuts.splice(editing, 1);
    save();
    dlg.close();
    renderSites();
  });

  /* ---------------- go ---------------- */
  resize();
  addEventListener('resize', resize);
  syncSpecies();
  syncStyle();
  populate();
  renderSites();
  requestAnimationFrame(frame);
})();
