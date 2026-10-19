import { AnimationGroup, Observer, Scene, TransformNode } from "babylonjs";

/** Options for {@link AnimationMixer.play}. */
export interface PlayOptions {
    /** Cross-fade time from the current animation, seconds. Default 0.25; 0 cuts. */
    blend?: number;
    /** Loop (the default) or play once. A one-shot returns to the motion animation (or the last looping one) when it ends. */
    loop?: boolean;
    /** Playback speed, 1 = as authored. */
    speed?: number;
}

/**
 * Plays a model's named animation groups (a GLB's `Idle`, `Walk`, `Wave`)
 * with cross-fades, and optionally picks idle/walk/run from how fast the
 * model is moving. Owned by {@link GardenMeshModel}; see its `play()` and
 * `anim-*` attributes.
 *
 * Fades by animation-group weights: during a blend both groups run, the new
 * one's weight rising to 1 as the old one's falls to 0.
 *
 * @category Core
 */
export class AnimationMixer {
    /** The playing (or fading-in) animation's name. */
    current: string = null;

    private groups = new Map<string, AnimationGroup>();
    private fades: { group: AnimationGroup, from: number, to: number, t: number, length: number }[] = [];
    private observer: Observer<Scene>;
    private oneShot = false;
    private lastLoop: { name: string, speed: number } = null;

    /** Set by the motion driver: what to return to after a one-shot. */
    motion: (() => { name: string, speed: number }) = null;

    constructor(private scene: Scene, groups: AnimationGroup[], private owner: HTMLElement) {
        for (let group of groups) {
            group.stop();
            group.weight = 0;
            this.groups.set(group.name.toLowerCase(), group);
        }
        this.observer = scene.onBeforeRenderObservable.add(() => this.step());
    }

    /** The animation names, as the file has them. */
    get names(): string[] {
        return [...this.groups.values()].map(g => g.name);
    }

    /** The group called `name` (any case), or null. */
    group(name: string): AnimationGroup {
        return name ? this.groups.get(name.toLowerCase()) ?? null : null;
    }

    /** Cross-fades to `name`. Returns false (with a warning) if there is no such animation. */
    play(name: string, options: PlayOptions = {}): boolean {
        let group = this.group(name);
        if (!group) {
            console.warn(`No animation "${name}"; this model has: ${this.names.join(", ")}`);
            return false;
        }
        let loop = options.loop ?? true;
        let speed = options.speed ?? 1;
        let blend = Math.max(0, options.blend ?? 0.25);

        this.oneShot = !loop;
        if (loop)
            this.lastLoop = { name: group.name, speed };

        let same = this.current?.toLowerCase() == group.name.toLowerCase();
        this.current = group.name;
        group.speedRatio = speed;
        if (same && loop && group.isPlaying)
            return true;

        // A looping group still fading out carries on from where it is; a one-shot starts over.
        let wasPlaying = group.isPlaying && loop;
        group.onAnimationGroupEndObservable.clear();
        if (!wasPlaying)
            group.start(loop, speed);
        if (!loop) {
            group.onAnimationGroupEndObservable.addOnce(() => this.ended(group));
        }
        if (blend == 0) {
            this.fades = [];
            for (let other of this.groups.values())
                if (other != group) { other.weight = 0; other.stop(); }
            group.weight = 1;
        } else {
            // Fade every other playing group out from where it is now, this one in.
            this.fades = this.fades.filter(f => f.group != group);
            for (let other of this.groups.values()) {
                if (other == group || !other.isPlaying) continue;
                this.fades = this.fades.filter(f => f.group != other);
                this.fades.push({ group: other, from: other.weight, to: 0, t: 0, length: blend });
            }
            let from = wasPlaying ? group.weight : 0;
            this.fades.push({ group, from, to: 1, t: 0, length: blend });
            group.weight = from;
        }
        return true;
    }

