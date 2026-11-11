const $ = id => document.getElementById(id);
const R = 6371000;
let watchId = null, current = null, target = null, logging = false, logs = [];
let saved = JSON.parse(localStorage.getItem("cf_destinations") || "[]");

function validCoord(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}
function toRad(deg) { return deg * Math.PI / 180; }
function localENU(point, origin) {
  const p = toRad(point.lat), l = toRad(point.lon);
  const p0 = toRad(origin.lat), l0 = toRad(origin.lon);
  return { east: R * Math.cos(p0) * (l-l0), north: R * (p-p0) };
}
function haversine(a,b) {
  const p1=toRad(a.lat), p2=toRad(b.lat), dp=toRad(b.lat-a.lat), dl=toRad(b.lon-a.lon);
  const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}
function bearing(a,b) {
  const p1=toRad(a.lat), p2=toRad(b.lat), dl=toRad(b.lon-a.lon);
  const y=Math.sin(dl)*Math.cos(p2);
  const x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
  return (Math.atan2(y,x)*180/Math.PI+360)%360;
}
function compassLabel(deg) {
  return ["N","NE","E","SE","S","SW","W","NW"][Math.round(deg/45)%8];
}
function fmt(n) { return `${n >= 0 ? "+" : ""}${n.toFixed(1)} m`; }
function saveStore() { localStorage.setItem("cf_destinations", JSON.stringify(saved)); renderSaved(); }
function renderSaved() {
  const select=$("targetSelect"), previous=select.value;
  select.innerHTML='<option value="">Choose a saved destination</option>';
  saved.forEach((s,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=s.name;select.append(o);});
  if (previous && saved[Number(previous)]) select.value=previous;
  const list=$("savedList"); list.innerHTML="";
  if (!saved.length) {list.innerHTML='<p class="muted small">No saved destinations yet.</p>';return;}
  saved.forEach((s,i)=>{
    const item=document.createElement("div");item.className="saved-item";
    const info=document.createElement("div");const name=document.createElement("strong");name.textContent=s.name;
    const coords=document.createElement("small");coords.textContent=`${s.lat.toFixed(6)}, ${s.lon.toFixed(6)}`;
    info.append(name,coords);
    const actions=document.createElement("div");actions.className="saved-actions";
    const use=document.createElement("button");use.className="secondary";use.textContent="Use";use.onclick=()=>selectSaved(i);
    const del=document.createElement("button");del.className="secondary";del.textContent="Delete";del.onclick=()=>{saved.splice(i,1);saveStore();};
    actions.append(use,del);item.append(info,actions);list.append(item);
  });
}
function setTarget(lat,lon,name="Manual target") {
  if(!validCoord(lat,lon)){ $("targetStatus").textContent="Please enter valid latitude and longitude.";return false; }
  target={lat,lon,name};$("targetLat").value=lat;$("targetLon").value=lon;
  $("targetStatus").textContent=`Active target: ${name}`; $("startLogBtn").disabled=!current||logging; updateResults(); return true;
}
function selectSaved(i) { const s=saved[i]; if(s) setTarget(s.lat,s.lon,s.name); }
function updateResults() {
  if(!current || !target) return;
  const enu=localEN( U(target,current), current ); // target relative to current
  const d=haversine(current,target), b=bearing(current,target);
  $("eastDiff").textContent=fmt(enu.east);
  $("northDiff").textContent=fmt(enu.north);
  $("distance").textContent=d<1000?`${d.toFixed(1)} m`:`${(d/1000).toFixed(3)} km`;
  $("bearing").textContent=`Bearing: ${b.toFixed(1)}° (${compassLabel(b)}) from north`;
  $("directionArrow").style.transform=`rotate(${b}deg)`;
  $("directionText").textContent=`Target is ${compassLabel(b)} of your position`;
  const uncertainty=current.accuracy ?? null;
  $("arrivalStatus").textContent=d<=5+ (uncertainty||0)
    ? `Within the 5 m arrival threshold plus reported GPS uncertainty (${uncertainty===null?"unknown":uncertainty.toFixed(1)+" m"}). Verify visually that this is the correct house.`
    : `Distance is ${d.toFixed(1)} m. Reported GPS uncertainty: ${uncertainty===null?"unknown":uncertainty.toFixed(1)+" m"}.`;
  if(logging) addLog(enu,d,b);
}
function U(point,origin){ return point; } // explicit point passthrough for readable ENU call
function addLog(enu,d,b) {
  const row={timestamp:new Date().toISOString(),currentLat:current.lat,currentLon:current.lon,accuracy:current.accuracy,targetLat:target.lat,targetLon:target.lon,eastM:enu.east,northM:enu.north,distanceM:d,bearingDeg:b};
  logs.push(row);$("logCount").textContent=`${logs.length} readings`;$("exportBtn").disabled=!logs.length;
}
function onPosition(pos) {
  current={lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:pos.coords.accuracy};
  $("currentLat").textContent=current.lat.toFixed(7);$("currentLon").textContent=current.lon.toFixed(7);
  $("accuracy").textContent=Number.isFinite(current.accuracy)?`±${current.accuracy.toFixed(1)} m`:"Unavailable";
  $("updatedAt").textContent=new Date(pos.timestamp).toLocaleTimeString();
  $("saveCurrentBtn").disabled=false;$("startLogBtn").disabled=!target||logging;$("gpsBadge").textContent="GPS ACTIVE";$("gpsBadge").className="badge on";
  $("gpsMessage").textContent=current.accuracy<=5?"Good reported accuracy (≤5 m).":current.accuracy<=15?"Moderate reported accuracy (5–15 m).":"Poor reported accuracy (>15 m). Try an open-sky location.";
  $("startLogBtn").disabled=!target||logging; updateResults();
}
function startGPS() {
  if(!("geolocation" in navigator)){ $("gpsMessage").textContent="This browser does not support geolocation.";return; }
  if(watchId!==null)return;
  $("gpsMessage").textContent="Requesting location permission…";
  watchId=navigator.geolocation.watchPosition(onPosition,err=>{
    $("gpsMessage").textContent=({1:"Location permission denied. Allow location access in browser settings.",2:"Position unavailable. Try moving to an open area.",3:"Location request timed out. Try again."})[err.code]||err.message;
    $("gpsBadge").textContent="GPS ISSUE";$("gpsBadge").className="badge off";
    if(err.code===1) stopGPS();
  },{enableHighAccuracy:true,maximumAge:1000,timeout:20000});
  $("locateBtn").textContent="Stop GPS";
}
function stopGPS(){if(watchId!==null)navigator.geolocation.clearWatch(watchId);watchId=null;$("locateBtn").textContent="Start GPS";$("gpsBadge").textContent="GPS PAUSED";$("gpsBadge").className="badge off";}
$("locateBtn").onclick=()=>watchId===null?startGPS():stopGPS();
$("setTargetBtn").onclick=()=>{const a=$("targetLat").value.trim(),b=$("targetLon").value.trim();if(!a||!b){$("targetStatus").textContent="Enter both latitude and longitude.";return;}setTarget(Number(a),Number(b));};
$("targetSelect").onchange=e=>{if(e.target.value!=="")selectSaved(Number(e.target.value));};
$("saveCurrentBtn").onclick=()=>{if(!current)return;const name=prompt("Name this saved location:","House "+(saved.length+1));if(name&&name.trim()){saved.push({name:name.trim(),lat:current.lat,lon:current.lon});saveStore();setTarget(current.lat,current.lon,name.trim());}};
$("saveTargetBtn").onclick=()=>{const a=$("targetLat").value.trim(),b=$("targetLon").value.trim(),lat=Number(a),lon=Number(b);if(!a||!b||!validCoord(lat,lon)){ $("targetStatus").textContent="Enter valid target coordinates first.";return;}const name=prompt("Name this destination:","House "+(saved.length+1));if(name&&name.trim()){saved.push({name:name.trim(),lat,lon});saveStore();setTarget(lat,lon,name.trim());}};
$("startLogBtn").onclick=()=>{if(!current||!target)return;logs=[];logging=true;$("startLogBtn").disabled=true;$("stopLogBtn").disabled=false;$("exportBtn").disabled=true;$("logStatus").textContent="Experiment running. Keep this page open and GPS active.";$("logCount").textContent="0 readings";};
$("stopLogBtn").onclick=()=>{logging=false;$("startLogBtn").disabled=!current||!target;$("stopLogBtn").disabled=true;$("exportBtn").disabled=!logs.length;$("logStatus").textContent=`Experiment stopped. ${logs.length} readings recorded.`;};
$("exportBtn").onclick=()=>{
  if(!logs.length)return;
  const keys=Object.keys(logs[0]),csv=[keys.join(","),...logs.map(r=>keys.map(k=>r[k]===null?"":String(r[k])).join(","))].join("\n");
  const blob=new Blob([csv],{type:"text/csv"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`coordinate-finder-${new Date().toISOString().replace(/[:.]/g,"-")}.csv`;a.click();URL.revokeObjectURL(url);
};
renderSaved();
