// End to end: a picture stands upright on every kind of wall Parterre draws. juel-garden's meshes each lay
// it differently (Babylon's box turns it a quarter on its x faces), so Parterre gives each a turn=
// on the <garden-texture>. The picture's top half is red and its bottom half green, its right half has blue.
// Reads pixels above, below and either side of the middle of each wall. Needs the sibling parterre checkout, built:
//   node tests/parterre-texture-upright.js
const fs=require('fs'),os=require('os'),path=require('path'),zlib=require('zlib');const{execFileSync}=require('child_process');const{chromium}=require('playwright-core');
const ROOT=path.resolve(__dirname,'..'),PARTERRE=path.resolve(ROOT,'..','parterre'),OUT=path.join(os.tmpdir(),'jg-uv');const ORIGIN='http://parterre.test';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
function png(){const T=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});const crc=b=>{let c=0xffffffff;for(const x of b)c=T[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0};const ch=(t,d)=>{const a=Buffer.concat([Buffer.from(t),d]),l=Buffer.alloc(4),s=Buffer.alloc(4);l.writeUInt32BE(d.length);s.writeUInt32BE(crc(a));return Buffer.concat([l,a,s])};const N=32;const h=Buffer.alloc(13);h.writeUInt32BE(N,0);h.writeUInt32BE(N,4);h[8]=8;h[9]=2;const rows=[];for(let y=0;y<N;y++){const r=[0];for(let x=0;x<N;x++){r.push(y<N/2?240:20,y<N/2?20:240,x<N/2?20:200)}rows.push(Buffer.from(r))}return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),ch('IHDR',h),ch('IDAT',zlib.deflateSync(Buffer.concat(rows))),ch('IEND',Buffer.alloc(0))])}

const PLAN=`<svg xmlns="http://www.w3.org/2000/svg">
<rect data-fixture="room" data-id="a" x="0" y="0" width="100" height="100" data-walls-texture="p.png"/>
<circle data-fixture="room" data-id="c" cx="300" cy="50" r="50" data-walls-texture="p.png"/>
<polygon data-fixture="room" data-id="s" points="500,0 600,0 600,100 500,100 480,50" data-walls-texture="p.png"/>
<rect data-fixture="wall" data-id="wh" x="0" y="300" width="100" height="4" data-walls-texture="p.png"/>
<rect data-fixture="wall" data-id="wv" x="200" y="250" width="4" height="100" data-walls-texture="p.png"/>
<path data-fixture="wall" data-id="ph" d="M 300,300 L 400,300" data-walls-texture="p.png"/>
<path data-fixture="wall" data-id="pv" d="M 500,250 L 500,350" data-walls-texture="p.png"/>
</svg>`;
(async()=>{fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'p.png'),png());const pf=path.join(OUT,'plan.svg');fs.writeFileSync(pf,PLAN);
execFileSync('dotnet',['run','--project',path.join(PARTERRE,'Parterre.Cli'),'--','--in',pf,'--out',path.join(OUT,'scene.html'),'--scale','0.1','--height','3','--no-directory','--garden',path.join(ROOT,'dist','juel-garden.js')],{stdio:'ignore'});
const b=await chromium.launch({executablePath:CHROME,headless:true,args:[...require('./gpu').GPU_ARGS]});const page=await b.newPage({viewport:{width:600,height:600}});
await page.route('**/*',r=>{const u=r.request().url();if(!u.startsWith(ORIGIN))return r.abort();const f=path.join(OUT,decodeURIComponent(new URL(u).pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,body:fs.readFileSync(f),contentType:f.endsWith('.html')?'text/html':f.endsWith('.js')?'text/javascript':f.endsWith('.wasm')?'application/wasm':'image/png'})});
await page.goto(ORIGIN+'/scene.html');await page.waitForFunction(()=>document.querySelector('garden-scene').scene?.getFrameId()>30,null,{timeout:45000});await page.waitForTimeout(2500);
// Read four points of a wall: above and below the middle, and either side. R high = picture's top half; B high = its right half.
const bad=[];const probe=async(name,from,mid,want)=>{const r=await page.evaluate(async([from,mid,rv])=>{const s=document.querySelector('garden-scene').scene,c=s.activeCamera,e=s.getEngine();e.stopRenderLoop();const V=c.position.constructor;c.position=new V(...from);c.setTarget(new V(...mid));for(let i=0;i<150&&s.meshes.some(m=>m.isEnabled()&&m.isVisible&&m.getTotalVertices()>0&&!m.isReady(true));i++){s.render();await new Promise(k=>setTimeout(k,20));}/* Babylon skips a mesh until it's ready, so the first sight of a wall can be a few frames of nothing. */s.render();const cv=e.getRenderingCanvas(),w=cv.width,h=cv.height;const g=async(x,y)=>Array.from(await e.readPixels(x,y,1,1)).slice(0,3);
 const dy=Math.round(h*.12),dx=Math.round(w*.12);return{up:await g(w>>1,(h>>1)+dy),down:await g(w>>1,(h>>1)-dy),left:await g((w>>1)-dx,h>>1),right:await g((w>>1)+dx,h>>1)}},[from,mid,0]);
 const kind=c=>c[0]>c[1]?'TOP':'BOTTOM';const side=c=>c[2]>60?'RIGHT':'LEFT';
 const upright=kind(r.up)=='TOP'&&kind(r.down)=='BOTTOM';const sideways=kind(r.left)!=kind(r.right);
 const along=side(r.left)!=side(r.right)&&!sideways;const ok=want=='along'?along:upright;if(!ok)bad.push(name);console.log(`${ok?'PASS':'FAIL'}  ${name}: ${want=='along'?'its width runs along the wall':'upright'}  -- above ${kind(r.up)} below ${kind(r.down)}, left ${kind(r.left)} ${side(r.left)}, right ${kind(r.right)} ${side(r.right)}`);};
const at=id=>page.evaluate(id=>document.getElementById(id).getAttribute('position').split(' ').map(Number),id);
const[ax,ay,az]=await at('a');const Y=1.5;
await probe('box north',[ax,ay+Y,az],[ax,ay+Y,az+5]);await probe('box south',[ax,ay+Y,az],[ax,ay+Y,az-5]);await probe('box east',[ax,ay+Y,az],[ax+5,ay+Y,az]);await probe('box west',[ax,ay+Y,az],[ax-5,ay+Y,az]);
const[cx,cy,cz]=await at('c');await probe('rotunda',[cx,cy+Y,cz],[cx+5,cy+Y,cz],'along');
const[sx,sy,sz]=await at('s');await probe('polygon',[sx,sy+Y,sz],[sx+6,sy+Y,sz]);
const wh=await at('wh');await probe('wall box e-w',[wh[0],wh[1],wh[2]-5],[wh[0],wh[1],wh[2]]);const wv=await at('wv');await probe('wall box n-s',[wv[0]-5,wv[1],wv[2]],[wv[0],wv[1],wv[2]]);
const pts=id=>page.evaluate(id=>document.getElementById(id).getAttribute('points').split(',').map(p=>p.trim().split(' ').map(Number)),id);
const ph=await pts('ph');const pm=[(ph[0][0]+ph[1][0])/2,ph[0][1]+1.5,ph[0][2]];await probe('path wall e-w',[pm[0],pm[1],pm[2]-5],pm,'along');const pv=await pts('pv');const vm=[pv[0][0],pv[0][1]+1.5,(pv[0][2]+pv[1][2])/2];await probe('path wall n-s',[vm[0]-5,vm[1],vm[2]],vm,'along');
await b.close();console.log(bad.length?`${bad.length} failed`:'all upright');process.exit(bad.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
