"use strict";

const CampusView = (() => {
  const {clamp, dot, sub, cross, unit, mix} = Angraecum.math;
  const RADIANS = Math.PI / 180;
  const DEPTH = 405;
  const ANCHOR = [0,5,-7];
  const SHADOW_WIDE=133, SHADOW_HIGH=125, SHADOW_DEPTH=238;

  function basis(back) {
    const right=unit(cross([0,1,0],back));
    return {right, up:cross(back,right), back};
  }
  function orbit(yaw,elevation) {
    const a=wrapBearing(yaw)*RADIANS, b=clamp(elevation,4,88.5)*RADIANS;
    return basis([Math.sin(a)*Math.cos(b),Math.sin(b),Math.cos(a)*Math.cos(b)]);
  }
  function wrapBearing(degrees) {
    return ((degrees%360)+360)%360;
  }
  function matrix(axes,center,wide,high,depth,shift=0) {
    const x=axes.right.map(v=>v/wide), y=axes.up.map(v=>v/high), z=axes.back.map(v=>-v/depth);
    return new Float32Array([
      x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
      -dot(x,center),-dot(y,center),-dot(z,center)+shift/depth,1
    ]);
  }
  const framePoints=({bounds})=>bounds.flatMap(({at,size:[w,d,h],angle=0})=>{
      const points=[];
      const cos=Math.cos(angle),sin=Math.sin(angle);
      for(const x of [-w/2,w/2]) for(const z of [-d/2,d/2]) for(const y of [0,h]) {
        points.push([at[0]+x*cos+z*sin,y,at[1]-x*sin+z*cos]);
      }
      return points;
  });
  const frames=Object.fromEntries(Object.entries(Angraecum.presets).map(([key,preset])=>[key,framePoints(preset)]));
  function frameCamera(aspect,setting,venue=null) {
    const look=orbit(setting.azimuth,setting.elevation);
    const target=Object.prototype.hasOwnProperty.call(frames,setting.viewTarget) ? setting.viewTarget : "campus";
    const detail=venue!==null || target!=="campus", preset=venue??Angraecum.presets[target];
    const projected=(venue?framePoints(venue):frames[target]).map(p=>{
      const delta=sub(p,ANCHOR);
      return [dot(delta,look.right),dot(delta,look.up),dot(delta,look.back)];
    });
    const range=[0,1,2].map(i=>{
      const values=projected.map(p=>p[i]);
      return [Math.min(...values),Math.max(...values)];
    });
    const [[l,r],[b,t],[far,near]]=range;
    const high=Math.max((r-l)/(2*aspect*.89),(t-b)/(2*.84))*100/setting.zoom;
    const lift=preset.lift??.025;
    const shiftX=(l+r)/2,shiftY=(b+t)/2-high*lift;
    const center=ANCHOR.map((p,i)=>p+look.right[i]*shiftX+look.up[i]*shiftY);
    const lowest=clamp(setting.elevation-(setting.parallax||0)*.47,4,88.5);
    const reach=(high+22)/Math.sin(lowest*RADIANS);
    const closeCut=near+(preset.nearPad||0);
    const cutNear=Math.max(DEPTH,reach);
    const foregroundLimit=detail && setting.zoom>=80 && setting.elevation>=12 ? closeCut : cutNear+1;
    const cutFar=detail ? far-182 : -DEPTH;
    return {center,wide:high*aspect,high,focus:(far+near)/2,sharpRange:Math.max(detail?15:26,(near-far)*(detail?.41:.46)),
      depthRadius:(cutNear-cutFar)/2,depthShift:(cutNear+cutFar)/2,foregroundLimit};
  }
  function viewAt(frame,yaw,elevation) {
    const axes=orbit(yaw,elevation);
    return {axes,matrix:matrix(axes,frame.center,frame.wide,frame.high,frame.depthRadius,frame.depthShift)};
  }
  function project(p,view) {
    return [
      p[0]*view[0]+p[1]*view[4]+p[2]*view[8]+view[12],
      p[0]*view[1]+p[1]*view[5]+p[2]*view[9]+view[13],
      p[0]*view[2]+p[1]*view[6]+p[2]*view[10]+view[14]
    ];
  }
  function groundPoint(x,y,frame,view) {
    const {right,up,back}=view.axes;
    const plane=frame.center.map((v,i)=>v+right[i]*x*frame.wide+up[i]*y*frame.high);
    const distance=plane[1]/back[1];
    return [plane[0]-back[0]*distance,plane[2]-back[2]*distance];
  }

  const mainVertex=`
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aColor;
attribute float aMaterial;
attribute vec2 aUV;
uniform mat4 uView;
uniform mat4 uLightView;
varying vec3 vPos;
varying vec3 vNorm;
varying vec3 vColor;
varying vec3 vShadow;
varying float vMaterial;
varying vec2 vUV;
void main() {
  gl_Position=uView*vec4(aPosition,1.0);
  vShadow=(uLightView*vec4(aPosition,1.0)).xyz*0.5+0.5;
  vPos=aPosition;
  vNorm=aNormal;
  vColor=aColor;
  vMaterial=aMaterial;
  vUV=aUV;
}
`;
  const mainFragment=`
precision highp float;
uniform sampler2D uShadow;
uniform vec3 uSun;
uniform vec3 uSunColor;
uniform vec3 uAir;
uniform vec3 uPathLawn;
uniform vec3 uEye;
uniform vec3 uViewCenter;
uniform float uForegroundLimit;
uniform float uMist;
uniform float uTime;
uniform float uShadowTexel;
uniform float uDetail;
uniform float uPixelScale;
uniform vec3 uStoryLight;
uniform vec3 uLantern;
uniform float uLanternOn;
uniform vec4 uWake;
varying vec3 vPos;
varying vec3 vNorm;
varying vec3 vColor;
varying vec3 vShadow;
varying float vMaterial;
varying vec2 vUV;

float hash(vec2 p) {
  p=fract(p*vec2(0.1031,0.11369));
  p+=vec2(dot(p,p.yx+vec2(19.19)));
  return fract((p.x+p.y)*p.x);
}
float noise(vec2 p) {
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),
    mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);
}
vec3 lakeColor(vec3 base, float shadow) {
  vec2 p=vPos.xz;
  float drift=noise(p*0.16);
  float swell=dot(p,vec2(0.79,1.25))+drift*4.8-uTime*0.86;
  float ripple=dot(p,vec2(-1.88,2.12))+0.78*sin(p.x*0.39-p.y*0.63)+uTime*1.23;
  float fine=dot(p,vec2(4.65,0.87))+1.25*sin(swell)-uTime*1.51;
  float fineDetail=smoothstep(3.5,16.0,uPixelScale*abs(uEye.y));
  vec2 slope=vec2(0.056,0.083)*cos(swell)+vec2(-0.059,0.067)*cos(ripple)
    +fineDetail*vec2(0.041,0.012)*cos(fine);

  // The pond fan's radial coordinate approximates the depth towards its edge.
  float shelf=smoothstep(0.65,1.0,vUV.x+0.07*(drift-0.5));
  float gravel=noise((p+1.6*slope)*2.4);
  vec3 bed=mix(uPathLawn,vec3(0.65,0.64,0.49),0.63)*(0.83+0.25*gravel);
  vec3 water=mix(base*vec3(0.62,0.85,0.94),mix(base,bed,0.56),shelf);
  vec2 bottom=p+2.4*slope;
  float caustic=sin(dot(bottom,vec2(2.7,1.4))+drift*6.2)
    +sin(dot(bottom,vec2(-1.4,2.3))+swell*0.45);
  float lightOnBed=(1.0-smoothstep(0.02,0.30,abs(caustic)))*(0.38+0.62*noise(bottom*0.72));
  water+=vec3(0.087,0.113,0.081)*lightOnBed*shelf*fineDetail;

  vec3 waveNormal=normalize(vec3(-slope.x,1.0,-slope.y));
  float facing=clamp(dot(waveNormal,uEye),0.0,1.0);
  float skyPatch=noise(p*0.17+slope*5.0);
  vec3 sky=mix(uAir*0.77,mix(uAir,vec3(0.89,0.96,0.99),0.52),skyPatch);
  float reflection=0.14+0.18*skyPatch+0.62*pow(1.0-facing,4.0);
  vec3 color=mix(water,sky,reflection)*(0.87+0.13*shadow);
  float crest=smoothstep(0.37,1.0,0.57*sin(ripple)+0.43*sin(swell));
  float glint=max(0.0,dot(waveNormal,normalize(uSun+uEye)));
  color+=shadow*(vec3(0.030,0.054,0.062)*crest+uSunColor*(0.13*pow(glint,56.0)+0.21*pow(glint,158.0)));

  if(dot(uWake.zw,uWake.zw)>0.5) {
    vec2 offset=p-uWake.xy;
    float rear=-dot(offset,uWake.zw)-2.04;
    float side=abs(dot(offset,vec2(uWake.w,-uWake.z)));
    float curve=0.35+0.21*rear+0.027*rear*rear;
    float trail=smoothstep(0.0,0.40,rear)*(1.0-smoothstep(1.2,4.65,rear));
    float arm=1.0-smoothstep(0.027,0.20,abs(side-curve+0.045*sin(ripple)));
    float wash=(1.0-smoothstep(0.04,0.63,side))*smoothstep(0.48,0.94,sin(rear*7.1-uTime*1.55));
    color+=vec3(0.13,0.18,0.18)*(arm+0.31*wash)*trail*(1.0-0.46*shelf);
  }
  return color;
}
float grout(vec2 uv,float softness,float stagger,float depth) {
  float row=floor(uv.y);
  vec2 p=vec2(uv.x+stagger*mod(row,2.0),uv.y);
  vec2 d=min(fract(p),1.0-fract(p));
  float boundary=smoothstep(0.02,softness,min(d.x,d.y*1.24));
  float tile=hash(floor(p));
  return (1.0-depth+depth*boundary)*(0.944+0.117*tile);
}
float beveledStone(vec2 uv,float stagger,float mortar) {
  uv.x+=stagger*mod(floor(uv.y),2.0);
  vec2 cell=fract(uv);
  vec2 rim=min(cell,1.0-cell);
  float face=smoothstep(0.023,0.105,min(rim.x,rim.y*1.23));
  float bevel=(smoothstep(0.025,0.068,cell.y)-smoothstep(0.067,0.162,cell.y))*smoothstep(0.02,0.14,rim.x);
  float tile=hash(floor(uv));
  return (1.0-mortar+face*mortar+0.09*bevel)*(0.918+0.16*tile);
}
float shadeAt(vec2 offset,float bias,vec2 slope) {
  vec2 sampleAt=vShadow.xy+offset*uShadowTexel;
  vec2 stored=texture2D(uShadow,sampleAt).rg;
  vec2 center=(floor(sampleAt/uShadowTexel)+0.5)*uShadowTexel;
  float receiver=vShadow.z+dot(center-vShadow.xy,slope);
  return step(receiver-bias,stored.x+stored.y/255.0);
}
void main() {
  // Close-up viewpoints trim foreground objects while retaining the ground and paths below.
  bool route=vMaterial>15.5 && vMaterial<21.5;
  bool soil=vMaterial>0.5 && vMaterial<1.5;
  bool paving=soil||(vMaterial>8.5 && vMaterial<9.5)||route;
  bool water=vMaterial>2.5 && vMaterial<4.5;
  bool terrain=vMaterial>13.5 && vMaterial<14.5;
  bool ground=terrain || (vPos.y<0.23 && (paving||water));
  if(!ground && dot(vPos-uViewCenter,uEye)>uForegroundLimit) discard;
  if(vMaterial>22.5 && vMaterial<23.5) {
    gl_FragColor=vec4(vColor,0.34*(1.0-smoothstep(0.09,1.0,dot(vUV,vUV))));
    return;
  }
  vec3 n=normalize(vNorm);
  float direct=max(dot(n,uSun),0.0);
  float shadow=1.0;
  if(uShadowTexel>0.0 && direct>0.015 && all(greaterThan(vShadow,vec3(0.006))) && all(lessThan(vShadow,vec3(0.994)))) {
    float bias=0.0005+0.00115*(1.0-direct);
    vec2 slope=vec2(0.0);
    if(ground) {
      // Compare each shadow sample at the depth of its own point on the same ground plane.
      vec3 east=normalize(cross(vec3(0.0,1.0,0.0),uSun)),up=cross(uSun,east);
      slope=vec2(dot(east,n)*${SHADOW_WIDE}.0,dot(up,n)*${SHADOW_HIGH}.0)/(${SHADOW_DEPTH}.0*max(direct,0.04));
    }
    shadow=0.27+0.146*(shadeAt(vec2(0.0),bias,slope)+shadeAt(vec2(1.8,1.8),bias,slope)+shadeAt(vec2(-1.8,1.8),bias,slope)
      +shadeAt(vec2(1.8,-1.8),bias,slope)+shadeAt(vec2(-1.8,-1.8),bias,slope));
  }
  float micro=noise(vUV*3.1);
  float faded=uDetail;
  float groundPixels=uPixelScale*abs(dot(n,uEye));
  vec3 surface=vColor*(0.964+0.077*micro);
  if(soil||terrain) {
    float patches=noise(vPos.xz*0.227);
    surface*=0.921+0.166*patches+0.047*noise(vPos.xz*2.43);
    if(groundPixels>4.0) {
      float clumps=noise(vPos.xz*vec2(3.7,4.6))-0.5;
      surface*=1.0+0.16*clumps*smoothstep(4.0,16.0,groundPixels);
    }
    if(groundPixels>18.0) {
      vec2 scale=soil?vec2(13.2,14.6):vec2(21.6,12.2);
      float fibers=noise(vPos.xz*scale)-0.5;
      surface*=1.0+0.17*fibers*smoothstep(18.0,48.0,groundPixels);
    }
  }
  if(vMaterial>1.5 && vMaterial<2.5) {
    float slate=grout(vUV*vec2(1.21,2.19),0.13,0.5,0.28);
    surface*=mix(0.99,slate,faded)*(0.965+0.084*noise(vUV*vec2(2.8,0.62)));
  }
  bool chapelStone=vMaterial>14.5 && vMaterial<15.5;
  if((vMaterial>6.5 && vMaterial<7.5)||chapelStone) {
    vec2 scale=chapelStone?vec2(1.31,2.69):vec2(0.92,1.85);
    float stone=chapelStone?beveledStone(vUV*scale,0.5,0.22):grout(vUV*scale,0.095,0.5,0.18);
    float patina=noise(vUV*0.31+vec2(4.4,2.6));
    surface*=mix(0.99,stone,faded)*(0.93+0.126*patina);
  }
  if(vMaterial>7.5 && vMaterial<8.5) {
    float lap=fract(vUV.y*3.22);
    float seam=smoothstep(0.019,0.19,lap);
    surface*=mix(1.0,0.835+0.165*seam+0.057*smoothstep(0.76,1.0,lap),faded);
    surface*=0.96+0.08*noise(vUV*vec2(0.66,3.2));
  }
  if(vMaterial>8.5 && vMaterial<9.5) {
    surface*=mix(0.995,grout(vUV*vec2(1.03,1.40),0.133,0.5,0.13),faded*0.82);
  }
  if(route) {
    float pavingDetail=mix(0.27,0.92,smoothstep(4.7,15.0,groundPixels));
    if(vMaterial<17.5) {
      bool brick=vMaterial<16.5;
      vec2 scale=brick?vec2(1.19,2.08):vec2(0.80,1.37);
      float stone=beveledStone(vUV*scale,brick?0.5:0.31,brick?0.18:0.15);
      surface*=mix(1.0,stone,pavingDetail)*(0.965+0.069*noise(vPos.xz*0.36));
      if(groundPixels>12.0) {
        float aggregate=noise(vUV*vec2(10.3,12.1))-0.5;
        surface*=1.0+0.14*aggregate*smoothstep(12.0,38.0,groundPixels);
      }
    } else if(vMaterial<20.5) {
      float bed=noise(vPos.xz*0.81);
      float grains=noise(vPos.xz*vec2(7.5,7.9));
      float wear=0.951+0.098*bed;
      surface*=wear+0.19*(grains-0.5)*smoothstep(7.0,20.0,groundPixels);
      if(vMaterial>19.5) {
        vec3 lawn=uPathLawn*(0.943+0.105*bed+0.085*(grains-0.5)*smoothstep(7.0,20.0,groundPixels));
        float verge=smoothstep(0.02,1.0,clamp(vUV.y+(bed-0.5)*0.24,0.0,1.0));
        surface=mix(surface,lawn,verge);
      }
    } else {
      float joint=smoothstep(0.022,0.12,fract(vUV.x*1.73));
      surface*=mix(1.0,0.86+0.14*joint,pavingDetail)*(0.97+0.075*sin(vUV.y*3.14159));
    }
  }
  if(vMaterial>21.5 && vMaterial<22.5) {
    float seam=fract(vUV.x*2.95);
    float rib=smoothstep(0.032,0.13,seam);
    float highlight=smoothstep(0.67,0.91,seam)-smoothstep(0.92,1.0,seam);
    surface*=0.945+0.11*noise(vUV*vec2(0.7,1.79));
    surface*=mix(1.0,0.77+0.23*rib+0.12*highlight,faded);
  }
  if(vMaterial>9.5 && vMaterial<10.5) {
    float board=fract(vUV.x*3.78);
    float grain=noise(vUV*vec2(6.1,0.52));
    surface*=0.89+0.16*grain+0.045*mix(1.0,smoothstep(0.01,0.14,board),faded);
  }
  if(vMaterial>10.5 && vMaterial<11.5) {
    float canopy=noise(vPos.xz*0.91+vec2(vPos.y*0.79,vPos.y*1.08));
    surface*=0.90+0.19*canopy+0.044*noise(vPos.xz*2.55);
  }
  float hemi=0.591+0.161*max(0.0,n.y);
  vec3 lit=surface*(hemi*mix(uAir,vec3(1.0),0.78)+direct*0.515*shadow*uSunColor);
  float opacity=1.0;
  if(vMaterial>2.5 && vMaterial<3.5) {
    lit=lakeColor(vColor,shadow);
  }
  if(vMaterial>3.5 && vMaterial<4.5) {
    float frost=noise(vPos.xz*0.314+vec2(0.24*micro));
    float streak=pow(abs(sin(vPos.x*0.43+vPos.z*0.83+frost*0.7)),19.0);
    lit=mix(surface,uAir,0.33+0.33*frost)+vec3(0.034*streak);
  }
  if(vMaterial>4.5 && vMaterial<5.5) {
    float reflectance=1.0-abs(dot(n,uEye));
    float sheen=smoothstep(0.49,0.72,noise(vPos.xz*0.25+vec2(vPos.y*0.12)));
    lit=mix(0.91*surface,uAir,0.26+0.57*reflectance)+vec3(0.045*sheen);
    opacity=0.18+0.22*reflectance+0.04*sheen;
  }
  if(vMaterial>5.5 && vMaterial<6.5) lit=mix(lit,surface*1.24,0.89);
  if(vMaterial>11.5 && vMaterial<12.5) {
    float grazing=1.0-abs(dot(n,uEye));
    vec3 reflection=reflect(-uEye,n);
    float sky=smoothstep(-0.28,0.42,reflection.y+0.52*(noise(vUV*0.28)-0.5));
    float sheen=smoothstep(0.49,0.68,noise(vec2(vUV.x*0.24+reflection.x,vUV.y*0.41-reflection.z)));
    vec3 reflected=mix(surface*0.73,uAir,0.28+0.55*sky+0.12*sheen);
    lit=mix(lit,reflected,0.27+0.43*grazing+0.14*sheen);
  }
  if(vMaterial>12.5 && vMaterial<13.5) {
    float course=smoothstep(0.023,0.115,min(fract(vUV.y*3.55),1.0-fract(vUV.y*3.55)));
    float variation=noise(vUV*vec2(0.61,1.92));
    lit*=mix(0.99,0.912+0.105*course+0.067*variation,uDetail);
  }
  float distance=length((vPos.xz-vec2(1.0,-8.0))*vec2(0.82,1.13));
  float distanceBehind=-dot(vPos-vec3(0.0,0.0,-7.0),uEye);
  float fog=smoothstep(58.0,215.0,distance)*uMist+smoothstep(48.0,184.0,distanceBehind)*0.145;
  fog+=smoothstep(167.0,393.0,distanceBehind)*0.78;
  vec3 resolved=mix(lit,uAir,clamp(fog,0.0,1.0));
  if(!(vMaterial>5.5 && vMaterial<6.5)) {
    vec3 ray=uLantern-vPos;
    float lamp=uLanternOn*exp(-0.32*dot(ray,ray))*0.52;
    resolved*=mix(uStoryLight,vec3(1.19,1.02,0.77),lamp);
    resolved+=lamp*vec3(0.062,0.037,0.016);
  }
  gl_FragColor=vec4(clamp(resolved,0.0,1.0),opacity);
}
`;
  const shadowVertex=`
attribute vec3 aPosition;
uniform mat4 uLightView;
void main() { gl_Position=uLightView*vec4(aPosition,1.0); }
`;
  const shadowFragment=`
precision highp float;
void main() {
  float depth=gl_FragCoord.z*255.0;
  gl_FragColor=vec4(floor(depth)/255.0,fract(depth),0.0,1.0);
}
`;
  const postVertex=`
attribute vec2 aPosition;
varying vec2 vUV;
void main() {
  gl_Position=vec4(aPosition,0.0,1.0);
  vUV=aPosition*0.5+0.5;
}
`;
  const postFragment=`
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uDepth;
uniform vec2 uPixel;
uniform float uEdgeFilter;
uniform float uAmount;
uniform float uFocus;
uniform float uRange;
uniform float uDepthSpan;
uniform float uDepthShift;
uniform float uDepthAvailable;
varying vec2 vUV;

float brightness(vec3 c) { return dot(c,vec3(0.299,0.587,0.114)); }
vec3 antialias(vec3 center) {
  vec3 tl=texture2D(uScene,vUV+vec2(-1.0,-1.0)*uPixel).rgb;
  vec3 tr=texture2D(uScene,vUV+vec2( 1.0,-1.0)*uPixel).rgb;
  vec3 bl=texture2D(uScene,vUV+vec2(-1.0, 1.0)*uPixel).rgb;
  vec3 br=texture2D(uScene,vUV+vec2( 1.0, 1.0)*uPixel).rgb;
  float a=brightness(tl),b=brightness(tr),c=brightness(bl),d=brightness(br);
  float delta=max(max(a,b),max(c,d))-min(min(a,b),min(c,d));
  if(delta<0.078) return center;
  vec2 direction=vec2(-(a+b-c-d),a+c-b-d);
  float inv=1.0/(min(abs(direction.x),abs(direction.y))+0.075);
  direction=clamp(direction*inv,vec2(-2.7),vec2(2.7))*uPixel;
  vec3 neighbors=0.5*(texture2D(uScene,vUV-direction*0.35).rgb+
    texture2D(uScene,vUV+direction*0.35).rgb);
  return mix(center,neighbors,0.68*uEdgeFilter);
}
void main() {
  vec3 source=texture2D(uScene,vUV).rgb;
  float edgeBand=abs(vUV.y-0.515)*2.0;
  float edge=smoothstep(0.63,1.02,edgeBand);
  float amount=edge;
  if(uDepthAvailable>0.5) {
    float depth=(0.5-texture2D(uDepth,vUV).r)*uDepthSpan+uDepthShift;
    float distance=abs(depth-uFocus);
    float circle=smoothstep(uRange-3.0,uRange+52.0,distance);
    amount=max(circle,edge*0.46);
  }
  float radius=amount*uAmount*(13.0+14.0/(1080.0*uPixel.y));
  if(radius<0.54) {
    gl_FragColor=vec4(uEdgeFilter>0.0?antialias(source):source,1.0);
    return;
  }
  vec3 accumulation=source*1.85;
  float total=1.85;
  for(int i=0;i<16;i++) {
    float t=(float(i)+0.5)/16.0;
    float angle=float(i)*2.39996323;
    vec2 offset=vec2(cos(angle),sin(angle))*sqrt(t)*radius*uPixel;
    float weight=1.0-0.36*t;
    accumulation+=texture2D(uScene,vUV+offset).rgb*weight;
    total+=weight;
  }
  gl_FragColor=vec4(mix(source,accumulation/total,smoothstep(0.46,3.5,radius)),1.0);
}
`;

  const portraitVertex=`
attribute vec2 aPortrait;
uniform mat4 uView;
uniform vec3 uOrigin;
uniform vec3 uAcross;
uniform vec3 uUp;
uniform vec2 uAnchor;
varying vec2 vUV;
void main() {
  vUV=aPortrait;
  vec3 p=uOrigin+uAcross*(vUV.x-uAnchor.x)+uUp*(uAnchor.y-vUV.y);
  gl_Position=uView*vec4(p,1.0);
}
`;
  const portraitFragment=`
precision highp float;
uniform sampler2D uArt;
uniform vec2 uArtScale;
uniform vec3 uTint;
varying vec2 vUV;
void main() {
  vec4 color=texture2D(uArt,vUV*uArtScale);
  if(color.a<0.045) discard;
  gl_FragColor=vec4(color.rgb*uTint,color.a);
}
`;

  function portraitPoint(pose,u,v) {
    const {origin,across,up,anchor}=pose;
    return origin.map((value,i)=>value+across[i]*(u-anchor[0])+up[i]*(anchor[1]-v));
  }

  function link(gl,vs,fs,label) {
    function compile(type,source) {
      const shader=gl.createShader(type);
      gl.shaderSource(shader,source);
      gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw Error(label+" · "+gl.getShaderInfoLog(shader));
      return shader;
    }
    const vertex=compile(gl.VERTEX_SHADER,vs),fragment=compile(gl.FRAGMENT_SHADER,fs);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);
    gl.attachShader(program,fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error(label+" · "+gl.getProgramInfoLog(program));
    return program;
  }
  const uniforms = (gl,program,names) => Object.fromEntries(names.map(n=>[n,gl.getUniformLocation(program,n)]));
  function colorTexture(gl,tex,w,h,filter) {
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  }
  function attachRenderDepth(gl,buffer,w,h) {
    gl.bindRenderbuffer(gl.RENDERBUFFER,buffer);
    gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,buffer);
  }
  class Renderer {
    constructor(canvas,onArtReady) {
      this.canvas=canvas;
      const gl=canvas.getContext("webgl",{alpha:false,depth:true,antialias:true,desynchronized:true});
      if(!gl) throw Error("无法启动 WebGL");
      this.gl=gl;
      this.maxSize=Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
      this.canSampleDepth=!!gl.getExtension("WEBGL_depth_texture");
      this.anisotropy=gl.getExtension("EXT_texture_filter_anisotropic");
      this.portraitSamples=this.anisotropy?Math.min(4,gl.getParameter(this.anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)):1;
      this.main=link(gl,mainVertex,mainFragment,"建筑材质");
      this.shadow=link(gl,shadowVertex,shadowFragment,"光照");
      this.post=link(gl,postVertex,postFragment,"景深");
      this.portrait=link(gl,portraitVertex,portraitFragment,"人物立绘");
      this.onArtReady=onArtReady;
      this.portraits=new Map();
      this.portraitAttribute=gl.getAttribLocation(this.portrait,"aPortrait");
      this.portraitUniforms=uniforms(gl,this.portrait,["uView","uArt","uArtScale","uOrigin","uAcross","uUp","uAnchor","uTint"]);
      this.attributes=["aPosition","aNormal","aColor","aMaterial","aUV"].map(name=>gl.getAttribLocation(this.main,name));
      this.mainUniforms=uniforms(gl,this.main,["uView","uLightView","uShadow","uSun","uSunColor","uAir","uPathLawn","uEye","uViewCenter","uForegroundLimit","uMist","uTime",
        "uShadowTexel","uDetail","uPixelScale","uStoryLight","uLantern","uLanternOn","uWake"]);
      this.postUniforms=uniforms(gl,this.post,["uScene","uDepth","uPixel","uEdgeFilter","uAmount","uFocus","uRange","uDepthSpan","uDepthShift","uDepthAvailable"]);
      this.depthAttribute=gl.getAttribLocation(this.shadow,"aPosition");
      this.depthUniform=gl.getUniformLocation(this.shadow,"uLightView");
      this.postAttribute=gl.getAttribLocation(this.post,"aPosition");
      this.geometry=[gl.createBuffer(),gl.createBuffer()];
      this.figures=gl.createBuffer();
      this.screen=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,this.screen);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      this.portraitQuad=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,this.portraitQuad);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]),gl.STATIC_DRAW);
      this.shadowTarget={frame:gl.createFramebuffer(),color:gl.createTexture(),depth:gl.createRenderbuffer(),size:0};
      this.sceneTarget={frame:gl.createFramebuffer(),color:gl.createTexture(),depth:gl.createTexture(),
        fallback:gl.createRenderbuffer(),width:0,height:0};
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.CULL_FACE);
    }
    resize(cssWidth,cssHeight,quality) {
      const maxPixels={low:950000,standard:3600000,high:8400000}[quality];
      const minimum={low:1,standard:1.18,high:1.34}[quality];
      const ratio=Math.min(Math.max(window.devicePixelRatio||1,minimum),1.85,Math.sqrt(maxPixels/(cssWidth*cssHeight)),
        this.maxSize/cssWidth,this.maxSize/cssHeight);
      this.edgeFilter=clamp((1.24-ratio)/.24,0,1);
      const w=Math.max(1,Math.round(cssWidth*ratio)),h=Math.max(1,Math.round(cssHeight*ratio));
      if(this.canvas.width!==w || this.canvas.height!==h) {
        this.canvas.width=w;
        this.canvas.height=h;
      }
      const gl=this.gl,t=this.sceneTarget;
      if(w===t.width && h===t.height) return;
      t.width=w;t.height=h;
      gl.bindFramebuffer(gl.FRAMEBUFFER,t.frame);
      colorTexture(gl,t.color,w,h,gl.LINEAR);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t.color,0);
      let depthReady=false;
      if(this.canSampleDepth) {
        gl.bindTexture(gl.TEXTURE_2D,t.depth);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      // Higher precision keeps adjoining strips of paving from fighting at crossings.
      for(const type of [gl.UNSIGNED_INT,gl.UNSIGNED_SHORT]) {
        gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT,w,h,0,gl.DEPTH_COMPONENT,type,null);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,t.depth,0);
        depthReady=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
        if(depthReady) break;
      }
      }
      if(!depthReady) attachRenderDepth(gl,t.fallback,w,h);
      t.depthReady=depthReady;
      t.ready=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
    load(s,quality) {
      const gl=this.gl, layers=Angraecum.build(s,quality);
      this.season=s;
      this.counts=layers.map(v=>v.length/12);
      layers.forEach((v,i)=>{
        gl.bindBuffer(gl.ARRAY_BUFFER,this.geometry[i]);
        gl.bufferData(gl.ARRAY_BUFFER,v,gl.STATIC_DRAW);
      });
      this.lightMatrix=matrix(basis(s.sun),[0,0,-3],SHADOW_WIDE,SHADOW_HIGH,SHADOW_DEPTH);
      const t=this.shadowTarget,r=Math.min(this.maxSize,{low:768,standard:1536,high:2048}[quality]);
      gl.bindFramebuffer(gl.FRAMEBUFFER,t.frame);
      if(r!==t.size) {
        t.size=r;
        colorTexture(gl,t.color,r,r,gl.NEAREST);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t.color,0);
        attachRenderDepth(gl,t.depth,r,r);
        t.ready=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
      }
      if(t.ready) {
        gl.viewport(0,0,r,r);
        gl.clearColor(1,0,0,1);
        gl.enable(gl.DEPTH_TEST);
        gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        gl.useProgram(this.shadow);
        gl.uniformMatrix4fv(this.depthUniform,false,this.lightMatrix);
        gl.bindBuffer(gl.ARRAY_BUFFER,this.geometry[0]);
        gl.enableVertexAttribArray(this.depthAttribute);
        gl.vertexAttribPointer(this.depthAttribute,3,gl.FLOAT,false,48,0);
        gl.drawArrays(gl.TRIANGLES,0,this.counts[0]);
        gl.disableVertexAttribArray(this.depthAttribute);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
    drawMesh(buffer,first,count) {
      const gl=this.gl, offsets=[0,12,24,36,40], sizes=[3,3,3,1,2];
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      this.attributes.forEach((loc,i)=>{
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc,sizes[i],gl.FLOAT,false,48,offsets[i]);
      });
      gl.drawArrays(gl.TRIANGLES,first,count);
    }
    loadPortrait(art) {
      if(this.portraits.has(art)) return this.portraits.get(art);
      const gl=this.gl, image=new Image();
      this.portraits.set(art,null);
      image.onload=()=>{
        // Pad to a mipmap-compatible size without resampling the original pixels.
        const raster=document.createElement("canvas");
        raster.width=2**Math.ceil(Math.log2(art.width));
        raster.height=2**Math.ceil(Math.log2(art.height));
        const pixels=raster.getContext("2d");
        pixels.drawImage(image,0,0);
        const scale=[art.width/raster.width,art.height/raster.height];
        const texture=gl.createTexture();
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,raster);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        if(this.anisotropy) gl.texParameterf(gl.TEXTURE_2D,this.anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,this.portraitSamples);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.activeTexture(gl.TEXTURE0);

        const size=112;
        raster.width=raster.height=size;
        pixels.drawImage(image,0,0,size,size);
        const rgba=pixels.getImageData(0,0,size,size).data;
        const alpha=new Uint8Array(size*size);
        for(let i=0;i<alpha.length;i++) alpha[i]=rgba[i*4+3];
        this.portraits.set(art,{texture,alpha,size,scale});
        this.onArtReady();
      };
      image.onerror=()=>console.error("无法读取人物立绘");
      image.src=art.image;
      return null;
    }
    drawPortraits(view,framing,figures) {
      const gl=this.gl,{right,up,back}=view.axes,u=this.portraitUniforms;
      const cards=[];
      for(const sprite of figures.sprites) {
        const {actor,art,origin,world,height}=sprite;
        const texture=this.loadPortrait(art);
        const distance=dot(sub(origin,framing.center),back);
        if(!texture || distance>framing.foregroundLimit) continue;
        const {right:artRight,up:artUp}=sprite.axes??view.axes;
        const c=Math.cos(sprite.roll),s=Math.sin(sprite.roll),width=height*art.width/art.height;
        const across=artRight.map((v,i)=>(v*c+artUp[i]*s)*width);
        const vertical=artUp.map((v,i)=>(v*c-artRight[i]*s)*height);
        const pose={origin,anchor:art.anchor,across,up:vertical};
        const pick={...pose,radius:height*.115,mask:texture,
          screenAcross:[dot(across,right),dot(across,up)],screenUp:[dot(vertical,right),dot(vertical,up)]};
        for(const person of sprite.members??[actor]) {
          const member=art.members?.[person.who];
          person.pick={...pick,member,aspect:art.width/art.height,
            world:world??[person.x,person.y,person.z],head:portraitPoint(pose,...(member?.[0]??art.head))};
        }
        cards.push({pose,distance,texture});
      }
      if(!cards.length) return;
      // Draw the farther portraits first so their antialiased edges blend into the scene.
      cards.sort((a,b)=>a.distance-b.distance);
      gl.useProgram(this.portrait);
      gl.uniformMatrix4fv(u.uView,false,view.matrix);
      gl.uniform3fv(u.uTint,mix([.96,.967,.96],figures.light??[1,1,1],.48));
      gl.activeTexture(gl.TEXTURE2);
      gl.uniform1i(u.uArt,2);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.portraitQuad);
      gl.enableVertexAttribArray(this.portraitAttribute);
      gl.vertexAttribPointer(this.portraitAttribute,2,gl.FLOAT,false,0,0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      for(const {pose,texture} of cards) {
        gl.bindTexture(gl.TEXTURE_2D,texture.texture);
        gl.uniform2fv(u.uArtScale,texture.scale);
        gl.uniform3fv(u.uOrigin,pose.origin);
        gl.uniform3fv(u.uAcross,pose.across);
        gl.uniform3fv(u.uUp,pose.up);
        gl.uniform2fv(u.uAnchor,pose.anchor);
        gl.drawArrays(gl.TRIANGLES,0,6);
      }
      gl.disableVertexAttribArray(this.portraitAttribute);
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.BLEND);
      gl.activeTexture(gl.TEXTURE0);
      gl.useProgram(this.main);
    }
    renderGeometry(view,framing,time,figures) {
      const gl=this.gl,u=this.mainUniforms,s=this.season;
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.clearColor(...s.air,1);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.main);
      gl.uniformMatrix4fv(u.uView,false,view.matrix);
      gl.uniformMatrix4fv(u.uLightView,false,this.lightMatrix);
      gl.uniform3fv(u.uSun,s.sun);
      gl.uniform3fv(u.uSunColor,s.light);
      gl.uniform3fv(u.uAir,s.air);
      gl.uniform3fv(u.uPathLawn,mix(s.lawn,s.margin,.32));
      gl.uniform3fv(u.uEye,view.axes.back);
      gl.uniform3fv(u.uViewCenter,framing.center);
      gl.uniform1f(u.uForegroundLimit,framing.foregroundLimit);
      gl.uniform1f(u.uMist,s.mist);
      gl.uniform1f(u.uTime,time);
      const pixelScale=this.canvas.width/(framing.wide*2);
      gl.uniform1f(u.uDetail,clamp((pixelScale-2.3)/5.1,0.08,1));
      gl.uniform1f(u.uPixelScale,pixelScale);
      gl.uniform1f(u.uShadowTexel,this.shadowTarget.ready ? 1/this.shadowTarget.size : 0);
      gl.uniform3fv(u.uStoryLight,figures?.light??[1,1,1]);
      gl.uniform3fv(u.uLantern,figures?.glow??[0,0,0]);
      gl.uniform1f(u.uLanternOn,figures?.glow?1:0);
    const wake=figures?.wake;
    if(wake) gl.uniform4fv(u.uWake,wake);
    else gl.uniform4f(u.uWake,0,0,0,0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D,this.shadowTarget.color);
      gl.uniform1i(u.uShadow,0);
      this.drawMesh(this.geometry[0],0,this.counts[0]);
      if(figures && figures.data.length) {
        gl.bindBuffer(gl.ARRAY_BUFFER,this.figures);
        gl.bufferData(gl.ARRAY_BUFFER,figures.data,gl.DYNAMIC_DRAW);
        this.drawMesh(this.figures,0,figures.opaque);
      }
      if(figures?.sprites.length) this.drawPortraits(view,framing,figures);
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      this.drawMesh(this.geometry[1],0,this.counts[1]);
      if(figures?.shadows) this.drawMesh(this.figures,figures.opaque,figures.shadows);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      this.attributes.forEach(loc=>gl.disableVertexAttribArray(loc));
    }
    draw(view,framing,time,blur,focus,figures=null) {
      const gl=this.gl,t=this.sceneTarget,w=this.canvas.width,h=this.canvas.height;
      gl.bindFramebuffer(gl.FRAMEBUFFER,t.ready ? t.frame : null);
      gl.viewport(0,0,w,h);
      this.renderGeometry(view,framing,time,figures);
      if(!t.ready) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(this.post);
      const u=this.postUniforms;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D,t.color);
      gl.uniform1i(u.uScene,0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D,t.depthReady ? t.depth : t.color);
      gl.uniform1i(u.uDepth,1);
      gl.uniform2f(u.uPixel,1/w,1/h);
      gl.uniform1f(u.uEdgeFilter,this.edgeFilter);
      gl.uniform1f(u.uAmount,blur/100);
      gl.uniform1f(u.uFocus,framing.focus+focus);
      gl.uniform1f(u.uRange,framing.sharpRange);
      gl.uniform1f(u.uDepthSpan,2*framing.depthRadius);
      gl.uniform1f(u.uDepthShift,framing.depthShift);
      gl.uniform1f(u.uDepthAvailable,t.depthReady?1:0);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.screen);
      gl.enableVertexAttribArray(this.postAttribute);
      gl.vertexAttribPointer(this.postAttribute,2,gl.FLOAT,false,0,0);
      gl.drawArrays(gl.TRIANGLES,0,3);
      gl.disableVertexAttribArray(this.postAttribute);
      gl.activeTexture(gl.TEXTURE0);
    }
  }

  return { Renderer,frameCamera,viewAt,project,groundPoint,wrapBearing,portraitPoint };
})();
