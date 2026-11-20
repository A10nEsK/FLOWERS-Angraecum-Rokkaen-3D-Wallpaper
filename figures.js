"use strict";

const CampusFigures = (()=>{
  const {Mesh,material:M,math:{TAU,rgb,mix}}=Angraecum;
  const cream=rgb(0xf6e8d4),wood=rgb(0x8f634d);
  const ink=rgb(0x3d3546), snow=rgb(0xeff6fa), paleBlue=rgb(0xafc5d4);
  const floor=.113, rad=Math.PI/180;
  const props=new Map();
  let vertices=new Float32Array(32768), length=0;

  function pose(x,y,z,yaw=0,pitch=0,roll=0,scale=1) {
    const c=Math.cos(yaw),s=Math.sin(yaw),p=Math.cos(pitch),q=Math.sin(pitch),r=Math.cos(roll),t=Math.sin(roll);
    return [(c*r+s*q*t)*scale,(-c*t+s*q*r)*scale,s*p*scale,x,
      p*t*scale,p*r*scale,-q*scale,y,(-s*r+c*q*t)*scale,(s*t+c*q*r)*scale,c*p*scale,z];
  }
  function point(m,x,y,z) {
    return [m[0]*x+m[1]*y+m[2]*z+m[3],m[4]*x+m[5]*y+m[6]*z+m[7],m[8]*x+m[9]*y+m[10]*z+m[11]];
  }
  function stream(part,m) {
    if(length+part.length>vertices.length) {
      const next=new Float32Array(Math.max(2*vertices.length,length+part.length));
      next.set(vertices);
      vertices=next;
    }
    const inverse=1/Math.hypot(m[0],m[1],m[2]);
    vertices.set(part,length);
    for(let i=0;i<part.length;i+=12) {
      const x=part[i],y=part[i+1],z=part[i+2],nx=part[i+3],ny=part[i+4],nz=part[i+5],j=length+i;
      vertices[j]=m[0]*x+m[1]*y+m[2]*z+m[3];
      vertices[j+1]=m[4]*x+m[5]*y+m[6]*z+m[7];
      vertices[j+2]=m[8]*x+m[9]*y+m[10]*z+m[11];
      vertices[j+3]=(m[0]*nx+m[1]*ny+m[2]*nz)*inverse;
      vertices[j+4]=(m[4]*nx+m[5]*ny+m[6]*nz)*inverse;
      vertices[j+5]=(m[8]*nx+m[9]*ny+m[10]*nz)*inverse;
    }
    length+=part.length;
  }
  function meshPart(build) {
    const mesh=new Mesh();
    build(mesh);
    return mesh.layers()[0].slice();
  }
  function ellipse(mesh,x,y,z,rx,ry,rz,color,sides=12,rows=8,cutoff=()=>Math.PI,material=M.SIMPLE) {
    const vertex=(i,j)=>{
      const q=i*TAU/sides,b=j/rows*cutoff(q),u=Math.sin(q)*Math.sin(b),v=Math.cos(b),w=Math.cos(q)*Math.sin(b);
      const normal=[u/rx,v/ry,w/rz], n=Math.hypot(...normal);
      return [[x+rx*u,y+ry*v,z+rz*w],normal.map(q=>q/n)];
    };
    function face(a,b,c) {
      const offset=mesh.used[0];
      mesh.triangle([a[0],b[0],c[0]],color,material,a[1]);
      mesh.buffers[0].set(b[1],offset+15);
      mesh.buffers[0].set(c[1],offset+27);
    }
    for(let j=0;j<rows;j++) for(let i=0;i<sides;i++) {
      const a=vertex(i,j),b=vertex(i+1,j),c=vertex(i+1,j+1),d=vertex(i,j+1);
      if(j) face(a,b,d);
      face(b,c,d);
    }
  }
  const oval=(m,x,y,z,rx,ry,rz,c)=>ellipse(m,x,y,z,rx,ry,rz,c,9,6);
  function reclineAxes(yaw) {
    const s=Math.sin(yaw),c=Math.cos(yaw);
    return {right:[-c,0,s],up:[s,0,c]};
  }
  function portraitFor(actor,t,season,voice,vessel) {
    const variant=actor.detached?null:actor.source?.portrait;
    const profile=CampusStories.cast[actor.who],a=actor.gesture==="walk"?t:actor.phase+t;
    const art=CampusPortraits[variant]??CampusPortraits[season+"-"+actor.who]??CampusPortraits[profile.portrait??actor.who];
    const speaking=voice===actor.uid || actor.gesture==="talk" || actor.gesture==="sing";
    const step=actor.walking && !profile.chair;
    const bob=step?.046*Math.abs(Math.sin(a*8.5)):.014*Math.sin(a*1.62);
    const roll=(step?.037:.014)*Math.sin(a*(step?4.25:1.12))+(speaking?.010*Math.sin(a*4.1):0);
    if(vessel) {
      return {actor,art,height:art.worldHeight,roll,
        origin:point(vessel,actor.x,.415+bob,actor.z-.45),
        world:point(vessel,actor.x,actor.y,actor.z),
        axes:{right:[vessel[0],vessel[4],vessel[8]],up:[-vessel[2],-vessel[6],-vessel[10]]}};
    }
    const world=[actor.x,actor.y,actor.z];
    if(art.layout==="recline") {
      return {actor,art,height:art.worldHeight,roll,world,
        origin:[actor.x,actor.y+.167+bob,actor.z],
        axes:reclineAxes(actor.yaw)};
    }
    return {actor,art,height:art.worldHeight*profile.size,roll,world,
      origin:[actor.x,actor.y+bob+.012,actor.z]};
  }
  function groupPortrait(scene,actors) {
    const {portrait,at,yaw,roll=0}=scene.group,art=CampusPortraits[portrait];
    const x=scene.at[0]+at[0],z=scene.at[1]+at[1],flat=art.layout==="recline";
    return {members:actors,art,height:art.worldHeight,roll:roll*rad,
      origin:[x,floor+(flat?.151:.012),z],
      axes:flat?reclineAxes(yaw*rad):undefined};
  }

  function boat(mesh) {
    const timber=rgb(0xa9795a),trim=rgb(0xd1ae87),inside=rgb(0x624c42),red=rgb(0x906052);
    const ribs=[[-2.63,.074,.358],[-2.13,.69,.49],[-1.30,1.02,.49],[0,1.13,.46],
      [1.28,1.01,.49],[2.13,.70,.53],[2.72,.065,.65]];
    function cross(section,side,wall) {
      const [z,w,h]=section;
      return [side*w*(wall?1:.70),wall?h:.10,z];
    }
    for(let i=1;i<ribs.length;i++) {
      const a=ribs[i-1],b=ribs[i];
      for(const side of [-1,1]) {
        const p=cross(a,side,false),q=cross(b,side,false),r=cross(b,side,true),s=cross(a,side,true);
        mesh.face([p,q,r,s],mix(timber,red,i%2*.24),M.WOOD);
        mesh.rod(s,r,.061,.057,trim,7,M.WOOD);
        mesh.rod(p.map((v,i)=>.42*v+.58*s[i]),q.map((v,i)=>.42*v+.58*r[i]),.020,.020,red,6,M.WOOD);
      }
      mesh.face([cross(a,-1,false),cross(b,-1,false),cross(b,1,false),cross(a,1,false)],inside,M.WOOD,true);
    }
    for(let i=-4;i<=4;i++) mesh.box(i*.18,.14,0,.154,.066,4.08-Math.abs(i)*.31,trim,0,M.WOOD);
    for(const [z,w] of [[-1.50,1.74],[1.61,1.72]]) mesh.box(0,.34,z,w,.088,.323,timber,0,M.WOOD);
    mesh.rod([.91,.48,-1.75],[.96,.54,.85],.035,.036,trim,7,M.WOOD);
    oval(mesh,.956,.54,1.076,.108,.042,.272,timber);
    mesh.box(0,.643,2.536,.141,.053,.177,trim,0,M.WOOD);
  }
  function patchOfFlowers(mesh,palette,autumn=false,clearArea=null) {
    for(let i=0;i<43;i++) {
      const a=i*2.399963,r=.68+Math.sqrt(i)*.39,x=Math.cos(a)*r,z=Math.sin(a)*r*.85;
      if(clearArea?.(x,z)) continue;
      if(autumn) {
        mesh.face([[x-.12,.018,z],[x,.052,z-.06],[x+.13,.032,z+.06],[x-.01,.019,z+.078]],palette[i%palette.length],M.SIMPLE,true);
      } else {
        const h=.10+(i%5)*.045;
        mesh.rod([x,0,z],[x+.027,h,z],.011,.008,rgb(0x70835a),4);
        oval(mesh,x+.027,h,z,.055,.024,.056,palette[i%palette.length]);
        oval(mesh,x+.027,h+.017,z,.019,.012,.020,rgb(0xe8c16b));
      }
    }
  }
  function picnic(mesh,group) {
    patchOfFlowers(mesh,[rgb(0xcb8b4a),rgb(0xc4794e),rgb(0xe0b05b),rgb(0xbb6754)],true);
    const [cx,cz]=group.at,angle=(group.yaw-180)*rad,placement=pose(cx,0,cz,angle);
    mesh.box(cx,.028,cz,4.48,.031,3.39,rgb(0xc4978c),angle);
    for(let i=0;i<7;i++) {
      const [x,,z]=point(placement,0,0,(i-3)*.46);
      mesh.box(x,.046,z,4.48,.008,.061,rgb(0xe1c1a6),angle);
    }
    const [trayX,,trayZ]=point(placement,2.63,0,.56);
    mesh.box(trayX,.219,trayZ,.63,.38,.457,rgb(0xc39966),.15,M.WOOD);
    const curve=i=>[trayX+.25*Math.cos(i*Math.PI/8),.381+.29*Math.sin(i*Math.PI/8),trayZ];
    for(let i=0;i<8;i++) mesh.rod(curve(i),curve(i+1),.028,.029,wood,6,M.WOOD);
    for(let i=0;i<2;i++) {
      const [x,,z]=point(placement,-1.91,0,1.19+i*.23);
      mesh.box(x,.073,z,.37,.062,.218,cream,angle-.18);
      mesh.box(x,.110,z,.35,.016,.191,rgb(0x7d966c),angle-.18);
      mesh.box(x,.133,z,.37,.039,.218,rgb(0xe2c596),angle-.18);
    }
  }
  function igloo(mesh) {
    const rx=1.28,ry=1.35,rz=1.21;
    const ring=(a,b)=>[rx*Math.cos(b)*Math.sin(a),ry*Math.sin(b),rz*Math.cos(a)*Math.cos(b)];
    for(let row=0;row<6;row++) {
      const bottom=row*Math.PI/12,top=(row+1)*Math.PI/12-.014;
      for(let i=0;i<20;i++) {
        const a=(i+.5*(row%2))*TAU/20,b=a+TAU/20-.018;
        if((i===0 || i===19) && row<3) continue;
        mesh.face([ring(a,bottom),ring(b,bottom),ring(b,top),ring(a,top)],mix(snow,paleBlue,.15+.12*Math.sin(i*7.8+row)**2));
      }
    }
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/8,b=(i+1)*Math.PI/8;
      const arch=(r,t,z)=>[r*Math.cos(t),r*Math.sin(t),z];
      mesh.face([arch(.43,a,1.28),arch(.43,b,1.28),arch(.66,b,1.41),arch(.66,a,1.41)],snow);
      mesh.face([arch(.43,a,1.28),arch(.43,b,1.28),arch(.38,b,.97),arch(.38,a,.97)],paleBlue);
    }
    mesh.face([[.43,.018,1.27],[-.43,.018,1.27],[-.38,.018,.68],[.38,.018,.68]],paleBlue,M.SIMPLE,true);
    for(const [x,z] of [[-1.42,1], [1.37,.94], [1.42,-.81]]) oval(mesh,x,.17,z,.285,.188,.278,snow);
    mesh.rod([1.45,.192,1.63],[1.49,.939,1.65],.029,.028,wood,6);
    mesh.box(1.47,.11,1.66,.265,.203,.072,rgb(0x53738a),.12);
    oval(mesh,-2.70,.425,.21,.49,.49,.46,snow);
    oval(mesh,-2.70,1.026,.23,.34,.34,.331,snow);
    oval(mesh,-2.70,.812,.245,.36,.084,.35,rgb(0xa26975));
    for(const side of [-1,1]) oval(mesh,-2.70+side*.109,1.071,.54,.03,.031,.02,ink);
    mesh.rod([-2.70,1.006,.544],[-2.70,.978,.69],.041,.009,rgb(0xd28850),8);
  }
  function stageProp(scene) {
    const type=scene.set;
    if(!props.has(type)) {
      const build={boat,igloo,picnic:m=>picnic(m,scene.group),
        petals:m=>patchOfFlowers(m,[rgb(0xeab3c0),cream,rgb(0xde96b1)],true),
        meadow:m=>{
          const flowers=[cream,rgb(0xdfb766),rgb(0xc7a3cd)],stem=rgb(0x71855d);
          const a=scene.camera[0]*rad,c=Math.cos(a),s=Math.sin(a);
          patchOfFlowers(m,flowers,false,(x,z)=>((c*x-s*z)/1.92)**2+((s*x+c*z+.105)/1.22)**2<1);
          for(const [x,z] of [[-1.99,.86],[2.15,.8]]) {
            for(let i=0;i<10;i++) {
              const angle=i*2.399963, radius=.14+Math.sqrt(i)*.13;
              const u=x+Math.cos(angle)*radius,v=z+Math.sin(angle)*radius*.45;
              const h=.152+.030*(i%5);
              m.rod([u,0,v],[u+.04,h,v],.012,.008,stem,4);
              oval(m,u+.044,h,v,.057,.023,.045,flowers[i%flowers.length]);
            }
          }
        },
        song:m=>patchOfFlowers(m,[rgb(0xb6a8c7),cream,rgb(0xa6b988)]),
        stars:m=>{
          const x=1.05,z=-1.78,lampX=x+.42,lampZ=z-.02;
          m.box(x,.755,z,1.16,.066,.62,wood,.18,M.WOOD);
          for(const s of [-1,1]) m.rod([x+s*.24,0,z-.06],[x+s*.17,.743,z],.037,.047,wood,7,M.WOOD);
          m.box(x,.798,z,.54,.027,.405,rgb(0x6b8192),.18);
          for(const [dx,dz] of [[-.15,.02],[-.01,.08],[.12,-.01],[.10,-.14],[-.08,-.12]]) m.disc(x+dx,.819,z+dz,.021,.021,cream,0,5);
          m.box(lampX,.826,lampZ,.26,.075,.26,wood);
          m.box(lampX,.985,lampZ,.192,.27,.192,rgb(0xf3bb66),0,M.LIT);
          m.box(lampX,1.13,lampZ,.26,.07,.26,ink);
          for(const u of [-.091,.091]) for(const v of [-.091,.091]) {
            m.rod([lampX+u,.830,lampZ+v],[lampX+u,1.16,lampZ+v],.013,.013,ink,5);
          }
          m.rod([lampX-.12,1.15,lampZ],[lampX,1.236,lampZ],.021,.018,ink,6);
          m.rod([lampX,1.236,lampZ],[lampX+.12,1.15,lampZ],.018,.021,ink,6);
        },
        snowwalk:m=>{
          for(let i=0;i<18;i++) {
            const x=(i-8.5)*.246,z=Math.sin(i*.27)*.61+(i%2?.16:-.16);
            m.disc(x-.30,.012,z+.42,.112,.140,paleBlue,0,9);
            m.disc(x+.04,.013,z-.38,.114,.143,paleBlue,0,9);
          }
        }}[type];
      props.set(type,meshPart(build));
    }
    return props.get(type);
  }
  const shadow=meshPart(m=>{
    for(let i=0;i<16;i++) {
      const a=i*TAU/16,b=(i+1)*TAU/16, u=[Math.cos(a),Math.sin(a)],v=[Math.cos(b),Math.sin(b)];
      m.triangle([[0,0,0],[u[0]*.71,0,u[1]*.51],[v[0]*.71,0,v[1]*.51]],rgb(0x364639),M.FIGURE_SHADOW,[0,1,0],[[0,0],u,v]);
    }
  });
  function boatAt(t) {
    const [x,z]=Angraecum.pondCenter,a=t*TAU/46+.42,rx=8.35,rz=3.65;
    // The route sits away from the pier so the hull clears it as the boat turns.
    const yaw=Math.atan2(-rx*Math.sin(a),rz*Math.cos(a));
    return pose(x+rx*Math.cos(a),.069+.034*Math.sin(t*2.4),z+1.92+rz*Math.sin(a),yaw,
      .016*Math.cos(t*2.4),.043*Math.sin(t*1.5));
  }
  function build(actors,scene,time,season,voice) {
    length=0;
    const vessel=scene?.set==="boat"?boatAt(time):null;
    if(scene) stream(stageProp(scene),vessel??pose(scene.at[0],floor,scene.at[1]));
    for(const actor of actors) actor.pick=null;
    const grouped=scene?.group && actors.length===scene.cast.length && actors.every(actor=>!actor.detached);
    const sprites=grouped?[groupPortrait(scene,actors)]:
      actors.map(actor=>portraitFor(actor,time,season,voice,actor.aboard?vessel:null));
    const opaque=length/12;
    for(const {actor,art,origin} of sprites) {
      if(actor?.aboard) continue;
      if(!actor) {
        if(art.layout==="stand") stream(shadow,pose(origin[0],floor+.008,origin[2],0,0,0,1.76));
        continue;
      }
      const scale=art.layout==="recline"?1.29:1.03;
      stream(shadow,pose(actor.x,actor.y+.008,actor.z,actor.yaw,0,0,scale));
    }
    const glow=scene?.glow?[scene.at[0]+scene.glow[0],scene.glow[1]+floor,scene.at[1]+scene.glow[2]]:null;
    const wake=vessel?[vessel[3],vessel[11],vessel[2],vessel[10]]:null;
    return {data:vertices.subarray(0,length),opaque,shadows:length/12-opaque,sprites,light:scene?.light,glow,wake};
  }

  return {build,floor};
})();
