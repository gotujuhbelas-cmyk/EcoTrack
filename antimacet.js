// ANTI-MACET v7 (compact lengkap)
var AM_PROJECT='ecotrack-184c2';
var AM={w:null,path:[],dist:0,t0:null,t0s:null,doc:null,dr:'',vh:'',ui:null,lr:0,ls:0,rid:null,mk:null,ln:null,lk:false,sub:null};
function amParse(p){if(!p)return[];if(typeof p=='string')return p.split(';').map(s=>s.split(',').map(Number));return p}
function amStr(p){return p.map(x=>x[0]+','+x[1]).join(';')}
function amFv(v){if(typeof v=='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};if(typeof v=='boolean')return{booleanValue:v};if(Array.isArray(v))return{arrayValue:{values:v.map(amFv)}};return{stringValue:String(v)}}
function amW(c,id,o){var f={};Object.keys(o).forEach(k=>f[k]=amFv(o[k]));var b='https://firestore.googleapis.com/v1/projects/'+AM_PROJECT+'/databases/(default)/documents/'+c,body=JSON.stringify({fields:f});
function pr(r){return r.text().then(t=>{if(!r.ok)throw new Error('HTTP '+r.status+' '+t.slice(0,120));return JSON.parse(t)})}
var u=id?b+'/'+encodeURIComponent(id):b;
return fetch(u,{method:id?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:body}).then(r=>(!r.ok&&id&&(r.status==400||r.status==404))?fetch(b+'?documentId='+encodeURIComponent(id),{method:'POST',headers:{'Content-Type':'application/json'},body:body}).then(pr):pr(r))}
function amRD(f){return{driverName:AM.dr,vehicleName:AM.vh,startTime:AM.t0s||AM.t0.toLocaleString('id-ID'),endTime:f?new Date().toLocaleString('id-ID'):null,path:amStr(AM.path),distanceM:Math.round(AM.dist),pointCount:AM.path.length,isActiveRoute:!f,createdAt:new Date().toISOString()}}
function amMap(pt,mid){if(!maps[mid]){maps[mid]=L.map(mid).setView(pt,16);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM'}).addTo(maps[mid])}
if(!AM.mk)AM.mk=L.marker(pt,{icon:truckIcon()}).addTo(maps[mid]);else AM.mk.setLatLng(pt);
if(!AM.ln)AM.ln=L.polyline([pt],{color:'#2e7d32',weight:4,opacity:.9}).addTo(maps[mid]);else AM.ln.setLatLngs(AM.path.length?AM.path:[pt]);
maps[mid].invalidateSize();maps[mid].panTo(pt)}
function listenToLiveTracking(tb,mid,pub){if(liveSubs[mid])return;markers[mid]={};polylines[mid]={};
liveSubs[mid]=db.collection('live_tracking').where('isActive','==',true).onSnapshot(sn=>{
var map=maps[mid],body=tb?document.getElementById(tb):null,ov=pub?document.getElementById('mapOverlay'):null,seen=[],rows='';
if(sn.empty){if(body)body.innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray)">Tidak ada armada aktif</td></tr>';if(ov)ov.style.display='flex'}
else{if(ov)ov.style.display='none';sn.forEach(dc=>{var d=dc.data(),id=dc.id,pts=amParse(d.path);seen.push(id);
var pp='<b>'+d.vehicleName+'</b><br>Driver: '+d.driverName+'<br>🛣️ '+((d.distanceM||0)/1000).toFixed(2)+' km';
if(map){if(markers[mid][id]){markers[mid][id].setLatLng([d.lat,d.lng]);markers[mid][id].setPopupContent(pp)}else markers[mid][id]=L.marker([d.lat,d.lng],{icon:truckIcon()}).addTo(map).bindPopup(pp);
if(pts.length>1){if(polylines[mid][id])polylines[mid][id].setLatLngs(pts);else polylines[mid][id]=L.polyline(pts,{color:'#2e7d32',weight:4,opacity:.85}).addTo(map)}}
rows+='<tr><td style="font-weight:bold">'+d.vehicleName+'</td><td>'+d.driverName+'</td><td style="color:var(--gray)">'+(d.localTime||'Baru saja')+'</td><td><span class="status-badge status-diolah">🟢 Aktif</span></td></tr>'});
if(body)body.innerHTML=rows}
if(map){Object.keys(markers[mid]).forEach(id=>{if(!seen.includes(id)){map.removeLayer(markers[mid][id]);delete markers[mid][id]}});Object.keys(polylines[mid]).forEach(id=>{if(!seen.includes(id)){map.removeLayer(polylines[mid][id]);delete polylines[mid][id]}})}
},e=>toast('❌ Live tracking: '+e.message,'error'))}
function viewSavedRoute(rid){var map=maps['mapDash'],r=(window.__savedRoutes||[]).find(x=>x.id===rid);if(!map){alert('Peta belum siap');return}
var pts=amParse(r?r.path:null);if(!r||pts.length<2){alert('Rute tidak valid');return}
if(savedRouteLayer.length)savedRouteLayer.forEach(l=>map.removeLayer(l));
var ln=L.polyline(pts,{color:'#ff9800',weight:5,opacity:.9}).addTo(map);
savedRouteLayer=[ln,L.marker(pts[0],{icon:flagIcon('🟢')}).addTo(map),L.marker(pts[pts.length-1],{icon:flagIcon('🏁')}).addTo(map)];
map.fitBounds(ln.getBounds(),{padding:[40,40]})}
function amAuto(){if(AM.lk)return;AM.lk=true;if(AM.ui)AM.ui.status.innerHTML='⏹️ Perjalanan di-STOP oleh kantor.';stopSharing()}
function amStart(ui,dr,vh){if(!dr||!vh){ui.status.innerHTML='❌ Isi nama driver & armada';return}
if(!navigator.geolocation){ui.status.innerHTML='❌ Browser tidak support GPS';return}
if(AM.mk&&maps[ui.mapId])maps[ui.mapId].removeLayer(AM.mk);if(AM.ln&&maps[ui.mapId])maps[ui.mapId].removeLayer(AM.ln);
if(AM.sub){AM.sub();AM.sub=null}
AM.w=null;AM.path
