import { Node } from "@babylonjs/core/node";
import { StaticSound } from "@babylonjs/core/AudioV2/abstractAudio/staticSound";
import { Tools } from "@babylonjs/core/Misc/tools";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { customElement, property } from "lit/decorators.js";
import { GardenElement } from "../GardenElement";

/**
 * A positional (or ambient) audio source on Babylon's audio engine
 * (`AudioEngineV2`, see {@link GardenScene.audioEngine}). Inside an element
 * with a mesh or node it is spatial: it follows that mesh every frame, so a
 * voice comes from a guide who is walking about. Directly inside
 * `<garden-scene>` (or with `ambient`) it plays at the same volume
 * everywhere.
 *
 * Attributes:
 * - `url`, `loop`, `autoplay`, `volume` (0-1, default 1).
 * - `ref-distance` -- the distance the volume starts to fall at (default 1).
 * - `rolloff` -- how fast it falls (default 1).
 * - `max-distance` (or the older `maxdistance`) -- beyond this it falls no
 *   further; only used by the `linear` model.
 * - `distance-model` -- `inverse` (the default), `linear` or `exponential`.
 *   Setting only `max-distance` picks `linear`, as the old `<garden-sound>` did.
 * - `directional="inner outer"` -- a cone in degrees, for a voice facing
 *   one way: full volume inside `inner`, fading to `directional-volume`
 *   (default 0) at `outer` and beyond. Points the way the parent faces.
 * - `play-on`, `stop-on` -- DOM event names that play or stop the sound
 *   when they reach the parent element (e.g. `play-on="garden-near"`, see
 *   {@link Proximity}), so an exhibit talks when you walk up to it with no
 *   code at all.
 * - `ambient` -- never spatial, even inside a mesh.
 * - `sync` -- a group name: sounds with the same `sync` (in the same scene) play
 *   together, sample-accurately -- parts of one piece of music, layers of an engine
 *   noise. With `autoplay` they wait until every one in the group has loaded, then
 *   start at once; `play()`, `stop()`, `pause()` and `resume()` on any one of them act
 *   on the whole group.
 *
 * Script API: {@link play}, {@link stop}, {@link pause}, {@link resume}, {@link group},
 * {@link attachTo} (re-parent it to another element or node), `playing`,
 * and the underlying Babylon {@link sound}. Fires `garden-sound-end`
 * (bubbling) when the sound finishes or is stopped.
 *
 * @example
 * ```html
 * <garden-box id="exhibit" near="#player" near-distance="4">
 *   <garden-sound url="talk.mp3" play-on="garden-near" stop-on="garden-far" ref-distance="2"></garden-sound>
 * </garden-box>
 * ```
 *
 * @category Components
 */
/** A bare attribute or any value but `"false"` is on (the old `loop="true"` still works). */
const flag = { fromAttribute: (value: string) => value != null && value != "false" };

@customElement("garden-sound")
export class GardenSound extends GardenElement {
    @property() url: string;
    @property({ converter: flag }) loop: boolean;
    @property({ converter: flag }) autoplay: boolean;
    @property({ type: Number }) volume: number;

    /** The Babylon sound, once loaded (see {@link whenReady}). */
    sound: StaticSound;

    private _built: string;
    private _listeners: [EventTarget, string, EventListener][] = [];

    /** True while the sound is playing. */
    get playing(): boolean {
        return (this.sound?.activeInstancesCount ?? 0) > 0;
    }

    /** Its `updated()` handles later changes in place. */
    protected get handlesChanges() {
        return true;
    }

    updated() {
        // Changing loop/volume shouldn't reload the file.
        if (this.sound) {
            this.sound.loop = this.loop;
            this.sound.volume = this.volume ?? 1;
        }
        if (!this.url || this._built == this.url)
            return;
        this._built = this.url;
        this.beginBuild();
        this.build(this.url)
            .catch(err => console.error(`<garden-sound> couldn't load ${this.url}`, err))
            .finally(() => this.endBuild());
    }

