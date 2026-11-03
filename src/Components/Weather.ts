import { Color4 } from "@babylonjs/core/Maths/math.color";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

/**
 * The weather presets behind `<garden-particle preset="...">` (see
 * {@link "Components/Particle"!GardenParticle}): tuned particle systems that need no image (they
 * draw their own soft dot), so they work offline.
 *
 * - `rain` and `snow` fall round the camera and go where it goes.
 * - `sand` blows sideways round the camera, along `wind`.
 * - `dust-devil` is a spinning column of dust standing on its parent mesh
 *   (move the mesh with `track` or `wander` and the whirlwind travels).
 *
 * `density` (0 = none, 1 = the preset's normal amount, more for a storm)
 * scales how many particles are emitted, and can change at any time.
 *
 * @category Components
 */
export module Weather {
    export const Presets = ["rain", "snow", "sand", "dust-devil"];

    let textures = new WeakMap<Scene, DynamicTexture>();

    /** A soft white dot, drawn once per scene. */
    export function dotTexture(scene: Scene): DynamicTexture {
        let texture = textures.get(scene);
        if (texture) return texture;
        texture = new DynamicTexture("garden-weather-dot", 64, scene, true);
        let ctx = texture.getContext() as CanvasRenderingContext2D;
        let gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, "rgba(255,255,255,1)");
        gradient.addColorStop(0.4, "rgba(255,255,255,0.6)");
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        texture.hasAlpha = true;
        texture.update();
        textures.set(scene, texture);
        return texture;
    }

    export interface WeatherSystem {
        system: ParticleSystem;
        /** The emit rate at density 1. */
        baseRate: number;
        dispose(): void;
    }

    /**
     * Builds preset `name`. `anchor` is the parent's node (for a dust devil);
     * `wind` (units/second) blows sand and leans rain and snow.
     */
    export function create(name: string, scene: Scene, anchor: TransformNode, options: { wind?: Vector3, colour?: Color4, size?: number }): WeatherSystem {
        let wind = options.wind ?? (name == "sand" ? new Vector3(7, 0, 2) : Vector3.Zero());
        let scale = options.size ?? 1;
        let ps: ParticleSystem;
        let baseRate: number;
        let observer: any;
        let emitterNode: Mesh;

        // Falling or blowing round the camera: a box of emitters moved with it each frame.
        let aroundCamera = (offset: Vector3) => {
            let at = new Vector3();
            ps.emitter = at;
            observer = scene.onBeforeRenderObservable.add(() => {
                let camera = scene.activeCamera;
                if (camera) at.copyFrom(camera.globalPosition).addInPlace(offset);
            });
        };

        switch (name) {
            case "rain":
                ps = new ParticleSystem("garden-rain", 6000, scene);
                baseRate = 4000;
                ps.minEmitBox = new Vector3(-18, 0, -18);
                ps.maxEmitBox = new Vector3(18, 0, 18);
                ps.direction1 = new Vector3(wind.x * 0.1, -1, wind.z * 0.1);
                ps.direction2 = new Vector3(wind.x * 0.1, -1, wind.z * 0.1);
                ps.minEmitPower = 14;
                ps.maxEmitPower = 18;
                ps.minLifeTime = ps.maxLifeTime = 0.9;
                ps.minSize = 0.04 * scale;
                ps.maxSize = 0.06 * scale;
                ps.minScaleY = ps.maxScaleY = 1;
                ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
                ps.color1 = options.colour ?? new Color4(0.75, 0.8, 0.9, 0.55);
                ps.color2 = ps.color1;
                ps.colorDead = new Color4(0.75, 0.8, 0.9, 0);
                ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
                aroundCamera(new Vector3(0, 12, 0));
                break;
            case "snow":
                ps = new ParticleSystem("garden-snow", 5000, scene);
                baseRate = 900;
                ps.minEmitBox = new Vector3(-20, 0, -20);
                ps.maxEmitBox = new Vector3(20, 0, 20);
                ps.direction1 = new Vector3(-0.3 + wind.x * 0.2, -1, -0.3 + wind.z * 0.2);
                ps.direction2 = new Vector3(0.3 + wind.x * 0.2, -1, 0.3 + wind.z * 0.2);
                ps.minEmitPower = 0.8;
                ps.maxEmitPower = 1.4;
                ps.minLifeTime = ps.maxLifeTime = 9;
                ps.minSize = 0.06 * scale;
                ps.maxSize = 0.14 * scale;
                ps.color1 = options.colour ?? new Color4(1, 1, 1, 0.9);
                ps.color2 = ps.color1;
                ps.colorDead = new Color4(1, 1, 1, 0);
                ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
                aroundCamera(new Vector3(0, 9, 0));
                break;
            case "sand": {
                ps = new ParticleSystem("garden-sand", 8000, scene);
                baseRate = 3500;
                let across = new Vector3(-wind.z, 0, wind.x).normalize().scale(22);
                let upwind = wind.lengthSquared() > 0 ? wind.normalizeToNew().scale(-14) : Vector3.Zero();
                ps.minEmitBox = new Vector3(Math.min(-across.x, across.x), -1, Math.min(-across.z, across.z)).addInPlace(upwind);
                ps.maxEmitBox = new Vector3(Math.max(-across.x, across.x), 4, Math.max(-across.z, across.z)).addInPlace(upwind);
                let w = wind.lengthSquared() > 0 ? wind.normalizeToNew() : new Vector3(1, 0, 0);
                ps.direction1 = new Vector3(w.x, -0.05, w.z);
                ps.direction2 = new Vector3(w.x, 0.15, w.z);
                ps.minEmitPower = wind.length() * 0.8;
                ps.maxEmitPower = wind.length() * 1.2;
                ps.minLifeTime = 3;
                ps.maxLifeTime = 4.5;
                ps.minSize = 0.03 * scale;
                ps.maxSize = 0.09 * scale;
                ps.color1 = options.colour ?? new Color4(0.86, 0.72, 0.5, 0.75);
                ps.color2 = new Color4(0.76, 0.6, 0.4, 0.6);
                ps.colorDead = new Color4(0.8, 0.65, 0.45, 0);
                ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
                aroundCamera(new Vector3(0, 0, 0));
                break;
            }
            case "dust-devil": {
                ps = new ParticleSystem("garden-dust-devil", 3000, scene);
                baseRate = 600;
                // Particles live in the spinning emitter's own space, so they all turn with it.
                emitterNode = new Mesh("garden-dust-devil-emitter", scene);
                emitterNode.isVisible = false;
                if (anchor) emitterNode.parent = anchor;
                ps.emitter = emitterNode;
                ps.isLocal = true;
                let cylinder = ps.createCylinderEmitter(0.6 * scale, 0.2, 0.2, 0);
                cylinder.directionRandomizer = 0;
                ps.startDirectionFunction = (matrix, direction, particle) => {
                    // Up and out: the column widens as it rises.
                    let p = particle.position;
                    let r = Math.hypot(p.x, p.z) || 1;
                    direction.set(p.x / r * 0.35, 1, p.z / r * 0.35);
                };
                ps.minEmitPower = 2;
                ps.maxEmitPower = 3.5;
                ps.minLifeTime = 1.6;
                ps.maxLifeTime = 2.6;
                ps.minSize = 0.15 * scale;
                ps.maxSize = 0.45 * scale;
                ps.color1 = options.colour ?? new Color4(0.78, 0.64, 0.45, 0.55);
                ps.color2 = new Color4(0.65, 0.52, 0.38, 0.4);
                ps.colorDead = new Color4(0.7, 0.58, 0.42, 0);
                ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
                let spin = 5;
                observer = scene.onBeforeRenderObservable.add(() => {
                    emitterNode.rotation.y += spin * Math.min(scene.getEngine().getDeltaTime(), 50) / 1000;
                });
                break;
            }
            default:
                return null;
        }
        ps.particleTexture = dotTexture(scene);
        ps.emitRate = baseRate;
        // Already falling when the page opens, not starting from the sky.
        ps.preWarmCycles = name == "dust-devil" ? 60 : 100;
        ps.preWarmStepOffset = 5;

        return {
            system: ps,
            baseRate,
            dispose() {
                scene.onBeforeRenderObservable.remove(observer);
                ps.dispose(false);
                emitterNode?.dispose();
            },
        };
    }
}
