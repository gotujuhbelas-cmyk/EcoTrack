// ANTI-MACET v8 (final, compact, lengkap)
var AM_PROJECT='ecotrack-184c2';
var AM={w:null,path:[],dist:0,t0:null,doc:null,dr:'',vh:'',ui:null,lr:0,ls:0,rid:null,mk:null,ln:null};
function amParse(p){if(!p)return[];if(typeof p=='string')return p.split(';').map(function(s){return s.split(',').map(Number);});return p;}
function amStr(p){return p.map(function(x){return x[0]+','+x[1];}).join(';');}
function amFv(v){
  if(typeof v=='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
  if(typeof v=='boolean')return{booleanValue:v};
  if(Array.isArray(v))return{arrayValue:{values:v.map(amFv)}};
  return{stringValue:String(v)};
}
function amW(c,id,o){
  var f={};Object.keys(o).forEach(function(k){f[k]=amFv(o[k]);});
  var b='https://firestore.googleapis.com/v1/projects/'+AM_PROJECT+'/databases/(default)/documents/'+c;
  var body=JSON.stringify({fields:f});
  function pr(r){return r.text().then(function(t){if(!r.ok)throw new Error('HTTP '+r.status+' '+t.slice(0,120));return JSON.parse(t);});}
  var u=id?b+'/'+encodeURIComponent(id):b;
  return fetch(u,{method:id?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:body}).then(function(r){
    if(!r.ok&&id&&(r.status===400||r.status===404)){return fetch(b+'?documentId='+encodeURIComponent(id),{method:'POST',headers:{'Content-Type':'application/json'},body:body}).then(pr);}
    return pr(r);
  });
}
function amRD(f){return{driverName:AM.dr,vehicleName:AM.vh,startTime:AM.t0.toLocaleString('id-ID'),endTime:f?new Date().toLocaleString('id-ID'):null,path:amStr(AM.path),distanceM:Math.round(AM.dist),pointCount:AM.path.length,isActiveRoute:!f,createdAt:new Date().toISOString()};}
function amMap(pt,mid){
  if(!maps[mid]){maps[mid]=L.map(mid).setView(pt,16);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM'}).addTo(maps[mid]);}
  if(!AM.mk)AM.mk=L.marker(pt,{icon:truckIcon()}).addTo(maps[mid]);else AM.mk.setLatLng(pt);
  if(!AM.ln)AM.ln=L.polyline([pt],{color:'#2e7d32',weight:4,opacity:.9}).addTo(maps[mid]);else AM.ln.setLatLngs(AM.path.length?AM.path:[pt]);
  maps[mid].invalidateSize();maps[mid].panTo(pt);
}
function listenToLiveTracking(tb,mid,pub){
  if(liveSubs[mid])return;
  markers[mid]={};polylines[mid]={};
  liveSubs[mid]=db.collection('live_tracking').where('isActive','==',true).onSnapshot(function(sn){
    var map=maps[mid],body=tb?document.getElementById(tb):null,ov=pub?document.getElementById('mapOverlay'):null,seen=[],rows='';
    if(sn.empty){
      if(body)body.innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray)">Tidak ada armada aktif</td></tr>';
      if(ov)ov.style.display='flex';
    }else{
      if(ov)ov.style.display='none';
      sn.forEach(function(dc){
        var d=dc.data(),id=dc.id,pts=amParse(d.path);seen.push(id);
        var pp='<b>'+d.vehicleName+'</b><br>Driver: '+d.driverName+'<br>🛣️ '+((d.distanceM||0)/1000).toFixed(2)+' km';
        if(map){
          if(markers[mid][id]){markers[mid][id].setLatLng([d.lat,d.lng]);markers[mid][id].setPopupContent(pp);}
          else markers[mid][id]=L.marker([d.lat,d.lng],{icon:truckIcon()}).addTo(map).bindPopup(pp);
          if(pts.length>1){if(polylines[mid][id])polylines[mid][id].setLatLngs(pts);else polylines[mid][id]=L.polyline(pts,{color:'#2e7d32',weight:4,opacity:.85}).addTo(map);}
        }
        rows+='<tr><td style="font-weight:bold">'+d.vehicleName+'</td><td>'+d.driverName+'</td><td style="color:var(--gray)">'+(d.localTime||'Baru saja')+'</td><td><span class="status-badge status-diolah">🟢 Aktif</span></td></tr>';
      });
      if(body)body.innerHTML=rows;
    }
    if(map){
      Object.keys(markers[mid]).forEach(function(id){if(seen.indexOf(id)<0){map.removeLayer(markers[mid][id]);delete markers[mid][id];}});
      Object.keys(polylines[mid]).forEach(function(id){if(seen.indexOf(id)<0){map.removeLayer(polylines[mid][id]);delete polylines[mid][id];}});
    }
  },function(e){toast('❌ Live tracking: '+e.message,'error');});
}
function viewSavedRoute(rid){
  var map=maps['mapDash'],r=(window.__savedRoutes||[]).find(function(x){return x.id===rid;});
  if(!map){alert('Peta belum siap');return;}
  var pts=amParse(r?r.path:null);
  if(!r||pts.length<2){alert('Rute tidak valid');return;}
  if(savedRouteLayer&&savedRouteLayer.length)savedRouteLayer.forEach(function(l){map.removeLayer(l);});
  var ln=L.polyline(pts,{color:'#ff9800',weight:5,opacity:.9}).addTo(map);
  savedRouteLayer=[ln,L.marker(pts[0],{icon:flagIcon('🟢')}).addTo(map),L.marker(pts[pts.length-1],{icon:flagIcon('🏁')}).addTo(map)];
  map.fitBounds(ln.getBounds(),{padding:[40,40]});
}
function amStart(ui,dr,vh){
  if(!dr||!vh){ui.status.innerHTML='❌ Isi nama driver & armada';return;}
  if(!navigator.geolocation){ui.status.innerHTML='❌ Browser tidak support GPS';return;}
  if(AM.mk&&maps[ui.mapId])maps[ui.mapId].removeLayer(AM.mk);
  if(AM.ln&&maps[ui.mapId])maps[ui.mapId].removeLayer(AM.ln);
  AM.w=null;AM.path=[];AM.dist=0;AM.t0=new Date();AM.dr=dr;AM.vh=vh;AM.ui=ui;AM.lr=0;AM.ls=0;AM.rid=null;AM.mk=null;AM.ln=null;
  AM.doc=vh.replace(/[\/\#\[\]]/g,'-').replace(/\s+/g,'_');
  ui.btnStart.style.display='none';ui.btnStop.style.display='block';
  ui.status.innerHTML='📡 Mencari GPS... <small>(izinkan akses lokasi)</small>';
  AM.w=navigator.geolocation.watchPosition(function(p){
    var la=p.coords.latitude,lo=p.coords.longitude,ac=p.coords.accuracy;
    var pt=[Number(la.toFixed(6)),Number(lo.toFixed(6))],now=Date.now(),last=AM.path[AM.path.length-1];
    if(!last||haversineM(last,pt)>=8||now-AM.lr>20000){
      if(last)AM.dist+=haversineM(last,pt);
      AM.path.push(pt);AM.lr=now;
    }
    amMap(pt,ui.mapId);
        amW('live_tracking',AM.doc,{driverName:AM.dr,vehicleName:AM.vh,lat:la,lng:lo,accuracy:ac,path:amStr(AM.path),distanceM:Math.round(AM.dist),startTime:AM.t0.toLocaleString('id-ID'),localTime:new Date().toLocaleString('id-ID'),isActive:true}).then(function(){
      ui.status.innerHTML='✅ TERKIRIM! 🛣️ Titik: '+AM.path.length+' | ±'+(AM.dist/1000).toFixed(2)+' km<br><small>Biarkan halaman terbuka</small>';
      if(AM.path.length>=2){
        if(!AM.rid){amW('routes',null,amRD(false)).then(function(r){AM.rid=r.name.split('/').pop();AM.ls=now;}).catch(function(){});}
        else if(now-AM.ls>30000){AM.ls=now;amW('routes',AM.rid,amRD(false)).catch(function(){});}
      }
    }).catch(function(e){ui.status.innerHTML='❌ Gagal kirim: '+e.message;});
  },function(e){
    var m=e.code===1?'Izin lokasi DITOLAK. Ketuk 🔒 di address bar → Site settings → Location → Allow':e.code===2?'GPS tidak tersedia. Nyalakan lokasi HP':e.code===3?'Timeout GPS':e.message;
    ui.status.innerHTML='❌ '+m;
    ui.btnStart.style.display='block';ui.btnStop.style.display='none';
  },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
}
function startPublicSharing(e){
  e.preventDefault();
  amStart({status:document.getElementById('driverStatus'),btnStart:document.getElementById('btnStartTrack'),btnStop:document.getElementById('btnStopTrack'),mapId:'mapShare'},document.getElementById('driverName').value.trim(),document.getElementById('vehicleName').value.trim());
}
function startDashSharing(){
  amStart({status:document.getElementById('dsStatus'),btnStart:document.getElementById('btnStartDs'),btnStop:document.getElementById('btnStopDs'),mapId:'mapDashShare'},document.getElementById('dsDriverName').value.trim(),document.getElementById('dsVehicleName').value.trim());
}
function stopSharing(){
  if(AM.w!==null)navigator.geolocation.clearWatch(AM.w);AM.w=null;
  var ui=AM.ui;
  if(AM.path.length>=2){
    amW('routes',AM.rid||null,amRD(true)).then(function(){
      if(ui)ui.status.innerHTML='⏹️ Rute TERSIMPAN: '+AM.path.length+' titik, ±'+(AM.dist/1000).toFixed(2)+' km';
      loadRouteHistory();
    }).catch(function(e){if(ui)ui.status.innerHTML='⏹️ Rute gagal disimpan: '+e.message;});
  }else if(ui){ui.status.innerHTML='⏹️ Berhenti (titik < 2)';}
  if(AM.doc&&AM.path.length){
    var lp=AM.path[AM.path.length-1];
    amW('live_tracking',AM.doc,{driverName:AM.dr,vehicleName:AM.vh,lat:lp[0],lng:lp[1],path:amStr(AM.path),distanceM:Math.round(AM.dist),startTime:AM.t0.toLocaleString('id-ID'),localTime:new Date().toLocaleString('id-ID'),isActive:false}).catch(function(){});
  }
  if(ui){ui.btnStart.style.display='block';ui.btnStop.style.display='none';}
}
