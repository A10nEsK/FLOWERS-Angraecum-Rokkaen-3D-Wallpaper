"use strict";

const CampusPeople=(()=>{
  const {cast,scenes}=CampusStories, {clamp}=Angraecum.math;
  const $=id=>document.getElementById(id);
  const modes=["off","story","free"], limit=18, rad=Math.PI/180, storageKey="angraecum-people-1";
  const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1],
    KeyA:[-1,0],KeyD:[1,0],KeyW:[0,-1],KeyS:[0,1]};

  class Controller {
    constructor(canvas,callbacks) {
      this.canvas=canvas;
      this.callbacks=callbacks;
      this.options=$("people-settings");
      this.choice=new CampusPicker($("story-choice"));
      this.figureChoice=new CampusPicker($("figure-choice"));
      this.list=$("figure-list");
      this.menu=$("figure-menu");
      this.pad=$("figure-joystick");
      this.drivePanel=$("figure-drive");
      this.driveGrip=$("figure-drive-grip");
      this.drivePosition=null;
      this.drivePanelDrag=null;
      this.dot=$("figure-dot");
      this.audio=$("figure-voice");
      this.labelLayer=$("figure-names");
      this.season=null;
      this.mode="off";
      this.selected={};
      this.storyActors=[];
      this.freeActors=[];
      this.labels=false;
      this.volume=62;
      this.ids=0;
      this.clock=0;
      this.reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.stick=[0,0];
      this.keys=new Set();
      this.lastClip={};
      this.castNodes=new Map();
      this.restore();
      this.audio.volume=this.volume/100;
      this.figureChoice.setOptions(Object.entries(cast).map(([id,person])=>[id,person.name]));
      this.bind();
    }
    restore() {
      try {
        const saved=JSON.parse(localStorage.getItem(storageKey)||"{}");
        if(modes.includes(saved.mode)) this.mode=saved.mode;
        if(typeof saved.labels==="boolean") this.labels=saved.labels;
        if(Number.isFinite(saved.volume)) this.volume=clamp(saved.volume,0,100);
        if(Array.isArray(saved.drivePosition) && saved.drivePosition.length===2 && saved.drivePosition.every(Number.isFinite)) {
          this.drivePosition=saved.drivePosition;
        }
        for(const [season,options] of Object.entries(scenes)) {
          if(options.some(option=>option.id===saved.selected?.[season])) this.selected[season]=saved.selected[season];
        }
        const placements=Array.isArray(saved.free)?saved.free.slice(0,limit):[];
        for(const item of placements) {
          if(!item || !Object.prototype.hasOwnProperty.call(cast,item.who) || !Angraecum.canStand(item.x,item.z)) continue;
          const actor=this.actor(item.who,item.x,item.z,Number.isFinite(item.yaw)?item.yaw:0);
          if(Angraecum.canStand(item.home?.x,item.home?.z) && Number.isFinite(item.home.yaw)) actor.home=item.home;
          this.freeActors.push(actor);
        }
      } catch (_) {}
    }
    save() {
      const {mode,selected,labels,volume,drivePosition}=this;
      const free=this.freeActors.map(({who,x,z,yaw,home})=>({who,x,z,yaw,home}));
      try { localStorage.setItem(storageKey,JSON.stringify({mode,selected,labels,volume,free,drivePosition})); } catch (_) {}
    }
    actor(who,x,z,yaw) {
      const uid=++this.ids;
      return {uid,who,x,y:CampusFigures.floor,z,yaw,phase:uid*1.72,home:{x,z,yaw}};
    }
    setSeason(season) {
      if(season===this.season) return;
      const keepFocus=this.settle(true);
      this.season=season;
      const options=scenes[season];
      if(!this.selected[season]) this.selected[season]=options[0].id;
      this.choice.setOptions(options.map(scene=>[scene.id,scene.name]),this.selected[season]);
      this.resetStory();
      if(keepFocus) this.focusScene();
    }
    get scene() {
      return this.mode==="story"?scenes[this.season].find(scene=>scene.id===this.selected[this.season]):null;
    }
    get active() {
      if(this.mode==="story") return this.storyActors;
      return this.mode==="free"?this.freeActors:[];
    }
    get animated() {
      return (!this.reduced && (this.active.length>0 || !!this.scene)) || (this.driver && this.hasDirection());
    }
    get interacting() { return !!(this.target || this.mover || this.driver); }
    resetStory() {
      this.clock=0;
      this.storyActors=this.scene?.cast.map(spec=>{
        const actor=this.actor(spec.who,...this.scene.at,0);
        actor.source=spec;
        this.storyPose(actor);
        return actor;
      })??[];
      this.sync();
    }
    storyPose(actor) {
      const scene=this.scene,spec=actor.source;
      actor.aboard=scene.set==="boat";
      const [x,z]=scene.at;
      actor.x=spec.at[0]+(actor.aboard?0:x);
      actor.z=spec.at[1]+(actor.aboard?0:z);
      actor.y=actor.aboard?.195:CampusFigures.floor;
      actor.yaw=spec.yaw*rad;
      actor.gesture=spec.gesture;
      actor.walking=false;
      if(spec.gesture==="walk" && !this.reduced) {
        const a=this.clock*.31+.94;
        actor.x+=1.86*Math.sin(a);
        actor.z+=.86*Math.cos(a);
        actor.yaw=Math.atan2(1.86*Math.cos(a),-.86*Math.sin(a));
        actor.walking=true;
      }
    }
    setMode(mode) {
      if(this.mode===mode) return;
      this.settle();
      this.mode=mode;
      this.resetStory();
      this.save();
    }
    settle(keepStoryFocus=false) {
      this.stopVoice();
      this.cancelOperation();
      this.closeMenu();
      const keepFocus=keepStoryFocus && this.callbacks.isStoryFocused();
      if(!keepFocus) this.callbacks.focus(null);
      return keepFocus;
    }
    sync() {
      for(const button of this.options.querySelectorAll("[data-people]")) {
        button.setAttribute("aria-pressed",String(button.dataset.people===this.mode));
      }
      $("story-options").hidden=this.mode!=="story";
      $("free-options").hidden=this.mode!=="free";
      $("figure-add").disabled=this.freeActors.length>=limit;
      $("voice-volume").value=this.volume;
      document.querySelector('output[for="voice-volume"]').value=this.volume+"%";
      $("figure-labels").checked=this.labels;
      this.list.replaceChildren();
      this.castNodes.clear();
      this.labelLayer.replaceChildren();
      for(const actor of this.active) {
        const name=cast[actor.who].short;
        const button=document.createElement("button");
        button.type="button";
        button.textContent=name;
        button.title=`操作${name}`;
        button.addEventListener("click",()=>{
          const rect=button.getBoundingClientRect();
          this.openMenu(actor,rect.left,rect.top,true);
        });
        this.list.append(button);
        const label=document.createElement("span");
        label.className="figure-name";
        label.textContent=name;
        label.hidden=true;
        this.castNodes.set(actor.uid,label);
        this.labelLayer.append(label);
      }
      this.list.hidden=!this.active.length;
      $("figure-hint").hidden=this.list.hidden;
      this.canvas.classList.remove("over-figure");
      this.note(this.mode==="free" && this.freeActors.length>=limit?`当前已摆放 ${limit} 位人物。`:"");
      this.callbacks.invalidate();
    }
    note(message) {
      const el=$("people-status");
      el.textContent=message;
      el.hidden=!message;
    }
    focusScene() {
      const scene=this.scene;
      if(scene) this.callbacks.focus({kind:"story",bounds:[{at:scene.at,size:scene.size}],nearPad:10,camera:scene.camera});
    }
    focusActor(actor) {
      if(actor.aboard || actor.pick?.member) { this.focusScene(); return; }
      this.callbacks.focus({bounds:[{at:[actor.x,actor.z],size:[6.9,6.0,2.8]}],nearPad:5.5,
        camera:[(actor.yaw/rad+360)%360,28,100]});
    }
    canPlace(actor,x,z) {
      return Angraecum.canStand(x,z,cast[actor.who].chair?.58:.42) && this.active.every(other=>{
        if(other===actor || other.aboard) return true;
        return Math.hypot(other.x-x,other.z-z)>.79;
      });
    }
    nearestGround(actor,x,z,radius=21) {
      if(this.canPlace(actor,x,z)) return [x,z];
      for(let r=.7;r<=radius;r+=.7) for(let i=0;i<20;i++) {
        const a=i*Math.PI/10, px=x+r*Math.cos(a),pz=z+r*Math.sin(a);
        if(this.canPlace(actor,px,pz)) return [px,pz];
      }
      return null;
    }
    add(who) {
      if(this.freeActors.length>=limit || !Object.prototype.hasOwnProperty.call(cast,who)) return;
      const actor=this.actor(who,0,0,(this.view?Math.atan2(this.view.axes.back[0],this.view.axes.back[2]):.46));
      const at=this.groundAt(this.canvas.clientWidth*.49,this.canvas.clientHeight*.54)??[-10.5,12];
      const candidate=this.nearestGround(actor,...at,11)??this.nearestGround(actor,-10.5,12);
      if(!candidate) { this.note("在取景范围内找不到空地。"); return; }
      [actor.x,actor.z]=candidate;
      actor.home={x:actor.x,z:actor.z,yaw:actor.yaw};
      this.freeActors.push(actor);
      this.save();
      this.sync();
    }
    detach(actor,x,z) {
      actor.detached=true;
      actor.aboard=false;
      actor.gesture=undefined;
      actor.y=CampusFigures.floor;
      actor.x=x;
      actor.z=z;
    }
    playVoice(actor) {
      if(!this.volume) { this.note("语音音量为 0%。"); return; }
      const previous=this.lastClip[actor.who];
      const options=[1,2,3,4].filter(num=>num!==previous);
      const clip=options[Math.floor(Math.random()*options.length)];
      this.lastClip[actor.who]=clip;
      this.note("");
      this.audio.pause();
      this.audio.src=`voices/${actor.who}-${clip}.ogg`;
      this.voice=actor.uid;
      this.callbacks.voiceMix(true);
      const source=this.audio.src;
      this.audio.play().catch(error=>{
        if(error.name==="AbortError" || this.audio.src!==source) return;
        this.stopVoice();
        this.note("语音未能播放，再点一次人物试试。");
      });
      this.callbacks.invalidate();
    }
    stopVoice() {
      this.audio.pause();
      if(this.voice===undefined) return;
      this.voice=undefined;
      this.callbacks.voiceMix(false);
      this.callbacks.invalidate();
    }
    groundAt(x,y) {
      if(!this.view) return null;
      return CampusView.groundPoint(2*x/this.canvas.clientWidth-1,1-2*y/this.canvas.clientHeight,this.frame,this.view);
    }
    pixel(point) {
      const [x,y,z]=CampusView.project(point,this.view.matrix);
      return [(x+1)*this.canvas.clientWidth/2,(1-y)*this.canvas.clientHeight/2,z];
    }
    hit(x,y) {
      if(!this.view) return null;
      const pixelsPerUnit=this.canvas.clientWidth/(2*this.frame.wide);
      let best=null,nearest=Infinity,nearestMember=Infinity;
      for(const actor of this.active) {
        const pick=actor.pick;
        if(!pick) continue;
        const [ox,oy]=this.pixel(pick.origin);
        const dx=(x-ox)/pixelsPerUnit,dy=(oy-y)/pixelsPerUnit;
        const [ax,ay]=pick.screenAcross,[ux,uy]=pick.screenUp;
        const area=ax*uy-ay*ux;
        if(Math.abs(area)<.0001) continue;
        const u=pick.anchor[0]+(dx*uy-dy*ux)/area;
        const v=pick.anchor[1]-(dy*ax-dx*ay)/area;
        if(u<0 || u>=1 || v<0 || v>=1) continue;
        const {alpha,size}=pick.mask;
        if(alpha[Math.floor(v*size)*size+Math.floor(u*size)]<32) continue;
        const point=CampusView.portraitPoint(pick,u,v);
        const depth=CampusView.project(point,this.view.matrix)[2];
        if(depth>nearest || !Angraecum.figureVisible(point,this.view,this.frame)) continue;
        let memberDistance=Infinity;
        if(pick.member) {
          // Resolve clicks inside a shared silhouette by the head-to-body lines in the CG.
          const [[hx,hy],[bx,by]]=pick.member;
          const px=(u-hx)*pick.aspect,py=v-hy,vx=(bx-hx)*pick.aspect,vy=by-hy;
          const along=clamp((px*vx+py*vy)/(vx*vx+vy*vy),0,1);
          memberDistance=Math.hypot(px-along*vx,py-along*vy);
        }
        if(depth===nearest && memberDistance>=nearestMember) continue;
        best=actor;
        nearest=depth;
        nearestMember=memberDistance;
      }
      return best;
    }
    openMenu(actor,x,y,lift=false) {
      this.target=actor;
      $("figure-menu-name").textContent=cast[actor.who].name;
      this.menu.hidden=false;
      const width=this.menu.offsetWidth,height=this.menu.offsetHeight;
      this.menu.style.left=clamp(x,5,Math.max(5,innerWidth-width-6))+"px";
      this.menu.style.top=clamp(lift?y-height-7:y,5,Math.max(5,innerHeight-height-6))+"px";
    }
    closeMenu() {
      this.target=null;
      this.menu.hidden=true;
    }
    pointMove(x,y) {
      if(!this.mover) return;
      const point=this.groundAt(x,y);
      if(!point || !this.canPlace(this.mover,...point)) return;
      this.detach(this.mover,...point);
      this.save();
      this.cancelOperation();
      this.callbacks.invalidate();
    }
    setStick(x=0,y=0) {
      const mag=Math.max(1,Math.hypot(x,y));
      this.stick=[x/mag,y/mag];
      this.pad.querySelector("span").style.transform=`translate(calc(-50% + ${this.stick[0]*28}px),calc(-50% + ${this.stick[1]*28}px))`;
      this.callbacks.invalidate();
    }
    endDriveInput() {
      this.keys.clear();
      if(this.driver) this.driver.walking=false;
      const id=this.drivePointer;
      this.drivePointer=null;
      if(id!=null && this.pad.hasPointerCapture(id)) this.pad.releasePointerCapture(id);
      this.setStick();
      this.save();
    }
    cancelOperation() {
      if(this.driver) this.endDriveInput();
      this.endDrivePanelDrag();
      this.mover=this.driver=null;
      $("figure-move").hidden=this.drivePanel.hidden=this.dot.hidden=true;
      this.canvas.classList.remove("placing");
    }
    positionDrivePanel() {
      if(this.drivePanel.hidden || !this.drivePosition) return;
      const [x,y]=this.drivePosition, margin=8;
      const bottom=parseFloat(getComputedStyle(this.drivePanel).getPropertyValue("--taskbar-gap"))||margin;
      const left=clamp(x,margin,Math.max(margin,innerWidth-this.drivePanel.offsetWidth-margin));
      const top=clamp(y,margin,Math.max(margin,innerHeight-this.drivePanel.offsetHeight-bottom));
      Object.assign(this.drivePanel.style,{left:left+"px",top:top+"px",transform:"none"});
    }
    endDrivePanelDrag(event) {
      const drag=this.drivePanelDrag;
      if(!drag || (event && event.pointerId!==drag.id)) return;
      this.drivePanelDrag=null;
      this.driveGrip.classList.remove("dragging");
      if(this.driveGrip.hasPointerCapture(drag.id)) this.driveGrip.releasePointerCapture(drag.id);
      if(drag.moved) this.save();
    }
    action(name) {
      const actor=this.target;
      this.closeMenu();
      if(!actor || !this.active.includes(actor)) return;
      if(name==="voice") { this.playVoice(actor); return; }
      this.cancelOperation();
      if(name==="move") {
        this.mover=actor;
        this.canvas.classList.add("placing");
        $("figure-move-name").textContent=`移动${cast[actor.who].short} · 点击空地`;
        $("figure-move").hidden=false;
      } else if(name==="joystick") {
        this.driver=actor;
        $("figure-drive-name").textContent=cast[actor.who].short;
        this.drivePanel.hidden=false;
        this.positionDrivePanel();
        this.pad.focus();
      } else if(name==="focus") this.focusActor(actor);
      else if(name==="restore") {
        actor.detached=false;
        if(actor.source) this.storyPose(actor);
        else {
          const at=this.nearestGround(actor,actor.home.x,actor.home.z,4);
          if(at) [actor.x,actor.z]=at;
          actor.yaw=actor.home.yaw;
        }
        this.save();
      } else if(name==="delete") {
        const actors=this.active;
        actors.splice(actors.indexOf(actor),1);
        if(this.voice===actor.uid) this.stopVoice();
        this.save();
        this.sync();
      }
      this.callbacks.invalidate();
    }
    hasDirection() {
      return this.keys.size || Math.hypot(...this.stick)>.09;
    }
    drive(dt) {
      const actor=this.driver;
      if(!actor || !this.view || !this.hasDirection()) return;
      let [u,v]=this.stick;
      for(const key of this.keys) { u+=directions[key][0]; v+=directions[key][1]; }
      const mag=Math.max(1,Math.hypot(u,v));
      const [rx,,rz]=this.view.axes.right,[bx,,bz]=this.view.axes.back,norm=Math.hypot(bx,bz);
      const dx=(u*rx+v*bx/norm)/mag,dz=(u*rz+v*bz/norm)/mag;
      const step=dt*2.65;
      if(actor.aboard) {
        const p=actor.pick?.world??[this.scene.at[0],0,this.scene.at[1]];
        const shore=this.nearestGround(actor,p[0],p[2]);
        if(!shore) return;
        this.detach(actor,...shore);
      }
      const x=actor.x+dx*step,z=actor.z+dz*step;
      const place=this.canPlace(actor,x,z)?[x,z]:this.canPlace(actor,x,actor.z)?[x,actor.z]:
        this.canPlace(actor,actor.x,z)?[actor.x,z]:null;
      actor.walking=!!place && Math.hypot(dx,dz)>.06;
      if(actor.walking) {
        this.detach(actor,...place);
        actor.yaw=Math.atan2(dx,dz);
      }
    }
    build(dt,season) {
      if(this.animated) this.clock+=dt;
      if(!this.scene && !this.active.length) return null;
      for(const actor of this.storyActors) if(!actor.detached) this.storyPose(actor);
      this.drive(dt);
      return CampusFigures.build(this.active,this.scene,this.clock,season,this.voice);
    }
    updateView(view,frame) {
      this.view=view;
      this.frame=frame;
      for(const actor of this.active) {
        const label=this.castNodes.get(actor.uid);
        if(!label) continue;
        if(!actor.pick) { label.hidden=true; continue; }
        const [x,y]=this.pixel(actor.pick.head);
        label.hidden=!this.labels || x<12 || x>this.canvas.clientWidth-12 || y<24 || y>this.canvas.clientHeight ||
          !Angraecum.figureVisible(actor.pick.head,view,frame);
        if(!label.hidden) {
          label.style.left=x+"px";
          label.style.top=(y-actor.pick.radius*this.canvas.clientWidth/(frame.wide*2)-4)+"px";
        }
      }
    }
    bind() {
      this.options.querySelector("#people-modes").addEventListener("click",e=>{
        const mode=e.target.closest("[data-people]")?.dataset.people;
        if(mode) this.setMode(mode);
      });
      this.choice.element.addEventListener("change",()=>{
        const keepFocus=this.settle(true);
        this.selected[this.season]=this.choice.value;
        this.resetStory();
        if(keepFocus) this.focusScene();
        this.save();
      });
      $("story-unfocus").addEventListener("click",()=>this.callbacks.focus(null));
      $("story-focus").addEventListener("click",()=>this.focusScene());
      $("story-reset").addEventListener("click",()=>{
        this.stopVoice(); this.closeMenu(); this.cancelOperation(); this.resetStory();
      });
      $("figure-add").addEventListener("click",()=>this.add(this.figureChoice.value));
      $("figure-labels").addEventListener("change",e=>{
        this.labels=e.target.checked;
        this.save();
        this.callbacks.invalidate();
      });
      $("voice-volume").addEventListener("input",e=>{
        this.volume=Number(e.target.value);
        this.audio.volume=this.volume*.01;
        document.querySelector('output[for="voice-volume"]').value=this.volume+"%";
        if(!this.volume) this.stopVoice();
      });
      $("voice-volume").addEventListener("change",()=>this.save());
      this.audio.addEventListener("ended",()=>{ if(this.audio.ended) this.stopVoice(); });
      this.menu.addEventListener("click",e=>{
        const name=e.target.closest("[data-act]")?.dataset.act;
        if(name) this.action(name);
      });
      $("figure-move-cancel").addEventListener("click",()=>this.cancelOperation());
      $("figure-drive-close").addEventListener("click",()=>this.cancelOperation());
      this.driveGrip.addEventListener("pointerdown",e=>{
        if(e.button!==0 || !this.driver || this.drivePanelDrag || this.drivePointer!=null) return;
        e.preventDefault();
        const rect=this.drivePanel.getBoundingClientRect();
        this.drivePanelDrag={id:e.pointerId,left:rect.left,top:rect.top,x:e.clientX,y:e.clientY,moved:false};
        this.driveGrip.classList.add("dragging");
        try { this.driveGrip.setPointerCapture(e.pointerId); } catch (_) {}
      });
      window.addEventListener("pointermove",e=>{
        const drag=this.drivePanelDrag;
        if(!drag || e.pointerId!==drag.id) return;
        const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
        if(!drag.moved && Math.hypot(dx,dy)<3) return;
        drag.moved=true;
        this.drivePosition=[drag.left+dx,drag.top+dy];
        this.positionDrivePanel();
      });
      for(const event of ["pointerup","pointercancel"]) window.addEventListener(event,e=>this.endDrivePanelDrag(e));
      this.driveGrip.addEventListener("lostpointercapture",e=>this.endDrivePanelDrag(e));
      window.addEventListener("resize",()=>this.positionDrivePanel());
      this.canvas.addEventListener("click",e=>{
        if(e.button!==0) return;
        if(this.target) {this.closeMenu();return;}
        if(this.mover) { this.pointMove(e.clientX,e.clientY); return; }
        const actor=this.hit(e.clientX,e.clientY);
        if(actor) this.playVoice(actor);
      });
      this.canvas.addEventListener("contextmenu",e=>{
        const actor=this.hit(e.clientX,e.clientY);
        if(!actor && !this.target && !this.mover) return;
        e.preventDefault();
        if(actor) this.openMenu(actor,e.clientX,e.clientY);
        else { this.closeMenu(); this.cancelOperation(); }
      });
      this.canvas.addEventListener("pointermove",e=>{
        if(this.mover) {
          const target=this.groundAt(e.clientX,e.clientY);
          this.dot.style.left=e.clientX+"px";
          this.dot.style.top=e.clientY+"px";
          this.dot.hidden=!target;
          this.dot.classList.toggle("blocked",!target || !this.canPlace(this.mover,...target));
        } else if(!e.buttons && this.active.length) {
          this.canvas.classList.toggle("over-figure",!!this.hit(e.clientX,e.clientY));
        }
      });
      this.canvas.addEventListener("pointerleave",()=>{ this.dot.hidden=true; this.canvas.classList.remove("over-figure"); });
      document.addEventListener("pointerdown",e=>{
        if(this.target && e.target!==this.canvas && !this.menu.contains(e.target)) this.closeMenu();
      });
      const drag=e=>{
        const rect=this.pad.getBoundingClientRect();
        this.setStick((e.clientX-rect.x-rect.width/2)/30,(e.clientY-rect.y-rect.height/2)/30);
      };
      this.pad.addEventListener("pointerdown",e=>{
        if(e.button!==0 || this.drivePointer!=null) return;
        this.drivePointer=e.pointerId;
        try { this.pad.setPointerCapture(e.pointerId); } catch (_) {}
        drag(e);
      });
      window.addEventListener("pointermove",e=>{ if(e.pointerId===this.drivePointer) drag(e); });
      for(const name of ["pointerup","pointercancel"]) window.addEventListener(name,e=>{
        if(e.pointerId===this.drivePointer) this.endDriveInput();
      });
      this.pad.addEventListener("lostpointercapture",e=>{ if(e.pointerId===this.drivePointer) this.endDriveInput(); });
      document.addEventListener("keydown",e=>{
        if(e.key==="Escape"&&(this.target || this.mover || this.driver)) {
          e.preventDefault(); e.stopPropagation(); this.closeMenu(); this.cancelOperation(); return;
        }
        if(!this.driver || !directions[e.code] || e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.("input,select")) return;
        e.preventDefault();
        this.keys.add(e.code);
        this.callbacks.invalidate();
      });
      document.addEventListener("keyup",e=>{
        if(!this.keys.delete(e.code)) return;
        if(!this.hasDirection()) { this.driver.walking=false; this.save(); }
        this.callbacks.invalidate();
      });
      window.addEventListener("blur",()=>{
        this.endDrivePanelDrag();
        if(this.driver) this.endDriveInput();
      });
    }
  }

  return {Controller};
})();
