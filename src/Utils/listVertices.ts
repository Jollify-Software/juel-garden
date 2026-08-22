import { Mesh, Vector3, VertexBuffer } from "babylonjs";

/**
* List the vertices of a given mesh in Babylon.js
* @param mesh - The Babylon.js mesh
* @returns An array of vectors representing the vertices of the mesh
* @category Utilities
*/
export function listVertices(mesh: Mesh): Vector3[] {
   const vertices: Vector3[] = [];
   const geometry = mesh.geometry;

   if (!geometry) {
       console.error("The mesh does not have any geometry.");
       return vertices;
   }

   const vertexData = geometry.getVerticesData(VertexBuffer.PositionKind);

   if (!vertexData) {
       console.error("The mesh does not have position data.");
       return vertices;
   }

   for (let i = 0; i < vertexData.length; i += 3) {
       const x = vertexData[i];
       const y = vertexData[i + 1];
       const z = vertexData[i + 2];
       vertices.push(new Vector3(x, y, z));
   }

   return vertices;
}