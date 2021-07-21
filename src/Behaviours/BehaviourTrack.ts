import { Axis, Vector3 } from "babylonjs";
import { GardenLine } from "../Components/Line";
import { GardenMesh } from "../GardenMesh";

export function BehaviourTrack(el: HTMLElement, attr: Attr[]) {
    if (el.parentElement.tagName == "GARDEN-LINE") {
        let line = el.parentElement as GardenLine;
        let scene = (<GardenMesh>el).getScene();
        let mesh = (<GardenMesh>el).mesh;

        const track: TrackPosition[] = [];
        track.push(new TrackPosition(Math.PI / 2, 4));
        track.push(new TrackPosition(3 * Math.PI / 4, 8));
        track.push(new TrackPosition(3 * Math.PI / 4, 8 + 4 * Math.sqrt(2)));
    
        let startPos = mesh.position;
        let distance = 0;
        let step = Number(el.getAttribute("track-step") ?? 0.05);
        let p = 0;
    
        scene.onBeforeRenderObservable.add(() => {
            mesh.movePOV(0, 0, step);
            distance += step;
                  
            if (distance > track[p].distance) {        
                mesh.rotate(Axis.Y, track[p].turn, BABYLON.Space.LOCAL);
                p +=1;
                p %= track.length;
                if (p === 0) {
                    distance = 0;
                    mesh.position = startPos; //reset to initial conditions
                    mesh.rotation = Vector3.Zero();//prevents error accumulation
                }
            }
        });
    }
}

class TrackPosition {
    constructor(public turn: number, public distance: number) {
    }
}