    /** Stops everything (fading out over `blend` seconds). */
    stop(blend = 0.25) {
        this.current = null;
        this.oneShot = false;
        this.lastLoop = null;
        this.fades = [];
        for (let group of this.groups.values()) {
            if (!group.isPlaying) continue;
            if (blend > 0) this.fades.push({ group, from: group.weight, to: 0, t: 0, length: blend });
            else { group.weight = 0; group.stop(); }
        }
    }

    /** Sets the playing animation's speed without restarting it. */
    setSpeed(speed: number) {
        let group = this.group(this.current);
        if (group) group.speedRatio = speed;
        if (this.lastLoop && this.lastLoop.name == this.current) this.lastLoop.speed = speed;
    }

    /** True while a one-shot (loop: false) is playing: the motion driver leaves it alone. */
    get busy(): boolean {
        return this.oneShot;
    }

    private ended(group: AnimationGroup) {
        if (this.current != group.name)
            return;
        this.owner.dispatchEvent(new CustomEvent("garden-animation-end", { bubbles: true, detail: { name: group.name } }));
        this.oneShot = false;
        let next = this.motion?.() ?? this.lastLoop;
        if (next)
            this.play(next.name, { speed: next.speed, blend: 0.2 });
        else
            this.current = null;
    }

    private step() {
        if (!this.fades.length)
            return;
        let dt = Math.min(this.scene.getEngine().getDeltaTime(), 50) / 1000;
        for (let fade of this.fades) {
            fade.t = Math.min(fade.length, fade.t + dt);
            let k = fade.length > 0 ? fade.t / fade.length : 1;
            fade.group.weight = fade.from + (fade.to - fade.from) * k;
            if (k >= 1 && fade.to == 0)
                fade.group.stop();
        }
        this.fades = this.fades.filter(f => f.t < f.length);
    }

    dispose() {
        this.scene.onBeforeRenderObservable.remove(this.observer);
    }
}

/**
 * The motion driver behind `anim-idle`/`anim-walk`/`anim-run`: measures how
 * fast `node` moves (or asks `speedOf`, e.g. a walker's own speed) and plays
 * idle, walk or run, speeding walk and run up or down to match. Smoothed so
 * one jerky frame doesn't flip animations.
 *
 * @category Core
 */
export function driveByMotion(mixer: AnimationMixer, scene: Scene, node: TransformNode, options: {
    idle?: string, walk?: string, run?: string,
    walkSpeed: number, runSpeed: number,
    speedOf?: () => number,
}): Observer<Scene> {
    let last = node.getAbsolutePosition().clone();
    let smoothed = 0;
    let choose = (): { name: string, speed: number } => {
        let v = smoothed;
        if (v < 0.15 || (!options.walk && !options.run))
            return options.idle ? { name: options.idle, speed: 1 } : null;
        let runFrom = (options.walkSpeed + options.runSpeed) / 2;
        let clamp = (k: number) => Math.max(0.5, Math.min(2, k));
        if (options.run && (v >= runFrom || !options.walk))
            return { name: options.run, speed: clamp(v / options.runSpeed) };
        return { name: options.walk, speed: clamp(v / options.walkSpeed) };
    };
    mixer.motion = choose;
    return scene.onBeforeRenderObservable.add(() => {
        let dt = Math.min(scene.getEngine().getDeltaTime(), 50) / 1000;
        if (!dt) return;
        let p = node.getAbsolutePosition();
        let measured = options.speedOf?.() ?? Math.hypot(p.x - last.x, p.z - last.z) / dt;
        last.copyFrom(p);
        smoothed += (measured - smoothed) * Math.min(1, dt * 8);
        if (mixer.busy)
            return;
        let want = choose();
        if (!want)
            return;
        if (want.name.toLowerCase() != mixer.current?.toLowerCase())
            mixer.play(want.name, { speed: want.speed, blend: 0.3 });
        else
            mixer.setSpeed(want.speed);
    });
}
