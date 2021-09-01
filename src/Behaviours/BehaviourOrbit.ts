import { Axis, Camera, Mesh, Space, TransformNode, Vector3 } from "babylonjs";
import { GardenLine } from "../Components/Line";
import { GardenMesh } from "../GardenMesh";

export function BehaviourOrbit(el: HTMLElement, mesh: Mesh, attr: Attr[]) {
  let nodes: TransformNode[] = [];
  let camera: Camera = null;

    let pos = mesh.position;
    let scene = (<GardenMesh>el.parentElement).getScene();
    let cor = (<GardenMesh>el.parentElement).mesh.position;
    var axis = new Vector3(0, -1, 0);
  var pilotStart = cor.add(pos);

  var pivot = new TransformNode("root");
  pivot.position = cor; 
  mesh.parent = pivot;
  mesh.position = pilotStart;
  nodes.push(pivot);
  /***************************************************************/
  (<any>el).enter = (obj: TransformNode | Camera) => {
    if (obj instanceof TransformNode) {
      nodes.push(obj);
    } else {
      obj.parent = nodes[0];
    }
  }
  (<any>el).leave = (obj: TransformNode | Camera) => {
    if (obj instanceof TransformNode) {
      nodes = nodes.filter(x => x != obj);
    } else {
      obj.parent = null;
    }
  }
  
  /**************Animation of Rotation**********/
   var angle = 0.002;
  scene.registerAfterRender(function () { 
    for (let node of nodes) {
      node.rotate(axis, angle, Space.LOCAL);
    }
  });
}

class TrackPosition {
    constructor(public turn: number, public distance: number) {
    }
}