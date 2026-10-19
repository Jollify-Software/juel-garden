import { Scene } from "babylonjs";

/**
 * Runs `step(k)` every frame for `seconds`, `k` going 0 to 1 (eased in and
 * out), and resolves when done. A zero or negative time steps straight to 1.
 * Used for fog that closes in, a sky that darkens, a flash that fades.
 *
 * @category Utilities
 */
export function tween(scene: Scene, seconds: number, step: (k: number) => void): Promise<void> {
    if (!(seconds > 0)) {
        step(1);
        return Promise.resolve();
    }
    return new Promise(resolve => {
        let t = 0;
        let observer = scene.onBeforeRenderObservable.add(() => {
            t = Math.min(seconds, t + Math.min(scene.getEngine().getDeltaTime(), 100) / 1000);
            let x = t / seconds;
            step(x * x * (3 - 2 * x));
            if (t >= seconds) {
                scene.onBeforeRenderObservable.remove(observer);
                resolve();
            }
        });
    });
}
