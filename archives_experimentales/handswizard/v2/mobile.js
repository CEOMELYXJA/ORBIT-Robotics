"use strict";
const el=id=>document.getElementById(id);
let ws=null, sensorReady=false, reading=null, neutral=null, enabled=false, dragging=false;
let lastSent=0, rx=0, ry=0, lastTouch=null;
function state(message,active=false){el("state").textContent=message;el("state").className="tag"+(active?" on":"");}
function send(msg){if(ws?.readyState===WebSocket.OPEN) ws.send(JSON.stringify(msg));}
function stop(){enabled=false;dragging=false;send({type:"pause"});el("toggle").textContent="3 · Démarrer la souris";el("toggle").classList.remove("stop");el("drag").textContent="Maintenir / glisser";}
function showLogin(logged){el("login").classList.toggle("hide",logged);el("controls").classList.toggle("hide",!logged);}
function connect(){
  const scheme=location.protocol==="https:"?"wss:":"ws:";
  ws=new WebSocket(scheme+"//"+location.host+"/ws");
  ws.onopen=()=>state("Connecté · souris en pause",true);
  ws.onmessage=ev=>{try{const a=JSON.parse(ev.data);if(a.type==="ready")stop();}catch{}};
  ws.onclose=()=>{stop();state("Connexion interrompue · souris arrêtée");setTimeout(check,2500);};
  ws.onerror=()=>state("Connexion indisponible");
}
async function check(){
  try{const result=await (await fetch("/status",{cache:"no-store"})).json();showLogin(result.authorized);if(result.authorized&&(!ws||ws.readyState===WebSocket.CLOSED))connect();}
  catch{state("Serveur Windows inaccessible");}
}
el("pair").onclick=async()=>{
  const code=el("code").value.trim();if(!/^\d{6}$/.test(code)){el("pairError").textContent="Entre les six chiffres du PC.";return;}
  try{const response=await fetch("/pair",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})});
    if(!response.ok){el("pairError").textContent=response.status===429?"Trop de tentatives. Attends une minute.":"Code incorrect ou accès non sécurisé.";return;}
    el("code").value="";el("pairError").textContent="";await check();
  }catch{el("pairError").textContent="Impossible de joindre le PC.";}
};
el("sensor").onclick=async()=>{
  if(typeof DeviceOrientationEvent==="undefined"){state("Pas de capteur d’orientation sur ce navigateur");return;}
  try{if(typeof DeviceOrientationEvent.requestPermission==="function"){
     const permission=await DeviceOrientationEvent.requestPermission();if(permission!=="granted"){state("Autorisation refusée");return;}
  }
  window.addEventListener("deviceorientation",event=>{
    if(event.beta===null||event.gamma===null)return;
    reading={beta:event.beta,gamma:event.gamma};
    el("angles").textContent="Inclinaison "+event.beta.toFixed(1)+"° / "+event.gamma.toFixed(1)+"°";
  },{passive:true});
  sensorReady=true;el("sensor").textContent="✓ Gyroscope activé";
  }catch{state("Autorisation iPhone impossible");}
};
el("calibrate").onclick=()=>{
  if(!reading){state("Autorise le gyroscope et bouge un peu l’iPhone");return;}
  neutral={...reading};rx=0;ry=0;state("Position calibrée",true);
};
el("speed").oninput=()=>el("speedValue").textContent=Number(el("speed").value).toFixed(1);
el("toggle").onclick=()=>{
  if(enabled){stop();state("Souris en pause",true);return;}
  if(!sensorReady||!neutral){state("Active le gyroscope et calibre avant de démarrer");return;}
  if(ws?.readyState!==WebSocket.OPEN){state("Connexion Windows perdue");return;}
  send({type:"resume"});enabled=true;el("toggle").textContent="ARRÊTER IMMÉDIATEMENT";el("toggle").classList.add("stop");state("Souris active",true);
};
function speedAxis(delta){const dead=4, a=Math.abs(delta);return a<=dead?0:Math.sign(delta)*Math.min(18,(a-dead)*.52);}
function angleDelta(a,b){return ((a-b+540)%360)-180;}
setInterval(()=>{
 if(!enabled||!reading||!neutral||document.hidden)return;
 const gain=Number(el("speed").value);
 // Tilt relative to initial orientation, dead-zone & smoothed speed.
 let x=speedAxis(angleDelta(reading.gamma,neutral.gamma))*gain;
 let y=speedAxis(angleDelta(reading.beta,neutral.beta))*gain;
 rx=.55*rx+.45*x;ry=.55*ry+.45*y;
 send({type:"move",dx:rx,dy:ry});
},33);
document.addEventListener("visibilitychange",()=>{if(document.hidden)stop();});
window.addEventListener("pagehide",stop);
el("left").onclick=()=>send({type:"click",button:"left"});
el("right").onclick=()=>send({type:"click",button:"right"});
el("drag").onclick=()=>{if(!enabled)return;dragging=!dragging;send({type:"button",button:"left",down:dragging});el("drag").textContent=dragging?"Glissement actif · appuyer pour relâcher":"Maintenir / glisser";};
el("release").onclick=()=>{dragging=false;send({type:"button",button:"left",down:false});el("drag").textContent="Maintenir / glisser";};
el("up").onclick=()=>send({type:"scroll",steps:2});
el("down").onclick=()=>send({type:"scroll",steps:-2});
const pad=el("touch");
pad.addEventListener("pointerdown",e=>{lastTouch={x:e.clientX,y:e.clientY};pad.setPointerCapture(e.pointerId);});
pad.addEventListener("pointermove",e=>{if(!lastTouch||!enabled)return;const dx=e.clientX-lastTouch.x,dy=e.clientY-lastTouch.y;send({type:"move",dx:dx*1.3,dy:dy*1.3});lastTouch={x:e.clientX,y:e.clientY};});
for(const event of ["pointerup","pointercancel"])pad.addEventListener(event,()=>lastTouch=null);
el("logout").onclick=async()=>{stop();try{await fetch("/logout",{method:"POST"});}catch{}ws?.close();showLogin(false);state("Dissocié");};
check();

