// Browser test of <garden-texture>'s sampling options: `sampling`, `wrap` (one or two words),
// `mipmaps="false"` and `invert-y="false"`, and their defaults (Babylon's).
// Run after a build: npm run test:texture-options.
const { run } = require("./harness");

run(`
<garden-scene>
  <garden-camera></garden-camera>
  <garden-light></garden-light>
  <garden-box><garden-material>
    <garden-texture id="plain" src="/examples/assets/dunes.png"></garden-texture>
  </garden-material></garden-box>
  <garden-box position="2 0 0"><garden-material>
    <garden-texture id="crisp" src="/examples/assets/dunes.png" sampling="nearest" wrap="clamp mirror" mipmaps="false" invert-y="false"></garden-texture>
  </garden-material></garden-box>
</garden-scene>`, async ({ page, check, frames }) => {
    await page.waitForFunction(() => document.getElementById("crisp").texture && document.getElementById("plain").texture);
    await frames(5);
    const t = await page.evaluate(() => {
        const read = id => { const x = document.getElementById(id).texture; return { sampling: x.samplingMode, u: x.wrapU, v: x.wrapV, noMip: x.noMipmap, invertY: x.invertY }; };
        return { plain: read("plain"), crisp: read("crisp"), T: { nearest: BABYLON.Texture.NEAREST_SAMPLINGMODE, trilinear: BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
                 wrap: BABYLON.Texture.WRAP_ADDRESSMODE, clamp: BABYLON.Texture.CLAMP_ADDRESSMODE, mirror: BABYLON.Texture.MIRROR_ADDRESSMODE } };
    });
    check("defaults are Babylon's: trilinear, repeat, mipmaps, flipped",
        t.plain.sampling == t.T.trilinear && t.plain.u == t.T.wrap && t.plain.v == t.T.wrap && !t.plain.noMip && t.plain.invertY, JSON.stringify(t));
    check("sampling=\"nearest\", wrap=\"clamp mirror\", mipmaps=\"false\", invert-y=\"false\"",
        t.crisp.sampling == t.T.nearest && t.crisp.u == t.T.clamp && t.crisp.v == t.T.mirror && t.crisp.noMip && !t.crisp.invertY, JSON.stringify(t));
});
