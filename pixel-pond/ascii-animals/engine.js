// From ascii-animals (https://github.com/DesignerStephen1/ascii-animals), MIT License, Copyright (c) 2026 drewdi. See LICENSE.txt
import { ANIMALS } from "./animals/index.js";
import { Flock } from "./flock.js";
import { AsciiRenderer } from "./renderer.js";
const STEP = 1 / 60;
const resolve = (animal)=>typeof animal === "string" ? ANIMALS[animal] : animal;
const MAX_STEPS = 4;
export class AnimalEngine {
    canvas;
    tuning;
    animal;
    flock;
    renderer;
    count;
    raf = 0;
    last = 0;
    acc = 0;
    visible = true;
    reducedMotion;
    resizeObserver;
    intersectionObserver;
    disposed = false;
    constructor(canvas, { animal = "butterflies", count, theme = "light", tuning } = {}){
        this.canvas = canvas;
        this.count = count;
        this.animal = resolve(animal);
        this.tuning = {
            ...this.animal.defaults,
            ...tuning
        };
        this.flock = new Flock(this.animal, this.tuning, count);
        this.renderer = new AsciiRenderer(canvas, this.tuning);
        this.renderer.setFontFamily(getComputedStyle(canvas).fontFamily);
        this.renderer.setAnimal(this.animal, this.tuning);
        this.renderer.setTheme(theme);
        this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        this.resizeObserver = new ResizeObserver(()=>this.resize());
        this.resizeObserver.observe(canvas);
        this.intersectionObserver = new IntersectionObserver(([entry])=>{
            this.visible = entry.isIntersecting;
            this.schedule();
        });
        this.intersectionObserver.observe(canvas);
        this.reducedMotion.addEventListener("change", this.onMotionPreference);
        window.addEventListener("pointerdown", this.onPointerDown, {
            passive: true
        });
        // [Pixel Pond change] track the cursor so animals can scatter from it
        window.addEventListener("pointermove", this.onPointerMove, { passive: true });
        document.addEventListener("pointerleave", this.onPointerLeave);
        this.resize();
        document.fonts?.load(`600 16px ${getComputedStyle(canvas).fontFamily}`).then(()=>{
            if (!this.disposed && this.reducedMotion.matches) this.drawStill();
        });
        this.schedule();
    }
    destroy() {
        this.disposed = true;
        cancelAnimationFrame(this.raf);
        this.resizeObserver.disconnect();
        this.intersectionObserver.disconnect();
        this.reducedMotion.removeEventListener("change", this.onMotionPreference);
        window.removeEventListener("pointerdown", this.onPointerDown);
        window.removeEventListener("pointermove", this.onPointerMove);
        document.removeEventListener("pointerleave", this.onPointerLeave);
    }
    setAnimal(animal, tuning) {
        this.animal = resolve(animal);
        this.tuning = {
            ...this.animal.defaults,
            ...tuning
        };
        this.flock = new Flock(this.animal, this.tuning, this.count);
        this.renderer.setAnimal(this.animal, this.tuning);
        this.resize();
    }
    set(key, value) {
        this.tuning[key] = value;
        if (key === "detail") this.resize();
        else if (key === "hueShift" || key === "grid") this.renderer.restyle();
        if (this.reducedMotion.matches) this.drawStill();
    }
    setTheme(theme) {
        this.renderer.setTheme(theme);
        if (this.reducedMotion.matches) this.drawStill();
    }
    resize() {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.renderer.resize(rect.width, rect.height, dpr);
        this.flock.resize(rect.width, rect.height);
        if (this.reducedMotion.matches) this.drawStill();
    }
    schedule() {
        cancelAnimationFrame(this.raf);
        if (this.disposed || !this.visible || this.reducedMotion.matches) return;
        this.last = performance.now();
        this.raf = requestAnimationFrame(this.frame);
    }
    frame = (now)=>{
        const dt = Math.min(0.1, (now - this.last) / 1000);
        this.last = now;
        this.acc += dt;
        let steps = 0;
        this.flock.pointer = this.pointer;
        while(this.acc >= STEP && steps < MAX_STEPS){
            this.flock.step(STEP);
            this.acc -= STEP;
            steps++;
        }
        if (steps === MAX_STEPS) this.acc = 0;
        this.renderer.render(this.flock, dt);
        this.raf = requestAnimationFrame(this.frame);
    };
    drawStill() {
        if (this.flock.time < 4) {
            for(let i = 0; i < 240; i++)this.flock.step(STEP);
        }
        this.renderer.render(this.flock, STEP);
    }
    onMotionPreference = ()=>{
        if (this.reducedMotion.matches) {
            cancelAnimationFrame(this.raf);
            this.drawStill();
        } else {
            this.schedule();
        }
    };
    pointer = { x: 0, y: 0, on: false };
    onPointerMove = (e)=>{
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = e.clientX - rect.left;
        this.pointer.y = e.clientY - rect.top;
        this.pointer.on = !this.reducedMotion.matches;
    };
    onPointerLeave = ()=>{
        this.pointer.on = false;
    };
    onPointerDown = (e)=>{
        if (this.reducedMotion.matches || e.target !== this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        this.flock.startle(e.clientX - rect.left, e.clientY - rect.top);
    };
}
