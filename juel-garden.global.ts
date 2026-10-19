// The global <script src="juel-garden.js"> bundle: everything in juel-garden.ts,
// plus all of Babylon as window.BABYLON for pages (and tests) that script
// Babylon directly, as the old UMD build did.
import * as BABYLON from "@babylonjs/core";
export * from "./juel-garden";

(<any>globalThis).BABYLON ??= BABYLON;
