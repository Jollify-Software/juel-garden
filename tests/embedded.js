// Browser test of <garden-scene embedded>: a scene in the middle of an ordinary page that
// scrolls. The page keeps scrolling and its margins, the canvas is the size of the scene's
// box (and follows it), and other canvases on the page keep their own size. Controls: a
// scene without `embedded` still takes over the window; with one of each on a page, the
// full-window styles stay until the full-window scene leaves. Run after a build.
const { run } = require("./harness");

const tall = n => `<p style="height: ${n}px">Text</p>`;
const box = `<garden-camera type="arc" radius="4"></garden-camera><garden-light></garden-light>
    <garden-box position="0 0.5 0" colour="#4CC3D9"></garden-box>`;

run(`${tall(800)}
<garden-scene id="embedded" embedded style="width: 400px; height: 300px">${box}</garden-scene>
${tall(800)}
<canvas id="other" width="50" height="50"></canvas>`, async ({ page, check, frames, open }) => {
    const state = () => page.evaluate(() => {
        const scene = document.querySelector("garden-scene"), canvas = scene.canvas, other = document.getElementById("other");
        return {
            scrollHeight: document.documentElement.scrollHeight, innerHeight: innerHeight,
            htmlOverflow: getComputedStyle(document.documentElement).overflow,
            bodyOverflow: getComputedStyle(document.body).overflow, bodyMargin: getComputedStyle(document.body).marginTop,
            canvas: [canvas.clientWidth, canvas.clientHeight],
            render: [scene.engine.getRenderWidth(), scene.engine.getRenderHeight()], dpr: devicePixelRatio,
            other: other ? [other.clientWidth, other.clientHeight] : null,
            pageStyles: !!document.getElementById("garden-garden-page-styles"),
        };
    });

    let s = await state();
    check("the page is taller than the window", s.scrollHeight > s.innerHeight, `${s.scrollHeight} > ${s.innerHeight}`);
    check("html and body can scroll", s.htmlOverflow != "hidden" && s.bodyOverflow != "hidden", `${s.htmlOverflow} / ${s.bodyOverflow}`);
    check("the body keeps its margin", s.bodyMargin == "8px", s.bodyMargin);
    check("no full-window page styles", !s.pageStyles);
    const scrolled = await page.evaluate(() => { scrollTo(0, 500); return scrollY; });
    check("scrollTo moves the page", scrolled == 500, String(scrolled));
    check("the canvas is the size of the scene's box", s.canvas.join() == "400,300", s.canvas.join());
    check("the engine renders at that size", s.render.join() == [400 * s.dpr, 300 * s.dpr].join(), s.render.join());
    check("another canvas on the page keeps its size", s.other.join() == "50,50", s.other.join());

    // The page resizes the box: the canvas and the engine follow, with no window resize.
    await page.evaluate(() => Object.assign(document.querySelector("garden-scene").style, { width: "200px", height: "150px" }));
    await frames(5);
    s = await state();
    check("the canvas follows the box when the page resizes it", s.canvas.join() == "200,150" && s.render.join() == [200 * s.dpr, 150 * s.dpr].join(),
        `${s.canvas.join()} / ${s.render.join()}`);

    // Control: without `embedded`, today's full-window behaviour.
    await open(`${tall(800)}<garden-scene>${box}</garden-scene><canvas id="other" width="50" height="50"></canvas>`);
    s = await state();
    check("control: a scene without embedded stops the page scrolling", s.htmlOverflow == "hidden" && s.bodyOverflow == "hidden" && s.bodyMargin == "0px",
        `${s.htmlOverflow} / ${s.bodyOverflow} / ${s.bodyMargin}`);
    check("control: its canvas fills the window", s.canvas.join() == [1000, 700].join(), s.canvas.join());
    check("control: another canvas still keeps its size", s.other.join() == "50,50", s.other.join());

    // One of each on a page: each as it asks; the page styles go with the full-window scene.
    await open(`<garden-scene id="full">${box}</garden-scene>
        <div style="position: absolute; top: 0; left: 0"><garden-scene id="inset" embedded style="width: 300px; height: 200px">${box}</garden-scene></div>`);
    await page.waitForFunction(() => document.getElementById("inset").scene?.getFrameId() > 5);
    const both = await page.evaluate(() => ({
        full: [document.getElementById("full").canvas.clientWidth, document.getElementById("full").canvas.clientHeight],
        inset: [document.getElementById("inset").canvas.clientWidth, document.getElementById("inset").canvas.clientHeight],
        htmlOverflow: getComputedStyle(document.documentElement).overflow,
    }));
    check("two scenes: the full-window one fills the window", both.full.join() == "1000,700", both.full.join());
    check("two scenes: the embedded one fills its box", both.inset.join() == "300,200", both.inset.join());
    check("two scenes: the page is full-window while the full-window scene is in it", both.htmlOverflow == "hidden", both.htmlOverflow);
    const after = await page.evaluate(async () => {
        document.getElementById("full").remove();
        await new Promise(r => setTimeout(r, 0));
        return { pageStyles: !!document.getElementById("garden-garden-page-styles"),
                 htmlOverflow: getComputedStyle(document.documentElement).overflow };
    });
    check("two scenes: the page styles go with the last full-window scene", !after.pageStyles && after.htmlOverflow != "hidden", JSON.stringify(after));
});
