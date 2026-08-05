// ===== ADMIN CONTROL v1 =====
function isAdminCtl(){try{return currentUserRole==='admin';}catch(e){return false;}}
function adminStopVehicle(name){
  if(!confirm('Stop perjalanan "'+name+'" ?\nHP driver akan otomatis berhenti mengirim.'))return;
  var docId=name.replace(/[\/\#\[\]]/g,'-').replace(/\s+/g,'_');
  db.collection('live_tracking').doc(docId).update({isActive:false,locked:true}).then(function(){toast('⏹️ '+name+' di-stop oleh admin');}).catch(function(e){toast('Gagal: '+e.message,'error');});
}
function adminDeleteRoute(id){
  if(!confirm('Hapus rute ini?'))return;
  db.collection('routes').doc(id).delete().then(function(){toast('🗑️ Rute dihapus');loadRouteHistory();}).catch(function(e){toast('Gagal: '+e.message,'error');});
}
function loadRouteHistory(){
  db.collection('routes').orderBy('createdAt','desc').limit(20).get().then(function(snap){
    var rows=[];snap.forEach(function(d){rows.push(Object.assign({id:d.id},d.data()));});
    window.__savedRoutes=rows;
    var tb=document.getElementById('routeTableDash');if(!tb)return;
    tb.innerHTML=rows.map(function(r){
      return '<tr><td>'+(r.startTime||'-')+'</td><td>'+(r.endTime?'✅ '+r.endTime:'🔴 Live')+'</td><td><b>'+(r.vehicleName||'-')+'</b></td><td>'+(r.driverName||'-')+'</td><td>'+((r.distanceM||0)/1000).toFixed(2)+' km</td><td>'+(r.pointCount||0)+'</td><td><button class="btn btn-small" onclick="viewSavedRoute(\''+r.id+'\')">🗺️</button>'+(isAdminCtl()?' <button class="btn btn-danger btn-small" onclick="adminDeleteRoute(\''+r.id+'\')">🗑️</button>':'')+'</td></tr>';
    }).join('')||'<tr><td colspan="7" style="text-align:center;padding:15px;color:var(--gray)">Belum ada rute tersimpan</td></tr>';
  }).catch(function(e){console.error(e);});
}
window.addEventListener('load',function(){
  setTimeout(function(){
    var tb=document.getElementById('dashArmadaBody');if(!tb)return;
    var thr=tb.closest('table').querySelector('thead tr');
    new MutationObserver(function(){
      if(!isAdminCtl())return;
      if(!thr.querySelector('.thx')){var th=document.createElement('th');th.className='thx';th.textContent='Aksi';thr.appendChild(th);}
      Array.prototype.forEach.call(tb.rows,function(tr){
        if(tr.querySelector('.stopbtn'))return;
        var c=tr.cells[0];if(!c)return;var n=c.textContent.trim();
        if(!n||/Tidak ada|Menunggu/.test(n))return;
        var td=document.createElement('td');
        td.innerHTML='<button class="btn btn-danger btn-small stopbtn" onclick="adminStopVehicle(\''+n.replace(/'/g,'')+'\')">⏹️ Stop</button>';
        tr.appendChild(td);
      });
    }).observe(tb,{childList:true,subtree:true});
  },1200);
});
