import { Material } from "@babylonjs/core/Materials/material";
import { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";
import { GardenTexture } from "./Components/Texture";
import { HtmlTexture } from "./HtmlTexture";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShape } from "@babylonjs/core/Physics/v2/physicsShape";
import { PhysicsEventType, PhysicsMotionType, PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { CSG } from "@babylonjs/core/Meshes/csg";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { property } from "lit/decorators.js";
import { Behaviours } from "./Behaviours/Behaviours";
import { GardenAnimation } from "./Components/Animation";
import { GardenParticle } from "./Components/Particle";
import { Vector3Convert } from "./Converters/Vector3Convert";
import { GardenElement } from "./GardenElement";
import { GardenMaterial } from "./Components/Material";
import { Modifier } from "./Modifiers/Modifier";
import { GardenPhysics, elementOfBody } from "./Components/Physics";

/** `physics-shape` values, and the shape each tag gets when it's left unset. */
const shapeNames: {[name: string]: PhysicsShapeType} = {
    'sphere': PhysicsShapeType.SPHERE,
    'box': PhysicsShapeType.BOX,
    'cylinder': PhysicsShapeType.CYLINDER,
    'capsule': PhysicsShapeType.CAPSULE,
    'convex': PhysicsShapeType.CONVEX_HULL,
    'mesh': PhysicsShapeType.MESH,
};
const shapeByTag: {[tag: string]: PhysicsShapeType} = {
    'garden-sphere': PhysicsShapeType.SPHERE,
    'garden-box': PhysicsShapeType.BOX,
    'garden-ground': PhysicsShapeType.BOX,
    'garden-plane': PhysicsShapeType.BOX,
    'garden-cylinder': PhysicsShapeType.CYLINDER,
};

/**
 * Base class for every custom element that owns a real Babylon `Mesh`
 * ({@link GardenElement} subclasses without a mesh -- lights, sounds,
 * cameras -- extend `GardenElement` directly instead). Handles the attributes
 * shared by (almost) every shape: `position`/`rotation`/`scale` (inherited
 * from `GardenElement`), `colour`/`spec-colour`/`emissive-colour`,
 * `texture`/`diffuse-texture`/`bump-texture`/`reflection-texture` (and their
 * `-uscale`/`-vscale`/`-level`/`-coordinates` companions), `collisions`,
 * `hollow` (CSG-subtracts a scaled clone of itself, for a shell/box effect),
 * and `split` (CSG-halves the mesh). Also wires up any `track`/`orbit`/
 * `action`/`drive`/`suspension` behaviour attribute via {@link Behaviours}.
 *
 * **Physics** (needs a `<garden-physics>` in the scene, see {@link GardenPhysics}):
 * - `physics` -- `"dynamic"` (the default when the attribute is bare),
 *   `"static"` (walls, floors), `"animated"` (moved by code, pushes others)
 *   or `"trigger"` (a sensor: nothing bounces off it, but it fires
 *   `garden-trigger-enter`/`-exit`).
 * - `physics-shape` -- `sphere`, `box`, `cylinder`, `capsule`, `convex` or
 *   `mesh` (exact triangles, static bodies only). Default: the tag's own
 *   shape, else `convex` (dynamic) or `mesh` (static). On a
 *   `<garden-mesh-model>` the shape is the whole model's (every part, as
 *   scaled): a convex hull round it, its triangles, or a box (sphere, ...)
 *   round it.
 * - `physics-group` -- the collision groups the body is in, as bits (a
 *   number, `0x...` allowed; default all), and `physics-collides` -- the
 *   groups it collides with (default all). Two bodies collide only when
 *   each is in a group the other collides with; {@link GardenPhysics.raycast}'s
 *   `collideWith` hits only bodies in those groups.
 * - `mass` (default 1; 0 for static/trigger), `friction`, `restitution`
 *   (bounciness, 0-1), `linear-damping`, `angular-damping` (slow a body down
 *   over time -- what stops balls rolling for ever when there's no floor).
 * - `velocity`, `angular-velocity` -- `Vector3`s set once the body exists.
 * - `collide-events` -- `"false"` stops `garden-collide` events for this body
 *   (Havok then needn't report its contacts: cheaper with many bodies). A
 *   `grid` of copies has them only with `collide-events`.
 *
 * **Copies** (a wall of bricks, a stack of crates, a field of posts): `grid="nx ny nz"`
 * repeats the mesh nx x ny x nz times as GPU thin instances, `grid-spacing` apart (`"x y z"`,
 * default the mesh's own size) from its `position` along +x, +y and +z: one draw call
 * however many. `instance-colours` colours them: `random`, or colours (`#rrggbb`, by
 * spaces) taken in turn; `instance-rotations` turns each about its own centre: `random`, or
 * `"x y z"` turns in degrees (by commas) taken in turn -- a heap of crates rather than a
 * stack. With `physics` every copy is a body of its own (Havok's instanced
 * bodies, placed where the element's transform puts it (give a physics grid its size by
 * `width`/`height`/... rather than `scale`); {@link GardenPhysics.raycast} says which copy it
 * hit, and pointer picking sees each copy.
 *
 * `layer-mask` (a number, `0x...` hex allowed) is the mesh's Babylon `layerMask`
 * (its parts' too): only cameras whose `layer-mask` shares a bit with it see it
 * (see {@link GardenCamera}).
 *
 * Script API: {@link impulse}, {@link getVelocity}, {@link setVelocity},
 * {@link stop}, {@link teleport}, {@link removePhysics}, and the underlying
 * Babylon {@link physicsAggregate}.
 *
 * A subclass's `updated()` builds the actual Babylon geometry (typically via
 * `MeshBuilder`) and hands it to {@link GardenMesh.setMesh}, which applies all
 * of the above plus picks up a single child `<garden-material>` and any
 * `<garden-animation>`/`<garden-particle>` children.
 *
 * @category Core
 */
export abstract class GardenMesh extends GardenElement {
    static defaultHollowScale = new Vector3(.75, .75, .75);

    @property({ converter: Vector3Convert.fromString }) hollow: Vector3;
    @property() split: string;

    mesh: Mesh;

    /** The Babylon physics body + shape, when the `physics` attribute is set and physics has started. */
    physicsAggregate: PhysicsAggregate;

    getNode(): TransformNode {
        return this.mesh;
    }

    getPosition() {
        return this.mesh?.getAbsolutePosition().clone();
    }
    getRotation() {
        return this.mesh?.rotation;
    }
    getScale() {
        return this.mesh?.scaling;
    }

    setPosition(position: Vector3) {
        this.mesh.position = position;
    }
    setRotation(rotation: Vector3) {
        this.mesh.rotation = rotation;
    }
    setScale(scale: Vector3) {
        this.mesh.scaling = scale;
    }

    /**
     * Draws a `texture="html"` surface again from its content (see {@link HtmlTexture}):
     * after a stylesheet change, say (changes to the content itself redraw it on their own).
     * Resolves once it's drawn; at once when the element has no HTML texture.
     */
    renderHtml(): Promise<void> {
        return HtmlTexture.of(this)?.render() ?? Promise.resolve();
    }

    getMaterial() {
        return this.mesh?.material;
    }
    setMaterial(material: Material) {
        this.mesh.material = material;
    }

    getScene(): Scene {
        if (this.parentElement && 'getScene' in this.parentElement) {
            return (<any>this.parentElement).getScene();
        } else {
            return null;
        }
    }

    /** In place, except under `orbit`: the mesh sits in its pivot's frame, so the orbit is built again. */
    protected get transformsInPlace() {
        return !this.hasAttribute("orbit");
    }

    /**
     * `position`, `rotation` and `scale` onto the mesh as the build gives them (a parent
     * element's share included); a physics body is teleported there.
     */
    applyTransform() {
        if (!this.mesh)
            return;
        let { position, rotation, scaling } = Modifier.transformOf(this);
        if (rotation) {
            if (this.mesh.rotationQuaternion)
                this.mesh.rotationQuaternion = Quaternion.FromEulerVector(rotation);
            else
                this.mesh.rotation = rotation;
        }
        if (scaling)
            this.mesh.scaling = scaling;
        if (position) {
            if (this.physicsAggregate)
                this.teleport(position);
            else
                this.mesh.position = position;
        }
    }

    /** Before a rebuild for a change: the body goes too (setMesh replaces the mesh itself). */
    protected unbuild() {
        this.removePhysics();
        super.unbuild();
    }

    setMesh(mesh: Mesh) {
        this.removePhysics();
        let orphans: TransformNode[] = [];
        let worn: Set<Material> = new Set();
        if (this.mesh) {
            // Other elements' nodes move onto the new mesh; this build's own parts (a wall's
            // caps) were made again with it, so the old ones go.
            orphans = this.mesh.getChildTransformNodes(true).concat(this.mesh.getChildMeshes(true))
                .filter(node => this.belongsToOther(node));
            worn = this.disposeBuilt(this.mesh, orphans);
        }

        if (this.hasAttribute("split")) {
            mesh = this.splitMesh(mesh, this.split);
        }
        if (this.hasAttribute("hollow")) {
            mesh = this.hollowMesh(mesh, this.hollow ?? GardenMesh.defaultHollowScale);
        }

        for (let orphan of orphans) {
            orphan.parent = mesh;
        }

        (<any>mesh).element = this;
        this.mesh = mesh;
        this.modifyMesh();

        if (this.hasAttribute("collisions"))
            this.mesh.checkCollisions = true;
        if (this.hasAttribute("layer-mask")) {
            let mask = Number(this.getAttribute("layer-mask").trim());
            for (let part of [mesh as any].concat(mesh.getChildMeshes(false)))
                part.layerMask = Number.isFinite(mask) ? mask >>> 0 : 0x0FFFFFFF;
        }

        if (this.hasAttribute("grid"))
            this.makeGrid(mesh);

        if (this.hasAttribute("physics"))
            this.attachPhysics(mesh);
        GardenMesh.disposeUnworn(worn);
    }

    /** `grid`: the mesh's thin instances, in a block of nx x ny x nz, and their `instance-colours`. */
    private makeGrid(mesh: Mesh) {
        let [nx, ny, nz] = (this.getAttribute("grid") ?? "").trim().split(/\s+/).map(n => Math.max(1, Math.floor(Number(n) || 1)));
        ny ??= 1; nz ??= 1;
        let size = mesh.getBoundingInfo().boundingBox.extendSize.scale(2);
        let spacing = Vector3Convert.fromString(this.getAttribute("grid-spacing")) ?? size;
        let total = nx * ny * nz;
        let matrices = new Float32Array(total * 16);
        // Havok's instanced bodies read (and write back) each copy's matrix as its place in the
        // world, so with physics the element's own transform goes into the copies and the mesh
        // stays at the origin.
        let world = Matrix.Identity();
        if (this.hasAttribute("physics")) {
            world = mesh.computeWorldMatrix(true).clone();
            mesh.parent = null;
            mesh.position = Vector3.Zero();
            mesh.rotation = Vector3.Zero();
            mesh.rotationQuaternion = null;
            mesh.scaling = Vector3.One();
        }
        let turns = this.instanceRotations(total);
        let index = 0;
        for (let k = 0; k < nz; k++)
            for (let j = 0; j < ny; j++)
                for (let i = 0; i < nx; i++) {
                    let place = Matrix.Translation(i * spacing.x, j * spacing.y, k * spacing.z);
                    if (turns) place = turns[index].multiply(place);
                    place.multiply(world).copyToArray(matrices, index++ * 16);
                }
        // Physics writes the copies' matrices back every step: the GPU buffer must take updates.
        mesh.thinInstanceSetBuffer("matrix", matrices, 16, !this.hasAttribute("physics"));
        let colours = this.getAttribute("instance-colours")?.trim();
        if (colours) {
            let list = colours == "random" ? null : colours.split(/\s+/).map(c => Color3.FromHexString(c));
            let buffer = new Float32Array(total * 4);
            for (let n = 0; n < total; n++) {
                let c = list ? list[n % list.length] : new Color3(Math.random(), Math.random(), Math.random());
                new Color4(c.r, c.g, c.b, 1).toArray(buffer, n * 4);
            }
            mesh.thinInstanceSetBuffer("color", buffer, 4);
        }
        mesh.thinInstanceEnablePicking = true;
        // Physics moves the copies without updating the mesh's bounds (refreshing them every
        // step would cost as much as the copies), so a heap that has fallen out of where it
        // started would be culled: a physics grid is always drawn.
        if (this.hasAttribute("physics"))
            mesh.alwaysSelectAsActiveMesh = true;
    }

    /**
     * `instance-rotations`: each copy's turn about its own centre, `random` or `"x y z"`
     * triples in degrees (by commas) taken in turn; null when unset.
     */
    private instanceRotations(total: number): Matrix[] {
        let text = this.getAttribute("instance-rotations")?.trim();
        if (!text) return null;
        let random = text == "random";
        let list = random ? [] : text.split(",").map(t => Vector3Convert.fromString(t.trim())).filter(v => v);
        if (!random && !list.length) return null;
        let turns: Matrix[] = [];
        for (let n = 0; n < total; n++) {
            let degrees = random ? new Vector3(Math.random(), Math.random(), Math.random()).scale(360) : list[n % list.length];
            let radians = degrees.scale(Math.PI / 180);
            let turn = new Matrix();
            Quaternion.FromEulerAngles(radians.x, radians.y, radians.z).toRotationMatrix(turn);
            turns.push(turn);
        }
        return turns;
    }

    private belongsToOther(node: TransformNode): boolean {
        let el = (<any>node).element;
        return el != null && el != this;
    }

    /**
     * Disposes `mesh` and this build's own parts under it, leaving `keep` (other
     * elements' nodes); gives back the materials they wore, for {@link disposeUnworn}.
     */
    private disposeBuilt(mesh: Mesh, keep: TransformNode[] = []): Set<Material> {
        let worn = new Set<Material>();
        let parts = [mesh as TransformNode].concat(mesh.getDescendants(false, node =>
            !keep.some(k => k == node || node.isDescendantOf(k))) as TransformNode[]);
        for (let part of parts)
            for (let material of GardenMesh.materialsOf(part))
                worn.add(material);
        for (let node of keep)
            node.parent = null;
        for (let part of parts.reverse())
            if (!part.isDisposed())
                part.dispose(true);
        return worn;
    }

    private static materialsOf(node: TransformNode): Material[] {
        let material = (<any>node).material as Material;
        if (!material) return [];
        return material instanceof MultiMaterial ? [material as Material].concat(material.subMaterials.filter(m => m)) : [material];
    }

    /**
     * Disposes the materials in `materials` that no mesh wears any more, unless a
     * `<garden-material>` owns them, with their textures unless a `<garden-texture>` owns those.
     */
    private static disposeUnworn(materials: Set<Material>) {
        for (let material of materials) {
            if (GardenMaterial.owned.has(material) || material.getBindedMeshes().length ||
                !material.getScene()?.materials.includes(material))
                continue;
            let textures = material.getActiveTextures().filter(t => !GardenTexture.owned.has(t));
            material.dispose(false, false);
            for (let texture of textures)
                if (!texture.getScene()?.materials.some(m => m.hasTexture(texture)))
                    texture.dispose();
        }
    }

    /**
     * Gives `mesh` a physics body once the scene's `<garden-physics>` has
     * loaded Havok. Skipped if the mesh has been replaced in the meantime.
     */
    private async attachPhysics(mesh: Mesh) {
        await GardenElement.whenDocumentReady();
        let physicsEl = GardenPhysics.forElement(this);
        if (!physicsEl) {
            console.warn(`<${this.localName} physics> needs a <garden-physics> element in its <garden-scene>.`);
            return;
        }
        await physicsEl.ready;
        if (this.mesh != mesh || this.physicsAggregate)
            return;

        let kind = (this.getAttribute("physics") || "dynamic").toLowerCase();
        let motion = kind == "static" || kind == "trigger" ? PhysicsMotionType.STATIC
            : kind == "animated" ? PhysicsMotionType.ANIMATED
            : PhysicsMotionType.DYNAMIC;
        let isStatic = motion != PhysicsMotionType.DYNAMIC;

        let shapeAttr = this.getAttribute("physics-shape");
        let shape = shapeAttr ? shapeNames[shapeAttr.toLowerCase()] : shapeByTag[this.localName];
        if (shapeAttr && shape == null)
            console.warn(`Unknown physics-shape "${shapeAttr}"; using the default.`);
        if (shape == null)
            shape = isStatic ? PhysicsShapeType.MESH : PhysicsShapeType.CONVEX_HULL;

        let num = (name: string) => this.hasAttribute(name) ? Number(this.getAttribute(name)) : undefined;
        let options: any = {
            mass: isStatic ? 0 : (num("mass") ?? 1),
            friction: num("friction"),
            restitution: num("restitution"),
            mesh: shape == PhysicsShapeType.MESH || shape == PhysicsShapeType.CONVEX_HULL ? mesh : undefined,
            isTriggerShape: kind == "trigger",
        };
        for (let key in options)
            if (options[key] === undefined) delete options[key];

        // A model (an empty holder over its loaded meshes): the shape is the whole model's.
        let shapeOrType: PhysicsShapeType | PhysicsShape = shape;
        if (!mesh.getTotalVertices() && mesh.getChildMeshes(false).some(m => m.getTotalVertices() > 0))
            shapeOrType = this.wholeShape(mesh, shape, options);

        let aggregate = new PhysicsAggregate(mesh, shapeOrType, options, this.getScene());
        let body = aggregate.body;
        body.setMotionType(motion);
        this.physicsAggregate = aggregate;
        if (shapeOrType instanceof PhysicsShape) {
            // The aggregate leaves a shape it was given alone: it goes with the body here.
            this.whenPhysicsRemoved(() => shapeOrType.dispose());
        }

        let group = num("physics-group"), collides = num("physics-collides");
        if (group != null) aggregate.shape.filterMembershipMask = group >>> 0;
        if (collides != null) aggregate.shape.filterCollideMask = collides >>> 0;

        let linearDamping = num("linear-damping");
        if (linearDamping != null) body.setLinearDamping(linearDamping);
        let angularDamping = num("angular-damping");
        if (angularDamping != null) body.setAngularDamping(angularDamping);

        let velocity = Vector3Convert.fromString(this.getAttribute("velocity"));
        if (velocity) body.setLinearVelocity(velocity);
        let spin = Vector3Convert.fromString(this.getAttribute("angular-velocity"));
        if (spin) body.setAngularVelocity(spin);

        // Havok reporting every contact costs physics time: a grid of copies (hundreds of
        // bodies) reports only when asked to, and `collide-events="false"` turns it off.
        let events = this.getAttribute("collide-events");
        let reportCollisions = events != null ? events != "false" : !this.hasAttribute("grid");
        if (motion == PhysicsMotionType.DYNAMIC)
            physicsEl.trackDynamic(body, true);
        if (motion == PhysicsMotionType.DYNAMIC && reportCollisions) {
            body.setCollisionCallbackEnabled(true);
            body.getCollisionObservable().add(ev => {
                if (ev.type != PhysicsEventType.COLLISION_STARTED)
                    return;
                this.dispatchEvent(new CustomEvent("garden-collide", {
                    bubbles: true,
                    detail: {
                        other: elementOfBody(ev.collidedAgainst),
                        point: ev.point,
                        normal: ev.normal,
                        impulse: ev.impulse,
                    }
                }));
            });
        }
    }

    /**
     * The shape of a model's whole hierarchy (its holder has no geometry of its own), in the
     * holder's space with its scale baked in: a convex hull or mesh of every part's triangles,
     * or a box, sphere, cylinder or capsule round them all.
     */
    private wholeShape(holder: Mesh, type: PhysicsShapeType, options: any): PhysicsShape {
        let scene = this.getScene();
        // The parts' world matrices may be from before the holder was placed and scaled
        // (Babylon's accumulator doesn't recompute them).
        holder.computeWorldMatrix(true);
        for (let node of holder.getDescendants(false))
            (<any>node).computeWorldMatrix?.(true);
        if (type == PhysicsShapeType.CONVEX_HULL || type == PhysicsShapeType.MESH) {
            delete options.mesh;
            return new PhysicsShape({ type, parameters: { mesh: holder, includeChildMeshes: true } }, scene);
        }
        // The parts' bounds in the holder's (scaled) space.
        let toHolder = holder.computeWorldMatrix(true).clone().invert();
        let scale = holder.absoluteScaling;
        let min = new Vector3(Infinity, Infinity, Infinity), max = min.scale(-1);
        for (let part of holder.getChildMeshes(false)) {
            if (!part.getTotalVertices()) continue;
            part.computeWorldMatrix(true);
            for (let corner of part.getBoundingInfo().boundingBox.vectorsWorld) {
                let p = Vector3.TransformCoordinates(corner, toHolder).multiply(scale);
                min.minimizeInPlace(p);
                max.maximizeInPlace(p);
            }
        }
        let size = max.subtract(min), center = min.add(max).scale(0.5);
        let radius = Math.max(size.x, size.z) / 2;
        let parameters: any = { center, rotation: Quaternion.Identity(), extents: size };
        if (type == PhysicsShapeType.SPHERE)
            parameters.radius = Math.max(size.x, size.y, size.z) / 2;
        else if (type == PhysicsShapeType.CYLINDER) {
            parameters.radius = radius;
            parameters.pointA = new Vector3(center.x, min.y, center.z);
            parameters.pointB = new Vector3(center.x, max.y, center.z);
        } else if (type == PhysicsShapeType.CAPSULE) {
            parameters.radius = radius;
            parameters.pointA = new Vector3(center.x, min.y + radius, center.z);
            parameters.pointB = new Vector3(center.x, Math.max(min.y + radius, max.y - radius), center.z);
        }
        return new PhysicsShape({ type, parameters }, scene);
    }

    private physicsDisposers: (() => void)[] = [];

    /** Runs `disposer` when the body goes ({@link removePhysics}). */
    private whenPhysicsRemoved(disposer: () => void) {
        this.physicsDisposers.push(disposer);
    }

    /**
     * Where copy `instance` of `mesh`'s thin instances is now, in world space (null if there's
     * no such copy). Read from the matrix buffer, which physics updates every step (Babylon's
     * `thinInstanceGetWorldMatrices` keeps the first answer it gave).
     */
    static copyPlace(mesh: Mesh, instance: number): Vector3 {
        let data: Float32Array = (<any>mesh)?._thinInstanceDataStorage?.matrixData;
        if (!data || instance < 0 || instance >= mesh.thinInstanceCount) return null;
        let at = instance * 16;
        return Vector3.TransformCoordinates(new Vector3(data[at + 12], data[at + 13], data[at + 14]), mesh.computeWorldMatrix());
    }

    /**
     * Pushes the body: `impulse` is mass x change in velocity, applied at `point` (world space;
     * default the centre). On a physics `grid`, `instance` pushes only that copy (default all).
     */
    impulse(impulse: Vector3 | string, point?: Vector3, instance?: number) {
        let body = this.physicsAggregate?.body;
        if (!body) return;
        let v = typeof impulse == "string" ? Vector3Convert.fromString(impulse) : impulse;
        if (point == null && instance != null)
            point = GardenMesh.copyPlace(this.mesh, instance);
        body.applyImpulse(v, point ?? this.mesh.getAbsolutePosition(), instance);
    }

    getVelocity(): Vector3 {
        return this.physicsAggregate?.body.getLinearVelocity() ?? Vector3.Zero();
    }

    setVelocity(velocity: Vector3 | string) {
        let v = typeof velocity == "string" ? Vector3Convert.fromString(velocity) : velocity;
        this.physicsAggregate?.body.setLinearVelocity(v);
    }

    /** Zeroes linear and angular velocity. */
    stop() {
        let body = this.physicsAggregate?.body;
        if (!body) return;
        body.setLinearVelocity(Vector3.Zero());
        body.setAngularVelocity(Vector3.Zero());
    }

    /**
     * Moves a physics body to `position` and stops it. Plain `mesh.position`
     * writes are ignored once a body exists (Havok owns the transform), so
     * setting the `position` attribute or property comes through here too.
     */
    teleport(position: Vector3 | string) {
        let p = typeof position == "string" ? Vector3Convert.fromString(position) : position;
        let body = this.physicsAggregate?.body;
        this.mesh.position = p.clone();
        if (!body) return;
        this.stop();
        // Let the next step copy the node's transform into the body, then hand it back.
        // Wait for that step to begin first: called from inside the physics step (a
        // garden-rest or garden-collide listener), an after-physics observer added now
        // would run in this same pass, before the body ever got the new transform.
        body.disablePreStep = false;
        const scene = this.getScene();
        scene.onBeforePhysicsObservable.addOnce(() =>
            scene.onAfterPhysicsObservable.addOnce(() => body.disablePreStep = true));
    }

    /** Disposes the physics body (e.g. a ball that has been potted). The mesh stays. */
    removePhysics() {
        if (!this.physicsAggregate) return;
        GardenPhysics.forElement(this)?.trackDynamic(this.physicsAggregate.body, false);
        this.physicsAggregate.dispose();
        this.physicsAggregate = null;
        for (let disposer of this.physicsDisposers.splice(0))
            disposer();
    }

    /**
     * Removed for good: the body and the mesh leave the scene. Not recursive: child meshes
     * belong to child elements, which dispose their own (or keep them, when only this one
     * was removed and they were moved out first). Materials stay; `<garden-material>` owns them.
     */
    protected dispose() {
        this.removePhysics();
        if (this.mesh && !this.mesh.isDisposed()) {
            let others = this.mesh.getChildTransformNodes(true).concat(this.mesh.getChildMeshes(true))
                .filter(node => this.belongsToOther(node));
            GardenMesh.disposeUnworn(this.disposeBuilt(this.mesh, others));
        }
        this.mesh = null;
        super.dispose();
    }

    /** Under a new parent: the mesh follows a `parent`-tagged element's node, or leaves the old one's. */
    protected moved() {
        if (!this.mesh)
            return;
        let parent = this.parentElement as GardenElement;
        this.mesh.parent = parent?.hasAttribute("parent") && 'getNode' in parent ? parent.getNode() : null;
        if (this.physicsAggregate)
            this.teleport(this.position ?? this.mesh.position);
    }

    hollowMesh(mesh: Mesh, hollowScale: Vector3) {
        console.log(hollowScale)
        let clone = mesh.clone("hollowClone");
        clone.scaling = hollowScale;
        let toReturn = CSG.FromMesh(mesh)
            .subtract(CSG.FromMesh(clone))
                .toMesh(mesh.id, mesh.material, this.getScene());
        clone.dispose();
        mesh.dispose();
        return toReturn;
    }

    splitMesh(mesh: Mesh, splitty: string) {
        let bounds = mesh.getBoundingInfo();
        let vectorsWorld = bounds.boundingBox.vectorsWorld; 
        let width = Number(vectorsWorld[1].x-(vectorsWorld[0].x));
        let height = Number(vectorsWorld[1].y-(vectorsWorld[0].y));
        let depth = Number(vectorsWorld[1].z-(vectorsWorld[0].z));
        let splittyMesh: Mesh;
        switch (splitty) {
            default:
            case 'half':
                splittyMesh = MeshBuilder.CreateBox("splittyMesh", {
                    width: width,
                    height: height,
                    depth: depth
                });
                splittyMesh.position.y = -(height/2);
                break;
        
        }
        let toReturn = CSG.FromMesh(mesh)
            .subtract(CSG.FromMesh(splittyMesh))
            .toMesh(mesh.id, mesh.material, this.getScene(), true);
        mesh.dispose();
        splittyMesh.dispose();
        return toReturn;
    }

    modifyMesh(exclude: string[] = null): void {
        if (this.mesh != null) {

            if (this.parentElement.hasAttribute("parent")) {
                console.log("parent")
                this.mesh.parent = (<GardenElement>this.parentElement).getNode();
            }

            Modifier.modifyMesh(this, this.mesh, exclude);
            Behaviours.applyBehaviours(this, this.mesh);


            setTimeout(async () => {
                // A mesh in the initial markup upgrades on its opening tag, so while the
                // document is still loading its children may not be parsed yet: a
                // setTimeout(0) alone sometimes found none, and an event="load"
                // <garden-particle> (starship's plumes) never started.
                await GardenElement.whenDocumentReady();
                let scene = this.getScene();
                let animations: GardenAnimation[] = [];
                let particles: GardenParticle[] = [];

                for (let el of (<HTMLElement[]>Array.prototype.slice.call(this.children))) {
                    if (el.matches('garden-animation')) {
                        animations.push(el as GardenAnimation);
                    } else if (el.matches('garden-particle')) {
                        particles.push(el as GardenParticle);
                    } else if (el.matches('garden-material') && !el.hasAttribute('slot')) {
                        // Meshes with more than one material (e.g. GardenRoof's dome)
                        // read their own slot-tagged <garden-material> children directly,
                        // before the mesh is even built -- this generic path only covers
                        // the common single-material case, applied after the fact. Must
                        // await the element's own build (whenReady) before reading its
                        // .material -- this setTimeout(0) callback can otherwise fire
                        // before <garden-material>'s own async updated() (which itself
                        // waits on document-ready plus any <garden-texture> children) has
                        // produced anything, silently applying `undefined` and leaving the
                        // mesh on Babylon's default grey material.
                        let materialEl = el as GardenMaterial;
                        await materialEl.whenReady;
                        this.setMaterial(materialEl.material);
                    }
                }

                for (var animation of animations) {
                    // Mirrors the garden-particle event switch just below: an explicit
                    // event="load" auto-plays, anything else (e.g. unset, for a
                    // <garden-button target="..."> to trigger) waits to be played on demand.
                    if (animation.event === "load")
                        animation.playWhenReady(this);
                }

                for (var p of particles) {
                    switch (p.event) {
                        case "load":
                            p.play();
                            break;
                        case "pointerdown":
                            this.observe(scene.onPointerObservable, (pointerInfo) => {            
                                switch (pointerInfo.type) {
                                    case PointerEventTypes.POINTERDOWN:
                                        if(pointerInfo.pickInfo.hit &&
                                            pointerInfo.pickInfo.pickedMesh == this.mesh) {
                                            p.toggle();
                                        }
                                    break;
                                }
                            });
                        default:
                            break;
                    }
                }
            });
        }
    }
}