    private async build(url: string) {
        let sceneEl = this.getSceneEl();
        if (!sceneEl)
            return;
        let audio = await sceneEl.audioEngine();
        await GardenElement.whenDocumentReady();

        let num = (name: string) => this.hasAttribute(name) ? Number(this.getAttribute(name)) : undefined;
        let maxDistance = num("max-distance") ?? num("maxdistance");
        let model = this.getAttribute("distance-model") as any
            ?? (maxDistance != null ? "linear" : undefined);
        let spatialOptions: any = {
            minDistance: num("ref-distance"),
            rolloffFactor: num("rolloff"),
            maxDistance: maxDistance,
            distanceModel: model,
        };
        let cone = this.getAttribute("directional")?.trim().split(/\s+/).map(Number);
        if (cone?.length) {
            spatialOptions.coneInnerAngle = Tools.ToRadians(cone[0]);
            spatialOptions.coneOuterAngle = Tools.ToRadians(cone[1] ?? cone[0] * 2);
            spatialOptions.coneOuterVolume = num("directional-volume") ?? 0;
            spatialOptions.orientation = new Vector3(0, 0, 1);
        }

        let parent = this.parentElement as GardenElement;
        let spatial = !this.hasAttribute("ambient") && parent && parent.localName != "garden-scene"
            && typeof (parent as any).getNode == "function";
        let options: any = { loop: this.loop, volume: this.volume ?? 1, spatialEnabled: spatial };

        let sound = await audio.createSoundAsync(this.id || "sound", url, options);
        if (this._built != url) {
            sound.dispose();
            return;
        }
        this.sound?.dispose();
        this.sound = sound;
        sound.onEndedObservable.add(() => {
            if (!this.playing)
                this.dispatchEvent(new CustomEvent("garden-sound-end", { bubbles: true }));
        });

        if (spatial) {
            // Set after creation: Babylon 8 ignores most spatial* creation options.
            for (let key in spatialOptions)
                if (spatialOptions[key] !== undefined)
                    (sound.spatial as any)[key] = spatialOptions[key];
            await parent.whenReady;
            this.attachTo(parent);
        }

        this.listen("play-on", () => this.play());
        this.listen("stop-on", () => this.stop());

        if (this.syncGroup) {
            // The last of the group to load starts the ones that autoplay, all at once.
            let group = this.group();
            if (group.every(el => el.sound))
                GardenSound.together(group.filter(el => el.autoplay), el => el.playOne());
        } else if (this.autoplay) {
            this.play();
        }
    }

    /** The `sync` group's name, or null. */
    private get syncGroup(): string {
        return this.getAttribute("sync")?.trim() || null;
    }

    /** Every `<garden-sound>` with the same `sync` in its scene (this one too); just this one without `sync`. */
    group(): GardenSound[] {
        let name = this.syncGroup;
        let scene = this.closest("garden-scene");
        if (!name || !scene)
            return [this];
        return (Array.from(scene.querySelectorAll("garden-sound")) as GardenSound[])
            .filter(el => el.syncGroup == name);
    }

    /**
     * Runs `act` on each sound in the same moment of the audio clock: Web Audio schedules
     * them against one `currentTime`, which doesn't move during a task, so they line up.
     */
    private static together(sounds: GardenSound[], act: (el: GardenSound) => void) {
        for (let el of sounds)
            if (el.sound) act(el);
    }

    private listen(attr: string, handler: () => void) {
        let names = this.getAttribute(attr)?.trim().split(/[\s,]+/).filter(Boolean) ?? [];
        let target = this.parentElement;
        for (let name of names) {
            let listener = () => handler();
            target.addEventListener(name, listener);
            this._listeners.push([target, name, listener]);
        }
    }

    /** Makes the sound come from another element (its mesh or node) or a Babylon node; `null` makes it ambient. */
    attachTo(target: GardenElement | Node | null) {
        if (!this.sound)
            return;
        let node = target instanceof GardenElement ? target.getNode() : target;
        this.sound.spatial.attach(node ?? null);
    }

    /** Plays from the start (or, with `loop`, keeps looping). Plays once audio is unlocked if it isn't yet. */
    play() {
        GardenSound.together(this.group(), el => el.playOne());
    }

    stop() {
        GardenSound.together(this.group(), el => { if (el.playing) el.sound.stop(); });
    }

    pause() {
        GardenSound.together(this.group(), el => el.sound.pause());
    }

    resume() {
        GardenSound.together(this.group(), el => el.sound.resume());
    }

    /** Plays this one sound from the start, whatever its group. */
    private playOne() {
        if (!this.sound)
            return;
        this.sound.stop();
        this.sound.play();
    }

    protected dispose() {
        for (let [target, name, listener] of this._listeners)
            target.removeEventListener(name, listener);
        this._listeners = [];
        this.sound?.dispose();
        this.sound = null;
        this._built = null;
        super.dispose();
    }
}
