"use strict";

const Angraecum = (() => {
  const TAU = 2 * Math.PI;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (a, b, t) => a.map((n, i) => lerp(n, b[i], t));
  const rgb = (hex) => [16, 8, 0].map((shift) => ((hex >>> shift) & 255) / 255);
  const tint = (color, k) => color.map((n) => clamp(n * k, 0, 1));
  const sub = (a, b) => a.map((n, i) => n - b[i]);
  const dot = (a, b) => a.reduce((sum, n, i) => sum + n * b[i], 0);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const unit = (v) => { const length = Math.hypot(...v) || 1; return v.map((n) => n / length); };
  function random(seed) {
    return () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }
  const colors = (obj) => Object.fromEntries(Object.entries(obj).map(([k,v]) => [k,rgb(v)]));
  const C = colors({
    limestone:0xebdaba, sandstone:0xd8c29e, chapel:0xb2b6b5, chapelTrim:0xd2d1c3, plaster:0xf0e6cf,
    slate:0x546370, lighterSlate:0x637683, verdigris:0x5b8c7f, clapboard:0x719099,
    timber:0x705447, oak:0x927257, iron:0x3b4b4d, plinth:0x99a099, darkStone:0x6f7977,
    glass:0x7c9caa, paleGlass:0xc8dedb, lead:0x687880, amber:0xffd699, snow:0xf0f5f4,
    soil:0x817053, mulch:0x675649, palePath:0xdfceb0, brick:0x9a7671,
    gardenPaving:0xd8c9ac, flagstone:0xc6c3ae, gravel:0xcabd9b, packedEarth:0xc5ae82
  });
  const M = Object.freeze({ SIMPLE:0, SOIL:1, SLATE:2, WATER:3, ICE:4, GLASS:5, LIT:6, STONE:7,
    SIDING:8, PAVERS:9, WOOD:10, LEAVES:11, WINDOW:12, ASHLAR:13, TERRAIN:14, CHAPEL_STONE:15,
    PATH_BRICK:16, PATH_STONE:17, PATH_GRAVEL:18, PATH_EARTH:19, PATH_SHOULDER:20, PATH_CURB:21, METAL_ROOF:22,
    FIGURE_SHADOW:23 });
  function season(name, palette, sun, mist, count, wind) {
    return { ...colors(palette), id:name, winter:name==="winter", sun:unit(sun), mist, count, wind };
  }
  const seasons = {
    spring: season("spring", {
      lawn:0xa5b980, margin:0x6e9371, fir:0x4b7568, foliage:0x7fa17b, cherry:0xe9b2c1,
      flower:0xd77f9b, soil:0x837157, water:0x91b6b5, air:0xc0dbd9, light:0xfff0d7, particle:0xffd9e6
    },[.68,.85,.58],.24,80,.023),
    summer: season("summer", {
      lawn:0x9bb571, margin:0x5b8a63, fir:0x3e6b57, foliage:0x658f62, cherry:0x7ea05c,
      flower:0x92aecc, soil:0x887751, water:0x71a4aa, air:0xb4d5d4, light:0xffefcd, particle:0xfff7b5
    },[.44,1.29,.44],.19,42,.006),
    autumn: season("autumn", {
      lawn:0xaab078, margin:0x9e8963, fir:0x526c52, foliage:0xd29e5a, cherry:0xcd8d51,
      flower:0xaf665b, soil:0x997956, water:0x8daeb1, air:0xd0c4a6, light:0xffdfae, particle:0xe5a96b
    },[.80,.64,.58],.25,70,.033),
    winter: season("winter", {
      lawn:0xe6eeee, margin:0xb6c8d5, fir:0x547271, foliage:0x8c9ea5, cherry:0xe4efee,
      flower:0xaababc, soil:0xabbac1, water:0xa2c5d5, air:0xbbd1df, light:0xffefd6, particle:0xf7fdff
    },[.72,.57,.64],.34,158,.032)
  };
  const eastFacing=Math.PI/2;
  const entryStart=[-88,-30],entryEnd=[-49,-59];
  const entryTangent=unit(sub(entryEnd,entryStart));
  const gateCenter=entryStart.map((value,i)=>lerp(value,entryEnd[i],.42));
  const gateHalfWidth=7.0;
  const dormitoryShoulder=gateCenter.map((v,i)=>v+entryTangent[i]*(gateHalfWidth+8));
  // The gate sits on the straight diagonal. Each corner trims its adjoining walls by the given distance.
  const wallCorners=[
    [...entryStart,7],[...dormitoryShoulder,6],[-46,-64.4,10],[-22,-65.7,10],[6,-62.4,12],[43,-48,16],[76,-44,10],[97,-33,10],
    [107,-14,10],[102,17,14],[88.3,46.3,15],[58.7,60,13],[30,73,11],[-12,72,12],
    [-63.7,64,13],[-88.2,44.8,13],[-96,17,13],[-98,-8,10]
  ];
  const gateYaw=Math.atan2(entryTangent[1],-entryTangent[0]);
  const gateEdge=side=>gateCenter.map((v,i)=>v+entryTangent[i]*side*gateHalfWidth);
  const wallRoute=[gateEdge(1),...wallCorners.flatMap((_,index)=>{
    const count=wallCorners.length,i=(index+1)%count;
    const [x,z,cut]=wallCorners[i],at=[x,z];
    const before=unit(sub(wallCorners[(i+count-1)%count].slice(0,2),at));
    const after=unit(sub(wallCorners[(i+1)%count].slice(0,2),at));
    const segments=10;
    return Array.from({length:segments+1},(_,step)=>{
      const t=step/segments;
      return at.map((v,k)=>v+cut*((1-t)**2*before[k]+t*t*after[k]));
    });
  }),gateEdge(-1)];
  const wallEdges=wallRoute.map(([ax,az],i)=>{
    const [bx,bz]=wallRoute[(i+1)%wallRoute.length],dx=bx-ax,dz=bz-az;
    return {ax,az,bz,dx,dz,inverseLength:1/(dx*dx+dz*dz)};
  });
  const [[wallWest,wallEast],[wallNorth,wallSouth]]=[0,1].map(axis=>{
    const values=wallCorners.map(corner=>corner[axis]);
    return [Math.min(...values),Math.max(...values)];
  });
  const position = {
    school:[-42,2], chapel:[-52,42], club:[-68,7], pavilion:[7.4,31], pond:[11.9,56.8],
    roses:[-20,1], greenhouse:[34,-26.8], nursery:[62,-28.2], rabbits:[10,-27],
    farm:[64,1.6], farmShed:[87.7,5.4], rokkaen:[60.8,33.8], gate:gateCenter
  };
  const dormitories=[[-38.5,-47.9],[-10.5,-48.4]];
  const dormitorySize=[17.3,10.6];
  const dormitoryBounds=dormitories.map(([x,z])=>({at:[x,z+1.35],size:[19,14.4,11]}));
  const garden={center:[46,2.8],radiusX:35,radiusZ:18.8};
  const farmSize=[29,32];
  const pondSize=[15.2,9.3];
  const pondPier=[position.pond[0]+1.6,position.pond[1]-10.18];
  const pavilionScale=1.13;
  const rokkaenFacing=Math.PI/20;
  const rokkaenLocal=local(position.rokkaen[0],0,position.rokkaen[1],rokkaenFacing);
  const rokkaenAnnexOffset=[-18,-1.6];
  const gateLocal=local(position.gate[0],0,position.gate[1],gateYaw);
  function groundAt(transform,u,v) {
    const [x,,z]=transform(u,0,v);
    return [x,z];
  }
  const mainGlass = [24.2,12.2,4.86,2.74];
  const nurseryGlass = [13.2,8.6,3.81,2.18];
  // The framing uses the building envelopes. The outer woods and walls can extend past the screen.
  const bounds = {
    school:{at:[position.school[0]-1,position.school[1]], size:[35,53,12.6]},
    chapel:{at:[position.chapel[0]-.7,position.chapel[1]], size:[25.6,16.3,14.8]},
    rokkaen:{at:groundAt(rokkaenLocal,-4.5,0), size:[41,21,15], angle:rokkaenFacing},
    pavilion:{at:position.pavilion, size:[9.8,9.3,8.2].map(n=>n*pavilionScale)},
    roses:{at:position.roses, size:[18,26,1.8]},
    roseBeds:{at:[garden.center[0]-garden.radiusX/2,garden.center[1]], size:[garden.radiusX+1,2*garden.radiusZ,1.6]},
    greenhouse:{at:position.greenhouse, size:[mainGlass[0]+1,mainGlass[1]+1,8.1]},
    nursery:{at:position.nursery, size:[nurseryGlass[0]+1,nurseryGlass[1]+1,6.5]},
    farm:{at:position.farm,size:[farmSize[0]+1,farmSize[1]+1,2.3]},
    farmShed:{at:position.farmShed,size:[9,8,7]},
    pond:{at:position.pond,size:[34,21,1]},
    gate:{at:position.gate,size:[2*gateHalfWidth+2.6,5.4,4.35],angle:gateYaw},
    club:{at:position.club,size:[9,16,7]}
  };
  const frameBounds=[...Object.values(bounds),...dormitoryBounds];
  const occupied=[bounds.school,bounds.chapel,bounds.rokkaen,bounds.club,bounds.pavilion,bounds.greenhouse,
    bounds.nursery,bounds.farmShed,...dormitoryBounds,{at:position.rabbits,size:[5.1,4.6,3.3]}];
  function canStand(x,z,padding=.42) {
    if(!Number.isFinite(x) || !Number.isFinite(z) || wallDistance(x,z,0)>-1-padding) return false;
    const u=(x-position.pond[0])/pondSize[0],v=(z-position.pond[1])/pondSize[1];
    const a=Math.atan2(v,u),shore=1+.08*Math.sin(a*3+.4)+.08*Math.cos(a*5-.57);
    return Math.hypot(u,v)>shore+.07+padding/pondSize[1] && occupied.every(({at,size,angle=0})=>{
      const dx=x-at[0],dz=z-at[1],c=Math.cos(angle),s=Math.sin(angle);
      return Math.abs(dx*c-dz*s)>size[0]/2+padding || Math.abs(dx*s+dz*c)>size[1]/2+padding;
    });
  }
  function figureVisible(point,view,frame) {
    const direction=view.axes.back, room=frame.foregroundLimit-dot(sub(point,frame.center),direction);
    if(room<0) return false;
    return !occupied.some(({at,size:[w,d,h],angle=0})=>{
      const c=Math.cos(angle),s=Math.sin(angle),x=point[0]-at[0],z=point[2]-at[1];
      const origin=[x*c-z*s,point[1],x*s+z*c];
      const ray=[direction[0]*c-direction[2]*s,direction[1],direction[0]*s+direction[2]*c];
      const low=[-w/2,0,-d/2],high=[w/2,h,d/2];
      let near=.08,far=room;
      for(let axis=0;axis<3;axis++) {
        if(Math.abs(ray[axis])<1e-6) {
          if(origin[axis]<low[axis] || origin[axis]>high[axis]) return false;
          continue;
        }
        const a=(low[axis]-origin[axis])/ray[axis],b=(high[axis]-origin[axis])/ray[axis];
        near=Math.max(near,Math.min(a,b));
        far=Math.min(far,Math.max(a,b));
      }
      return far>near;
    });
  }
  const presets={
    campus:{bounds:frameBounds,azimuth:27,elevation:35.3,zoom:110,lift:.096},
    forecourt:{bounds:[bounds.school,bounds.roses],azimuth:80,elevation:17,zoom:104,nearPad:9},
    pavilion:{bounds:[bounds.pavilion,{at:[-7,29.5],size:[16,12,1.4]}],azimuth:323,elevation:15,zoom:104,nearPad:10},
    chapel:{bounds:[bounds.chapel,{at:[-33.5,42],size:[12.4,7.2,1.4]}],azimuth:75,elevation:17.5,zoom:104,nearPad:8},
    rokkaen:{bounds:[bounds.rokkaen,{at:groundAt(rokkaenLocal,0,10.8),size:[25,8,1.6],angle:rokkaenFacing}],azimuth:31,elevation:16.7,zoom:106,nearPad:8},
    dormitories:{bounds:dormitoryBounds,azimuth:344,elevation:43,zoom:99,nearPad:16},
    glass:{bounds:[bounds.greenhouse,bounds.nursery],azimuth:341,elevation:26,zoom:105,nearPad:13}
  };
  const markers = [
    ["校舍",position.school,12.6],["圣堂",position.chapel,13],["六华苑洋馆",position.rokkaen,12],
    ["东屋",position.pavilion,8*pavilionScale],["前庭玫瑰园",position.roses,1.5],["温室",position.greenhouse,7.9],
    ["寄宿舍 A 栋",dormitories[0],10.5],["玫瑰庭园",bounds.roseBeds.at,1.5],["正门",position.gate,4],["樱花道",[-29,-32],2],
    ["农园",position.farm,2],["农园管理小屋",position.farmShed,6],["兔舍",position.rabbits,4],
    ["社团活动室",position.club,7],["路灯小径",[-104,14],2],["庭园池",position.pond,1],
    ["育苗温室",position.nursery,6.2],["寄宿舍 B 栋",dormitories[1],10.5],
    ["六华苑和馆",groundAt(rokkaenLocal,...rokkaenAnnexOffset),6.35]
  ];
  function local(x,y,z,angle=0) {
    const c=Math.cos(angle),s=Math.sin(angle);
    return (u,v,w) => [x+c*u+s*w, y+v, z-s*u+c*w];
  }

  // Each vertex stores position, normal, color, material, and surface coordinates.
  class Mesh {
    constructor() {
      this.buffers = [new Float32Array(122880), new Float32Array(4608)];
      this.used = [0, 0];
    }
    placeAround([x,z],angle,build,scale=1) {
      const start=this.used.slice();
      build();
      const cos=Math.cos(angle),sin=Math.sin(angle);
      for(const [layer,buffer] of this.buffers.entries()) {
        for(let i=start[layer];i<this.used[layer];i+=12) {
          const dx=buffer[i]-x,dz=buffer[i+2]-z,nx=buffer[i+3],nz=buffer[i+5];
          buffer[i]=x+scale*(dx*cos+dz*sin);
          buffer[i+1]*=scale;
          buffer[i+2]=z+scale*(-dx*sin+dz*cos);
          buffer[i+3]=nx*cos+nz*sin;
          buffer[i+5]=-nx*sin+nz*cos;
        }
      }
    }
    triangle(points,color,material=0,normal=null,uv=null) {
      const [a,b,c]=points;
      const n=normal || unit(cross(sub(b,a),sub(c,a)));
      const layer=material===M.GLASS ? 1 : 0;
      let buf=this.buffers[layer], i=this.used[layer];
      if(i+36>buf.length) {
        const next=new Float32Array(buf.length*2);
        next.set(buf);
        buf=this.buffers[layer]=next;
      }
      const flat = Math.abs(n[1]) > .65;
      for(let j=0;j<3;j++) {
        const p=points[j];
        buf[i++]=p[0]; buf[i++]=p[1]; buf[i++]=p[2];
        buf[i++]=n[0]; buf[i++]=n[1]; buf[i++]=n[2];
        buf[i++]=color[0]; buf[i++]=color[1]; buf[i++]=color[2];
        buf[i++]=material;
        buf[i++]=uv ? uv[j][0] : (flat || Math.abs(n[2])>=Math.abs(n[0]) ? p[0] : p[2]);
        buf[i++]=uv ? uv[j][1] : (flat ? p[2] : p[1]);
      }
      this.used[layer]=i;
    }
    face(points,color,material=0,up=false,uv=null,normal=null) {
      let n=normal || unit(cross(sub(points[1],points[0]),sub(points[2],points[0])));
      if(up && n[1]<0) n=n.map((v)=>-v);
      for(let i=1;i<points.length-1;i++) {
        this.triangle([points[0],points[i],points[i+1]],color,material,n,uv ? [uv[0],uv[i],uv[i+1]] : null);
      }
    }
    box(x,y,z,w,h,d,color,angle=0,material=0) {
      const move=local(x,y,z,angle);
      const corners=[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1],
        [-1,1,-1],[1,1,-1],[1,1,1],[-1,1,1]].map(([a,b,c])=>move(a*w/2,b*h/2,c*d/2));
      for(const f of [[4,5,1,0],[5,6,2,1],[6,7,3,2],[7,4,0,3],[7,6,5,4],[0,1,2,3]]) {
        this.face(f.map((i)=>corners[i]),color,material);
      }
    }
    beam(a,b,depth,height,color,material=0) {
      const [dx,dz]=[b[0]-a[0],b[2]-a[2]];
      this.box((a[0]+b[0])/2,a[1],(a[2]+b[2])/2,Math.hypot(dx,dz),height,depth,color,-Math.atan2(dz,dx),material);
    }
    rod(a,b,r0,r1,color,sides=8,material=0,caps=true) {
      const dir=unit(sub(b,a)),u=unit(cross(Math.abs(dir[1])>.84?[1,0,0]:[0,1,0],dir)),v=cross(dir,u);
      const ring = (p,r,i) => {
        const t=i*TAU/sides,c=Math.cos(t),s=Math.sin(t);
        return p.map((n,k)=>n+r*(u[k]*c+v[k]*s));
      };
      for(let i=0;i<sides;i++) {
        const p=ring(a,r0,i),q=ring(a,r0,i+1),r=ring(b,r1,i),s=ring(b,r1,i+1);
        this.face([p,q,s,r],tint(color,.96+.067*Math.sin(i*7.2)**2),material);
        if(caps && r1>.025) this.triangle([b,r,s],color,material,dir);
        if(caps && r0>.025) this.triangle([a,q,p],color,material,dir.map((n)=>-n));
      }
    }
    column(x,z,y0,y1,r0,r1,color,sides=10,material=0,caps=true) {
      this.rod([x,y0,z],[x,y1,z],r0,r1,color,sides,material,caps);
    }
    disc(x,y,z,rx,rz,color,material=0,sides=30) {
      const edge=(i)=>[x+rx*Math.cos(i*TAU/sides),y,z+rz*Math.sin(i*TAU/sides)];
      for(let i=0;i<sides;i++) this.triangle([[x,y,z],edge(i),edge(i+1)],color,material,[0,1,0]);
    }
    oval(x,y,z,rx,ry,rz,color,sides=8,bands=4,seed=0,material=M.LEAVES) {
      const at=(i,j)=>{
        const a=j*Math.PI/bands,b=i*TAU/sides,k=1+.105*Math.sin(16.3*i+4.2*j+seed);
        return [x+rx*Math.sin(a)*Math.cos(b)*k, y+ry*Math.cos(a), z+rz*Math.sin(a)*Math.sin(b)*k];
      };
      for(let j=0;j<bands;j++) for(let i=0;i<sides;i++) {
        const a=at(i,j),b=at(i+1,j),c=at(i+1,j+1),d=at(i,j+1);
        const shade=tint(color,1.03-.22*j/bands+.086*Math.sin(i*11.2+j*1.8+seed));
        if(j>0) this.triangle([a,b,d],shade,material);
        if(j<bands-1) this.triangle([b,c,d],shade,material);
      }
    }
    layers() {
      return this.buffers.map((a,i)=>a.subarray(0,this.used[i]));
    }
  }

  function roof(mesh, x,z,y,w,d,height,color,winter,angle=0,hip=.17) {
    const p=local(x,y,z,angle),span=Math.hypot(height,d/2);
    const at=(side,t,k,raise=0)=>p((k-.5)*w*(1-hip*2*t),t*height+raise,side*(1-t)*d/2);
    const uv=(t,k)=>[(k-.5)*w*(1-hip*2*t),t*span];
    for(const side of [-1,1]) {
      mesh.face([at(side,0,0),at(side,0,1),at(side,1,1),at(side,1,0)],color,M.SLATE,true,
        [uv(0,0),uv(0,1),uv(1,1),uv(1,0)]);
      mesh.beam(at(side,0,0,-.025),at(side,0,1,-.025),.18,.16,tint(color,.66));
      if(winter) for(let i=0;i<23;i++) {
        const a=i/23,b=(i+1)/23,drip=(u)=>.16+.046*Math.sin(32*u+side)+.029*Math.cos(54*u)+.04*Math.sin(9*u);
        mesh.face([at(side,drip(a),a,.11),at(side,drip(b),b,.11),at(side,1,b,.11),at(side,1,a,.11)],
          C.snow,M.SIMPLE,true);
      }
    }
    for(const end of [0,1]) {
      const triangle=[at(-1,0,end),at(1,0,end),at(1,1,end)];
      const coords=[[0,0],[d,0],[d/2,Math.hypot(hip*w,height)]];
      if(end) {
        triangle.reverse();
        coords.reverse();
      }
      mesh.face(triangle,hip?color:C.chapel,hip?M.SLATE:M.CHAPEL_STONE,true,hip?coords:null);
      if(winter && hip) mesh.face([at(-1,.26,end,.11),at(1,.26,end,.11),at(1,1,end,.11)],C.snow,0,true);
    }
    mesh.beam(at(1,1,0,.06),at(1,1,1,.06),.21,.16,winter?C.snow:tint(color,.69));
  }

  function archShape(w,h,style) {
    if(!style) return [[-w/2,0],[w/2,0],[w/2,h],[-w/2,h]];
    if(style==="point") return [[-w/2,0],[w/2,0],[w/2,h*.58],[w*.38,h*.77],[0,h],[-w*.38,h*.77],[-w/2,h*.58]];
    const points=[[-w/2,0],[w/2,0]];
    for(let i=0;i<=10;i++) {
      const a=Math.PI*i/10;
      points.push([w/2*Math.cos(a),h-w/2+w/2*Math.sin(a)]);
    }
    return points;
  }
  function window(mesh,x,y,z,w,h,angle=0,opts={}) {
    const p=local(x,y,z,angle),frame=opts.frame||C.plaster;
    const outline=(width,height,base,d,color,mat)=>{
      mesh.face(archShape(width,height,opts.arch).map(([u,v])=>p(u,v+base,d)),color,mat);
    };
    const dark=opts.door ? C.timber : (opts.color || C.glass);
    outline(w*1.04,h*1.015,-.016,.015,tint(C.darkStone,.80),M.SIMPLE);
    outline(w,h,0,.052,frame,M.SIMPLE);
    outline(w*.815,h*.883,h*.058,.079,tint(dark,.61),opts.door?M.WOOD:M.WINDOW);
    outline(w*.743,h*.827,h*.084,.093,dark,opts.door?M.WOOD:opts.lit?M.LIT:M.WINDOW);
    if(opts.door) {
      mesh.box(...p(0,h*.40,.132),.066,h*.78,.084,tint(frame,.53),angle);
      mesh.box(...p(w*.068,h*.37,.17),.10,.12,.06,rgb(0xc7ae78),angle);
    } else {
      const bar=opts.lead||tint(frame,.89);
      mesh.box(...p(0,h*.47,.109),w*.050,h*.79,.071,bar,angle);
      for(const level of (opts.arch?[.32,.59]:[.38,.68])) {
        mesh.box(...p(0,h*level,.114),w*.74,.058,.075,bar,angle);
      }
      mesh.box(...p(0,-.06,.098),w*1.15,.113,.29,frame,angle);
    }
  }
  function archedPane(mesh,p,radius,rise,bottom,spring,depth,color,material=M.WINDOW) {
    if(spring>bottom) {
      mesh.face([p(-radius,bottom,depth),p(radius,bottom,depth),p(radius,spring,depth),p(-radius,spring,depth)],color,material);
    }
    const fan=[p(0,spring,depth)];
    for(let i=0;i<=12;i++) {
      const t=i*Math.PI/12;
      fan.push(p(radius*Math.cos(t),spring+rise*Math.sin(t),depth));
    }
    mesh.face(fan,color,material);
  }
  function archMolding(mesh,p,radius,rise,spring,border,depth,color) {
    const edge=(i,spread,d)=>{
      const t=i*Math.PI/12;
      return p((radius+spread)*Math.cos(t),spring+(rise+spread)*Math.sin(t),d);
    };
    for(let i=0;i<12;i++) {
      const a=edge(i,border,depth),b=edge(i+1,border,depth);
      const c=edge(i+1,0,depth-.027),d=edge(i,0,depth-.027);
      mesh.face([a,b,c,d],tint(color,1.02-.045*(i%3===0)));
      mesh.face([edge(i,border,0),edge(i+1,border,0),b,a],tint(color,.92));
      mesh.face([edge(i+1,0,.022),edge(i,0,.022),d,c],tint(color,.82));
    }
  }
  function stair(mesh,x,z,wide,n,h,depth=.42) {
    for(let i=0;i<n;i++) {
      const top=h*(i+1)/n,thickness=Math.min(.067,h/n*.39),riser=top-thickness;
      const treadZ=z-i*depth;
      mesh.box(x,riser/2,treadZ,wide,riser,depth+.05,tint(C.plinth,.91+i*.024),0,M.STONE);
      mesh.box(x,top-thickness/2,treadZ+.021,wide+.075,thickness,depth+.094,tint(C.chapelTrim,.91),0,M.PAVERS);
    }
  }
  function chimney(mesh,x,y,z,width=1.12) {
    mesh.box(x,y+.69,z,width,1.67,width*.83,C.sandstone,0,M.STONE);
    mesh.box(x,y+1.53,z,width*1.22,.23,width*.99,C.plinth);
    for(const side of [-1,1]) mesh.column(x+side*.24,z,y+1.61,y+1.85,.13,.12,C.brick,7);
  }
  function plinth(mesh,x,z,w,d,y=.5,color=C.plinth) {
    mesh.box(x,y/2,z,w,y,d,color,0,M.STONE);
    mesh.box(x,y-.018,z,w+.13,.13,d+.13,tint(color,1.12));
  }


  function schoolOpening(mesh,x,y,z,w,h,angle,lit,entry=false) {
    const p=local(x,y,z,angle),r=w*.43,rise=r*(entry?.62:.86),spring=h-rise;
    const frame=tint(C.plaster,1.025),glass=lit?rgb(0xd5bf95):rgb(0x849e9d);
    archedPane(mesh,p,r+.074,rise+.048,0,spring,.035,tint(C.darkStone,.82),M.SIMPLE);
    archedPane(mesh,p,r-.02,rise,.085,spring,.052,glass,lit?M.LIT:M.WINDOW);
    const bar=(u,v,wide,high,d=.10)=>mesh.box(...p(u,v,d),wide,high,.073,frame,angle);
    for(const side of [-1,1]) {
      bar(side*(r+.065),spring/2,.153,spring,.14);
      bar(side*(r+.025),spring/2,.045,spring,.188);
      mesh.box(...p(side*(r+.085),spring-.043,.157),.222,.208,.255,C.sandstone,angle);
    }
    archMolding(mesh,p,r,rise,spring,.152,.228,frame);
    const key=[p(-.084,h+.02,.25),p(.084,h+.02,.25),p(.14,h+.183,.29),p(-.14,h+.183,.29)];
    mesh.face(key,C.sandstone);
    for(const k of [0,1,2,3]) {
      const a=key[k],b=key[(k+1)%4];
      const back=([u,v,q])=>[u-Math.sin(angle)*.16,v,q-Math.cos(angle)*.16];
      mesh.face([a,b,back(b),back(a)],tint(frame,k===2?1.06:.86));
    }
    bar(0,spring,2*r,.099,.145);
    mesh.box(...p(0,.014,.155),2*r+.41,.128,.33,C.sandstone,angle);
    mesh.box(...p(0,.079,.177),2*r+.47,.062,.34,frame,angle);
    for(const f of [-.5,0,.5]) bar(f*r,(spring+.10)/2,entry&&f===0?.112:.065,spring-.10);
    for(const f of [.34,.68]) bar(0,spring*f,2*r,.061);
    if(entry) {
      bar(0,spring+.32,2*r*.93,.052);
      for(const side of [-1,1]) {
        bar(side*r*.55,spring+.31,.052,.61);
        mesh.box(...p(side*.14,1.33,.188),.068,.25,.098,C.iron,angle);
      }
    } else {
      for(const t of [Math.PI/4,Math.PI/2,Math.PI*3/4]) {
        mesh.rod(p(0,spring,.122),p(r*Math.cos(t),spring+rise*Math.sin(t),.122),.035,.029,frame,5);
      }
    }
  }

  function schoolCornice(mesh,first,last,y) {
    const [ax,az]=first,[bx,bz]=last;
    const span=Math.hypot(bx-ax,bz-az),angle=Math.atan2(az-bz,bx-ax);
    const count=Math.floor(span/.51);
    mesh.beam([ax,y,az],[bx,y,bz],.26,.24,tint(C.sandstone,.86));
    mesh.beam([ax,y+.19,az],[bx,y+.19,bz],.41,.13,C.plaster);
    for(let i=0;i<count;i++) {
      const t=(i+.5)/count;
      mesh.box(lerp(ax,bx,t),y-.012,lerp(az,bz,t),.155,.209,.34,C.plaster,angle);
    }
  }

  function school(mesh, s) {
    const [x,z]=position.school;
    const centralDepth=16.25;
    const sections=[
      {offset:0,width:29.05,depth:centralDepth,forward:0,wall:9.24},
      {offset:-18.95,width:11.3,depth:27.4,forward:-1.67,wall:9.02},
      {offset:18.95,width:11.3,depth:26.2,forward:-1.25,wall:9.02}
    ];
    for(const {offset,width:w,depth,forward,wall:h} of sections) {
      const wing=offset!==0,u=x+offset,v=z+forward,roofBase=h+.38;
      plinth(mesh,u,v,w+.63,depth+.60,.61);
      mesh.box(u,h/2+.32,v,w,h,depth,C.limestone,0,M.ASHLAR);
      for(const [y,a,b] of [[.78,.26,.23],[4.72,.29,.24],[h-.12,.48,.32],[h+.23,.36,.21]]) {
        mesh.box(u,y,v,w+a,b,depth+a,y<8?tint(C.sandstone,1.08):C.plaster);
      }
      roof(mesh,u,v,roofBase,wing?depth+.61:w+.48,wing?w+.60:depth+.46,wing?2.87:2.12,
        tint(C.slate,wing?1.07:.96),s.winter,wing?Math.PI/2:0,wing ? .18 : .15);
      const height=wing?1.03:.74;
      for(const side of [-1,1]) {
        const f=v+side*(depth/2-.022),angle=side===1?0:Math.PI;
        schoolCornice(mesh,[u-w/2,f+side*.18],[u+w/2,f+side*.18],h-.305);
        mesh.box(u,roofBase+.08,f,w+.12,.25,.47,C.sandstone,0,M.ASHLAR);
        mesh.box(u,roofBase+height,f,w+.29,.16,.62,s.winter?C.snow:C.plaster);
        const teeth=Math.ceil(w/.61);
        for(let tooth=0;tooth<=teeth;tooth++) {
          const point=u+(tooth/teeth-.5)*(w-.36);
          const base=roofBase+.17,waist=roofBase+height*.51;
          mesh.column(point,f,base,waist,.109,.059,C.plaster,6,M.SIMPLE,false);
          mesh.column(point,f,waist,roofBase+height-.068,.059,.088,C.plaster,6,M.SIMPLE,false);
        }
        const panelX=wing?[u-w/2+.54,u+w/2-.54]:[u-w/2+.32,u,u+w/2-.32];
        for(const point of panelX) {
          const central=!wing&&point===u,wide=central?3.55:.83;
          const lower=central?4.47:.60;
          mesh.box(point,(lower+h)/2,f,wide,h-lower,.46,C.limestone,0,M.ASHLAR);
          for(const level of [.91,4.50,h-.24]) {
            mesh.box(point,level,f,wide+.22,.22,.59,C.sandstone);
          }
          mesh.box(point,roofBase+height*.55,f,wide+.10,height,.53,C.limestone);
          mesh.box(point,roofBase+height+.11,f,wide+.27,.14,.68,s.winter?C.snow:C.plaster);
          mesh.box(point,roofBase+height*.58,f+side*.277,wide*.77,height*.59,.065,tint(C.sandstone,1.05));
          mesh.box(point,roofBase+height*.58,f+side*.319,wide*.65,height*.41,.052,C.limestone);
        }
        const bays=wing?[-2.84,0,2.84]:[-11.88,-9.02,-6.16,-3.30,3.30,6.16,9.02,11.88];
        for(const y of [1.39,5.42]) {
          bays.forEach((dx,i)=>schoolOpening(mesh,u+dx,y,f+.07*side,2.38,3.02,angle,s.winter&&i%3!==1));
        }
        if(!wing) schoolOpening(mesh,u,.61,f+.075*side,3.04,3.63,angle,s.winter,true);
      }
      for(const side of [-1,1]) {
        const a=u+side*w/2;
        if(wing) {
          const rim=a+side*.167;
          if(offset*side>0) schoolCornice(mesh,[rim,v-depth/2],[rim,v+depth/2],h-.305);
          mesh.box(a,roofBase+.12,v,.44,.34,depth,C.sandstone,0,M.ASHLAR);
          mesh.box(a,roofBase+.35,v,.56,.16,depth+.24,s.winter?C.snow:C.plaster);
          for(const p of [-depth/2+.25,depth/2-.25]) {
            mesh.box(a-.13*side,4.76,v+p,.78,8.45,.73,C.sandstone,0,M.STONE);
            for(const y of [1.08,4.65,8.66]) mesh.box(a-.13*side,y,v+p,.99,.20,.91,C.plaster);
          }
          for(let j=-3;j<=3;j++) {
            const dz=j*3.34;
            const exposed=offset*side>0 || Math.abs(v+dz-z)>centralDepth*.5+1.0;
            if(!exposed) continue;
            for(const y of [1.39,5.42]) {
              const lit=s.winter&&j%3!==0;
              schoolOpening(mesh,a,y,v+dz,2.23,3.02,side*Math.PI/2,lit);
            }
          }
        }
      }
      chimney(mesh,u+w*.21,roofBase+1.22,v-depth*.22,.97);
    }
    stair(mesh,x,z+10.24,5.3,4,.62);
    mesh.box(x,.316,z+8.63,5.3,.62,1.35,C.plinth,0,M.STONE);
    mesh.box(x,.052,z-11.09,23.8,.083,6.31,s.winter?C.snow:C.palePath,0,M.PAVERS);
    const gallery=[x+22.7,z+11.6];
    mesh.box(gallery[0],.29,gallery[1],6.9,.58,4.75,C.plinth,0,M.STONE);
    roof(mesh,gallery[0],gallery[1],3.76,7.18,4.99,1.1,tint(C.lighterSlate,.82),s.winter,0,.08);
    mesh.box(gallery[0],3.69,gallery[1]+2.40,7.22,.19,.23,tint(C.chapelTrim,.99));
    stair(mesh,gallery[0],gallery[1]+2.87,3.15,2,.58,.35);
    for(const dx of [-2.91,0,2.91]) {
      mesh.box(gallery[0]+dx,2.16,gallery[1]+2.12,.21,3.29,.22,C.verdigris,0,M.WOOD);
      mesh.box(gallery[0]+dx,.75,gallery[1]+2.12,.33,.24,.34,C.plinth);
      const inner=dx===0?[-1,1]:[-Math.sign(dx)];
      for(const dir of inner) {
        mesh.rod([gallery[0]+dx,3.03,gallery[1]+2.12],[gallery[0]+dx+dir*.58,3.69,gallery[1]+2.12],.079,.067,C.verdigris,7);
      }
    }
  }

  function chapelOculus(mesh,x,y,z,r,glass) {
    const at=(i,radius,d)=>[x+radius*Math.cos(i*TAU/24),y+radius*Math.sin(i*TAU/24),z+d];
    for(let i=0;i<24;i++) {
      mesh.triangle([[x,y,z+.031],at(i,r,.031),at(i+1,r,.031)],glass,M.WINDOW,[0,0,1]);
      mesh.face([at(i,r+.26,.070),at(i+1,r+.26,.070),at(i+1,r+.16,.20),at(i,r+.16,.20)],C.chapel);
      mesh.face([at(i,r+.16,.20),at(i+1,r+.16,.20),at(i+1,r,.13),at(i,r,.13)],C.chapelTrim);
      mesh.face([at(i,r,.13),at(i+1,r,.13),at(i+1,r,.024),at(i,r,.024)],tint(C.chapel,.9));
    }
    for(const f of [-.29,.29]) {
      const offset=r*f,chord=Math.sqrt(r*r-offset*offset);
      mesh.box(x+offset,y,z+.10,.063,2*chord,.09,C.chapelTrim);
      mesh.box(x,y+offset,z+.105,2*chord,.057,.076,C.chapelTrim);
    }
  }

  function chapelPortal(mesh,x,z,glass) {
    const p=local(x,.61,z),door=rgb(0x76504b),frame=tint(C.chapelTrim,1.04),iron=tint(C.iron,.81);
    const spring=4.04,r=1.52;
    mesh.box(...p(0,1.88,.049),3.22,3.76,.105,iron);
    mesh.box(...p(0,spring-.165,.153),3.67,.29,.29,frame);
    archMolding(mesh,p,r,1.55,spring,.27,.27,frame);
    archedPane(mesh,p,r,1.55,spring,spring,.06,glass);
    archMolding(mesh,p,.39,.36,spring,.056,.166,frame);
    for(const t of [Math.PI/4,Math.PI/2,Math.PI*3/4]) {
      const c=Math.cos(t),s=Math.sin(t);
      mesh.rod(p(.42*c,spring+.40*s,.145),p(r*c,spring+1.55*s,.145),.040,.033,frame,6);
    }
    for(const side of [-1,1]) {
      mesh.box(...p(side*1.72,1.95,.105),.34,3.90,.265,C.chapel);
      mesh.box(...p(side*1.595,1.90,.210),.127,3.80,.215,frame);
      mesh.box(...p(side*1.79,.18,.16),.48,.32,.33,frame);
      mesh.box(...p(side*1.78,spring-.055,.13),.53,.23,.41,frame);
      mesh.box(...p(side*.78,1.87,.114),1.43,3.60,.11,door,0,M.WOOD);
      for(const dy of [.71,1.85,3.00]) {
        mesh.box(...p(side*.78,dy,.178),1.18,1.01,.052,tint(door,1.095),0,M.WOOD);
        for(const f of [-.29,0,.29]) {
          mesh.box(...p(side*.78+f,dy,.208),.040,1.00,.021,tint(door,.73),0,M.WOOD);
        }
        mesh.box(...p(side*.78,dy+.55,.197),1.43,.091,.07,iron);
        mesh.box(...p(side*1.15,dy+.17,.216),.43,.055,.053,iron);
        for(const rivet of [1.02,1.29]) mesh.box(...p(side*rivet,dy+.17,.25),.063,.067,.028,tint(iron,1.21));
      }
      mesh.box(...p(side*1.438,1.87,.194),.091,3.63,.091,iron);
      mesh.box(...p(side*.16,1.72,.223),.083,.34,.099,rgb(0x948579));
    }
    mesh.box(...p(0,1.87,.190),.116,3.68,.105,iron);
  }

  function chapelButtress(mesh,x,z,angle,height,s) {
    const p=local(x,0,z,angle),trim=tint(C.chapelTrim,.95);
    const course=(y,w,h,d,push,color,material=0)=>mesh.box(...p(0,y,push),w,h,d,color,angle,material);
    course(.44,.99,.41,1.04,.28,tint(C.plinth,.89),M.STONE);
    course(.75,.86,.17,.95,.28,s.winter?C.snow:trim);
    course(1.30,.76,1.04,.86,.24,C.chapel,M.STONE);
    course(1.85,.77,.17,.86,.24,trim);
    course((height+1.72)/2,.55,height-1.72,.68,.18,C.chapel,M.CHAPEL_STONE);
    course(height-.11,.77,.21,.81,.24,trim);
    course(height+.085,.69,.17,.68,.21,trim);
    course(height+.36,.33,.42,.34,.21,tint(C.chapel,1.04));
    mesh.box(...p(0,height+.37,.393),.16,.25,.031,tint(trim,.83),angle);
    mesh.box(...p(0,height+.37,.418),.101,.176,.027,trim,angle);
    const [u,,v]=p(0,0,.21);
    mesh.column(u,v,height+.56,height+.68,.236,.205,s.winter?C.snow:trim,6);
    mesh.column(u,v,height+.68,height+1.18,.205,.026,trim,6);
  }

  function chapelApse(mesh,x,z,s,glass) {
    const r=3.76,depth=3.06,wall=7.61,summit=[x,9.67,z+.37];
    const corner=(i,y)=>[x+r*Math.sin((i/6-.5)*Math.PI),y,z-depth*Math.cos((i/6-.5)*Math.PI)];
    for(let i=0;i<6;i++) {
      const a=corner(i,wall),b=corner(i+1,wall);
      mesh.face([corner(i+1,.52),corner(i,.52),a,b],C.chapel,M.CHAPEL_STONE);
      mesh.face([corner(i+1,.19),corner(i,.19),corner(i,.65),corner(i+1,.65)],C.plinth,M.STONE);
      mesh.face([a,b,summit],s.winter?C.snow:C.slate,s.winter?M.SIMPLE:M.SLATE,true,
        [[0,0],[Math.hypot(b[0]-a[0],b[2]-a[2]),0],[1,3.5]]);
      mesh.beam(a,b,.15,.16,C.chapelTrim);
      if(i===0||i===5) continue;
      const angle=Math.atan2(b[2]-a[2],a[0]-b[0]);
      window(mesh,(a[0]+b[0])/2,2.58,(a[2]+b[2])/2,1.06,3.84,angle,
        {arch:"point",frame:C.chapelTrim,color:glass});
    }
  }

  function chapel(mesh,s) {
    const [x,z]=position.chapel,front=z+10.05,roofBase=8.95,rise=4.73;
    const naveW=10.14,naveD=20.10,roofW=10.77,roofD=21.1;
    const trim=C.chapelTrim,glass=s.winter?rgb(0x7e817a):rgb(0x718987);
    plinth(mesh,x,z,15.03,20.83,.61,tint(C.plinth,.89));
    mesh.box(x,(roofBase+.50)/2,z,naveW,roofBase-.50,naveD,C.chapel,0,M.CHAPEL_STONE);
    roof(mesh,x,z,roofBase,roofD,roofW,rise,tint(C.slate,.96),s.winter,Math.PI/2,0);
    chapelApse(mesh,x,z-naveD/2+.17,s,glass);
    for(const side of [-1,1]) {
      const flank=x+side*7.31,angle=side*Math.PI/2,eave=5.23;
      const aisleFront=front-.30,aisleBack=z-9.75;
      mesh.box(x+side*6.08,(eave+.5)/2,(aisleFront+aisleBack)/2,2.46,eave-.50,aisleFront-aisleBack,C.chapel,0,M.CHAPEL_STONE);
      const eaveX=flank+side*.20,inner=x+side*(naveW/2-.06),slope=6.48;
      mesh.face([[eaveX,eave,aisleBack-.16],[eaveX,eave,aisleFront+.14],
        [inner,slope,aisleFront+.14],[inner,slope,aisleBack-.16]],
        s.winter?C.snow:tint(C.lighterSlate,.80),s.winter?M.SIMPLE:M.SLATE,true,
        [[0,0],[19.5,0],[19.5,2.8],[0,2.8]]);
      mesh.beam([eaveX,eave-.035,aisleBack-.17],[eaveX,eave-.035,aisleFront+.15],.16,.16,tint(C.darkStone,.88));
      for(const end of [-1,1]) {
        const wall=end===1?aisleFront:aisleBack;
        const gable=[[x+side*naveW/2,eave,wall],[flank,eave,wall],[inner,slope,wall]];
        mesh.face(side===end?gable:gable.reverse(),C.chapel,M.CHAPEL_STONE);
        mesh.rod([eaveX,eave,wall+end*.17],[inner,slope,wall+end*.17],.078,.070,s.winter?C.snow:trim,6);
      }
      for(const dz of [-6.98,-2.38,2.22,6.82]) {
        window(mesh,flank,1.24,z+dz,1.35,3.48,angle,{arch:"point",frame:trim,color:glass});
        window(mesh,x+side*naveW/2,6.63,z+dz,1.62,1.89,angle,{arch:"point",frame:trim,color:tint(glass,1.18)});
        mesh.box(x+side*naveW*.505,7.58,z+dz+2.28,.14,1.92,.24,trim);
      }
      for(const dz of [-9.22,-4.68,-.08,4.51,9.12]) {
        chapelButtress(mesh,flank,z+dz,angle,4.15,s);
      }
      const p=local(x+side*3.42,1.28,front);
      archedPane(mesh,p,.523,.62,0,2.55,.033,glass);
      archMolding(mesh,p,.525,.62,2.55,.12,.163,trim);
      for(const k of [-1,1]) mesh.box(...p(k*.598,1.28,.10),.138,2.56,.16,trim);
      mesh.box(...p(0,1.50,.081),.067,3,.084,trim);
      for(const dy of [1.85,2.16]) mesh.box(...p(0,dy,.082),1.06,.056,.073,trim);
      mesh.box(...p(0,-.07,.094),1.48,.15,.31,trim);
      chapelButtress(mesh,x+side*4.62,front,0,7.27,s);
      chapelButtress(mesh,x+side*6.91,aisleFront,0,4.88,s);
      for(const end of [-1,1]) {
        const rim=z+end*(roofD/2+.035);
        mesh.rod([x+side*roofW/2,roofBase-.07,rim],[x,roofBase+rise+.01,rim],
          .145,.113,s.winter?C.snow:trim,6);
        mesh.rod([x+side*(roofW/2-.14),roofBase+.103,rim], [x,roofBase+rise+.132,rim],
          .061,.046,s.winter?C.snow:tint(C.verdigris,.76),6);
      }
    }
    const portalFace=front+.81,half=2.20,peak=roofBase+rise;
    const shoulder=peak-rise*half/(roofW/2);
    mesh.box(x,(roofBase+.51)/2,front+.28,half*2,roofBase-.51,1.06,tint(C.chapel,1.018),0,M.CHAPEL_STONE);
    mesh.face([[x-half,roofBase,portalFace],[x+half,roofBase,portalFace],[x+half,shoulder,portalFace],
      [x,peak,portalFace],[x-half,shoulder,portalFace]],tint(C.chapel,1.018),M.CHAPEL_STONE);
    for(const side of [-1,1]) {
      const u=x+side*half;
      mesh.box(u,(shoulder+.61)/2,front+.51,.22,shoulder-.61,.58,C.chapel,0,M.CHAPEL_STONE);
      mesh.rod([u,shoulder,portalFace+.045],[x,peak,portalFace+.045],.12,.10,s.winter?C.snow:trim,6);
    }
    chapelPortal(mesh,x,portalFace,glass);
    chapelOculus(mesh,x,8.88,portalFace,1.085,tint(glass,.88));
    mesh.box(x,peak+.41,front,.125,.83,.125,C.iron);
    mesh.box(x,peak+.55,front,.71,.121,.13,C.iron);
    stair(mesh,x,front+3.14,5.66,4,.61,.49);
    mesh.box(x,.30,front+1.07,5.66,.60,.89,C.plinth,0,M.STONE);
  }

  function balustrade(mesh,a,b,s,n=10,base=0) {
    mesh.beam([a[0],base+1.48,a[2]],[b[0],base+1.48,b[2]],.16,.15,s.winter?C.snow:C.plaster);
    mesh.beam([a[0],base+.68,a[2]],[b[0],base+.68,b[2]],.15,.12,C.plaster);
    for(let i=0;i<=n;i++) {
      const x=lerp(a[0],b[0],i/n),z=lerp(a[2],b[2],i/n);
      mesh.column(x,z,base+.73,base+.91,.075,.108,C.plaster,6,M.SIMPLE,false);
      mesh.column(x,z,base+.91,base+1.20,.108,.047,C.plaster,6,M.SIMPLE,false);
      mesh.column(x,z,base+1.20,base+1.43,.047,.075,C.plaster,6,M.SIMPLE,false);
    }
  }

  function verandaWindow(mesh,x,z,w,angle,lit) {
    const p=local(x,5.39,z,angle),frame=C.plaster,r=w*.445;
    const glass=lit?rgb(0xcfbd94):rgb(0x8fadb3);
    const bar=(u,v,width,height,d=.10)=>mesh.box(...p(u,v,d),width,height,.09,frame,angle,M.SIDING);
    mesh.box(...p(0,-.40,.034),w-.072,.76,.16,tint(frame,.85),angle,M.WOOD);
    mesh.box(...p(0,-.412,.126),w-.216,.55,.063,tint(frame,.94),angle,M.WOOD);
    for(const y of [-.664,-.158]) bar(0,y,w-.188,.048,.172);
    for(const side of [-1,1]) bar(side*(w/2-.103),-.413,.049,.53,.172);
    archedPane(mesh,p,r+.047,.34,.014,2.30,.042,tint(C.timber,.90),M.SIMPLE);
    archedPane(mesh,p,r,.32,.081,2.30,.068,glass,lit?M.LIT:M.WINDOW);
    archMolding(mesh,p,r,.32,2.30,.11,.131,frame);
    for(const side of [-1,1]) bar(side*(r+.044),1.17,.11,2.32);
    for(const y of [.055,.63,1.29,2.297]) bar(0,y,2*r+.19,y>2.2?.125:.071);
    const divisions=w>2.1?[-.60,-.30,0,.30,.60]:[0];
    for(const f of divisions) {
      const hi=2.30+.32*Math.sqrt(1-f*f);
      bar(r*f,(hi+.08)/2,.058,hi-.08);
    }
  }

  function rokkaenVeranda(mesh,x,z,w,d,s) {
    const wall=z+d/2,front=wall+2.0,left=x-.45-w/2,step=w/8;
    const stations=[[0,0],[1,0],[2,0],[3,0],[4,0],[4.33,.88],[5.55,.88],[6.82,.88],[7.68,.88],[8,0]]
      .map(([i,advance])=>[left+i*step,0,front+advance]);
    for(const [u,,v] of stations) {
      mesh.box(u,.72,v,.42,.23,.40,C.plaster);
      mesh.box(u,2.31,v,.243,3.04,.239,C.plaster,0,M.WOOD);
      for(const [y,width,height] of [[.88,.31,.11],[3.87,.33,.13],[4.19,.43,.23],[4.94,.27,.75],[6.8,.18,2.94]]) {
        mesh.box(u,y,v,width,height,width,C.plaster);
      }
      mesh.box(u,8.15,v,.29,.22,.30,C.plaster);
    }
    for(let i=1;i<stations.length;i++) {
      const a=stations[i-1],b=stations[i],span=Math.hypot(b[0]-a[0],b[2]-a[2]);
      const angle=-Math.atan2(b[2]-a[2],b[0]-a[0]),entry=i===4;
      const [u,,v]=a.map((q,j)=>(q+b[j])/2),p=local(u,0,v,angle);
      const floorZ=wall-.1;
      const [ax,,az]=p(-span/2,.6,.21),[bx,,bz]=p(span/2,.6,.21);
      mesh.face([[ax,.60,az],[bx,.60,bz],[b[0],.60,floorZ],[a[0],.60,floorZ]],C.plaster,M.PAVERS,true);
      mesh.face([[ax,.08,az],[bx,.08,bz],[bx,.60,bz],[ax,.60,az]],C.plinth,M.STONE);
      mesh.beam([ax,.56,az],[bx,.56,bz],.17,.16,tint(C.plaster,.92));
      for(const [y,h,depth,color] of [[4.29,.14,.37,C.plaster],[4.61,.12,.30,C.plaster],
        [5.34,.13,.19,C.plaster],[8.22,.14,.28,C.plaster],[8.42,.14,.45,C.plaster]]) {
        mesh.box(...p(0,y,.035),span+.074,h,depth,color,angle);
      }
      const eave=[[4.305,.43],[4.37,.20],[4.52,-.05],[4.70,-.22]];
      for(let k=1;k<eave.length;k++) {
        const [y0,z0]=eave[k-1],[y1,z1]=eave[k];
        mesh.face([p(-span/2,y0,z0),p(span/2,y0,z0),p(span/2,y1,z1),p(-span/2,y1,z1)],
          s.winter?C.snow:tint(C.lighterSlate,.984),s.winter?M.SIMPLE:M.METAL_ROOF,true,
          [[0,k-1],[span,k-1],[span,k],[0,k]]);
      }
      mesh.box(...p(0,4.288,.399),span+.07,.084,.113,tint(C.plaster,.91),angle);
      mesh.face([[a[0],8.49,a[2]+.25],[b[0],8.49,b[2]+.25],[b[0],8.86,floorZ],[a[0],8.86,floorZ]],
        s.winter?C.snow:tint(C.lighterSlate,.92),s.winter?M.SIMPLE:M.SLATE,true,
        [[0,0],[span,0],[span,2.2],[0,2.2]]);
      for(const dir of [-1,1]) {
        const u=dir*span/2,reach=Math.min(span*.30,.66);
        const root=p(u,4.27,.10),curve=(i)=> {
          const t=i*Math.PI/12;
          return p(u-dir*reach*(1-Math.cos(t)),3.68+.59*Math.sin(t),.10);
        };
        for(let k=0;k<6;k++) mesh.triangle([root,curve(k),curve(k+1)],C.plaster,M.WOOD);
      }
      if(!entry) balustrade(mesh,a,b,s,Math.max(3,Math.round(span/.33)));
      verandaWindow(mesh,u,v,span,angle,s.winter&&i%4!==0);
      window(mesh,u,entry?.61:1.51,wall,entry?1.79:Math.min(1.66,span*.75),entry?3.31:2.46,0,
        {door:entry,lit:s.winter,color:s.winter?C.amber:C.glass});
      if(entry) stair(mesh,u,v+1.55,span-.10,4,.61,.42);
    }
    for(const side of [-1,1]) {
      const [u,,v]=stations[side<0?0:stations.length-1],mid=(v+wall)/2;
      mesh.box(u,.323,mid,.20,.56,v-wall+.38,C.plinth,0,M.STONE);
      for(const y of [4.29,4.63,5.33,8.42]) mesh.box(u,y,mid,.28,.16,v-wall+.35,C.plaster);
      verandaWindow(mesh,u,mid,v-wall+.06,side*Math.PI/2,s.winter);
      balustrade(mesh,[u,0,wall],[u,0,v],s,6);
    }
  }

  function rokkaenResidence(mesh,s) {
    const [x,z]=position.rokkaen,w=27.5,d=13.1;
    plinth(mesh,x,z,29.0,14.8,.60);
    mesh.box(x,4.58,z,w,8.37,d,C.clapboard,0,M.SIDING);
    for(const y of [1.04,4.36,8.58]) mesh.box(x,y,z,w+.32,.16,d+.28,C.plaster);
    roof(mesh,x,z,8.84,w+1.05,d+1.40,2.45,tint(C.slate,1.03),s.winter,0,.19);
    chimney(mesh,x+7.45,10.6,z-1.62,1.11);
    chimney(mesh,x-8.12,10.59,z-.54,1.04);
    rokkaenVeranda(mesh,x,z,23.25,d,s);
    for(const side of [-1,1]) {
      const u=x+side*w/2;
      for(const y of [1.53,5.18]) for(const dz of [-4.25,.02,4.25]) {
        if(side===1&&y<2&&dz===.02) continue;
        const lit=s.winter&&dz>=0;
        window(mesh,u,y,z+dz,1.95,2.72,side*Math.PI/2,{arch:"round",lit,color:lit?C.amber:C.glass});
      }
      mesh.box(u,4.56,z+d/2,.36,8.25,.45,C.plaster);
    }
    const east=x+w/2,portico=east+1.87;
    window(mesh,east,.53,z,2.21,3.54,Math.PI/2,{door:true,frame:C.plaster});
    mesh.box(east+.91,.292,z,2.18,.58,3.63,C.plinth,0,M.STONE);
    mesh.box(east+.95,4.25,z,2.36,.33,3.86,C.plaster,0,M.WOOD);
    for(const k of [-1,1]) {
      mesh.box(portico,2.38,z+k*1.69,.24,3.66,.23,C.plaster);
      mesh.box(portico,4.86,z+k*1.69,.26,.89,.26,C.plaster);
      balustrade(mesh,[east,0,z+k*1.69],[portico,0,z+k*1.69],s,6,3.64);
    }
    balustrade(mesh,[portico,0,z-1.69],[portico,0,z+1.69],s,10,3.64);
    for(let i=0;i<8;i++) {
      const u=x+16.24+.18*Math.sin(i*.63),v=z+6.69-i*.735;
      mesh.box(u,.027,v,.86+.07*Math.cos(i*2.31),.075,.54,tint(s.winter?C.snow:C.flagstone,.91+.075*Math.cos(i*.97)),.09*Math.sin(i*.9),M.PAVERS);
    }
    for(const y of [1.36,5.18]) for(let i=-4;i<=4;i++) {
      window(mesh,x+i*2.76,y,z-d/2,1.52,2.54,Math.PI,{color:C.glass});
    }
    const tx=x-10.35,tz=z-7.0,r=3.49;
    mesh.column(tx,tz,.43,12.18,r,r*.975,C.clapboard,26,M.SIDING);
    for(const h of [.75,3.18,6.16,9.18,11.96]) mesh.column(tx,tz,h,h+.24,r+.10,r+.12,C.plaster,27);
    for(const y of [1.12,3.66,6.65,9.66]) for(let i=0;i<10;i++) {
      const a=i*TAU/10,lit=s.winter&&i%3!==0;
      window(mesh,tx+r*Math.sin(a),y,tz+r*Math.cos(a),1.20,2.08,a,
        {arch:y>9?"round":null,lit,color:lit?C.amber:C.glass,frame:C.plaster});
    }
    const dome=[[12.16,3.84],[12.52,3.73],[13.18,3.06],[13.77,1.92],[14.21,.74],[14.42,.10]];
    for(let i=1;i<dome.length;i++) {
      mesh.column(tx,tz,dome[i-1][0],dome[i][0],dome[i-1][1],dome[i][1],s.winter&&i>2?C.snow:C.slate,26,M.SLATE);
    }
    mesh.column(tx,tz,14.39,14.88,.15,.044,C.iron,8);
    const [u,v]=rokkaenAnnexOffset,annexX=x+u,annexZ=z+v;
    plinth(mesh,annexX,annexZ,12.9,8.20,.54);
    mesh.box(annexX,2.31,annexZ,12.5,3.66,7.68,C.timber,0,M.WOOD);
    roof(mesh,annexX,annexZ,4.21,13.5,8.68,1.72,tint(C.slate,.87),s.winter);
    const sill=annexZ+3.92;
    for(const y of [.87,1.10,3.81]) mesh.box(annexX,y,sill,12.66,.116,.19,tint(C.oak,1.035),0,M.WOOD);
    for(let i=0;i<=4;i++) mesh.box(annexX-5.94+i*2.90,2.28,sill,.127,3.14,.185,tint(C.timber,.82),0,M.WOOD);
    for(let i=0;i<4;i++) {
      window(mesh,annexX-4.49+i*2.89,1.14,annexZ+3.86,2.47,2.53,0,{
        frame:C.oak,lit:s.winter,color:s.winter?C.amber:C.paleGlass
      });
    }
  }

  function dormitory(mesh,s,[x,z]) {
    const [w,d]=dormitorySize,front=z+d/2;
    plinth(mesh,x,z,w+.48,d+.42,.56);
    mesh.box(x,4.02,z,w,7.02,d,C.clapboard,0,M.SIDING);
    for(const h of [.83,3.75,7.58]) mesh.box(x,h,z,w+.23,.19,d+.28,C.plaster);
    roof(mesh,x,z,7.70,w+1,d+.92,2.13,C.slate,s.winter,0,.2);
    chimney(mesh,x-4.4,9.1,z-1.7,.97);
    for(const side of [-1,1]) {
      for(const y of [1.08,4.45]) for(const dx of [-6.08,-3.02,0,3.02,6.08]) {
        if(side===1 && y<2 && dx===0) continue;
        window(mesh,x+dx,y,z+side*d/2,1.67,2.22,side===1?0:Math.PI,
          {arch:"round",lit:s.winter && dx>=0,frame:C.plaster});
      }
      for(const y of [1.08,4.45]) for(const dz of [-2.78,2.78]) {
        window(mesh,x+side*w/2,y,z+dz,1.74,2.22,side*eastFacing,{arch:"round",frame:C.plaster});
      }
    }
    const deck=front+1.12;
    plinth(mesh,x,deck,12.65,2.31,.54);
    mesh.box(x,3.72,deck,12.68,.23,2.35,C.plaster,0,M.WOOD);
    mesh.box(x,3.66,deck+1.19,12.77,.105,.14,tint(C.sandstone,.97));
    mesh.box(x,3.83,deck+1.20,12.78,.088,.19,s.winter?C.snow:C.plaster);
    window(mesh,x,.49,front,1.62,2.91,0,{door:true,frame:C.plaster});
    for(const dx of [-6,-3.15,3.15,6]) {
      mesh.box(x+dx,2.07,deck+.96,.20,3.1,.20,C.plaster);
      mesh.box(x+dx,.72,deck+.96,.38,.39,.38,C.sandstone);
      mesh.box(x+dx,3.43,deck+.96,.37,.23,.37,C.plaster);
      for(const side of [-1,1]) {
        if(dx*side>5.0) continue;
        mesh.rod([x+dx,3.14,deck+.97],[x+dx+side*.49,3.61,deck+.97],.066,.047,tint(C.plaster,.93),6);
      }
    }
    for(const side of [-1,1]) {
      balustrade(mesh,[x+side*1.85,0,deck+1.03],[x+side*6.05,0,deck+1.03],s,8,.50);
    }
    balustrade(mesh,[x-6.05,0,deck+1.03],[x+6.05,0,deck+1.03],s,20,3.65);
    stair(mesh,x,front+2.79,3.13,3,.55);
  }

  function pavilion(mesh,s) {
    const [x,z]=position.pavilion;
    const corners=[[-2.56,-3.50],[2.56,-3.50],[4.22,-1.87],[4.22,1.87],
      [2.56,3.50],[-2.56,3.50],[-4.22,1.87],[-4.22,-1.87]];
    const corner=(i,scale,h)=>{
      const [u,v]=corners[i%corners.length];
      return [x+u*scale,h,z+v*scale];
    };
    const band=(lo,hi,r0,r1,color,material=0,up=false)=>{
      for(let i=0;i<corners.length;i++) {
        mesh.face([corner(i+1,r0,lo),corner(i,r0,lo),corner(i,r1,hi),corner(i+1,r1,hi)],color,material,up);
      }
    };
    const frame=mix(C.chapelTrim,C.paleGlass,.25),recess=tint(frame,.83);
    band(0,.30,1.14,1.14,C.plinth,M.STONE);
    band(.30,.66,1.075,1.075,C.chapelTrim,M.STONE);
    mesh.face(corners.map((_,i)=>corner(i,1.075,.66)),C.plaster,M.PAVERS,true);
    stair(mesh,x,z+5.12,4.83,4,.68,.38);
    for(let i=0;i<4;i++) {
      const h=.66*(i+1)/4;
      mesh.box(x-5.90+i*.43,h/2,z,.49,h,3.28,C.plinth,0,M.STONE);
    }
    for(let i=0;i<corners.length;i++) {
      const [u,,v]=corner(i,.96,0);
      mesh.box(u,1.09,v,.67,.72,.67,frame);
      for(const [y,w,h] of [[.73,.83,.15],[1.45,.77,.18],[1.55,.65,.12],[4.93,.68,.16]]) {
        mesh.box(u,y,v,w,h,w,frame);
      }
      for(let side=0;side<4;side++) {
        const angle=side*Math.PI/2,p=local(u,0,v,angle);
        mesh.box(...p(0,1.10,.343),.46,.54,.032,recess,angle);
        const panel=[[-.14,-.21],[.14,-.21],[.20,-.14],[.20,.14],[.14,.21],[-.14,.21],[-.20,.14],[-.20,-.14]];
        mesh.face(panel.map(([x,y])=>p(x,1.10+y,.365)),frame);
        mesh.face(panel.map(([x,y])=>p(x*.78,1.10+y*.79,.381)),tint(frame,.88));
      }
      mesh.column(u,v,1.60,4.65,.232,.196,frame,16);
      mesh.column(u,v,4.64,4.88,.198,.325,frame,12);
      for(const y of [1.59,1.74,4.56,4.78]) mesh.column(u,v,y,y+.095,.255,.249,frame,12);
      for(let j=0;j<8;j++) {
        const t=j*TAU/8,c=Math.cos(t),q=Math.sin(t);
        mesh.rod([u+.226*c,1.80,v+.226*q],[u+.192*c,4.57,v+.192*q],.028,.022,
          tint(frame,1.05),5,M.SIMPLE,false);
      }
      const a=corner(i,.96,0),b=corner(i+1,.96,0);
      const length=Math.hypot(a[0]-b[0],a[2]-b[2]);
      const along=(t,y)=>[lerp(a[0],b[0],t),y,lerp(a[2],b[2],t)];
      const cells=Math.round(length/.54);
      for(let j=0;j<cells;j++) {
        mesh.rod(along(j/cells,5.03),along((j+1)/cells,5.37),.041,.041,frame,5,M.SIMPLE,false);
        mesh.rod(along(j/cells,5.37),along((j+1)/cells,5.03),.041,.041,frame,5,M.SIMPLE,false);
      }
      if(i===4||i===6) continue;
      mesh.beam(along(0,.76),along(1,.76),.15,.15,frame);
      mesh.beam(along(0,1.58),along(1,1.58),.21,.13,frame);
      for(let j=0;j<cells;j++) {
        const [u,,v]=along((j+.5)/cells,0);
        mesh.column(u,v,.80,1.54,.070,.057,frame,6,M.SIMPLE,false);
        mesh.rod(along(j/cells,1.51),along((j+1)/cells,1.18),.052,.047,frame,5,M.SIMPLE,false);
        mesh.rod(along(j/cells,.83),along((j+1)/cells,1.18),.048,.047,frame,5,M.SIMPLE,false);
      }
    }
    band(4.94,5.06,1.015,1.035,frame);
    band(5.32,5.42,1.035,1.05,frame);
    band(5.36,5.51,1.10,1.10,tint(C.plaster,.88),M.STONE);
    const oxidized=tint(C.verdigris,.94);
    band(5.49,5.56,1.131,1.117,tint(oxidized,.82));
    band(5.50,5.77,1.11,1.06,oxidized,0,true);
    band(5.77,6.69,1.06,.59,s.winter?C.snow:oxidized,0,true);
    band(6.69,7.33,.59,.068,s.winter?C.snow:tint(C.verdigris,1.10),0,true);
    for(let i=0;i<corners.length;i++) {
      const cap=s.winter?C.snow:tint(C.verdigris,.79);
      mesh.rod(corner(i,1.06,5.78),corner(i,.59,6.70),.049,.043,cap,6);
      mesh.rod(corner(i,.59,6.7),corner(i,.068,7.333),.043,.035,cap,6);
      mesh.rod(corner(i,1.128,5.58),corner(i,1.151,5.90),.062,.020,cap,6);
      if(!s.winter) for(const t of [1/3,2/3]) {
        const seam=(scale,h)=>corner(i,scale,h).map((v,k)=>lerp(v,corner(i+1,scale,h)[k],t));
        const edge=seam(1.11,5.521),lip=seam(1.06,5.787),knee=seam(.59,6.706);
        mesh.rod(edge,lip,.024,.023,cap,5,M.SIMPLE,false);
        mesh.rod(lip,knee,.023,.022,cap,5,M.SIMPLE,false);
        mesh.rod(knee,seam(.068,7.347),.022,.019,cap,5,M.SIMPLE,false);
      }
    }
    mesh.column(x,z,7.29,7.56,.26,.12,tint(oxidized,.83),8);
    mesh.column(x,z,7.30,7.94,.151,.024,C.iron,9);
    const front=z+3.90,apex=[x,6.29,front];
    mesh.face([[x-2.67,5.36,front],[x+2.67,5.36,front],apex],C.chapelTrim,M.STONE);
    for(const dir of [-1,1]) mesh.rod([x+dir*2.75,5.37,front+.018],apex,.081,.071,s.winter?C.snow:C.plaster,6);
    mesh.beam([x-2.78,5.37,front+.014],[x+2.78,5.37,front+.014],.14,.117,C.plaster);
    mesh.box(x,.96,z-2.02,3.44,.16,.58,C.oak,0,M.WOOD);
    for(const side of [-1,1]) mesh.box(x+side*1.23,.76,z-2.02,.15,.22,.45,tint(C.oak,.86),0,M.WOOD);
    mesh.column(x+.92,z-.44,.68,1.39,.15,.108,C.iron,9);
    mesh.column(x+.92,z-.44,1.36,1.47,.67,.65,tint(C.oak,1.06),10,M.WOOD);
    for(let i=0;i<3;i++) {
      const t=i*TAU/3;
      mesh.rod([x+.92,.96,z-.44],[x+.92+.47*Math.cos(t),.69,z-.44+.47*Math.sin(t)],.088,.052,C.iron,6);
    }
  }

  function greenhouse(mesh,s,at,size,isNursery=false) {
    const [x,z]=at,[w,d,top,ridge]=size;
    const frame=mix(C.verdigris,C.plaster,isNursery?.36:.65);
    const support=mix(frame,C.iron,.23);
    plinth(mesh,x,z,w+.40,d+.40,.56);
    mesh.box(x,.565,z,w-.1,.101,d-.07,isNursery?tint(C.palePath,.89):rgb(0xa6b489),0,isNursery?M.PAVERS:M.SOIL);
    stair(mesh,x,z+d/2+.95,isNursery?2.15:2.58,3,.61,.365);
    const n=Math.round(w/2.4);
    for(let i=0;i<=n;i++) {
      const u=x-w/2+i*w/n;
      if(i%2===0||i===n) {
        mesh.beam([u,top-.09,z-d/2],[u,top-.09,z+d/2],.079,.083,support);
        mesh.rod([u,top-.089,z],[u,top+ridge,z],.043,.051,support,6);
      }
      for(const side of [-1,1]) {
        const v=z+side*d/2;
        mesh.column(u,v,.57,top,i%2?.055:.077,.066,support,7);
        mesh.rod([u,top,v],[u,top+ridge,z],.076,.071,frame,6);
        if(i%2===0||i===n) {
          mesh.rod([u,top-.09,z],[u,top+ridge*.57,z+side*d*.215],.043,.047,support,6);
          mesh.rod([u,top-.60,v],[u,top-.087,z+side*d*.34],.041,.042,support,6);
        }
        if(i===n) continue;
        const a=u+w/n;
        mesh.face([[u,.69,v],[a,.69,v],[a,top,v],[u,top,v]],
          tint(C.paleGlass,.93+.07*Math.sin(i*3.2)),M.GLASS);
        mesh.face([[u,top,v],[a,top,v],[a,top+ridge,z],[u,top+ridge,z]],C.paleGlass,M.GLASS,true);
        mesh.rod([u,top,v],[a,top+ridge,z],.039,.035,frame,5);
        const rows=isNursery?[.5]:[1/3,2/3];
        for(const fraction of rows) {
          const pane=z+side*d*.5*(1-fraction),roofY=top+ridge*fraction;
          mesh.beam([u,roofY,pane],[a,roofY,pane],.067,.063,frame);
        }
      }
    }
    for(const side of [-1,1]) {
      const u=x+side*w/2,v=z+side*d/2;
      for(const h of [.69,2.26,top-.53,top]) mesh.beam([x-w/2,h,v],[x+w/2,h,v],.097,.090,frame);
      mesh.face([[u,.63,z-d/2],[u,top,z-d/2],[u,top+ridge,z],[u,top,z+d/2],[u,.63,z+d/2]],C.paleGlass,M.GLASS);
      for(let i=-2;i<=2;i++) {
        const zz=z+i*d/5;
        mesh.column(u,zz,.56,top+ridge*(1-Math.abs(i)*.4),.046,.050,frame,6);
      }
      for(const h of [2.26,top,top+ridge*.44]) {
        const half=d*.5*(1-Math.max(0,h-top)/ridge);
        mesh.beam([u,h,z-half],[u,h,z+half],.088,.084,support);
      }
      const rim=v+side*.035;
      for(const p of [-1.06,0,1.06]) mesh.column(x+p,rim,.6,top-.54,.074,.073,support,7);
      for(const y of [.63,1.87,3.18,top-.54]) mesh.beam([x-1.14,y,rim],[x+1.14,y,rim],.096,.085,frame);
      for(const p of [-.15,.15]) mesh.box(x+p,1.76,rim+side*.04,.078,.094,.10,C.brick);
      for(const post of [-.21,.21]) {
        mesh.box(x+post,1.70,rim+side*.105,.064,.29,.082,tint(C.oak,1.09));
      }
    }
    mesh.beam([x-w/2,top+ridge,z],[x+w/2,top+ridge,z],.13,.14,s.winter?C.snow:frame);
    greenhouseBeds(mesh,x,z,w,d,isNursery);
    if(!isNursery) {
      const tx=x+w*.23,tz=z+.36,floor=.81;
      for(let i=0;i<12;i++) {
        mesh.box(tx+(i-5.5)*.413,.71,tz,.40,.20,3.30,tint(C.oak,1.12+.072*Math.sin(i*2.27)),0,M.WOOD);
      }
      mesh.box(tx,.735,tz+1.65,5.03,.16,.09,tint(C.oak,.83),0,M.WOOD);
      mesh.column(tx,tz,floor,floor+.83,.11,.079,C.plaster,8);
      mesh.column(tx,tz,floor+.81,floor+.90,.89,.89,C.plaster,8);
      for(let i=0;i<3;i++) {
        const a=i*TAU/3;
        mesh.rod([tx,floor+.24,tz],[tx+.48*Math.cos(a),floor+.035,tz+.48*Math.sin(a)],.063,.035,C.plaster,6);
      }
      for(const side of [-1,1]) {
        const u=tx+side*1.38;
        mesh.box(u,floor+.38,tz,.53,.077,.50,C.plaster);
        const back=u+side*.218;
        for(const v of [-.22,.22]) mesh.column(back,tz+v,floor+.37,floor+.91,.038,.036,C.plaster,7);
        for(const level of [.54,.72,.92]) {
          mesh.rod([back,floor+level,tz-.219],[back+side*.042,floor+level+.04,tz],.027,.026,C.plaster,6);
          mesh.rod([back+side*.042,floor+level+.04,tz],[back,floor+level,tz+.219],.026,.027,C.plaster,6);
        }
        for(const dx of [-.16,.16]) for(const dz of [-.17,.17]) mesh.box(u+dx,floor+.18,tz+dz,.055,.36,.055,C.plaster);
      }
      for(let i=0;i<13;i++) {
        mesh.oval(tx-2.35+i*.385,1.17,tz-1.91,.30,.59,.32,rgb(0x6c8860),7,3,i);
      }
    }
  }
  function greenhouseBeds(mesh,x,z,w,d,isNursery) {
    const leaf=rgb(0x648451),flower=[0xce81ad,0xdd9eae,0xb38ac2,0xf0cbd5].map(rgb);
    const rand=random(isNursery?83812:27471);
    const wide=w*(isNursery ? .382 : .372),deep=d*.227;
    for(const side of [-1,1]) for(const row of [-1,1]) {
      const u=x+side*w*.251,v=z+row*d*.321;
      mesh.box(u,.777,v,wide,.31,deep,isNursery?tint(C.oak,.92):tint(C.brick,.85),0,isNursery?M.WOOD:M.STONE);
      if(!isNursery) mesh.box(u,.946,v,wide+.072,.073,deep+.078,tint(C.sandstone,.86),0,M.PAVERS);
      mesh.box(u,.953,v,wide-.19,.09,deep-.17,C.mulch,0,M.SOIL);
      const count=Math.max(4,Math.round(wide/.72));
      for(let i=0;i<count;i++) for(const band of [-1,1]) {
        const r=.46+rand()*.23,t=u-wide/2+(i+.53)*wide/count,depth=v+band*(deep*.27+rand()*.10);
        const h=.46+rand()*.78+(row<0&&!isNursery ? .39 : 0);
        mesh.oval(t,1.0+h*.39,depth,r,h*.56,deep*.256,tint(leaf,.86+.27*rand()),8,4,i+band);
        if(rand()>.19&&!isNursery) {
          mesh.oval(t+.20*(rand()-.5),1.0+h*.90,depth+.14*(rand()-.5),.36,.27,.33,flower[(i+band+5)%4],8,3,i);
        }
      }
      if(row===1&&!isNursery) {
        const edge=v-deep*.5-.20;
        for(const h of [.82,1.19]) mesh.beam([u-wide/2,h,edge],[u+wide/2,h,edge],.066,.058,C.plaster);
        for(let i=0;i<=count*2;i++) {
          const post=u-wide/2+i*wide/(count*2);
          mesh.box(post,.95,edge,.076,.74,.065,C.plaster);
        }
      }
    }
    if(isNursery) return;
    path(mesh,[[x,z+d*.5],[x-.64,z+2.7],[x-.89,z+.74],[x-2.8,z-.22],[x-6.8,z-.14]],
      1.64,.630,tint(C.gardenPaving,1.03));
    for(const side of [-1,1]) {
      const t=x+side*w*.39,v=z-d*.053;
      for(const offset of [-.84,.84]) mesh.column(t,v+offset,.61,3.37,.040,.044,C.verdigris,7);
      for(const y of [1.10,1.63,2.22,2.84,3.36]) mesh.beam([t-.05,y,v-.88],[t-.05,y,v+.88],.061,.065,C.verdigris);
      for(let i=0;i<4;i++) for(let j=0;j<3;j++) {
        const y=1.1+i*.56,zz=v-.84+j*.56;
        mesh.rod([t-.03,y,zz],[t-.03,y+.56,zz+.56],.032,.032,C.oak,5,M.WOOD,false);
        mesh.rod([t-.03,y+.56,zz],[t-.03,y,zz+.56],.032,.032,C.oak,5,M.WOOD,false);
      }
      for(let i=0;i<18;i++) {
        const u=t+(.51*rand()-.25),v2=v+(rand()*2-1)*.86,h=.83+rand()*2.48;
        mesh.oval(u,h,v2,.38,.38,.36,tint(leaf,.79+rand()*.24),7,3,i);
        if(rand()>.36) mesh.oval(u-.26,h+.19,v2,.24,.24,.23,flower[(i+(side+1))%4],6,3,i);
      }
    }
    for(const [dx,dz] of [[1.65,3.37],[1.13,2.04],[-.22,1.04],[-8.51,1.67]]) {
      const u=x+dx,v=z+dz;
      mesh.column(u,v,.61,1.11,.24,.36,C.brick,9,M.STONE);
      mesh.column(u,v,1.10,1.19,.39,.39,tint(C.brick,1.11),9);
      mesh.oval(u,1.28,v,.38,.29,.38,leaf,8,4,dx);
      for(let i=0;i<4;i++) {
        const t=i*TAU/4;
        mesh.oval(u+.23*Math.cos(t),1.46+.07*Math.cos(i*2.1),v+.23*Math.sin(t),
          .185,.13,.174,flower[i],7,3,i);
      }
    }
  }

  function cottage(mesh, at, size, s, color=C.timber) {
    const [x,z]=at,[w,d,h]=size;
    plinth(mesh,x,z,w+.30,d+.29,.43);
    mesh.box(x,h/2+.31,z,w,h,d,color,0,M.WOOD);
    roof(mesh,x,z,h+.38,w+.74,d+.69,h*.52,C.slate,s.winter,0,.1);
    const front=z+d/2;
    window(mesh,x,.46,front,w*.25,h*.81,0,{door:true,frame:C.oak});
    for(const side of [-1,1]) {
      window(mesh,x+side*w*.325,.94,front,w*.19,h*.56,0,{
        frame:C.plaster,color:s.winter?C.amber:C.glass,lit:s.winter
      });
    }
    chimney(mesh,x+w*.29,h+.90,z-.15,.72);
  }
  function rabbitHutch(mesh,s) {
    const [x,z]=position.rabbits,w=6.75,d=3.85,front=z+d/2;
    plinth(mesh,x,z,w+.34,d+.30,.35);
    mesh.box(x,1.53,z,w,2.52,d,C.oak,0,M.WOOD);
    const points=[[x-w*.57,3.63,z-d*.61],[x+w*.57,3.63,z-d*.61],
      [x+w*.57,3.0,front+.36],[x-w*.57,3.0,front+.36]];
    mesh.face(points,s.winter?C.snow:C.timber,s.winter?0:M.SLATE,true);
    mesh.beam([points[3][0],2.97,points[3][2]],[points[2][0],2.97,points[2][2]],.23,.19,C.oak,M.WOOD);
    for(const side of [-1,1]) {
      mesh.box(x+side*w*.489,1.65,front+.067,.165,2.64,.18,tint(C.oak,1.15),0,M.WOOD);
      mesh.box(x+side*w*.501,.58,z,.068,.32,d,C.oak,0,M.WOOD);
    }
    for(let i=-1;i<=1;i++) {
      const u=x+i*2.04;
      mesh.box(u,1.63,front+.03,1.89,1.9,.05,tint(C.iron,.69));
      for(const a of [-.985,.985]) mesh.box(u+a,1.63,front+.10,.106,2.03,.11,C.oak,0,M.WOOD);
      for(const y of [.66,2.59]) mesh.box(u,y,front+.11,1.94,.10,.12,C.oak,0,M.WOOD);
      for(let j=1;j<=9;j++) mesh.box(u-.96+j*.19,1.63,front+.095,.018,1.89,.027,C.lead);
      for(let j=1;j<=7;j++) mesh.box(u,.65+j*.241,front+.101,1.87,.016,.024,C.lead);
      mesh.box(u+.87,1.48,front+.18,.18,.096,.091,C.iron);
      for(const y of [.86,2.38]) mesh.box(u-.89,y,front+.164,.13,.15,.088,C.iron);
    }
  }
  function clubHouse(mesh,s) {
    const [x,z]=position.club,w=14.7,d=7.1,wall=6.17;
    plinth(mesh,x,z,w+.32,d+.34,.47);
    mesh.box(x,wall/2+.29,z,w,wall,d,tint(C.sandstone,.95),0,M.ASHLAR);
    for(const y of [.72,3.52,6.48]) mesh.box(x,y,z,w+.26,.22,d+.25,C.limestone);
    mesh.box(x,6.64,z,w+.55,.37,d+.52,s.winter?C.snow:C.plaster,0,M.STONE);
    mesh.box(x,6.86,z,w-.59,.12,d-.59,s.winter?C.snow:C.darkStone,0,M.SLATE);
    for(const side of [-1,1]) {
      const edge=z+side*d/2;
      for(const y of [1.03,4.05]) for(const u of [-5.62,-2.81,0,2.81,5.62]) {
        if(side===1 && y<2 && u===0) continue;
        window(mesh,x+u,y,edge,1.7,1.94,side===1?0:Math.PI,{lit:s.winter && u<2,frame:C.plaster});
      }
      for(const dz of [-1.61,1.61]) for(const y of [1.03,4.05]) {
        window(mesh,x+side*w/2,y,z+dz,1.54,1.94,side*eastFacing,{frame:C.plaster});
      }
    }
    window(mesh,x,.32,z+d/2,1.85,2.59,0,{door:true,frame:C.oak});
    stair(mesh,x,z+d/2+.42,2.82,2,.35);
    mesh.box(x,3.08,z+d/2+.55,2.69,.15,1.48,s.winter?C.snow:C.lighterSlate,0,M.SLATE);
  }


  const dormitoryJunction=[-56.4,-28.2];
  const cherryWalk=[groundAt(gateLocal,0,18),groundAt(gateLocal,0,7),position.gate,groundAt(gateLocal,0,-3),
    [-70.1,-33.8],[-64,-28.9],dormitoryJunction,[-48,-30.2],[-35,-32.6],[-24,-29],[-19,-21],[-16,-12],[-10,1]];
  const lampWalk=[groundAt(gateLocal,0,11),[-88.1,-41],[-96.5,-33.7],[-102,-25.1],
    [-105.6,-13.8],[-105.8,2.7],[-101.8,20.6],[-96.3,37.8],[-86.4,48.8]];
  const cherryRow=[[-60.6,-24.6],[-48.1,-25.7],[-40.9,-27.8],[-33.9,-29.4],[-26.4,-24.7],[-22.3,-17.0],
    [-43.5,-34.6],[-27,-35.8],[-16.3,-27.0],[-11.5,-18.3]];
  const dormitoryEntries=dormitories.map(([x,z])=>[x,z+dormitorySize[1]/2+5]);
  const rokkaenWalk=[[-20.4,11.9],[-11.5,11.45],[0,11.55],[12.0,11.45],[16.8,7.65]].map(([u,v])=>groundAt(rokkaenLocal,u,v));
  const pavilionCourt=[position.pavilion[0],position.pavilion[1]+6.45*pavilionScale];
  const shoreJunction=[-6.3,41.9],rokkaenJunction=[25.8,45.4];
  const roseFlanks=[-1,1].map(side=>[garden.center[0],garden.center[1]+side*garden.radiusZ*1.015]);
  const farmCourt=[82.1,position.farm[1]],shedCorner=[85,10.8],shedPath=[84.3,16.5];
  const circulation=[
    {points:cherryWalk,width:4.6,material:M.PATH_EARTH},
    {points:lampWalk,width:2.61,material:M.PATH_GRAVEL},
    {points:[dormitoryJunction,[-53.7,-33.5],[-49.2,-36.5],dormitoryEntries[0],[-27.3,-39.8],
      [-18.4,-38.7],dormitoryEntries[1],[-7.8,-37.85]],width:2.55,material:M.PATH_STONE},
    {points:[[-31.0,2],[-28.08,2]],width:3.36,material:M.PATH_STONE},
    {points:[[-10,1],[-10,15],[-16,24],[-24,30],[-31,42]],width:2.74,material:M.PATH_EARTH},
    {points:[[-10,1],[-1,2.4],[7,2.8],[15,2.8],[30,2.8],garden.center,[48,2.8],[50.5,1.6],[57,1.6],[64,1.6],farmCourt],width:2.78},
    {points:[[-10,1],[-2,-5],[7,-12],[19.5,-17.5],[34,-19],[42,-18.8],roseFlanks[0],[51.5,-17.6],
      [62,-18.9],[72.8,-17.8],[77.5,-16.4],[81.8,-9],farmCourt],width:2.78},
    {points:[[10,-24.6],[10.5,-19.6],[13.2,-15.1]],width:1.87,material:M.PATH_GRAVEL},
    {points:[[34,-20.7],[34,-19]],width:2.10},
    {points:[[62,-23.9],[62,-18.9]],width:2.12},
    {points:[[-64,-28.9],[-65.1,-23.6],[-64,-18],[-62.6,-6],[-62.1,7]],width:2.25,material:M.PATH_GRAVEL},
    {points:[[-31,42],[-20,43],shoreJunction,[.7,40.5],pavilionCourt],width:2.70},
    {points:[pavilionCourt,[position.pavilion[0],position.pavilion[1]+5.15*pavilionScale]],width:2.15,material:M.PATH_STONE},
    {points:[[-10,15],[-6.5,21.4],[-5,29.2],[-6.0,36.1],shoreJunction],width:2.33},
    {points:[roseFlanks[0],[47,-8],[47,3],[47,14],roseFlanks[1]],width:2.23},
    {points:[pavilionCourt,[14,38.1],[19.0,34.6],[27.5,30.1],[34.6,25.4],[41.2,23.6],roseFlanks[1]],width:2.23},
    {points:[roseFlanks[1],[54.5,20.7],[64,20.4],[74,20.8],[80.8,20.0],shedPath,shedCorner],width:2.24,material:M.PATH_GRAVEL},
    {points:[farmCourt,[81.7,6.0],[82.4,10.8],shedCorner,[87.7,9.4]],width:2.28,material:M.PATH_GRAVEL},
    {points:[pavilionCourt,[13.5,41.6],[20.5,42.6],rokkaenJunction,[30.9,50.8],[32.9,57.6],
      [28.6,64.4],[19.8,68.4],[10.6,69.1],[-.1,68.2],[-7,63.8],[-9.8,56.6],[-8.5,49.1],shoreJunction],width:2.38,material:M.PATH_GRAVEL},
    {points:[[13.5,41.6],[13.45,44.2],pondPier],width:2.12,material:M.PATH_STONE},
    {points:[rokkaenJunction,[32.4,43.4],[37.7,45.2],...rokkaenWalk,[81.7,36.5],[85.2,28.2],[85.3,21],shedPath],width:2.57,material:M.PATH_STONE},
    ...dormitoryEntries.map(([x,z])=>({points:[[x,z-2.24],[x,z]],width:2.68,material:M.PATH_STONE}))
  ];
  function wallDistance(x,z,limit=Infinity) {
    const beyond=Math.max(wallWest-x,x-wallEast,wallNorth-z,z-wallSouth);
    if(beyond>limit) return beyond;
    let inside=false,nearest=Infinity;
    for(const {ax,az,bz,dx,dz,inverseLength} of wallEdges) {
      const u=x-ax,v=z-az;
      if((az>z)!==(bz>z) && u<dx*v/dz) inside=!inside;
      const t=clamp((u*dx+v*dz)*inverseLength,0,1);
      const px=u-t*dx,pz=v-t*dz;
      nearest=Math.min(nearest,px*px+pz*pz);
    }
    return (inside?-1:1)*Math.sqrt(nearest);
  }
  function terrainY(x,z) {
    const horizon=1-clamp((Math.max(Math.abs(x),Math.abs(z))-196)/61,0,1);
    if(horizon===0) return 0;
    const edge=clamp((wallDistance(x,z,53)-19)*.030,0,1);
    return horizon*edge*(4.4*Math.sin(x*.039+z*.021)+3.1*Math.cos(z*.047-x*.020)+3.1*Math.sin(z*.036));
  }
  function landscape(mesh,s) {
    const edge=(x,z)=>[x,terrainY(x,z),z];
    function patch(x,z,nextX,nextZ,far=false) {
      const u=(x+nextX)/2,v=(z+nextZ)/2;
      const border=clamp((wallDistance(u,v,21)+7.7)/28,0,1);
      const margin=lerp(.12,.66,border*border*(3-2*border));
      const wave=.49+.24*Math.sin(u*.114+v*.092)+.19*Math.cos(v*.27-u*.081);
      const shade=far ? tint(s.margin,.99+wave*.023) :
        tint(mix(s.lawn,s.margin,clamp(.13+.64*margin+.23*wave,0,1)),.96+.07*wave);
      mesh.face([edge(x,z),edge(x,nextZ),edge(nextX,nextZ),edge(nextX,z)],shade,M.TERRAIN,true);
    }
    const grid=8.5;
    for(let z=-350;z<262;z+=grid) for(let x=-374;x<374;x+=grid) patch(x,z,x+grid,z+grid);
    // A coarse continuation supplies ground when the camera is tilted close to the horizon.
    const margins=[[-5400,-5400,5400,-350],[-5400,262,5400,5400],[-5400,-350,-374,262],[374,-350,5400,262]];
    for(const [left,top,right,bottom] of margins) patch(left,top,right,bottom,true);
  }
  function spline(points,samples=8) {
    const result=[];
    for(let i=0;i<points.length-1;i++) {
      const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];
      for(let j=0;j<samples;j++) {
        const t=j/samples;
        result.push(b.map((v,k)=>.5*(2*v+(-a[k]+c[k])*t+(2*a[k]-5*v+4*c[k]-d[k])*t*t+
          (-a[k]+3*v-3*c[k]+d[k])*t*t*t)));
      }
    }
    result.push(points[points.length-1]);
    return result;
  }
  function path(mesh,points,width,y,color,material=M.PATH_BRICK) {
    const spine=spline(points),edge=(x,z)=>[x,terrainY(x,z)+y,z];
    const paved=material===M.PATH_BRICK||material===M.PATH_STONE;
    const curbColor=paved?mix(color,C.chapelTrim,.44):color;
    let along=0;
    const section=spine.map(([x,z],i)=>{
      if(i) along+=Math.hypot(x-spine[i-1][0],z-spine[i-1][1]);
      const [dx,dz]=unit(sub(spine[Math.min(i+1,spine.length-1)],spine[Math.max(0,i-1)]));
      const half=width*(.493+(paved?.004:.015)*Math.sin(along*2.1));
      const border=paved?Math.min(.17,width*.067):width*.104;
      const inner=half-border;
      const point=(u)=>edge(x-dz*u,z+dx*u);
      return {along,inner,core:[point(inner),point(-inner)],rim:[point(half),point(-half)]};
    });
    for(let i=1;i<section.length;i++) {
      const a=section[i-1],b=section[i];
      mesh.face([a.core[0],a.core[1],b.core[1],b.core[0]],color,material,true,
        [[a.along,a.inner],[a.along,-a.inner],[b.along,-b.inner],[b.along,b.inner]]);
      for(const side of [0,1]) {
        mesh.face([a.core[side],b.core[side],b.rim[side],a.rim[side]],curbColor,paved?M.PATH_CURB:M.PATH_SHOULDER,true,
          [[a.along,0],[b.along,0],[b.along,1],[a.along,1]]);
      }
    }
  }
  function fence(mesh,points,wood,s,spacing=2) {
    for(let j=1;j<points.length;j++) {
      const [ax,az]=points[j-1],[bx,bz]=points[j],n=Math.ceil(Math.hypot(ax-bx,az-bz)/spacing);
      for(let i=0;i<n;i++) {
        const p=[lerp(ax,bx,i/n),0,lerp(az,bz,i/n)],q=[lerp(ax,bx,(i+1)/n),0,lerp(az,bz,(i+1)/n)];
        mesh.box(p[0],.52,p[2],.14,1.04,.14,wood,0,M.WOOD);
        for(const y of [.43,.81]) mesh.beam([p[0],y,p[2]],[q[0],y,q[2]],.106,.11,wood,M.WOOD);
        if(s.winter) mesh.box(p[0],1.045,p[2],.16,.075,.16,C.snow);
      }
      mesh.box(bx,.52,bz,.14,1.04,.14,wood,0,M.WOOD);
    }
  }
  function lamp(mesh,x,z,s,isGate=false) {
    const head=isGate?3.92:2.80;
    mesh.column(x,z,0,.22,.20,.16,C.plinth,8);
    mesh.column(x,z,.17,head+.025,isGate?.11:.087,isGate?.078:.062,C.iron,8);
    const zz=isGate?z+.57:z,y=isGate?head-.28:head+.16;
    if(isGate) {
      const neck=(i)=>[x,head+.28*Math.sin(i*Math.PI/8),z+.285*(1-Math.cos(i*Math.PI/8))];
      for(let i=0;i<8;i++) mesh.rod(neck(i),neck(i+1),.063,.061,C.iron,7);
    }
    mesh.box(x,y,zz,.34,.43,.34,s.winter?C.amber:C.paleGlass,0,s.winter?M.LIT:M.WINDOW);
    mesh.box(x,y-.232,zz,.40,.089,.40,C.iron);
    mesh.column(x,zz,y+.19,y+.40,.27,.055,C.iron,4);
    for(const dx of [-.16,.16]) for(const dz of [-.16,.16]) mesh.box(x+dx,y,zz+dz,.044,.44,.044,C.iron);
  }
  function boundary(mesh,s) {
    const shoulder=2.13,top=2.29,cap=s.winter?C.snow:C.limestone;
    const spine=wallRoute.flatMap((a,i)=>{
      const b=wallRoute[i+1];
      if(!b) return [a];
      const steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3.25);
      return Array.from({length:steps},(_,j)=>a.map((v,k)=>lerp(v,b[k],j/steps)));
    });
    const sections=spine.map(([x,z],i)=>{
      const before=spine[Math.max(0,i-1)],after=spine[Math.min(spine.length-1,i+1)];
      const [dx,dz]=unit(sub(after,before));
      return {x,z,point:(y,offset)=>[x+dz*offset,y,z-dx*offset]};
    });
    let along=0,nextPier=15;
    for(let i=0;i<sections.length-1;i++) {
      const a=sections[i],b=sections[i+1],length=Math.hypot(b.x-a.x,b.z-a.z),end=along+length;
      const stone=tint(C.sandstone,.94+.031*Math.cos(i*.77)+.019*Math.sin(i*2.37));
      mesh.face([a.point(0,.49),a.point(shoulder,.49),b.point(shoulder,.49),b.point(0,.49)],stone,M.STONE,false,
        [[along,0],[along,shoulder],[end,shoulder],[end,0]]);
      mesh.face([b.point(0,-.49),b.point(shoulder,-.49),a.point(shoulder,-.49),a.point(0,-.49)],stone,M.STONE,false,
        [[end,0],[end,shoulder],[along,shoulder],[along,0]]);
      mesh.face([a.point(shoulder,.49),a.point(top,.63),b.point(top,.63),b.point(shoulder,.49)],cap);
      mesh.face([b.point(shoulder,-.49),b.point(top,-.63),a.point(top,-.63),a.point(shoulder,-.49)],cap);
      mesh.face([a.point(top,-.63),b.point(top,-.63),b.point(top,.63),a.point(top,.63)],cap);
      if(end>=nextPier && i<sections.length-4) {
        const t=(nextPier-along)/length,x=lerp(a.x,b.x,t),z=lerp(a.z,b.z,t);
        const tangent=Math.atan2(a.z-b.z,b.x-a.x);
        mesh.box(x,1.09,z,1.25,2.18,1.22,C.sandstone,tangent,M.STONE);
        mesh.box(x,2.29,z,1.45,.21,1.47,cap,tangent);
        nextPier+=20;
      }
      along=end;
    }
  }
  function mainGate(mesh,s) {
    const [center,z]=position.gate;
    for(const side of [-1,1]) {
      const x=center+side*gateHalfWidth;
      mesh.box(x,1.59,z,2.12,2.84,1.94,tint(C.sandstone,.81));
      for(let row=0;row<6;row++) {
        mesh.box(x,.68+row*.41,z,2.24,.392,2.04,tint(C.sandstone,.96+.048*Math.sin(row*2.17+side)),0,M.SIMPLE);
      }
      mesh.box(x,.25,z,2.41,.50,2.25,tint(C.sandstone,.89),0,M.STONE);
      mesh.box(x,2.99,z,2.38,.21,2.20,C.limestone);
      mesh.box(x,3.17,z,2.54,.19,2.39,s.winter?C.snow:C.plaster);
      lamp(mesh,x+side*.33,z+1.9,s,true);
      const start=x-side*1.08,end=[start-side*2.1,0,z-5.26];
      const gate=(t,y)=>[lerp(start,end[0],t),y,lerp(z,end[2],t)];
      const top=(t)=>2.87+.88*t*t+.12*t;
      const span=Math.hypot(start-end[0],z-end[2]),angle=Math.atan2(z-end[2],end[0]-start);
      mesh.box(...gate(.5,.432),span,.272,.091,tint(C.iron,.83),angle);
      for(const y of [.48,.72,2.07]) mesh.beam(gate(0,y),gate(1,y),.094,.105,C.iron);
      for(let i=0;i<=15;i++) {
        const t=i/15,[u,,v]=gate(t,0),h=top(t);
        mesh.column(u,v,.36,h,.041,.037,C.iron,5);
        mesh.column(u,v,h,h+.19,.068,.009,C.iron,5);
        if(i===15) continue;
        const next=(i+1)/15;
        mesh.rod(gate(t,h-.22),gate(next,top(next)-.22),.053,.053,C.iron,6,M.SIMPLE,false);
        if(i%2===0) {
          mesh.rod(gate(t,2.14),gate(next,2.46),.034,.036,C.iron,5);
          mesh.rod(gate(t,2.46),gate(next,2.14),.034,.036,C.iron,5);
        }
      }
      for(let i=0;i<10;i++) {
        const t=(i+.5)/10;
        const curl=(p)=>{
          const angle=p*Math.PI*1.65,r=lerp(.117,.027,p);
          const at=t+r*Math.sin(angle)/span;
          return gate(at,top(at)-.356+r*Math.cos(angle));
        };
        for(let k=0;k<8;k++) {
          mesh.rod(curl(k/8),curl((k+1)/8),.028,.024,tint(C.iron,1.16),5,M.SIMPLE,false);
        }
      }
      for(const t of [0,1]) mesh.rod(gate(t,.30),gate(t,top(t)),.087,.075,C.iron,7);
      for(const y of [.83,2.41]) mesh.box(start+side*.08,y,z,.43,.15,.21,C.iron);
    }
  }
  function seat(mesh,x,z,angle,s) {
    const p=local(x,0,z,angle);
    for(const u of [-.72,.72]) mesh.box(...p(u,.28,0),.15,.56,.57,C.iron,angle);
    mesh.box(...p(0,.58,0),1.91,.13,.63,s.winter?C.snow:C.oak,angle,M.WOOD);
    for(const y of [.85,1.02]) mesh.box(...p(0,y,-.27),1.91,.13,.09,C.oak,angle,M.WOOD);
  }
  const rosePetals=[0xc2577f,0xdf8da2,0xb54e6a,0xe5afbe,0xf2cacc].map(rgb);
  function roseBush(mesh,x,z,y,r,seed,s,dense=false,petals=rosePetals) {
    mesh.oval(x,y+.29*r,z,r,.54*r,.91*r,tint(s.winter?s.margin:rgb(0x627c4f),.82+.16*Math.sin(seed)),7,3,seed);
    if(s.winter) {
      mesh.oval(x,y+.57*r,z,.84*r,.24*r,.74*r,C.snow,6,3,seed,M.SIMPLE);
      return;
    }
    for(let i=0;i<(dense?5:3);i++) {
      const a=i*2.40+seed,radius=(.13+.56*i/5)*r;
      const col=petals[(seed+i)%petals.length],p=x+radius*Math.cos(a),q=z+radius*Math.sin(a);
      mesh.oval(p,y+r*(.75-.051*i),q,.32*r,.224*r,.31*r,tint(col,s.id==="spring"?1.08:.97),7,3,seed+i);
    }
  }
  function chapelWalk(mesh,s) {
    const [x,z]=position.chapel;
    const stone=s.winter?rgb(0xc5cecf):C.flagstone;
    const approach=s.winter?rgb(0xd1d7d5):C.packedEarth;
    path(mesh,[[x,z+14.45],[x,z+16.9],[x+.1,z+20.73]],4.18,.061,approach,M.PATH_EARTH);
    mesh.box(x,.047,z+13.23,5.66,.09,2.76,stone,0,M.PAVERS);
    for(const side of [-1,1]) for(let i=0;i<16;i++) {
      const u=x+side*(2.33+.095*Math.sin(i*1.38)),v=z+13.3+i*.47;
      const r=.45+.07*Math.sin(i*2.43);
      mesh.oval(u,.33,v,r,.39,r+.03,tint(s.winter?s.margin:s.fir,1.04+.11*Math.sin(i*4.23)),7,3,i);
      if(s.winter) mesh.oval(u,.51,v,r*.80,.21,r*.87,C.snow,7,3,i,0);
    }
  }
  function shrubBorder(mesh,s,points,width,height,flowering=false) {
    for(let i=1;i<points.length;i++) {
      const [ax,az]=points[i-1],[bx,bz]=points[i];
      const n=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/(width*.82)));
      for(let j=0;j<n;j++) {
        const k=i*61+j,t=(j+.27)/n;
        const x=lerp(ax,bx,t),z=lerp(az,bz,t);
        if(flowering) {
          roseBush(mesh,x,z,.035,width*.59,k,s);
        } else {
          const color=tint(mix(s.fir,rgb(0x5d7449),s.winter ? .18 : .50),.95+.15*Math.sin(k*2.126));
          mesh.oval(x,height*.51,z,width*.64,height*.55,width*.62,color,8,3,k);
          if(s.winter) mesh.oval(x,height*.80,z,width*.51,height*.25,width*.49,C.snow,7,3,k,M.SIMPLE);
        }
      }
    }
  }
  function forecourtGarden(mesh,s) {
    const [x,z]=position.roses,stone=s.winter?rgb(0xdbe5e3):C.gardenPaving;
    const rim=Array.from({length:57},(_,i)=>[x+12.28*Math.cos(i*TAU/56),z+8.30*Math.sin(i*TAU/56)]);
    path(mesh,rim,.84,.041,stone);
    mesh.disc(x,.053,z,11.86,7.88,tint(s.lawn,.99),M.SOIL,52);
    mesh.column(x,z,.06,.31,3.51,3.49,C.plinth,30,M.STONE);
    mesh.disc(x,.318,z,3.32,3.32,s.winter?C.snow:C.mulch,M.SOIL,35);
    roseBush(mesh,x,z,.29,.84,12,s,true);
    for(let i=0;i<14;i++){
      const a=i*TAU/14,r=i%2?2.73:1.68;
      roseBush(mesh,x+r*Math.cos(a),z+r*Math.sin(a),.32,.63+.07*Math.cos(i),i+30,s,true);
    }
    for(const side of [-1,1]) {
      const u=x+side*6.81,v=z-1.14;
      mesh.column(u,v,.06,.24,1.27,1.25,C.plinth,22,M.STONE);
      mesh.disc(u,.247,v,1.13,1.13,s.winter?C.snow:C.mulch,M.SOIL,22);
      roseBush(mesh,u,v,.26,.84,34+side,s,true);
    }
    for(const offset of [0,Math.PI]) for(let i=0;i<26;i++) {
      const a=offset+.27+2.55*i/25;
      const u=x+10.5*Math.cos(a),v=z+6.65*Math.sin(a);
      roseBush(mesh,u,v,.05,.66,i+(offset>0?51:7),s,false);
    }
    for(let i=0;i<28;i++) {
      const a=.30+(i+.5)*2.51/28;
      roseBush(mesh,x+9.93*Math.cos(a),z+5.98*Math.sin(a),.055,.64,i+83,s,false);
    }
    for(const side of [-1,1]) {
      const u=x+side*10.4,v=z-7.18;
      seat(mesh,u,v,Math.PI,s);
      mesh.column(u+1.42,v,.055,.49,.33,.42,C.chapelTrim,9);
      mesh.oval(u+1.42,.63,v,.40,.38,.40,s.winter?s.margin:s.fir,7,3,side);
    }
    mesh.box(x-2.98,.077,z-10.12,19.9,.13,2.41,stone,0,M.PAVERS);
  }
  function formalRoseGarden(mesh,s) {
    const {center:[x,z],radiusX,radiusZ}=garden;
    const edge=(r,a,y)=>[x+r*radiusX*Math.cos(a),y,z+r*radiusZ*Math.sin(a)];
    const stone=s.winter?C.snow:tint(C.palePath,.89);
    const rings=[
      {inner:.17,outer:.435,palette:[0xa678aa,0xad7c9b,0xbb899e],sectors:2},
      {inner:.49,outer:.698,palette:[0xd8ad69,0xe2ba76,0xdfa77a],sectors:3},
      {inner:.755,outer:.95,palette:[0xbe738b,0xd6a0a4,0xb9cbb3],sectors:4}
    ];
    const rim=Array.from({length:15},(_,i)=>{
      const [u,,v]=edge(1.015,Math.PI/2+i*Math.PI/14,0);
      return [u,v];
    });
    path(mesh,rim,1.94,.081,s.winter?C.snow:C.palePath);
    for(const {inner,outer,palette,sectors} of rings) {
      const gap=Math.asin(1.57/(radiusZ*inner));
      const halves=[[Math.PI/2+.055,Math.PI-gap],[Math.PI+gap,Math.PI*1.5-.055]];
      for(const [half,[start,end]] of halves.entries()) for(let i=0;i<sectors;i++) {
        const a=lerp(start,end,i/sectors)+.029,b=lerp(start,end,(i+1)/sectors)-.029;
        const tone=rgb(palette[(i+half)%palette.length]);
        const blooms=[tint(tone,.91),tone,mix(tone,C.plaster,.25)];
        const bed=s.winter?tint(C.snow,.93):mix(tint(s.lawn,.80),tone,.69);
        for(let j=0;j<8;j++) {
          const p=lerp(a,b,j/8),q=lerp(a,b,(j+1)/8);
          mesh.face([edge(inner,p,.107),edge(outer,p,.107),edge(outer,q,.107),edge(inner,q,.107)],stone,M.STONE,true);
          mesh.face([edge(inner+.018,p+.003,.119),edge(outer-.018,p+.003,.119),
            edge(outer-.018,q-.003,.119),edge(inner+.018,q-.003,.119)],bed,M.SOIL,true);
        }
        for(const r of [lerp(inner,outer,.28),lerp(inner,outer,.72)]) {
          const n=Math.max(2,Math.round(r*29*(b-a)/1.85));
          for(let j=0;j<n;j++) {
            const [u,,v]=edge(r,lerp(a,b,(j+.5)/n),0);
            roseBush(mesh,u,v,.122,.97+.16*Math.sin(i*3.1+j*2.8)**2,10*half+13*i+j,s,false,blooms);
          }
        }
      }
    }
  }
  function gardenEdges(mesh,s) {
    const [sx,sz]=position.school,[nx,nz]=position.nursery;
    for(const side of [-1,1]) {
      shrubBorder(mesh,s,[[sx+9.3,sz+side*5.6],[sx+9.9,sz+side*12.7],[sx+13.3,sz+side*15.3]],1.10,.82,true);
    }
    shrubBorder(mesh,s,[[-11.4,9.14],[-7.2,9.35],[-2.9,9.35]].map(([u,v])=>groundAt(rokkaenLocal,u,v)),1.04,.74,true);
    shrubBorder(mesh,s,[[.45,9.84],[5.9,9.95],[10.4,9.82]].map(([u,v])=>groundAt(rokkaenLocal,u,v)),1.04,.74,true);
    for(const [x,z] of dormitoryEntries) for(const side of [-1,1]) {
      shrubBorder(mesh,s,[[x+side*3.15,z-2.0],[x+side*6.6,z-2.0]],.88,.6,true);
    }
    shrubBorder(mesh,s,[[1.4,27.1],[4.4,25.15],[9.1,25.2]],1.34,1.13);
    shrubBorder(mesh,s,[[15.4,30.4],[18,32.3],[20.7,32.15]],1.21,.84,true);
    shrubBorder(mesh,s,[[-42,34],[-38,34.8],[-34,35.9]],1.35,.84);
    shrubBorder(mesh,s,[[-43,50],[-36,49.9],[-30,47.6]],1.37,.89);
    shrubBorder(mesh,s,[[3,-5.6],[8,-8.5],[13,-10.8],[18,-13.2],[22.2,-14.5]],1.63,1.18);
    shrubBorder(mesh,s,[[-19.2,28.8],[-16.4,31.4],[-13.5,33.0]],1.51,1.06);
    shrubBorder(mesh,s,[[-19.1,52.4],[-15.25,55.6],[-12.6,57.3]],1.36,.85,true);
    shrubBorder(mesh,s,[[22.2,46.7],[24.2,48.2],[25.5,49.7]],1.29,.92);
    shrubBorder(mesh,s,[[89.7,23.7],[92.1,21.45],[93.5,17.5]],1.42,.91);
    shrubBorder(mesh,s,[[-64.3,-45.9],[-58.1,-46.55],[-51.35,-46.25]],1.20,.83);
    shrubBorder(mesh,s,[[24.5,-34.7],[28,-35.2],[32.5,-34.8]],1.10,.71,true);
    shrubBorder(mesh,s,[[38.8,-35.2],[42,-34.8],[45.5,-34.1]],1.10,.79,true);
    shrubBorder(mesh,s,[[55,-34.3],[58,-35.7],[66,-35.3],[70,-33.3]],1.32,.99);
    for(const u of [nx-4.05,nx+4.15]) {
      const v=nz+6.25;
      mesh.box(u,.22,v,3.68,.44,1.32,C.oak,0,M.WOOD);
      mesh.box(u,.468,v,3.49,.061,1.15,s.winter?C.snow:C.mulch,0,M.SOIL);
      for(let i=0;i<6;i++) {
        const plant=u-1.47+i*.58;
        mesh.oval(plant,.57,v,.29,.28,.39,s.winter?C.snow:s.foliage,6,3,i);
        if(!s.winter) mesh.oval(plant,.77,v,.19,.17,.22,s.flower,6,3,i);
      }
    }
  }
  function pond(mesh,s) {
    const [x,z]=position.pond,[rx,rz]=pondSize;
    const at=(i,r,y)=>{
      const a=i*TAU/54,k=r*(1+.08*Math.sin(a*3+.4)+.08*Math.cos(a*5-.57));
      return [x+k*rx*Math.cos(a),y,z+k*rz*Math.sin(a)];
    };
    for(let i=0;i<54;i++) {
      mesh.face([at(i,1,.057),at(i+1,1,.057),at(i+1,1.105,.029),at(i,1.105,.029)],
        tint(s.winter?C.snow:mix(s.margin,s.soil,.22),.95+.07*Math.cos(i*2.29)),M.SOIL,true);
      const b=at(i,1,.045),c=at(i+1,1,.045);
      mesh.triangle([[x,.045,z],b,c],s.water,s.winter?M.ICE:M.WATER,[0,1,0],s.winter?null:[[0,z],[1,b[2]],[1,c[2]]]);
      if(i%5===0) {
        const [a,,b]=at(i,1.042,0);
        mesh.oval(a,.22,b,.74,.37,.64,s.winter?C.snow:C.plinth,8,3,i,M.STONE);
      }
      if(i%7===0&&!s.winter) {
        const [a,,b]=at(i,1.048,0);
        for(let j=0;j<6;j++) {
          const u=a+.35*Math.sin(j*2.3),v=b+.26*Math.cos(j*2.8);
          mesh.rod([u,.03,v],[u+.18*Math.cos(j),.66+.35*Math.sin(j+.65)**2,v+.17*Math.sin(j)],.035,.013,tint(s.fir,1.3),4);
        }
      }
    }
    const [pierX,pierZ]=pondPier;
    for(let i=0;i<15;i++) {
      const at=pierZ+i*.42;
      mesh.box(pierX,.32,at,2.38+.041*Math.sin(1.79*i),.108,.385,
        tint(s.winter&&i%4===0?C.snow:C.oak,.89+.126*Math.sin(i*3.2)),0,M.WOOD);
      for(const side of [-1,1]) {
        mesh.box(pierX+side*.87,.377,at,.053,.016,.057,tint(C.timber,.71));
      }
    }
    for(const side of [-1,1]) {
      mesh.box(pierX+side*.875,.202,pierZ+2.94,.16,.16,6.29,tint(C.timber,.84),0,M.WOOD);
      for(const p of [z-9.91,z-7.62,z-4.67]) {
        mesh.column(pierX+side*1.09,p,-.02,.67,.127,.112,C.timber,7,M.WOOD);
        mesh.column(pierX+side*1.09,p,.635,.70,.139,.118,s.winter?C.snow:tint(C.oak,1.12),7);
      }
    }
  }
  function cropTunnel(mesh,x,z,w,depthScale,s) {
    const ribs=8,segments=8;
    const hoop=(i,j)=>[x+w*(i/ribs-.5),.18+1.52*Math.sin(j*Math.PI/segments),z+1.58*depthScale*Math.cos(j*Math.PI/segments)];
    const frame=tint(C.verdigris,.82),cloth=mix(C.paleGlass,C.verdigris,.54);
    for(let i=0;i<=ribs;i++) for(let j=0;j<segments;j++) {
      const a=hoop(i,j),b=hoop(i,j+1);
      mesh.rod(a,b,.062,.056,frame,5,M.SIMPLE,false);
      if(i===ribs) continue;
      const c=hoop(i+1,j+1),d=hoop(i+1,j);
      const snowy=s.winter && j>=2 && j<=5;
      mesh.face([a,b,c,d],snowy?C.snow:cloth,snowy?M.SIMPLE:M.GLASS,true);
    }
    mesh.beam(hoop(0,segments/2),hoop(ribs,segments/2),.076,.064,s.winter?C.snow:frame);
  }
  function cultivation(mesh,s) {
    const [x,z]=position.farm,[w,d]=farmSize,depthScale=d/42;
    mesh.box(x,.016,z,w,.029,d,s.winter?s.margin:s.soil,0,M.SOIL);
    const rows=[-17.1,-12.5,-7.8,-3.30,4.6,9.2,14.1,18.7];
    const greens=[0x718a47,0x789754,0x5f8558,0x8ca14c,0x648151,0x658a58].map(rgb);
    for(const [i,offset] of rows.entries()) {
      const v=z+depthScale*offset,span=22.7+(i%3)*.86;
      mesh.box(x,.137,v,span,.19,3.25*depthScale,s.winter?C.snow:C.mulch,0,M.SOIL);
      if(i>=6) cropTunnel(mesh,x,v,span,depthScale,s);
      if(s.winter) continue;
      for(let j=0;j<16;j++) for(const side of [-1,1]) {
        const u=x+span*(j/16-.47)+side*.08;
        const leaf=greens[i%greens.length],a=v+depthScale*(.76*side+.18*Math.sin(j*2.3+i));
        const h=.42+.45*Math.sin(i*2.7+j*2.3)**2;
        mesh.oval(u,h*.73,a,.65,h*.57,.73,tint(leaf,.93+.14*Math.cos(i+j)),7,3,i+j);
        if(i<2 && j%3===0) mesh.rod([u,.18,v],[u+.08,1.32,v+.41*side],.043,.035,C.oak,5,M.WOOD,false);
        if(i===4 || i===5) mesh.oval(u+.16,h*.98,a+.18,.19,.16,.18,C.brick,6,3,j);
      }
    }
    const left=x-w/2,right=x+w/2,north=z-d/2,south=z+d/2;
    fence(mesh,[[left,z-2],[left,north],[right,north],[right,z-2]],C.timber,s,2.40);
    fence(mesh,[[left,z+2],[left,south],[right,south],[right,z+2]],C.timber,s,2.40);
    cottage(mesh,position.farmShed,[7.75,6.65,3.83],s);
    rabbitHutch(mesh,s);
    const [rx,rz]=position.rabbits;
    fence(mesh,[[rx+3.45,rz-.9],[rx+6.9,rz-.9],[rx+6.9,rz+4.95],[rx+3.7,rz+4.95]],C.timber,s,1.8);
  }

  function tree(mesh,x,z,h,kind,s,near,seed) {
    const y=terrainY(x,z),rand=random(seed);
    if(kind==="fir") {
      mesh.column(x,z,y,y+h*.74,h*.041,h*.019,C.timber,5,M.WOOD,false);
      for(let j=0;j<(near?4:3);j++) {
        const a=y+h*(.19+.155*j),b=y+h*(.76+.075*j),r=h*(.26-.043*j);
        mesh.column(x,z,a,b,r,h*.012,tint(s.fir,.83+rand()*.24+j*.05),near?9:6,M.LEAVES,false);
        if(s.winter) {
          const cover=lerp(r,h*.012,.33)+.062;
          mesh.column(x,z,lerp(a,b,.33),b+.096,cover,h*.013,tint(C.snow,.85+rand()*.11),near?9:6,0,false);
        }
      }
      return;
    }
    const trunk=s.winter?tint(C.timber,.92):tint(C.timber,1.04);
    const top=[x+.115*h*(rand()-.5),y+h*.86,z+.112*h*(rand()-.5)];
    mesh.rod([x,y-.04,z],top,h*.047,h*.009,trunk,near?7:5,M.WOOD,false);
    if(s.winter) {
      for(let j=0;j<(near?6:4);j++) {
        const a=j*TAU/6+rand()*.46,r=h*(.17+rand()*.15);
        const tip=[x+Math.cos(a)*r,y+h*(.65+rand()*.22),z+Math.sin(a)*r];
        mesh.rod([x,y+h*(.36+rand()*.24),z],tip,h*.023,h*.008,trunk,5,M.WOOD,false);
        if(near) for(const side of [-1,1]) {
          mesh.rod(tip,[tip[0]+.13*h*Math.cos(a+side*.83),tip[1]+h*(.101+rand()*.061),
            tip[2]+.15*h*Math.sin(a+side*.83)],h*.008,h*.0022,tint(trunk,1.09),4,M.WOOD,false);
        }
        if(j%2===0) mesh.rod([x,y+h*.43+.02,z],tip.map((n,i)=>i===1?n+.065:n),h*.007,h*.006,C.snow,4,0,false);
      }
      return;
    }
    let leaf=kind==="cherry"?s.cherry:s.foliage;
    if(s.id==="autumn") leaf=mix(leaf,rgb([0xaa6650,0xe4bb60,0xa1a372,0xc4904d,0xd19c57][seed%5]),.55);
    leaf=tint(leaf,.86+rand()*.22);
    const spread=h*(kind==="cherry" ? .377 : .268),parts=near?6:3;
    mesh.oval(top[0],y+h*.80,top[2],spread*.86,h*.24,spread*.90,leaf,near?10:7,4,seed);
    for(let i=0;i<parts;i++) {
      const a=i*TAU/parts+rand()*.67,r=spread*(.51+rand()*.31);
      const u=x+Math.cos(a)*r,v=z+Math.sin(a)*r,p=y+h*(.58+rand()*.25),scale=.60+rand()*.23;
      if(near) mesh.rod([x,y+h*.36,z],[u,p,v],h*.023,h*.008,trunk,6,M.WOOD,false);
      const c=kind==="cherry"&&s.id==="spring"?mix(leaf,rgb(0xf9d9e1),.71*rand()):tint(leaf,.84+rand()*.27);
      mesh.oval(u,p,v,spread*scale,h*.177,spread*scale,c,near?9:6,near?4:3,seed+i);
    }
  }
  function forestry(mesh,s,quality) {
    const rand=random(47712),step={low:13.4,standard:10.8,high:8.9}[quality];
    const [entranceX,entranceZ]=groundAt(gateLocal,0,14);
    for(let z=-215;z<190;z+=step) for(let x=-258;x<260;x+=step) {
      const u=x+(rand()-.50)*step*.96,v=z+(rand()-.5)*step*.96,n=Math.floor(rand()*99999);
      const border=wallDistance(u,v,28);
      if(border<11 || Math.hypot(u-entranceX,v-entranceZ)<8 || rand()<.19) continue;
      const h=(9+rand()*9.3)*(v>51&&border<21 ? .77 : 1);
      const kind=rand()<.61+.19*Math.sin(u*.091+v*.11)*Math.cos(v*.033-u*.091)?"fir":"broad";
      tree(mesh,u,v,h,kind,s,quality!=="low" && border<(quality==="high"?28:19),n);
    }
    cherryRow.forEach(([x,z],i)=>tree(mesh,x,z,6.85+rand()*1.6,"cherry",s,true,104+47*i));
    const featured=[
      [-34,31.4,7.8,"broad"],[-61.5,-22.8,7.35,"broad"],[-75.6,15.9,7.5,"cherry"],
      [-64.7,33.0,9.6,"broad"],[-66.8,42.7,9.5,"broad"],[-56.2,53.65,10.1,"broad"],
      [-44.6,52.15,8.15,"broad"],[-33.1,55.2,6.8,"cherry"],
      [-58.3,-48.8,8.25,"broad"],[-51.8,-46.6,7.6,"broad"],[-39.3,-57.5,6.4,"broad"],
      [-73.3,-26.2,7.5,"broad"],[-82.3,-13.3,7.7,"broad"],
      [-15.6,30.6,7.6,"broad"],[75.7,-32.6,5.2,"broad"],[83,-25.8,6.5,"broad"],
      [-1.5,24.3,6.15,"broad"],[12.4,23.6,5.4,"broad"],[17,28.1,5.7,"broad"],
      [-18.1,48.35,6.55,"broad"],[-26.4,47.7,5.7,"cherry"],[-14.6,60.4,6.9,"broad"],
      [3,-29.5,7.8,"broad"],[18.1,-34.1,8.2,"broad"],[37.1,-37.7,8.4,"broad"],
      [49.8,-36.9,8.2,"broad"],[74.5,-23,6.9,"broad"],
      [17.0,-43.8,8.1,"broad"],[23.1,-44.2,10.15,"broad"],[28.8,-41.8,7.15,"broad"],
      [47.2,-44.4,8.5,"broad"],[54.6,-43.9,9.6,"broad"],[60.7,-41.65,7.7,"broad"],
      [70.3,-37.5,8.7,"broad"],[79.2,-36.4,7.6,"broad"],
      [39.2,55,6.05,"broad"],[81.1,32.2,7.2,"cherry"],[89.8,-10.1,6.1,"cherry"],
      [43.9,57.5,6.9,"broad"],[23,38.2,4.9,"broad"],[94,4.1,8.5,"broad"]
    ];
    featured.forEach(([x,z,h,kind],i)=>tree(mesh,x,z,h,kind,s,true,442+113*i));
    const groups=[
      [86.5,-31.7],[-54.5,-51.5],[-50.6,-55.7],[-28.2,-57.1],[-23.3,-50.8],[-13.7,-58.4],[3,-49.5],[12,-47.1],
      [-88,-18],[-90,11],[-86,22],[-77,31],[-71,40],[-63,48],[-55,55],
      [-23,-45],[-5,-58.1],[3,-38],[16,-36],[25,-49],[43.7,-47],[44,-36],[65.5,-39.3],
      [-1.9,-55.8],[76.7,-38.6],[85,-9.7],[95.4,-18.7],[99,-11],[101,4],[96.5,15.6],[91,20.2],
      [88.3,29.5],[80,39.9],[81.8,15],[2.6,-44.7],[37.3,60.6],[25.8,69],[53,-38.3],
      [88.2,-27.4],[-20,61],[-27,56],[-39,58],[43.4,-40.2],[-61,52],[-68,39],[-76,28],
      [-5,-9],[-2,6.5],[3,15],[-18,21.5],[17.5,-29.8],[16.6,38.8],[19.6,47.9],
      [80.6,-20.7],[80.3,27.2],[94.6,10.6]
    ];
    groups.forEach(([x,z],i)=>tree(mesh,x,z,4.9+rand()*3.1,i%7===0?"fir":"broad",s,true,748+13*i));
    const thickets=[
      [-61,-48,4.5,3.0,18],[-52.3,-40.9,3.2,1.5,18],[-24.9,-54,2.9,2.25,18],[-79,-24,4.3,6.1,20],
      [-86,8,2.2,10,18],[-80,22,4.3,4.8,18],[-59,28,7,3,21],[-66,44.6,2.1,8,24],[-53,54,10,3,22],
      [-14,-27,5,4,19],[11,-33,9,3.0,20],[34,-37,6.5,2.3,23],[67,-36.4,6,2.8,19],[84,-22,5.6,4.1,20],
      [22.5,-43.1,8.8,4.55,29],[53.8,-41,7.8,2.8,27],[75.75,-37,6.8,3.15,23],
      [-17.1,32.1,5.3,3.3,24],[-1.5,25.8,2.1,2.0,16],[11.5,24.9,3.2,2.4,21],[21.6,29.1,3.4,1.5,18],
      [-16.9,52.6,4.2,3.1,17],[-5.6,51.4,1.15,2.2,14],[89.8,-15.5,4.5,2.6,20],
      [27.6,38.6,3.8,2.0,15],[37,57.2,4.2,2.1,17],[80.7,-28.65,5.6,3.5,22],
      [56.8,50.4,4.4,2.7,20],[79.8,41.7,2.5,1.35,16],[91,22.5,2.8,2.45,21],[94.4,14,3.4,4.7,16]
    ];
    for(const [x,z,rx,rz,n] of thickets) for(let i=0;i<n;i++) {
      const a=rand()*TAU,r=Math.sqrt(rand()),u=x+rx*r*Math.cos(a),v=z+rz*r*Math.sin(a),h=.36+rand()*.85;
      const shade=.77+rand()*.37,flower=rand()>.72;
      mesh.oval(u,h*.48,v,h*1.47,h*.60,h*1.09,s.winter?s.margin:tint(s.foliage,shade),7,3,i);
      if(s.winter||flower) mesh.oval(u,h*.87,v,h*.62,h*.28,h*.58,s.winter?C.snow:s.flower,6,3,i);
    }
    if(s.id==="autumn"||s.id==="spring") {
      const color=s.id==="autumn"?mix(s.foliage,C.brick,.42):s.cherry;
      for(let i=0;i<710;i++) {
        const base=s.id==="spring"?cherryRow[i%cherryRow.length]:[4,0];
        const spread=s.id==="spring"?9.8:147;
        const x=base[0]+(rand()-.5)*spread,z=base[1]+(rand()-.5)*spread*.85;
        if(wallDistance(x,z,0)>0) continue;
        const r=.08+rand()*.15,a=rand()*TAU,u=Math.cos(a)*r,v=Math.sin(a)*r;
        mesh.triangle([[x-u,.087,z-v],[x+u,.085,z+v],[x+v*.48,.096,z-u*.48]],tint(color,.89+.24*rand()),0,[0,1,0]);
      }
    }
  }

  function build(s,quality) {
    const mesh=new Mesh();
    landscape(mesh,s);
    const pathColors={
      [M.PATH_BRICK]:s.winter?rgb(0xd6dfdf):C.gardenPaving,
      [M.PATH_STONE]:s.winter?rgb(0xc7d2d3):C.flagstone,
      [M.PATH_GRAVEL]:s.winter?rgb(0xd5dddb):C.gravel,
      [M.PATH_EARTH]:s.winter?rgb(0xd1d7d5):C.packedEarth
    };
    for(const [i,{points,width,material=M.PATH_BRICK}] of circulation.entries()) {
      path(mesh,points,width,.026+i*.002,pathColors[material],material);
    }
    boundary(mesh,s);
    mesh.placeAround(position.gate,gateYaw,()=>mainGate(mesh,s));
    mesh.placeAround(position.school,eastFacing,()=>school(mesh,s));
    mesh.placeAround(position.chapel,eastFacing,()=>{ chapel(mesh,s); chapelWalk(mesh,s); });
    mesh.placeAround(position.rokkaen,rokkaenFacing,()=>rokkaenResidence(mesh,s));
    for(const at of dormitories) dormitory(mesh,s,at);
    mesh.placeAround(position.club,eastFacing,()=>clubHouse(mesh,s));
    mesh.placeAround(position.pavilion,0,()=>pavilion(mesh,s),pavilionScale);
    greenhouse(mesh,s,position.greenhouse,mainGlass);
    greenhouse(mesh,s,position.nursery,nurseryGlass,true);
    mesh.placeAround(position.roses,eastFacing,()=>forecourtGarden(mesh,s));
    formalRoseGarden(mesh,s);
    gardenEdges(mesh,s);
    pond(mesh,s);
    cultivation(mesh,s);
    const lights=[...lampWalk.slice(1).map(([x,z])=>[x+2,z]),[-61.1,-27.05],[-29,-27],[-13.3,-10],[-9.9,9.8],
      [-18.6,25.8],[-31.7,39.45],[-1.1,37.7],[9.45,41.4],[23.4,-19.45],[44.1,-20.7],[51.1,-15.55],
      [72.2,-15.3],[46,24.0],[87.8,28.2],[25.5,67.9],groundAt(rokkaenLocal,-15.4,13.5),groundAt(rokkaenLocal,9.3,12.9),
      ...dormitoryEntries.map(([x,z])=>[x-3.2,z+1.65])];
    for(const [x,z] of lights) lamp(mesh,x,z,s);
    seat(mesh,-8.5,19.6,.22,s);
    seat(mesh,16.3,46.55,Math.PI,s);
    seat(mesh,33.7,47.15,Math.PI*1.15,s);
    seat(mesh,-2.3,38.3,Math.PI*.18,s);
    forestry(mesh,s,quality);
    return mesh.layers();
  }

  return {
    build, frameBounds, presets, markers, seasons, material:M,
    Mesh, canStand, figureVisible, pondCenter:position.pond,
    math:{TAU, clamp, lerp, mix, rgb, sub, dot, cross, unit, random}
  };
})();
