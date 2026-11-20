"use strict";

(() => {
  const { TAU, clamp, lerp, random } = Angraecum.math;
  const $ = (id) => document.getElementById(id);
  const canvas=$("campus"), particleCanvas=$("particles"), ink=particleCanvas.getContext("2d");
  const seasonButtons=Array.from(document.querySelectorAll("[data-pick]"));
  const viewpointButtons=Array.from(document.querySelectorAll("[data-view]"));
  const tabs=Array.from(document.querySelectorAll('[role="tab"]'));
  const ranges=Array.from(document.querySelectorAll(".slider:not(.voice-slider) input"));
  const controls=Object.fromEntries(ranges.map(el=>[el.id,{el,out:el.parentNode.querySelector("output")}]));
  const cameraKeys=["zoom","elevation","azimuth","parallax"];
  const effectKeys=["blur","focus","density"];
  const titleToggle=$("show-title");
  const fpsSelect=new CampusPicker($("fps-limit"));
  const fpsOptions=[["0","不限帧"],["240","240 FPS"],["144","144 FPS"],["60","60 FPS"]];
  const fpsChoices=new Set(["auto",...fpsOptions.map(([value])=>value)]);
  const browserFPS=60;
  fpsSelect.setOptions(fpsOptions,String(browserFPS));
  const orbitPad=$("orbit-pad"), dragView=$("drag-view");
  const dock=$("controls"), settings=$("settings"), grip=$("controls-grip");
  const dockMargin=12, dockGap=11, taskbarGap=parseFloat(getComputedStyle(dock).getPropertyValue("--taskbar-gap"));
  const musicPlayer=$("soundtrack"), musicTrack=$("music-track"), musicPicker=$("music-picker"),
    musicSelection=$("music-selection"), musicAction=$("music-action"), musicStatus=$("music-status");
  const tracks=new Map(Array.from(musicTrack.querySelectorAll("input"),input=>[input.value,input]));
  const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const {azimuth,elevation,zoom}=Angraecum.presets.campus;
  const defaults=Object.freeze({
    season:"spring",viewTarget:"campus",zoom,elevation,azimuth,parallax:reduced?0:6,
    blur:62,focus:0,density:70,effects:!reduced,labels:false,panel:true,showTitle:true,quality:"standard",fpsLimit:"auto",
    musicTrack:"off",musicVolume:35,musicPaused:false,dragView:false,dockPosition:null
  });
  const localKey="angraecum-estate-settings-2";
  const previousBearings={
    4:{campus:318,forecourt:350,pavilion:335,chapel:345,rokkaen:24,glass:341},
    5:{campus:30,forecourt:80,pavilion:323,chapel:75,rokkaen:109,glass:341}
  };
  const state={...defaults};
  const flags=["effects","labels","panel"];
  const sceneIDs=Object.keys(Angraecum.seasons);
  const display={
    zoom:n=>n+"%",elevation:n=>Number(n.toFixed(1))+"°",azimuth:n=>n+"°",parallax:n=>n+"°",
    blur:n=>n+"%",density:n=>n+"%",focus:n=>n===0?"中央":(n>0?"近 ":"远 ")+Math.abs(n),musicVolume:n=>n+"%"
  };
  const markers=Angraecum.markers.map(([label,[x,z],y])=>{
    const element=document.createElement("span");
    element.className="landmark";
    element.textContent=label;
    $("landmarks").append(element);
    return {label,point:[x,y,z],element};
  });
  const rng=random(139527);
  const moteCapacity=Math.ceil(Math.max(...Object.values(Angraecum.seasons).map(s=>s.count))*Number(controls.density.el.max)/100);
  const motes=Array.from({length:moteCapacity},()=>[rng(),rng(),rng(),rng(),rng()]);

  let renderer=null, framing=null, raf=0, nextFrame=0, lastTime=0, time=0;
  let viewDirty=true, modelDirty=true, panelHidden=false, expanded=false, paused=false;
  let width=1,height=1,aspect=1, mouseX=0,mouseY=0, driftX=0,driftY=0;
  let orbit=null, dockDrag=null, suppressClick=false, musicRequest=0;
  let people=null, venue=null, returnView=null, speaking=false;
  let engineFPS=null;

  function numberValue(key,raw) {
    const el=controls[key].el;
    let n=Number(raw);
    if(!Number.isFinite(n)) return state[key];
    if(key==="azimuth" && (n<0 || n>360)) n=CampusView.wrapBearing(n);
    const step=Number(el.step),min=Number(el.min);
    const value=min+Math.round((n-min)/step)*step;
    return clamp(Number(value.toFixed(2)),min,Number(el.max));
  }
  function restorePreferences() {
    try {
      const saved=JSON.parse(localStorage.getItem(localKey) || "{}");
      if(sceneIDs.includes(saved.season)) state.season=saved.season;
      else if(sceneIDs.includes(localStorage.getItem("angraecum-season"))) {
        state.season=localStorage.getItem("angraecum-season");
      }
      for(const key of [...cameraKeys,...effectKeys,"musicVolume"]) {
        if(Number.isFinite(saved[key])) state[key]=numberValue(key,saved[key]);
      }
      if(typeof saved.labels==="boolean") state.labels=saved.labels;
      if(typeof saved.showTitle==="boolean") state.showTitle=saved.showTitle;
      if(fpsChoices.has(saved.fpsLimit)) state.fpsLimit=saved.fpsLimit;
      if(tracks.has(saved.musicTrack)) state.musicTrack=saved.musicTrack;
      if(typeof saved.musicPaused==="boolean") state.musicPaused=saved.musicPaused;
      if(typeof saved.dragView==="boolean") state.dragView=saved.dragView;
      if(Array.isArray(saved.dockPosition) && saved.dockPosition.length===2 && saved.dockPosition.every(Number.isFinite)) {
        state.dockPosition=saved.dockPosition;
      }
      const target=saved.viewTarget==="dorm"?"rokkaen":saved.viewTarget;
      if(Object.prototype.hasOwnProperty.call(Angraecum.presets,target)) state.viewTarget=target;
      const oldBearing=previousBearings[saved.layout??4]?.[state.viewTarget];
      if(oldBearing!==undefined && saved.azimuth===oldBearing) {
        state.azimuth=Angraecum.presets[state.viewTarget].azimuth;
        const oldZoom=saved.layout===5?108:104;
        if(state.viewTarget==="campus" && saved.zoom===oldZoom) state.zoom=defaults.zoom;
      }
    } catch (_) {}
  }
  function remember() {
    try {
      const keys=["season","labels","showTitle","viewTarget",...cameraKeys,...effectKeys,
        "fpsLimit","musicTrack","musicVolume","musicPaused","dragView","dockPosition"];
      const preferences=Object.fromEntries(keys.map(key=>[key,returnView?.[key]??state[key]]));
      localStorage.setItem(localKey,JSON.stringify({layout:6,...preferences}));
    } catch (_) {}
  }
  function notice(message) {
    $("notice").textContent=message;
    $("notice").hidden=!message;
  }
  function updateControl(key) {
    const {el,out}=controls[key];
    el.value=state[key];
    out.value=display[key](state[key]);
  }
  function updateMusicButton() {
    musicAction.disabled=state.musicTrack==="off";
    musicAction.textContent=musicPlayer.paused?"播放":"暂停";
  }
  function syncMusicVolume() {
    musicPlayer.volume=state.musicVolume/100*(speaking?.47:1);
  }
  function showMusicStatus(message) {
    musicStatus.textContent=message;
    musicStatus.hidden=!message;
  }
  function syncMusic(retry=false) {
    const request=++musicRequest;
    const source=musicPlayer.getAttribute("src");
    if(state.musicTrack==="off") {
      musicPlayer.pause();
      if(source) {
        musicPlayer.removeAttribute("src");
        musicPlayer.load();
      }
      showMusicStatus("");
    } else {
      const track=`music/${state.musicTrack}.ogg`;
      if(source!==track) {
        musicPlayer.pause();
        musicPlayer.src=track;
        showMusicStatus("");
      } else if(retry && musicPlayer.error) musicPlayer.load();
      if(paused || document.hidden || state.musicPaused) musicPlayer.pause();
      else if(musicPlayer.paused) musicPlayer.play().catch(error=>{
        if(request!==musicRequest || error.name==="AbortError") return;
        showMusicStatus(error.name==="NotAllowedError"?"点击「播放」继续配乐。":"这首配乐暂时无法播放。");
        updateMusicButton();
      });
    }
    updateMusicButton();
  }
  function updateInterface() {
    document.body.dataset.season=state.season;
    for(const button of seasonButtons) button.setAttribute("aria-pressed",String(button.dataset.pick===state.season));
    for(const button of viewpointButtons) button.setAttribute("aria-pressed",String(!venue && button.dataset.view===state.viewTarget));
    $("story-focus").setAttribute("aria-pressed",String(isStoryFocused()));
    $("story-unfocus").setAttribute("aria-pressed",String(!isStoryFocused()));
    const hidden=!state.panel || panelHidden;
    dock.hidden=hidden;
    $("heading").hidden=hidden || !state.showTitle;
    titleToggle.checked=state.showTitle;
    dragView.checked=state.dragView;
    fpsSelect.value=state.fpsLimit==="auto" && engineFPS===null?String(browserFPS):state.fpsLimit;
    $("restore").hidden=!state.panel || !panelHidden;
    settings.hidden=!expanded || hidden;
    $("expand").setAttribute("aria-expanded",String(expanded && !hidden));
    $("show-labels").setAttribute("aria-pressed",String(state.labels));
    $("landmarks").hidden=!state.labels;
    for(const key of Object.keys(controls)) updateControl(key);
    const track=tracks.get(state.musicTrack);
    track.checked=true;
    musicSelection.textContent=track.labels[0].textContent;
    updateMusicButton();
    positionDock();
  }
  function wake() {
    if(!raf && renderer && !paused && !document.hidden) raf=requestAnimationFrame(draw);
  }
  function invalidate() {
    viewDirty=true;
    wake();
  }
  function stop() {
    if(raf) cancelAnimationFrame(raf);
    raf=0;
    nextFrame=0;
    lastTime=0;
  }
  function reframe() {
    framing=CampusView.frameCamera(aspect,state,venue);
    invalidate();
  }
  function isStoryFocused() { return venue?.kind==="story"; }
  function focusFigures(next) {
    if(!next && !returnView) return;
    endOrbit();
    const keys=["azimuth","elevation","zoom"];
    if(next) {
      if(!returnView) returnView=Object.fromEntries(keys.map(key=>[key,state[key]]));
      keys.forEach((key,i)=>state[key]=numberValue(key,next.camera[i]));
    } else {
      Object.assign(state,returnView);
      returnView=null;
    }
    venue=next;
    mouseX=mouseY=driftX=driftY=0;
    updateInterface();
    reframe();
  }
  function beginOrbit(e) {
    if(orbit || !renderer || paused) return;
    e.preventDefault();
    const target=e.currentTarget;
    orbit={id:e.pointerId,target,button:e.button,x:e.clientX,y:e.clientY,
      azimuth:state.azimuth+driftX,elevation:state.elevation+driftY,moved:false};
    target.classList.add("orbiting");
    try { target.setPointerCapture(e.pointerId); } catch (_) {}
  }
  function endOrbit(e) {
    if(!orbit || (e && e.pointerId!==orbit.id)) return;
    const {id,target,moved,button}=orbit;
    orbit=null;
    target.classList.remove("orbiting");
    if(target.hasPointerCapture(id)) target.releasePointerCapture(id);
    if(moved) {
      if(target===canvas && button===0) suppressClick=true;
      remember();
    }
    invalidate();
  }
  function moveOrbit(e) {
    if(!orbit || e.pointerId!==orbit.id) return;
    const dx=e.clientX-orbit.x,dy=e.clientY-orbit.y;
    if(!dx && !dy) return;
    orbit.x=e.clientX;
    orbit.y=e.clientY;
    orbit.azimuth=CampusView.wrapBearing(orbit.azimuth-dx*.28);
    orbit.elevation=clamp(orbit.elevation-dy*.2,8,85);
    orbit.moved=true;
    mouseX=mouseY=driftX=driftY=0;
    for(const key of ["azimuth","elevation"]) {
      state[key]=numberValue(key,orbit[key]);
      updateControl(key);
    }
    reframe();
  }
  function positionDock() {
    if(dock.hidden) return;
    if(state.dockPosition) {
      const [x,y]=state.dockPosition;
      const left=clamp(x,dockMargin,Math.max(dockMargin,width-dock.offsetWidth-dockMargin));
      const top=clamp(y,dockMargin,Math.max(dockMargin,height-dock.offsetHeight-taskbarGap));
      Object.assign(dock.style,{right:"auto",bottom:"auto",left:left+"px",top:top+"px"});
    }
    if(settings.hidden) return;
    const rect=dock.getBoundingClientRect();
    const above=rect.top-dockGap-dockMargin, below=height-taskbarGap-rect.bottom-dockGap;
    settings.classList.toggle("below",below>above);
    settings.style.maxHeight=Math.max(0,above,below)+"px";
    const left=clamp(rect.right-settings.offsetWidth,dockMargin,Math.max(dockMargin,width-settings.offsetWidth-dockMargin));
    settings.style.left=(left-rect.left)+"px";
    settings.style.right="auto";
  }
  function endDockDrag(e) {
    if(!dockDrag || (e && e.pointerId!==dockDrag.id)) return;
    const {id,moved}=dockDrag;
    dockDrag=null;
    grip.classList.remove("dragging");
    if(grip.hasPointerCapture(id)) grip.releasePointerCapture(id);
    if(moved) remember();
  }
  function resize() {
    width=Math.max(1,canvas.clientWidth);
    height=Math.max(1,canvas.clientHeight);
    aspect=width/height;
    const ratio=Math.min(1.3,devicePixelRatio||1);
    particleCanvas.width=Math.round(width*ratio);
    particleCanvas.height=Math.round(height*ratio);
    if(ink) ink.setTransform(ratio,0,0,ratio,0,0);
    if(renderer) renderer.resize(width,height,state.quality);
    positionDock();
    reframe();
  }
  function changeSeason(id,save=false) {
    if(!sceneIDs.includes(id)) return;
    if(id!==state.season) {
      state.season=id;
      people?.setSeason(id);
      modelDirty=true;
    }
    updateInterface();
    if(save) remember();
    invalidate();
  }
  function changeView(target) {
    endOrbit();
    venue=returnView=null;
    const preset=Angraecum.presets[target];
    state.viewTarget=target;
    for(const key of ["azimuth","elevation","zoom"]) state[key]=preset[key];
    mouseX=mouseY=driftX=driftY=0;
    updateInterface();
    remember();
    reframe();
  }
  function projectMarkers(view) {
    const placed=[];
    for(const [i,{element,point,label}] of markers.entries()) {
      const [x,y,z]=CampusView.project(point,view);
      const depth=framing.depthShift-z*framing.depthRadius;
      const left=width*(x*.5+.5),top=height*(.5-y*.5)-8,margin=label.length*7+7;
      const rect=[left-margin,top-25,left+margin,top];
      const intersects=placed.some(p=>rect[0]<p[2]&&rect[2]>p[0]&&rect[1]<p[3]&&rect[3]>p[1]);
      element.hidden=Math.abs(z)>1 || depth>framing.foregroundLimit || intersects ||
        (i>6&&width<640) || left<margin || left>width-margin || top<25 || top>height-8;
      if(!element.hidden) {
        element.style.left=left+"px";
        element.style.top=top+"px";
        placed.push(rect);
      }
    }
  }
  function drawMotes(s) {
    if(!ink) return;
    ink.clearRect(0,0,width,height);
    if(!state.effects || !state.density) return;
    const leaf=s.id==="autumn",pollen=s.id==="summer",pink=s.id==="spring";
    const count=Math.min(motes.length,Math.round(s.count*state.density/100*(state.quality==="low" ? .65 : 1)));
    const frac=(n)=>n-Math.floor(n);
    const brightness=s.particle.map(v=>Math.round(v*255)).join(",");
    const sizeScale=clamp(height/880,.58,1.45);
    for(let i=0;i<count;i++) {
      const [a,b,d,p,w]=motes[i];
      const drift=Math.sin(time*(.31+d*.45)+p*TAU);
      const u=frac(a+time*(leaf ? .019 : .008)+drift*.024-driftX*.026)*width;
      const v=frac(b+time*s.wind*(.51+d)+Math.cos(time*.29+w*TAU)*.026-driftY*.02)*height;
      const size=(.63+2.57*d)*sizeScale;
      ink.fillStyle="rgb("+brightness+")";
      ink.globalAlpha=(.24+.44*d)*(pollen ? .67 + .30*drift:1);
      ink.beginPath();
      if(leaf||pink) {
        ink.ellipse(u,v,size*1.34,size*.57,drift*1.47+p*Math.PI,0,TAU);
      } else if(pollen) {
        ink.arc(u,v,size*.66,0,TAU);
      } else {
        ink.arc(u,v,size*.76,0,TAU);
      }
      ink.fill();
    }
    ink.globalAlpha=1;
  }
  function draw(now) {
    raf=0;
    if(!renderer || paused || document.hidden) return;
    const fps=state.fpsLimit==="auto" ? engineFPS??browserFPS : Number(state.fpsLimit);
    if(fps>0) {
      const interval=1000/fps;
      if(nextFrame && now+.25<nextFrame) { wake(); return; }
      if(!nextFrame || now-nextFrame>=interval) nextFrame=now;
      nextFrame+=interval;
    }
    const dt=lastTime?Math.min(.09,(now-lastTime)/1000):1/30;
    lastTime=now;
    if(state.effects) time=(time+dt)%4096;

    const fixed=orbit || people.interacting;
    const targetX=fixed?driftX:mouseX*state.parallax,targetY=fixed?driftY:-mouseY*state.parallax*.47;
    const oldX=driftX,oldY=driftY,t=1-Math.exp(-dt*7.5);
    driftX=Math.abs(driftX-targetX)<.005?targetX:lerp(driftX,targetX,t);
    driftY=Math.abs(driftY-targetY)<.005?targetY:lerp(driftY,targetY,t);
    const s=Angraecum.seasons[state.season];
    if(modelDirty) {
      try {
        renderer.load(s,state.quality);
        modelDirty=false;
        viewDirty=true;
        notice("");
      } catch(error) {
        console.error(error);
        notice("场景初始化失败，请重新打开壁纸。");
        return;
      }
    }
    if(viewDirty || state.effects || people.animated || oldX!==driftX || oldY!==driftY) {
      const view=CampusView.viewAt(framing,state.azimuth+driftX,state.elevation+driftY);
      renderer.draw(view,framing,state.effects?time:0,state.blur,state.focus,people.build(dt,state.season));
      people.updateView(view,framing);
      if(state.labels) projectMarkers(view.matrix);
      drawMotes(s);
      viewDirty=false;
    }
    if(state.effects || people.animated || driftX!==targetX || driftY!==targetY) wake();
  }

  window.wallpaperPropertyListener={
    applyUserProperties(properties) {
      const values=(name)=>properties[name]?.value;
      if(properties.azimuth || properties.elevation) endOrbit();
      if(properties.season) changeSeason(String(values("season")));
      if(["low","standard","high"].includes(values("quality")) && state.quality!==values("quality")) {
        state.quality=values("quality");
        modelDirty=true;
        if(renderer) renderer.resize(width,height,state.quality);
      }
      for(const key of [...cameraKeys,...effectKeys]) {
        if(properties[key]) state[key]=numberValue(key,values(key));
      }
      for(const key of flags) {
        if(properties[key]) state[key]=[true,1,"true","1"].includes(values(key));
      }
      if(properties.panel) panelHidden=false;
      updateInterface();
      reframe();
    },
    applyGeneralProperties(properties) {
      const value=properties.fps;
      const fps=Number(value?.value??value);
      if(!Number.isFinite(fps) || fps<=0) return;
      engineFPS=clamp(fps,1,240);
      fpsSelect.setOptions([...fpsOptions,["auto",`跟随引擎（${engineFPS} FPS）`]],state.fpsLimit);
      if(state.fpsLimit==="auto") {
        fpsSelect.value="auto";
        nextFrame=0;
        invalidate();
      }
    },
    setPaused(isPaused) {
      paused=!!isPaused;
      if(paused) { endOrbit(); endDockDrag(); people?.stopVoice(); people?.cancelOperation(); stop(); }
      else invalidate();
      syncMusic();
    }
  };

  function resetPointer() {
    if(!mouseX && !mouseY) return;
    mouseX=mouseY=0;
    invalidate();
  }
  function selectTab(tab,focus=false) {
    for(const item of tabs) {
      const active=tab===item;
      item.setAttribute("aria-selected",String(active));
      item.tabIndex=active?0:-1;
      $(item.getAttribute("aria-controls")).hidden=!active;
    }
    if(focus) tab.focus();
    positionDock();
  }
  function toggleOptions() {
    expanded=!expanded;
    resetPointer();
    updateInterface();
  }
  function toggleLabels() {
    state.labels=!state.labels;
    updateInterface();
    remember();
    invalidate();
  }
  function togglePanel() {
    panelHidden=!panelHidden;
    if(panelHidden) expanded=false;
    updateInterface();
  }
  function start() {
    try {
      renderer=new CampusView.Renderer(canvas,invalidate);
      notice("正在布置学院…");
      modelDirty=true;
      resize();
    } catch(error) {
      renderer=null;
      console.error(error);
      notice("当前环境无法初始化 WebGL。请用启用硬件加速的浏览器或 Wallpaper Engine 打开。");
    }
  }

  for(const tab of tabs) {
    tab.addEventListener("click",()=>selectTab(tab));
    tab.addEventListener("keydown",e=>{
      const i=tabs.indexOf(tab);
      const target={ArrowLeft:(i-1+tabs.length)%tabs.length,ArrowRight:(i+1)%tabs.length,Home:0,End:tabs.length-1}[e.key];
      if(target===undefined) return;
      e.preventDefault();
      selectTab(tabs[target],true);
    });
  }
  for(const {el} of Object.values(controls)) el.addEventListener("input",()=>{
    state[el.id]=numberValue(el.id,el.value);
    updateControl(el.id);
    if(cameraKeys.includes(el.id)) reframe();
    else if(el.id==="musicVolume") syncMusicVolume();
    else invalidate();
  });
  for(const {el} of Object.values(controls)) el.addEventListener("change",remember);
  for(const button of document.querySelectorAll("[data-reset]")) button.addEventListener("click",()=>{
    const keys=button.dataset.reset==="camera"?cameraKeys:effectKeys;
    if(button.dataset.reset==="camera") { endOrbit(); venue=returnView=null; }
    for(const key of keys) state[key]=defaults[key];
    if(button.dataset.reset==="camera") state.viewTarget="campus";
    updateInterface();
    remember();
    reframe();
  });
  for(const button of seasonButtons) button.addEventListener("click",()=>changeSeason(button.dataset.pick,true));
  for(const button of viewpointButtons) button.addEventListener("click",()=>changeView(button.dataset.view));
  $("expand").addEventListener("click",toggleOptions);
  titleToggle.addEventListener("change",()=>{
    state.showTitle=titleToggle.checked;
    updateInterface();
    remember();
  });
  dragView.addEventListener("change",()=>{
    state.dragView=dragView.checked;
    if(!state.dragView && orbit?.target===canvas) endOrbit();
    remember();
  });
  grip.addEventListener("pointerdown",e=>{
    if(e.button!==0 || dockDrag) return;
    e.preventDefault();
    const rect=dock.getBoundingClientRect();
    dockDrag={id:e.pointerId,left:rect.left,top:rect.top,x:e.clientX,y:e.clientY,moved:false};
    grip.classList.add("dragging");
    try { grip.setPointerCapture(e.pointerId); } catch (_) {}
  });
  grip.addEventListener("lostpointercapture",endDockDrag);
  window.addEventListener("pointermove",e=>{
    if(!dockDrag || e.pointerId!==dockDrag.id) return;
    const x=e.clientX-dockDrag.x,y=e.clientY-dockDrag.y;
    if(!dockDrag.moved && Math.hypot(x,y)<3) return;
    dockDrag.moved=true;
    state.dockPosition=[dockDrag.left+x,dockDrag.top+y];
    positionDock();
  });
  fpsSelect.element.addEventListener("change",()=>{
    if(!fpsChoices.has(fpsSelect.value)) return;
    state.fpsLimit=fpsSelect.value;
    nextFrame=0;
    remember();
    invalidate();
  });
  $("show-labels").addEventListener("click",toggleLabels);
  $("hide-controls").addEventListener("click",togglePanel);
  $("restore").addEventListener("click",togglePanel);
  musicTrack.addEventListener("change",()=>{
    state.musicTrack=musicTrack.querySelector(":checked").value;
    musicSelection.textContent=tracks.get(state.musicTrack).labels[0].textContent;
    musicPicker.open=false;
    state.musicPaused=false;
    syncMusic();
    remember();
  });
  musicAction.addEventListener("click",()=>{
    state.musicPaused=!musicPlayer.paused;
    syncMusic(true);
    remember();
  });
  musicPlayer.addEventListener("pause",updateMusicButton);
  musicPlayer.addEventListener("playing",()=>{
    showMusicStatus("");
    updateMusicButton();
  });
  musicPlayer.addEventListener("error",()=>{
    if(musicPlayer.error && state.musicTrack!=="off") showMusicStatus("这首配乐暂时无法播放。");
    updateMusicButton();
  });
  canvas.addEventListener("pointerdown",e=>{
    if(e.button===0) suppressClick=false;
    if(!state.dragView) return;
    if(e.button===1 || (e.button===0 && !people.interacting && !people.hit(e.clientX,e.clientY))) beginOrbit(e);
  });
  canvas.addEventListener("click",e=>{
    if(!suppressClick) return;
    suppressClick=false;
    e.stopImmediatePropagation();
  },true);
  orbitPad.addEventListener("pointerdown",e=>{ if(e.button===0) beginOrbit(e); });
  for(const target of [canvas,orbitPad]) target.addEventListener("lostpointercapture",endOrbit);
  for(const type of ["mousedown","auxclick"]) canvas.addEventListener(type,e=>{ if(e.button===1 && state.dragView) e.preventDefault(); });
  window.addEventListener("pointermove",moveOrbit);
  window.addEventListener("pointerup",endOrbit);
  window.addEventListener("pointercancel",endOrbit);
  window.addEventListener("pointerup",endDockDrag);
  window.addEventListener("pointercancel",endDockDrag);
  window.addEventListener("mousemove",e=>{
    if(orbit || people.interacting || !state.parallax || (e.target instanceof Element && e.target.closest("#controls,#restore,.figure-panel"))) return;
    mouseX=clamp(e.clientX*2/width-1,-1,1);
    mouseY=clamp(e.clientY*2/height-1,-1,1);
    invalidate();
  },{passive:true});
  document.documentElement.addEventListener("mouseleave",resetPointer);
  window.addEventListener("blur",()=>{ endOrbit(); endDockDrag(); resetPointer(); });
  window.addEventListener("resize",resize);
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden) { endOrbit(); endDockDrag(); people?.stopVoice(); people?.cancelOperation(); stop(); }
    else invalidate();
    syncMusic();
  });
  window.addEventListener("keydown",e=>{
    if(e.ctrlKey||e.metaKey||e.altKey||e.repeat) return;
    if(["1","2","3","4"].includes(e.key)) changeSeason(sceneIDs[Number(e.key)-1],true);
    if(e.key.toLowerCase()==="l") toggleLabels();
    if(state.panel && e.key.toLowerCase()==="h") togglePanel();
    if(state.panel && !panelHidden && e.key.toLowerCase()==="o") toggleOptions();
    if(expanded && e.key==="Escape") { toggleOptions(); $("expand").focus(); }
  });
  canvas.addEventListener("webglcontextlost",e=>{
    e.preventDefault();
    endOrbit();
    stop();
    renderer=null;
    notice("正在等待图形设备恢复…");
  });
  canvas.addEventListener("webglcontextrestored",start);
  restorePreferences();
  people=new CampusPeople.Controller(canvas,{invalidate,focus:focusFigures,isStoryFocused,voiceMix:active=>{
    speaking=active;
    syncMusicVolume();
  }});
  people.setSeason(state.season);
  updateInterface();
  syncMusicVolume();
  syncMusic();
  start();
})();
