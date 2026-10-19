(() => {
"use strict";
const canvas=document.getElementById("scene"),ctx=canvas.getContext("2d",{alpha:false});
const cover=document.getElementById("cover"),start=document.getElementById("start");
const snd=document.getElementById("sound"),energyBar=document.getElementById("energy"),livesBar=document.getElementById("lives");
const host=document.getElementById("game");
if(!ctx)throw Error("Canvas2D unavailable");
const TAU=Math.PI*2,clamp=(v,min,max)=>Math.max(min,Math.min(max,v)),rand=(a,b)=>a+Math.random()*(b-a);
const PETAL_TARGET=12,lowMotion=matchMedia("(prefers-reduced-motion: reduce)").matches;
let W=1,H=1,DPR=1,animation=0,previous=0,life=3,petals=0,stage="menu",ticker=0,player=.5,target=.5,key=0,dragging=false,sound=true,immune=0,shudder=0,objects=[],dust=[],stars=[],audio;
for(let i=0;i<3;i++)livesBar.appendChild(document.createElement("i"));
for(let i=0;i<PETAL_TARGET;i++)energyBar.appendChild(document.createElement("i"));
function updateHud(){
 Array.from(livesBar.children).forEach((e,i)=>e.classList.toggle("empty",i>=life));
 Array.from(energyBar.children).forEach((e,i)=>e.classList.toggle("full",i<petals));
 energyBar.setAttribute("aria-valuenow",String(petals));
}
function resize(){
 const w=Math.max(240,Math.round(host.clientWidth||innerWidth)),h=Math.max(200,Math.round(host.clientHeight||innerHeight));
 if(w===W&&h===H)return;
 W=w;H=h;DPR=clamp(devicePixelRatio||1,1,2);
 canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);
 canvas.style.width=W+"px";canvas.style.height=H+"px";ctx.setTransform(DPR,0,0,DPR,0,0);
 stars=Array.from({length:Math.round(clamp(W*H/10000,30,100))},()=>({x:Math.random(),y:Math.random(),r:rand(.5,1.75),p:rand(0,TAU)}));
}
addEventListener("resize",resize,{passive:true});
function beep(hz,vol=.018,time=.1){
 if(!sound)return;
 try{
  if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();
  if(audio.state==="suspended")void audio.resume();
  const o=audio.createOscillator(),g=audio.createGain(),now=audio.currentTime;
  o.type="sine";o.frequency.setValueAtTime(hz,now);o.frequency.exponentialRampToValueAtTime(hz*.69,now+time);
  g.gain.setValueAtTime(vol,now);g.gain.exponentialRampToValueAtTime(.0001,now+time);
  o.connect(g).connect(audio.destination);o.start(now);o.stop(now+time+.015);
 }catch{/* audio never blocks play */}
}
function burst(x,y,tint,n=16){
 for(let i=0;i<n && dust.length<(lowMotion?25:100);i++){
  const a=rand(0,TAU),v=rand(55,210);
  dust.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,age:0,ttl:rand(.3,.9),r:rand(2,5),tint});
 }
}
function begin(){
 life=3;petals=0;objects=[];dust=[];ticker=0;immune=0;shudder=0;player=.5;target=.5;key=0;dragging=false;stage="playing";
 cover.classList.remove("loss");cover.classList.add("hidden");cover.setAttribute("aria-label","Game playing");
 updateHud();beep(780,.014,.12);
}
function finish(win){
 stage=win?"win":"loss";
 cover.classList.remove("hidden");cover.classList.toggle("loss",!win);
 cover.setAttribute("aria-label",win?"Garden complete":"Game over");
 burst(W*.5,H*.5,win?"#ffe9a4":"#f7a0ad",win?65:25);
 beep(win?980:190,.03,.19);
}
function spawn(){
 const hard=rand(0,1)<clamp(.23+ticker/230,.23,.46);
 objects.push({x:rand(.075,.925),y:-.08,bad:hard,speed:rand(.22,.31)+Math.min(ticker/310, .12),r:rand(11,19),rot:rand(0,TAU),spin:rand(-2,2),p:rand(0,TAU)});
}
function update(dt){
 animation+=dt;
 dust.forEach(p=>{p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-2*dt);p.vy+=65*dt});
 dust=dust.filter(p=>p.age<p.ttl);
 shudder=Math.max(0,shudder-dt*1.8);
 if(stage!=="playing")return;
 ticker+=dt;immune=Math.max(0,immune-dt);
 if(!dragging)target+=key*dt*.92;
 target=clamp(target,.07,.93);
 player+=(target-player)*clamp(dt*12,0,1);
 if(!("nextSpawn" in update))update.nextSpawn=.1;
 update.nextSpawn-=dt;
 if(update.nextSpawn<=0){spawn();update.nextSpawn=rand(.43,.66)*clamp(1-ticker/180,.55,1)}
 const y=H*.80,r=clamp(Math.min(W,H)*.03,13,25);
 for(let i=objects.length-1;i>=0;i--){
  const e=objects[i];e.y+=e.speed*dt*(H>W?1:1.14);e.rot+=e.spin*dt;
  const bx=e.x*W,by=e.y*H;
  if(Math.hypot(bx-player*W,by-y)<r+e.r*.76 && (!e.bad||immune<=0)){
   objects.splice(i,1);burst(bx,by,e.bad?"#ff9ba4":"#ffdf91",e.bad?20:12);
   if(e.bad){life--;immune=1;shudder=.6;beep(180,.035,.16)}
   else{petals++;beep(570+petals*30,.016,.065)}
   updateHud();
   if(petals>=PETAL_TARGET)finish(true);else if(life<=0)finish(false);
  }else if(e.y>1.07){objects.splice(i,1)}
 }
}
function bloom(x,y,size,hue){
 ctx.save();ctx.translate(x,y);
 ctx.fillStyle=hue;
 for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(Math.sin(i*TAU/5)*size*.45,Math.cos(i*TAU/5)*size*.45,size*.31,size*.72,i*TAU/5,0,TAU);ctx.fill()}
 ctx.fillStyle="#fff8d6";ctx.beginPath();ctx.arc(0,0,size*.32,0,TAU);ctx.fill();
 ctx.restore();
}
function halo(x,y,r,kind,opacity=1){
 const c=kind==="bad"?"#ff839c":kind==="gold"?"#f5da84":"#a0ffe5";
 ctx.save();ctx.globalAlpha=opacity;
 const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,c);g.addColorStop(.2,kind==="bad"?"#fc7995a2":"#d5ffe5a5");g.addColorStop(1,"#ffffff00");
 ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();ctx.restore();
}
function background(){
 const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,"#0e162e");g.addColorStop(.58,"#244659");g.addColorStop(1,"#102d3e");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 halo(W*.52,H*.17,Math.min(W,H)*.42,"good",.14);
 ctx.globalAlpha=.55;ctx.fillStyle="#e0ffdb";ctx.beginPath();ctx.arc(W*.51,H*.16,Math.min(W,H)*.055,0,TAU);ctx.fill();ctx.globalAlpha=1;
 for(const s of stars){ctx.globalAlpha=.22+.48*(.5+.5*Math.sin(animation*1.2+s.p));ctx.fillStyle="#dcfff4";ctx.beginPath();ctx.arc(s.x*W,s.y*H,s.r,0,TAU);ctx.fill()}ctx.globalAlpha=1;
 ctx.fillStyle="#1d4b56";ctx.beginPath();ctx.moveTo(0,H*.70);ctx.bezierCurveTo(W*.22,H*.57,W*.29,H*.77,W*.49,H*.63);ctx.bezierCurveTo(W*.70,H*.52,W*.76,H*.7,W,H*.61);ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.fill();
 ctx.fillStyle="#17404c";ctx.beginPath();ctx.moveTo(0,H*.81);ctx.bezierCurveTo(W*.28,H*.68,W*.41,H*.9,W*.57,H*.79);ctx.bezierCurveTo(W*.79,H*.69,W*.82,H*.85,W,H*.73);ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.fill();
 for(let i=0;i<23;i++){const xx=((i*.212)%1)*W,yy=H*(.74+.11*(.5+.5*Math.cos(i*7)));
  ctx.globalAlpha=.08;ctx.strokeStyle="#b3f9e7";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(xx,yy+13);ctx.quadraticCurveTo(xx-3,yy,xx+5,yy-9);ctx.stroke()}
 ctx.globalAlpha=1;
}
function drawObjects(){
 for(const e of objects){
  const x=e.x*W+Math.sin(animation*2+e.p)*2.6,y=e.y*H;
  ctx.save();ctx.translate(x,y);ctx.rotate(e.rot);
  halo(0,0,e.r*2.5,e.bad?"bad":"gold",.48);
  if(e.bad){ctx.fillStyle="#ee7390";ctx.strokeStyle="#ffd1ad";ctx.lineWidth=1.3;ctx.beginPath();
   for(let i=0;i<10;i++){const a=i*TAU/10,r=e.r*(i%2===0?1.08:.5);if(i===0)ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);else ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r)}
   ctx.closePath();ctx.fill();ctx.stroke();
  }else bloom(0,0,e.r,"#ffefb1");
  ctx.restore();
 }
 const x=player*W,y=H*.80,r=clamp(Math.min(W,H)*.03,13,25);
 ctx.save();ctx.translate(x,y);
 if(immune>0&&Math.sin(animation*24)<0)ctx.globalAlpha=.48;
 halo(0,0,r*4.3,"good",.63);
 ctx.save();ctx.rotate(Math.sin(animation*5)*.1);bloom(0,0,r,"#b1ffe5");ctx.restore();
 ctx.restore();
 for(const p of dust){ctx.globalAlpha=clamp(1-p.age/p.ttl,0,1);ctx.fillStyle=p.tint;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,TAU);ctx.fill()}ctx.globalAlpha=1;
}
function render(){
 background();
 ctx.save();if(shudder>0)ctx.translate(rand(-5,5)*shudder,rand(-5,5)*shudder);
 drawObjects();ctx.restore();
 const v=ctx.createRadialGradient(W*.5,H*.42,Math.min(W,H)*.25,W*.5,H*.42,Math.max(W,H)*.84);
 v.addColorStop(0,"#08102200");v.addColorStop(1,"#050b1d80");ctx.fillStyle=v;ctx.fillRect(0,0,W,H);
}
function loop(t){
 const dt=previous?clamp((t-previous)/1000,0,.05):0;previous=t;
 resize();update(dt);render();requestAnimationFrame(loop);
}
function pointer(e){
 const rect=canvas.getBoundingClientRect();
 target=clamp((e.clientX-rect.left)/rect.width,.07,.93);
 dragging=true;
}
canvas.addEventListener("pointerdown",e=>{
 if(stage!=="playing")return;e.preventDefault();pointer(e);
 try{canvas.setPointerCapture(e.pointerId)}catch{}
},{passive:false});
canvas.addEventListener("pointermove",e=>{if(stage==="playing"&&(e.buttons||e.pointerType==="touch"))pointer(e)},{passive:true});
canvas.addEventListener("pointerup",()=>{dragging=false});
canvas.addEventListener("pointercancel",()=>{dragging=false});
addEventListener("keydown",e=>{
 const k=e.key;
 if(["ArrowLeft","ArrowRight","a","d","A","D"," ","Enter"].includes(k))e.preventDefault();
 if(k==="ArrowLeft"||k==="a"||k==="A"){dragging=false;key=-1}
 if(k==="ArrowRight"||k==="d"||k==="D"){dragging=false;key=1}
 if((k==="Enter"||k===" ")&&stage!=="playing")begin();
},{passive:false});
addEventListener("keyup",e=>{if(["ArrowLeft","ArrowRight","a","d","A","D"].includes(e.key))key=0});
start.addEventListener("click",()=>begin());
snd.addEventListener("click",()=>{sound=!sound;snd.setAttribute("aria-pressed",String(sound));snd.classList.toggle("muted",!sound);if(sound)beep(700,.01,.08)});
window.__LUMEN_GARDEN_STATE__=()=>({stage,life,petals,player,target,width:W,height:H,canvasWidth:canvas.width,canvasHeight:canvas.height,drops:objects.length,elapsed:animation});
resize();updateHud();requestAnimationFrame(loop);
})();