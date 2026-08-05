// AMVIEW v2 (pembaca peta monitoring)
function listenToLiveTracking(tb,mid,pub){
  if(liveSubs[mid])return;
  markers[mid]={};polylines[mid]={};
  liveSubs[mid]=db.collection('live_tracking').where('isActive','==',true).onSnapshot(function(sn){
    var mp=maps[mid],bd=tb?document.getElementById(tb):null,ov=pub?document.getElementById('mapOverlay'):null,rows='';
    if(sn.empty){
      if(bd)bd.innerHTML='<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--gray)">Tidak ada armada aktif</td></tr>';
      if(ov)ov.style.display='flex';
    }else{
      if(ov)ov.style.display='none';
      sn.forEach(function(dc){
        var d=dc.data(),id=dc.id,pts=amP(d.path);
        if(mp){
          if(!markers[mid][id])markers[mid][id]=L.marker([d.lat,d.lng],{icon:truckIcon()}).addTo(mp).bindPopup('<b>'+d.vehicleName+'</b>');
          markers[mid][id].setLatLng([d.lat,d.lng]);
          if(pts.length>1){
            if(!polylines[mid][id])polylines[mid][id]=L.polyline(pts,{color:'#2e7d32',weight:4,opacity:.85}).addTo(mp);
            else polylines[mid][id].setLatLngs(pts);
          }
        }
        rows+='<tr><td><b>'+d.vehicleName+'</b></td><td>'+d.driverName+'</td><td>'+(d.localTime||'-')+'</td><td><span class="status-badge status-diolah">🟢 Aktif</span></td></tr>';
      });
      if(bd)bd.innerHTML=rows;
    }
  },function(e){toast('❌ '+e.message,'error');});
}
function viewSavedRoute(rid){
  var mp=maps['mapDash'],r=(window.__savedRoutes||[]).find(function(x){return x.id===rid;});
  if(!mp||!r)return;
  var pts=amP(r.path);
  if(pts.length<2)return;
  if(savedRouteLayer&&savedRouteLayer.length)savedRouteLayer.forEach(function(l){mp.removeLayer(l);});
  var ln=L.polyline(pts,{color:'#ff9800',weight:5,opacity:.9}).addTo(mp);
  savedRouteLayer=[ln,L.marker(pts[0],{icon:flagIcon('🟢')}).addTo(mp),L.marker(pts[pts.length-1],{icon:flagIcon('🏁')}).addTo(mp)];
  mp.fitBounds(ln.getBounds(),{padding:[40,40]});
}
