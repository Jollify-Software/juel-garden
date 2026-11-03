import { Effect } from "@babylonjs/core/Materials/effect";

// AMD FidelityFX Super Resolution 1 (FSR 1) for WebGL2: EASU (the edge-aware upscale) and RCAS
// (the sharpen after it), for <garden-pipeline fsr>. The GLSL is Babylon.js 9's port
// (Shaders/fsr1Upscale.fragment, fsr1Sharpen.fragment and ShadersInclude/ffxFunctions in
// @babylonjs/core 9.32.0, Apache-2.0) of AMD's FSR 1 (MIT,
// https://github.com/GPUOpen-Effects/FidelityFX-FSR), copied while Juel Garden is on Babylon 8,
// which has no FSR: on Babylon 9, use its FSR1RenderingPipeline instead and drop this file.

/** The shaders' names in Babylon's store: a post-process made with one of these uses it. */
export const Fsr1Upscale = "gardenFsr1Upscale";
export const Fsr1Sharpen = "gardenFsr1Sharpen";

/** Puts the shaders in Babylon's store, once. */
export function registerFsr1Shaders() {
    Effect.IncludesShadersStore["gardenFfxFunctions"] ??= `float AMax3F1(float x,float y,float z) {return max(x,max(y,z));}
vec3 AMax3F3(vec3 x,vec3 y,vec3 z) {return max(x,max(y,z));}
float AMin3F1(float x,float y,float z) {return min(x,min(y,z));}
vec3 AMin3F3(vec3 x,vec3 y,vec3 z) {return min(x,min(y,z));}
float APrxLoRcpF1(float a) {return uintBitsToFloat(0x7ef07ebbu-floatBitsToUint(a));}
float APrxMedRcpF1(float a) {float b=uintBitsToFloat(0x7ef19fffu-floatBitsToUint(a));return b*(-b*a+2.0);}
float APrxLoRsqF1(float a) {return uintBitsToFloat(0x5f347d74u-(floatBitsToUint(a)>>1u));}
`;
    Effect.ShadersStore[Fsr1Upscale + "PixelShader"] ??= `#include<gardenFfxFunctions>
uniform sampler2D textureSampler;varying vec2 vUV;uniform vec4 con0;uniform vec4 con1;uniform vec4 con2;uniform vec4 con3;vec4 FsrEasuRF(vec2 p) {ivec2 texSize=textureSize(textureSampler,0);ivec2 mx=texSize-ivec2(1);ivec2 base=ivec2(floor(p*vec2(texSize)-0.5));return vec4(
texelFetch(textureSampler,clamp(base+ivec2(0,1),ivec2(0),mx),0).r,
texelFetch(textureSampler,clamp(base+ivec2(1,1),ivec2(0),mx),0).r,
texelFetch(textureSampler,clamp(base+ivec2(1,0),ivec2(0),mx),0).r,
texelFetch(textureSampler,clamp(base+ivec2(0,0),ivec2(0),mx),0).r);}
vec4 FsrEasuGF(vec2 p) {ivec2 texSize=textureSize(textureSampler,0);ivec2 mx=texSize-ivec2(1);ivec2 base=ivec2(floor(p*vec2(texSize)-0.5));return vec4(
texelFetch(textureSampler,clamp(base+ivec2(0,1),ivec2(0),mx),0).g,
texelFetch(textureSampler,clamp(base+ivec2(1,1),ivec2(0),mx),0).g,
texelFetch(textureSampler,clamp(base+ivec2(1,0),ivec2(0),mx),0).g,
texelFetch(textureSampler,clamp(base+ivec2(0,0),ivec2(0),mx),0).g);}
vec4 FsrEasuBF(vec2 p) {ivec2 texSize=textureSize(textureSampler,0);ivec2 mx=texSize-ivec2(1);ivec2 base=ivec2(floor(p*vec2(texSize)-0.5));return vec4(
texelFetch(textureSampler,clamp(base+ivec2(0,1),ivec2(0),mx),0).b,
texelFetch(textureSampler,clamp(base+ivec2(1,1),ivec2(0),mx),0).b,
texelFetch(textureSampler,clamp(base+ivec2(1,0),ivec2(0),mx),0).b,
texelFetch(textureSampler,clamp(base+ivec2(0,0),ivec2(0),mx),0).b);}
void FsrEasuTapF(
inout vec3 aC,
inout float aW,
vec2 off,
vec2 dir,
vec2 len,
float lob,
float clp,
vec3 c 
) {vec2 v;v.x=(off.x*( dir.x))+(off.y*dir.y);v.y=(off.x*(-dir.y))+(off.y*dir.x);v*=len;float d2=v.x*v.x+v.y*v.y;d2=min(d2,clp);float wB=2.0/5.0*d2+-1.0;float wA=lob*d2+-1.0;wB*=wB;wA*=wA;wB=25.0/16.0*wB+-(25.0/16.0-1.0);float w=wB*wA;aC+=c*w;aW+=w;}
void FsrEasuSetF(
inout vec2 dir,
inout float len,
vec2 pp,
bool biS,bool biT,bool biU,bool biV,
float lA,float lB,float lC,float lD,float lE
) {float w=0.0;if (biS) {w=(1.0-pp.x)*(1.0-pp.y);}
if (biT) {w=pp.x*(1.0-pp.y);}
if (biU) {w=(1.0-pp.x)*pp.y;}
if (biV) {w=pp.x*pp.y;}
float dc=lD-lC;float cb=lC-lB;float lenX=max(abs(dc),abs(cb));lenX=APrxLoRcpF1(lenX);float dirX=lD-lB;dir.x+=dirX*w;lenX=clamp(abs(dirX)*lenX,0.0,1.0);lenX*=lenX;len+=lenX*w;float ec=lE-lC;float ca=lC-lA;float lenY=max(abs(ec),abs(ca));lenY=APrxLoRcpF1(lenY);float dirY=lE-lA;dir.y+=dirY*w;lenY=clamp(abs(dirY)*lenY,0.0,1.0);lenY*=lenY;len+=lenY*w;}
vec3 FsrEasuF(
ivec2 ip,
vec4 con0,
vec4 con1,
vec4 con2,
vec4 con3
) {vec2 pp=vec2(ip)*con0.xy+con0.zw;vec2 fp=floor(pp);pp-=fp;vec2 p0=fp*con1.xy+con1.zw;vec2 p1=p0+con2.xy;vec2 p2=p0+con2.zw;vec2 p3=p0+con3.xy;vec4 bczzR=FsrEasuRF(p0);vec4 bczzG=FsrEasuGF(p0);vec4 bczzB=FsrEasuBF(p0);vec4 ijfeR=FsrEasuRF(p1);vec4 ijfeG=FsrEasuGF(p1);vec4 ijfeB=FsrEasuBF(p1);vec4 klhgR=FsrEasuRF(p2);vec4 klhgG=FsrEasuGF(p2);vec4 klhgB=FsrEasuBF(p2);vec4 zzonR=FsrEasuRF(p3);vec4 zzonG=FsrEasuGF(p3);vec4 zzonB=FsrEasuBF(p3);vec4 bczzL=bczzB*vec4(0.5)+(bczzR*vec4(0.5)+bczzG);vec4 ijfeL=ijfeB*vec4(0.5)+(ijfeR*vec4(0.5)+ijfeG);vec4 klhgL=klhgB*vec4(0.5)+(klhgR*vec4(0.5)+klhgG);vec4 zzonL=zzonB*vec4(0.5)+(zzonR*vec4(0.5)+zzonG);float bL=bczzL.x;float cL=bczzL.y;float iL=ijfeL.x;float jL=ijfeL.y;float fL=ijfeL.z;float eL=ijfeL.w;float kL=klhgL.x;float lL=klhgL.y;float hL=klhgL.z;float gL=klhgL.w;float oL=zzonL.z;float nL=zzonL.w;vec2 dir=vec2(0.0);float len=0.0;FsrEasuSetF(dir,len,pp,true, false,false,false,bL,eL,fL,gL,jL);FsrEasuSetF(dir,len,pp,false,true, false,false,cL,fL,gL,hL,kL);FsrEasuSetF(dir,len,pp,false,false,true, false,fL,iL,jL,kL,nL);FsrEasuSetF(dir,len,pp,false,false,false,true, gL,jL,kL,lL,oL);vec2 dir2=dir*dir;float dirR=dir2.x+dir2.y;bool zro=dirR<(1.0/32768.0);dirR=APrxLoRsqF1(dirR);dirR=zro ? 1.0 : dirR;dir.x=zro ? 1.0 : dir.x;dir*=vec2(dirR);len=len*0.5;len*=len;float stretch=(dir.x*dir.x+dir.y*dir.y)*APrxLoRcpF1(max(abs(dir.x),abs(dir.y)));vec2 len2=vec2(1.0+(stretch-1.0)*len,1.0+-0.5*len);float lob=0.5+((1.0/4.0-0.04)-0.5)*len;float clp=APrxLoRcpF1(lob);vec3 min4=min(AMin3F3(vec3(ijfeR.z,ijfeG.z,ijfeB.z),vec3(klhgR.w,klhgG.w,klhgB.w),vec3(ijfeR.y,ijfeG.y,ijfeB.y)),
vec3(klhgR.x,klhgG.x,klhgB.x));vec3 max4=max(AMax3F3(vec3(ijfeR.z,ijfeG.z,ijfeB.z),vec3(klhgR.w,klhgG.w,klhgB.w),vec3(ijfeR.y,ijfeG.y,ijfeB.y)),
vec3(klhgR.x,klhgG.x,klhgB.x));vec3 aC=vec3(0.0);float aW=0.0;FsrEasuTapF(aC,aW,vec2( 0.0,-1.0)-pp,dir,len2,lob,clp,vec3(bczzR.x,bczzG.x,bczzB.x)); 
FsrEasuTapF(aC,aW,vec2( 1.0,-1.0)-pp,dir,len2,lob,clp,vec3(bczzR.y,bczzG.y,bczzB.y)); 
FsrEasuTapF(aC,aW,vec2(-1.0, 1.0)-pp,dir,len2,lob,clp,vec3(ijfeR.x,ijfeG.x,ijfeB.x)); 
FsrEasuTapF(aC,aW,vec2( 0.0, 1.0)-pp,dir,len2,lob,clp,vec3(ijfeR.y,ijfeG.y,ijfeB.y)); 
FsrEasuTapF(aC,aW,vec2( 0.0, 0.0)-pp,dir,len2,lob,clp,vec3(ijfeR.z,ijfeG.z,ijfeB.z)); 
FsrEasuTapF(aC,aW,vec2(-1.0, 0.0)-pp,dir,len2,lob,clp,vec3(ijfeR.w,ijfeG.w,ijfeB.w)); 
FsrEasuTapF(aC,aW,vec2( 1.0, 1.0)-pp,dir,len2,lob,clp,vec3(klhgR.x,klhgG.x,klhgB.x)); 
FsrEasuTapF(aC,aW,vec2( 2.0, 1.0)-pp,dir,len2,lob,clp,vec3(klhgR.y,klhgG.y,klhgB.y)); 
FsrEasuTapF(aC,aW,vec2( 2.0, 0.0)-pp,dir,len2,lob,clp,vec3(klhgR.z,klhgG.z,klhgB.z)); 
FsrEasuTapF(aC,aW,vec2( 1.0, 0.0)-pp,dir,len2,lob,clp,vec3(klhgR.w,klhgG.w,klhgB.w)); 
FsrEasuTapF(aC,aW,vec2( 1.0, 2.0)-pp,dir,len2,lob,clp,vec3(zzonR.z,zzonG.z,zzonB.z)); 
FsrEasuTapF(aC,aW,vec2( 0.0, 2.0)-pp,dir,len2,lob,clp,vec3(zzonR.w,zzonG.w,zzonB.w)); 
return min(max4,max(min4,aC*vec3(1.0/aW)));}
void main() {ivec2 ip=ivec2(gl_FragCoord.xy);vec3 pix=FsrEasuF(ip,con0,con1,con2,con3);gl_FragColor=vec4(pix,1.0);}
`;
    Effect.ShadersStore[Fsr1Sharpen + "PixelShader"] ??= `#include<gardenFfxFunctions>
#define FSR_RCAS_LIMIT (0.25-(1.0/16.0))
uniform sampler2D textureSampler;varying vec2 vUV;uniform vec4 con;vec3 FsrRcasLoadF(ivec2 p) {return texelFetch(textureSampler,clamp(p,ivec2(0),textureSize(textureSampler,0)-ivec2(1)),0).rgb;}
void main() {ivec2 sp=ivec2(gl_FragCoord.xy);vec3 b=FsrRcasLoadF(sp+ivec2( 0,-1));vec3 d=FsrRcasLoadF(sp+ivec2(-1, 0));vec3 e=FsrRcasLoadF(sp);vec3 f=FsrRcasLoadF(sp+ivec2( 1, 0));vec3 h=FsrRcasLoadF(sp+ivec2( 0, 1));float bR=b.r; float bG=b.g; float bB=b.b;float dR=d.r; float dG=d.g; float dB=d.b;float eR=e.r; float eG=e.g; float eB=e.b;float fR=f.r; float fG=f.g; float fB=f.b;float hR=h.r; float hG=h.g; float hB=h.b;float bL=bB*0.5+(bR*0.5+bG);float dL=dB*0.5+(dR*0.5+dG);float eL=eB*0.5+(eR*0.5+eG);float fL=fB*0.5+(fR*0.5+fG);float hL=hB*0.5+(hR*0.5+hG);float nz=0.25*bL+0.25*dL+0.25*fL+0.25*hL-eL;nz=clamp(abs(nz)*APrxMedRcpF1(AMax3F1(AMax3F1(bL,dL,eL),fL,hL)-AMin3F1(AMin3F1(bL,dL,eL),fL,hL)),0.0,1.0);nz=-0.5*nz+1.0;float mn4R=min(AMin3F1(bR,dR,fR),hR);float mn4G=min(AMin3F1(bG,dG,fG),hG);float mn4B=min(AMin3F1(bB,dB,fB),hB);float mx4R=max(AMax3F1(bR,dR,fR),hR);float mx4G=max(AMax3F1(bG,dG,fG),hG);float mx4B=max(AMax3F1(bB,dB,fB),hB);vec2 peakC=vec2(1.0,-1.0*4.0);float hitMinR=min(mn4R,eR)*(1.0/(4.0*mx4R));float hitMinG=min(mn4G,eG)*(1.0/(4.0*mx4G));float hitMinB=min(mn4B,eB)*(1.0/(4.0*mx4B));float hitMaxR=(peakC.x-max(mx4R,eR))*(1.0/(4.0*mn4R+peakC.y));float hitMaxG=(peakC.x-max(mx4G,eG))*(1.0/(4.0*mn4G+peakC.y));float hitMaxB=(peakC.x-max(mx4B,eB))*(1.0/(4.0*mn4B+peakC.y));float lobeR=max(-hitMinR,hitMaxR);float lobeG=max(-hitMinG,hitMaxG);float lobeB=max(-hitMinB,hitMaxB);float lobe=max(-FSR_RCAS_LIMIT,min(AMax3F1(lobeR,lobeG,lobeB),0.0))*con.x;
#ifdef FSR_RCAS_DENOISE
lobe*=nz;
#endif
float rcpL=APrxMedRcpF1(4.0*lobe+1.0);float pixR=(lobe*bR+lobe*dR+lobe*hR+lobe*fR+eR)*rcpL;float pixG=(lobe*bG+lobe*dG+lobe*hG+lobe*fG+eG)*rcpL;float pixB=(lobe*bB+lobe*dB+lobe*hB+lobe*fB+eB)*rcpL;gl_FragColor=vec4(pixR,pixG,pixB,1.0);}
`;
}
