// ===== ANTI-MACET v1: kirim lokasi via REST (HTTPS biasa) =====
var AM_PROJECT = 'ecotrack-184c2';
var AM = {watchId:null, path:[], dist:0, start:null, docId:null, driver:'', vehicle:'', ui:null, lastRec:0, lastSave:0, routeId:null, marker:null, line:null};

function amFv(v){
  if (typeof v === 'number') return Number.isInteger(v) ? {integerValue:v} : {doubleValue:v};
  if (typeof v === 'boolean') return {booleanValue:v};
  if (Array.isArray(v)) return {arrayValue:{values:v.map(function(x){return Array.isArray(x)?{arrayValue:{values:x.map(function(n){return {doubleValue:n};})}}:amFv(x);})}};
  return {stringValue:String(v)};
}
function amWrite(col, docId, obj){
  var fields={}; Object.keys(obj).forEach(function(k){fields[k]=amFv(obj[k]);});
  var url='https://firestore.googleapis.com/v1/projects/'+AM_PROJECT+'/databases/(default)/documents/'+col+(docId?('/'+encodeURIComponent(docId)):'');
  return fetch(url,{method:docId?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields})}).then(function(r){
    if(!r.ok) return r.text().then(function(t){throw new Error('HTTP '+r.status);});
    return r.json();
  });
}
function amRouteDoc(final){
  return {driverName:AM.driver, vehicleName:AM.vehicle, startTime:AM.start.toLocaleString('id-ID'),
    endTime:final?new Date().toLocaleString('id-ID'):null, path:AM.path, distanceM:Math.round(AM.dist),
    pointCount:AM.path.length, isActiveRoute:!final, createdAt:new Date().toISOString()};
}
function amMap(pt, mapId){
  if(!maps[mapId]){ maps[mapId]=L.map(mapId).setView(pt,16); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM'}).addTo(maps[mapId]); }
  if(!AM.marker) AM.marker=L.marker(pt,{icon:truckIcon()}).addTo(maps[mapId]); else AM.marker.setLatLng(pt);
  if(!AM.line) AM.line=L.polyline([pt],{color:'#2e7d32',weight:4,opacity:.9}).addTo(maps[mapId]); else AM.line.setLatLngs(AM.path.length?AM.path:[pt]);
  maps[mapId].invalidateSize(); maps[mapId].panTo(pt);
}
function amStart(ui, driver, vehicle){
  if(!driver||!vehicle){ui.status.innerHTML='❌ Isi nama driver & armada';return;}
  if(!navigator.geolocation){ui.status.innerHTML='❌ Browser tidak support GPS';return;}
  if(AM.marker&&maps[ui.mapId]){maps[ui.mapId].removeLayer(AM.marker);} if(AM.line&&maps[ui.mapId]){maps[ui.mapId].removeLayer(AM.line);}
  AM.watchId=null; AM.path=[]; AM.dist=0; AM.start=new Date(); AM.driver=driver; AM.vehicle=vehicle; AM.ui=ui; AM.lastRec=0; AM.lastSave=0; AM.routeId=null; AM.marker=null; AM.line=null;
  AM.docId=vehicle.replace(/[\/\#\[\]]/g,'-').replace(/\s+/g,'_');
  ui.btnStart.style.display='none'; ui.btnStop.style.display='block';
  ui.status.innerHTML='📡 Mencari GPS... <small>(izinkan akses lokasi)</small>';
  AM.watchId=navigator.geolocation.watchPosition(function(pos){
    var lat=pos.coords.latitude, lng=pos.coords.longitude, acc=pos.coords.accuracy;
    var pt=[Number(lat.toFixed(6)),Number(lng.toFixed(6))];
    var now=Date.now();
    var last=AM.path[AM.path.length-1];
    if(!last || haversineM(last,pt)>=8 || (now-AM.lastRec)>20000){
      if(last) AM.dist+=haversineM(last,pt);
      AM.path.push(pt); AM.lastRec=now;
    }
    amMap(pt, ui.mapId);
    var payload={driverName:AM.driver, vehicleName:AM.vehicle, lat:lat, lng:lng, accuracy:acc,
      path:AM.path, distanceM:Math.round(AM.dist), startTime:AM.start.toLocaleString('id-ID'),
      localTime:new Date().toLocaleString('id-ID'), isActive:true};
    amWrite('live_tracking', AM.docId, payload).then(function(){
      ui.status.innerHTML='✅ TERKIRIM!<br>Lat: '+lat.toFixed(5)+', Lng: '+lng.toFixed(5)+'<br>Akurasi: ±'+Math.round(acc)+'m<br>🛣️ Titik: '+AM.path.length+' | ±'+(AM.dist/1000).toFixed(2)+' km<br><small>Biarkan halaman terbuka</small>';
      if(AM.path.length>=2){
        if(!AM.routeId){
          amWrite('routes', null, amRouteDoc(false)).then(function(r){ AM.routeId=r.name.split('/').pop(); AM.lastSave=now; }).catch(function(){});
        } else if(now-AM.lastSave>30000){
          AM.lastSave=now;
          amWrite('routes', AM.routeId, amRouteDoc(false)).catch(function(){});
        }
      }
    }).catch(function(err){ ui.status.innerHTML='❌ Gagal kirim: '+err.message; });
  }, function(err){
    var m=''; if(err.code===1)m='Izin lokasi DITOLAK. Ketuk 🔒 → Site settings → Location → Allow';
    else if(err.code===2)m='GPS tidak tersedia. Nyalakan lokasi HP';
    else if(err.code===3)m='Timeout GPS'; else m=err.message;
    ui.status.innerHTML='❌ '+m;
    ui.btnStart.style.display='block'; ui.btnStop.style.display='none';
  }, {enableHighAccuracy:true, timeout:15000, maximumAge:0});
}
function startPublicSharing(e){
  e.preventDefault();
  amStart({status:document.getElementById('driverStatus'), btnStart:document.getElementById('btnStartTrack'), btnStop:document.getElementById('btnStopTrack'), mapId:'mapShare'},
    document.getElementById('driverName').value.trim(), document.getElementById('vehicleName').value.trim());
}
function startDashSharing(){
  amStart({status:document.getElementById('dsStatus'), btnStart:document.getElementById('btnStartDs'), btnStop:document.getElementById('btnStopDs'), mapId:'mapDashShare'},
    document.getElementById('dsDriverName').value.trim(), document.getElementById('dsVehicleName').value.trim());
}
function stopSharing(){
  if(AM.watchId!==null) navigator.geolocation.clearWatch(AM.watchId); AM.watchId=null;
  var ui=AM.ui;
  if(AM.path.length>=2){
    amWrite('routes', AM.routeId||null, amRouteDoc(true)).then(function(){
      if(ui) ui.status.innerHTML='⏹️ Rute TERSIMPAN: '+AM.path.length+' titik, ±'+(AM.dist/1000).toFixed(2)+' km';
      loadRouteHistory();
    }).catch(function(err){ if(ui) ui.status.innerHTML='⏹️ Rute gagal disimpan: '+err.message; });
  } else if(ui){ ui.status.innerHTML='⏹️ Berhenti (titik < 2, rute tidak tersimpan)'; }
  if(AM.docId && AM.path.length){
    var off={driverName:AM.driver, vehicleName:AM.vehicle, lat:AM.path[AM.path.length-1][0], lng:AM.path[AM.path.length-1][1],
      path:AM.path, distanceM:Math.round(AM.dist), startTime:AM.start?AM.start.toLocaleString('id-ID'):'-',
      localTime:new Date().toLocaleString('id-ID'), isActive:false};
    amWrite('live_tracking', AM.docId, off).catch(function(){});
  }
  if(ui){ ui.btnStart.style.display='block'; ui.btnStop.style.display='none'; }
}
