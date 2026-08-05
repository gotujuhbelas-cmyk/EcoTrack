// ============ FIREBASE ============
const firebaseConfig = {
  apiKey: "AIzaSyCd70zeLsmPYBHH1UdKkp4dlrKr57P73yk",
  authDomain: "ecotrack-184c2.firebaseapp.com",
  projectId: "ecotrack-184c2",
  storageBucket: "ecotrack-184c2.firebasestorage.app",
  messagingSenderId: "703447241523",
  appId: "1:703447241523:web:0841c9817537b0aa82a446"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ============ STATE ============
let dataSampah = [], currentUser = null, currentUserRole = 'user';
const chartRegistry = {};
let selectedFiles = [], editFiles = [], editExistingPhotos = [];
let unsubscribeData = null;
let maps = {}, markers = {}, polylines = {}, liveSubs = {};
let watchId = null, routePath = [], routeDistance = 0, routeStartTime = null, routeDocId = null;
let shareMarker = null, sharePolyline = null, savedRouteLayer = [];
let savedRouteId = null, lastRecordTime = 0, lastSaveTime = 0;
let dsWatchId = null, dsRoutePath = [], dsRouteDistance = 0, dsRouteStartTime = null, dsRouteDocId = null;
let dsShareMarker = null, dsSharePolyline = null, dsSavedRouteId = null, dsLastRecordTime = 0, dsLastSaveTime = 0;

// ============ INIT ============
window.addEventListener('load', () => {
  setTimeout(() => { document.getElementById('splashScreen').classList.add('hidden'); initApp(); }, 1500);
});

function initApp() {
  const now = new Date();
  try {
    document.getElementById('fTanggal').valueAsDate = now;
    document.getElementById('reportDate').valueAsDate = now;
    document.getElementById('reportWeekDate').valueAsDate = now;
    document.getElementById('reportMonth').value = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    const weekAgo = new Date(); weekAgo.setDate(now.getDate()-7);
    document.getElementById('reportDateFrom').valueAsDate = weekAgo;
    document.getElementById('reportDateTo').valueAsDate = now;
  } catch(e) {}

  auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
      db.collection('users').doc(user.uid).get().then(doc => {
        currentUserRole = (doc.exists && doc.data().role) ? doc.data().role : 'user';
        const nama = (doc.exists && doc.data().nama) ? doc.data().nama : user.email;
        document.getElementById('dashEmail').textContent = user.email;
        document.getElementById('dashBrand').textContent = nama;
        const badge = document.getElementById('roleBadge');
        badge.textContent = currentUserRole.toUpperCase();
        badge.className = 'role-badge role-' + currentUserRole;
        applyRoleVisibility();
        showDashboard();
        subscribeToData();
      }).catch(() => { currentUserRole='user'; showDashboard(); subscribeToData(); });
    } else {
      if (unsubscribeData) unsubscribeData();
      dataSampah = [];
      showPublic();
    }
  });
}

function applyRoleVisibility() {
  const isAdmin = currentUserRole === 'admin';
  const isUser = currentUserRole === 'user';
  const isDriver = currentUserRole === 'driver';
  setVis('dashInput', isAdmin || isDriver);
  setVis('navInput', isAdmin || isDriver);
  setVis('dashData', isAdmin || isUser);
  setVis('navData', isAdmin || isUser);
  setVis('dashReport', isAdmin || isUser);
  setVis('navReport', isAdmin || isUser);
  setVis('thAksi', isAdmin);
  setVis('dashShare', isDriver);
  setVis('navShare', isDriver);
}

function setVis(id, show) { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', !show); }

// ============ NAV ============
function hideAllViews() { ['publicView','loginView','dashboardView','driverTrackingView'].forEach(id => document.getElementById(id).classList.add('hidden')); }
function showPublic() { hideAllViews(); document.getElementById('publicView').classList.remove('hidden'); closeMenu(); renderPublic(); initMap('mapPublic'); listenToLiveTracking(null,'mapPublic',true); }
function showLogin() { hideAllViews(); document.getElementById('loginView').classList.remove('hidden'); document.getElementById('loginError').style.display='none'; closeMenu(); }
function showDashboard() { hideAllViews(); document.getElementById('dashboardView').classList.remove('hidden'); closeMenu(); initMap('mapDash'); listenToLiveTracking('dashArmadaBody','mapDash'); loadRouteHistory(); if (currentUserRole === 'driver') { try { document.getElementById('dsDriverName').value = document.getElementById('dashBrand').textContent; } catch(e) {} } }
function showDriverTracking() { hideAllViews(); document.getElementById('driverTrackingView').classList.remove('hidden'); closeMenu(); setTimeout(()=>{ if(maps['mapShare']) maps['mapShare'].invalidateSize(); }, 200); }
function toggleMenu() { document.getElementById('navLinks').classList.toggle('active'); document.getElementById('dashNavLinks').classList.toggle('active'); }
function closeMenu() { document.getElementById('navLinks').classList.remove('active'); document.getElementById('dashNavLinks').classList.remove('active'); }

// ============ AUTH ============
async function doFirebaseLogin(e) {
  e.preventDefault(); showLoading('Memproses login...');
  try { await auth.signInWithEmailAndPassword(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value); hideLoading(); }
  catch(err) {
    const m = {'auth/invalid-credential':'Email/password salah','auth/user-not-found':'Email tidak ada','auth/wrong-password':'Password salah','auth/invalid-email':'Email tidak valid'};
    document.getElementById('loginError').textContent = '❌ ' + (m[err.code] || err.code);
    document.getElementById('loginError').style.display = 'block'; hideLoading();
  }
}
async function doFirebaseLogout() { if (!confirm('Yakin logout?')) return; await auth.signOut(); toast('Logout berhasil'); }

// ============ DATA ============
function subscribeToData() {
  if (unsubscribeData) unsubscribeData();
  unsubscribeData = db.collection('sampah').orderBy('tanggal','desc').onSnapshot(snap => {
    dataSampah = []; snap.forEach(d => dataSampah.push({id:d.id, ...d.data()}));
    renderPublic(); renderAll(); hideLoading();
  }, err => { console.error(err); toast('❌ Error: '+err.message,'error'); hideLoading(); });
}

function renderAll() {
  const t = id => document.getElementById(id);
  t('stPickup').textContent = dataSampah.length;
  t('stWeight').textContent = dataSampah.reduce((a,b)=>a+Number(b.berat||0),0).toFixed(1);
  t('stProcessed').textContent = dataSampah.reduce((a,b)=>a+Number(b.diolah||0),0).toFixed(1);
  t('stResidue').textContent = dataSampah.reduce((a,b)=>a+Number(b.residu||0),0).toFixed(1);
  renderDashTable();
}

function renderPublic() {
  const t = id => document.getElementById(id);
  t('pubTotalPickup').textContent = dataSampah.length;
  t('pubTotalWeight').textContent = dataSampah.reduce((a,b)=>a+Number(b.berat||0),0).toFixed(1);
  t('pubProcessed').textContent = dataSampah.reduce((a,b)=>a+Number(b.diolah||0),0).toFixed(1);
  t('pubResidue').textContent = dataSampah.reduce((a,b)=>a+Number(b.residu||0),0).toFixed(1);
  t('pubTable').innerHTML = dataSampah.slice(0,5).map(d => {
    const hp = d.diolah !== null && d.diolah !== undefined;
    return '<tr><td>'+d.tanggal+'</td><td>'+d.jenis+'</td><td>'+d.berat+'</td><td><span class="status-badge '+(hp?'status-diolah':'status-pending')+'">'+(hp?d.diolah+' kg diolah':'Menunggu')+'</span></td><td>'+(d.fotos&&d.fotos.length?'📷 '+d.fotos.length:'-')+'</td></tr>';
  }).join('') || '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--gray)">Belum ada data</td></tr>';
  renderChart('pubChart', true);
}

function renderDashTable() {
  const isAdmin = currentUserRole === 'admin';
  document.getElementById('dashDataTable').innerHTML = dataSampah.map(d => {
    const hp = d.diolah !== null && d.diolah !== undefined, fc = d.fotos ? d.fotos.length : 0;
    return '<tr><td>'+d.tanggal+'</td><td>'+d.jenis+'</td><td>'+d.berat+' kg</td>'+
      '<td><span class="status-badge '+(hp?'status-diolah':'status-pending')+'">'+(hp?d.diolah:'-')+'</span></td>'+
      '<td>'+(d.residu !== null && d.residu !== undefined ? d.residu : '-')+'</td><td>'+d.petugas+'</td>'+
      '<td>'+(fc?'<span style="cursor:pointer;color:var(--primary)" onclick="viewRecordPhotos(\''+d.id+'\')">📷 '+fc+'</span>':'-')+'</td>'+
      (isAdmin?'<td><button class="btn btn-warning btn-small" onclick="editData(\''+d.id+'\')">✏️</button> <button class="btn btn-danger btn-small" onclick="deleteData(\''+d.id+'\')">🗑️</button></td>':'')+'</tr>';
  }).join('') || '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--gray)">Belum ada data</td></tr>';
}

function renderChart(canvasId, isBar) {
  const sorted = [...dataSampah].sort((a,b)=>a.tanggal.localeCompare(b.tanggal)).slice(-7);
  const el = document.getElementById(canvasId);
  if (!el || sorted.length === 0) return;
  if (chartRegistry[canvasId]) chartRegistry[canvasId].destroy();
  chartRegistry[canvasId] = new Chart(el, {
    type: isBar ? 'bar' : 'line',
    data: { labels: sorted.map(d=>d.tanggal), datasets: [
      {label:'Diolah', data:sorted.map(d=>d.diolah||0), backgroundColor:isBar?'#2e7d32':'rgba(46,125,50,.1)', borderColor:'#2e7d32', fill:!isBar, tension:.3},
      {label:'Residu', data:sorted.map(d=>d.residu||0), backgroundColor:isBar?'#e53935':'rgba(229,57,53,.1)', borderColor:'#e53935', fill:!isBar, tension:.3}
    ]}, options: {responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}}
  });
}

// ============ CRUD ============
async function addData(e) {
  e.preventDefault();
  if (selectedFiles.length > 5) { toast('Maksimal 5 foto!','error'); return; }
  document.getElementById('btnSave').disabled = true; showLoading('Menyimpan...');
  try {
    const fotos = []; for (const f of selectedFiles) fotos.push(await compressImage(f.file));
    await db.collection('sampah').add({
      tanggal: document.getElementById('fTanggal').value,
      jenis: document.getElementById('fJenis').value,
      berat: parseFloat(document.getElementById('fBerat').value) || 0,
      diolah: document.getElementById('fDiolah').value ? parseFloat(document.getElementById('fDiolah').value) : null,
      residu: document.getElementById('fResidu').value ? parseFloat(document.getElementById('fResidu').value) : null,
      petugas: document.getElementById('fPetugas').value,
      catatan: document.getElementById('fCatatan').value,
      fotos, createdBy: currentUser ? currentUser.email : 'unknown',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    e.target.reset(); selectedFiles = []; renderFileList();
    document.getElementById('fTanggal').valueAsDate = new Date();
    toast('✅ Data tersimpan!');
  } catch(err) { toast('❌ Gagal: '+err.message,'error'); }
  finally { document.getElementById('btnSave').disabled = false; hideLoading(); }
}

function editData(id) {
  const r = dataSampah.find(d=>d.id===id); if (!r) return;
  document.getElementById('eId').value = r.id;
  document.getElementById('eTanggal').value = r.tanggal;
  document.getElementById('eJenis').value = r.jenis;
  document.getElementById('eBerat').value = r.berat;
  document.getElementById('eDiolah').value = r.diolah || '';
  document.getElementById('eResidu').value = r.residu || '';
  document.getElementById('ePetugas').value = r.petugas;
  document.getElementById('eCatatan').value = r.catatan || '';
  editExistingPhotos = r.fotos || []; editFiles = [];
  renderEditExistingPhotos(); renderEditFileList();
  document.getElementById('editModal').classList.add('active');
}

async function updateData(e) {
  e.preventDefault();
  if (editExistingPhotos.length + editFiles.length > 5) { toast('Maksimal 5 foto!','error'); return; }
  showLoading('Mengupdate...');
  try {
    const baru = []; for (const f of editFiles) baru.push(await compressImage(f.file));
    await db.collection('sampah').doc(document.getElementById('eId').value).update({
      tanggal: document.getElementById('eTanggal').value,
      jenis: document.getElementById('eJenis').value,
      berat: parseFloat(document.getElementById('eBerat').value) || 0,
      diolah: document.getElementById('eDiolah').value ? parseFloat(document.getElementById('eDiolah').value) : null,
      residu: document.getElementById('eResidu').value ? parseFloat(document.getElementById('eResidu').value) : null,
      petugas: document.getElementById('ePetugas').value,
      catatan: document.getElementById('eCatatan').value,
      fotos: [...editExistingPhotos, ...baru],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    closeEditModal(); toast('✅ Data diupdate!');
  } catch(err) { toast('❌ Gagal: '+err.message,'error'); }
  finally { hideLoading(); }
}

async function deleteData(id) {
  if (!confirm('Hapus data ini?')) return;
  try { await db.collection('sampah').doc(id).delete(); toast('Data dihapus'); }
  catch(err) { toast('Gagal: '+err.message,'error'); }
}

function compressImage(file, maxWidth=800, quality=0.7) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = h*maxWidth/w; w = maxWidth; }
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        res(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = rej; img.src = e.target.result;
    };
    r.onerror = rej; r.readAsDataURL(file);
  });
}

// ============ FILES ============
function handleFileSelect(ev) {
  const files = Array.from(ev.target.files);
  if (selectedFiles.length + files.length > 5) { toast('Max 5 foto!','error'); ev.target.value=''; return; }
  files.forEach(f => {
    const r = new FileReader();
    r.onload = e => { selectedFiles.push({file:f, dataUrl:e.target.result}); renderFileList(); };
    r.readAsDataURL(f);
  });
  ev.target.value = '';
}
function renderFileList() {
  document.getElementById('fileList').innerHTML = selectedFiles.map((f,i) =>
    '<div class="file-item"><img src="'+f.dataUrl+'"><div class="remove-file" onclick="removeFile('+i+')">×</div></div>'
  ).join('');
}
function removeFile(i) { selectedFiles.splice(i,1); renderFileList(); }

function handleEditFileSelect(ev) {
  const files = Array.from(ev.target.files);
  if (editExistingPhotos.length + editFiles.length + files.length > 5) { toast('Max 5 foto!','error'); ev.target.value=''; return; }
  files.forEach(f => {
    const r = new FileReader();
    r.onload = e => { editFiles.push({file:f, dataUrl:e.target.result}); renderEditFileList(); };
    r.readAsDataURL(f);
  });
  ev.target.value = '';
}
function renderEditFileList() {
  document.getElementById('eFileList').innerHTML = editFiles.map((f,i) =>
    '<div class="file-item"><img src="'+f.dataUrl+'"><div class="remove-file" onclick="removeEditFile('+i+')">×</div></div>'
  ).join('');
}
function removeEditFile(i) { editFiles.splice(i,1); renderEditFileList(); }

function renderEditExistingPhotos() {
  document.getElementById('eExistingPhotos').innerHTML = editExistingPhotos.length ?
    editExistingPhotos.map((f,i) => '<div class="photo-item" onclick="viewPhoto(\''+f+'\')"><img src="'+f+'"></div>').join('') :
    '<p style="color:var(--gray)">Belum ada foto</p>';
}
function viewPhoto(src) { document.getElementById('photoViewer').innerHTML = '<img src="'+src+'" class="full-image">'; document.getElementById('photoModal').classList.add('active'); }
function closePhotoModal() { document.getElementById('photoModal').classList.remove('active'); }
function viewRecordPhotos(id) {
  const r = dataSampah.find(d=>d.id===id);
  if (r && r.fotos && r.fotos.length) {
    document.getElementById('photoViewer').innerHTML = r.fotos.map(f => '<img src="'+f+'" class="full-image" style="margin-bottom:10px">').join('');
    document.getElementById('photoModal').classList.add('active');
  }
}
function closeEditModal() { document.getElementById('editModal').classList.remove('active'); editFiles = []; editExistingPhotos = []; }

// ============ REPORT ============
function toggleCustomDate() {
  const p = document.getElementById('reportPeriod').value;
  ['dailyDateGroup','weeklyDateGroup','monthlyDateGroup','customDateGroup','customDateGroup2'].forEach(id => document.getElementById(id).classList.add('hidden'));
  if (p === 'daily') document.getElementById('dailyDateGroup').classList.remove('hidden');
  if (p === 'weekly') document.getElementById('weeklyDateGroup').classList.remove('hidden');
  if (p === 'monthly') document.getElementById('monthlyDateGroup').classList.remove('hidden');
  if (p === 'custom') { document.getElementById('customDateGroup').classList.remove('hidden'); document.getElementById('customDateGroup2').classList.remove('hidden'); }
  generateReport();
}

function generateReport() {
  const p = document.getElementById('reportPeriod').value;
  let fd=[], labels=[], cd=[], cr=[];
  const sum = (arr,k) => arr.reduce((a,b)=>a+Number(b[k]||0), 0);
  if (p === 'daily') {
    const d = document.getElementById('reportDate').value; if (!d) return;
    fd = dataSampah.filter(x=>x.tanggal===d); labels=[d]; cd=[sum(fd,'diolah')]; cr=[sum(fd,'residu')];
  } else if (p === 'weekly') {
    const v = document.getElementById('reportWeekDate').value; if (!v) return;
    const s = new Date(v), day = s.getDay(), mon = new Date(s); mon.setDate(s.getDate()-day+(day===0?-6:1));
    const sun = new Date(mon); sun.setDate(mon.getDate()+6);
    const ms = mon.toISOString().split('T')[0], ss = sun.toISOString().split('T')[0];
    fd = dataSampah.filter(x=>x.tanggal>=ms && x.tanggal<=ss);
    const map = {}; for (let i=0;i<7;i++) { const dt = new Date(mon); dt.setDate(mon.getDate()+i); map[dt.toISOString().split('T')[0]] = {d:0, r:0}; }
    fd.forEach(x => { if (map[x.tanggal]) { map[x.tanggal].d += Number(x.diolah||0); map[x.tanggal].r += Number(x.residu||0); } });
    labels = Object.keys(map); cd = Object.values(map).map(v=>v.d); cr = Object.values(map).map(v=>v.r);
  } else if (p === 'monthly') {
    const m = document.getElementById('reportMonth').value; if (!m) return;
    fd = dataSampah.filter(x=>x.tanggal.startsWith(m));
    const map = {}; fd.forEach(x => { map[x.tanggal] = map[x.tanggal] || {d:0,r:0}; map[x.tanggal].d += Number(x.diolah||0); map[x.tanggal].r += Number(x.residu||0); });
    labels = Object.keys(map).sort(); cd = labels.map(l=>map[l].d); cr = labels.map(l=>map[l].r);
  } else {
    const a = document.getElementById('reportDateFrom').value, b = document.getElementById('reportDateTo').value; if (!a || !b) return;
    fd = dataSampah.filter(x=>x.tanggal>=a && x.tanggal<=b);
    const map = {}; fd.forEach(x => { map[x.tanggal] = map[x.tanggal] || {d:0,r:0}; map[x.tanggal].d += Number(x.diolah||0); map[x.tanggal].r += Number(x.residu||0); });
    labels = Object.keys(map).sort(); cd = labels.map(l=>map[l].d); cr = labels.map(l=>map[l].r);
  }
  document.getElementById('rptTotalPickup').textContent = fd.length;
  document.getElementById('rptTotalWeight').textContent = sum(fd,'berat').toFixed(1);
  document.getElementById('rptTotalProcessed').textContent = sum(fd,'diolah').toFixed(1);
  document.getElementById('rptTotalResidue').textContent = sum(fd,'residu').toFixed(1);
  document.getElementById('reportTableBody').innerHTML = fd.map(d =>
    '<tr><td>'+d.tanggal+'</td><td>'+d.jenis+'</td><td>'+d.berat+'</td><td>'+(d.diolah!==null&&d.diolah!==undefined?d.diolah:'-')+'</td><td>'+(d.residu!==null&&d.residu!==undefined?d.residu:'-')+'</td><td>'+d.petugas+'</td></tr>'
  ).join('') || '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--gray)">Tidak ada data</td></tr>';
  if (chartRegistry['reportChart']) chartRegistry['reportChart'].destroy();
  if (labels.length) {
    chartRegistry['reportChart'] = new Chart(document.getElementById('reportChart'), {
      type:'line', data:{labels, datasets:[
        {label:'Diolah', data:cd, borderColor:'#2e7d32', backgroundColor:'rgba(46,125,50,.1)', fill:true, tension:.3},
        {label:'Residu', data:cr, borderColor:'#e53935', backgroundColor:'rgba(229,57,53,.1)', fill:true, tension:.3}
      ]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}}
    });
  }
}

// ============ MAP ============
function haversineM(a,b) { const R=6371000, t=x=>x*Math.PI/180; const dLat=t(b[0]-a[0]), dLng=t(b[1]-a[1]); const s = Math.sin(dLat/2)**2 + Math.cos(t(a[0]))*Math.cos(t(b[0]))*Math.sin(dLng/2)**2; return 2*R*Math.asin(Math.sqrt(s)); }
function truckIcon() { return L.divIcon({className:'', html:'<div style="width:44px;height:44px;background:#fff;border:3px solid #2e7d32;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 3px 10px rgba(0,0,0,.4)">🚛</div>', iconSize:[44,44], iconAnchor:[22,22], popupAnchor:[0,-26]}); }
function flagIcon(e) { return L.divIcon({className:'', html:'<div style="font-size:26px;text-shadow:0 2px 4px rgba(0,0,0,.4)">'+e+'</div>', iconSize:[30,30], iconAnchor:[15,15], popupAnchor:[0,-18]}); }

function initMap(mapId, center, zoom) {
  setTimeout(() => {
    if (!maps[mapId]) {
      maps[mapId] = L.map(mapId).setView(center || [-6.2, 106.6], zoom || 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution:'© OpenStreetMap'}).addTo(maps[mapId]);
    }
    maps[mapId].invalidateSize();
  }, 100);
}

function listenToLiveTracking(tableBodyId, mapId, isPublic=false) {
  if (liveSubs[mapId]) return;
  markers[mapId] = {}; polylines[mapId] = {};
  liveSubs[mapId] = db.collection('live_tracking').where('isActive','==',true).onSnapshot(snap => {
    const map = maps[mapId], tbody = tableBodyId ? document.getElementById(tableBodyId) : null, overlay = isPublic ? document.getElementById('mapOverlay') : null;
    const seen = []; let rows = '';
    if (snap.empty) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--gray)">Tidak ada armada aktif</td></tr>';
      if (overlay) overlay.style.display = 'flex';
    } else {
      if (overlay) overlay.style.display = 'none';
      snap.forEach(doc => {
        const d = doc.data(), id = doc.id; seen.push(id);
        const popup = '<b>'+d.vehicleName+'</b><br>Driver: '+d.driverName+'<br>Update: '+(d.localTime||'-')+'<br>🛣️ '+((d.distanceM||0)/1000).toFixed(2)+' km';
        if (map) {
          if (markers[mapId][id]) { markers[mapId][id].setLatLng([d.lat,d.lng]); markers[mapId][id].setPopupContent(popup); }
          else markers[mapId][id] = L.marker([d.lat,d.lng], {icon:truckIcon()}).addTo(map).bindPopup(popup);
          if (d.path && d.path.length > 1) {
            if (polylines[mapId][id]) polylines[mapId][id].setLatLngs(d.path);
            else polylines[mapId][id] = L.polyline(d.path, {color:'#2e7d32', weight:4, opacity:.85}).addTo(map);
          }
        }
        rows += '<tr><td style="font-weight:bold">'+d.vehicleName+'</td><td>'+d.driverName+'</td><td style="color:var(--gray)">'+(d.localTime||'Baru saja')+'</td><td><span class="status-badge status-diolah">🟢 Aktif</span></td></tr>';
      });
      if (tbody) tbody.innerHTML = rows;
    }
    if (map) {
      Object.keys(markers[mapId]).forEach(id => { if (!seen.includes(id)) { map.removeLayer(markers[mapId][id]); delete markers[mapId][id]; } });
      Object.keys(polylines[mapId]).forEach(id => { if (!seen.includes(id)) { map.removeLayer(polylines[mapId][id]); delete polylines[mapId][id]; } });
    }
  }, err => { toast('❌ Live tracking: '+err.message, 'error'); });
}

// ============ PUBLIC SHARE (tanpa login) ============
function startPublicSharing(e) {
  e.preventDefault();
  const driverName = document.getElementById('driverName').value.trim();
  const vehicleName = document.getElementById('vehicleName').value.trim();
  const st = document.getElementById('driverStatus');
  if (!driverName || !vehicleName) { st.innerHTML = '❌ Isi nama driver & armada'; return; }
  if (!window.isSecureContext) { st.innerHTML = '❌ GPS wajib HTTPS'; return; }
  if (!navigator.geolocation) { st.innerHTML = '❌ Browser tidak support GPS'; return; }
  routePath = []; routeDistance = 0; routeStartTime = new Date();
  savedRouteId = null; lastRecordTime = 0; lastSaveTime = 0;
  routeDocId = vehicleName.replace(/[\/\#\[\]]/g,'-').replace(/\s+/g,'_');
  if (shareMarker && maps['mapShare']) { maps['mapShare'].removeLayer(shareMarker); shareMarker = null; }
  if (sharePolyline && maps['mapShare']) { maps['mapShare'].removeLayer(sharePolyline); sharePolyline = null; }
  document.getElementById('btnStartTrack').style.display = 'none';
  document.getElementById('btnStopTrack').style.display = 'block';
  st.innerHTML = '📡 Mencari GPS... <small>(izinkan akses lokasi)</small>';
  watchId = navigator.geolocation.watchPosition(pos => {
    const {latitude, longitude, accuracy} = pos.coords;
    const pt = [Number(latitude.toFixed(6)), Number(longitude.toFixed(6))];
    const nowMs = Date.now();
    const last = routePath[routePath.length-1];
    const moved = !last || haversineM(last, pt) >= 8;
    const timeDue = (nowMs - lastRecordTime) > 20000;
    if (moved || timeDue) {
      if (last) routeDistance += haversineM(last, pt);
      routePath.push(pt); lastRecordTime = nowMs;
      if (routePath.length > 5000) routePath.shift();
    }
    updateShareMapPublic(pt);
    if (routePath.length >= 2) {
      if (!savedRouteId) {
        db.collection('routes').add(routeBaseDoc(driverName, vehicleName, routePath, routeDistance, routeStartTime)).then(ref => { savedRouteId = ref.id; lastSaveTime = Date.now(); }).catch(err => console.error('autosave add:', err));
      } else if (nowMs - lastSaveTime > 30000) {
        lastSaveTime = nowMs;
        db.collection('routes').doc(savedRouteId).update({path:routePath, distanceM:Math.round(routeDistance), pointCount:routePath.length}).catch(err => console.error('autosave update:', err));
      }
    }
    db.collection('live_tracking').doc(routeDocId).set({
      driverName, vehicleName, lat:latitude, lng:longitude, accuracy,
      path:routePath, distanceM:Math.round(routeDistance),
      startTime:routeStartTime.toLocaleString('id-ID'),
      timestamp:firebase.firestore.FieldValue.serverTimestamp(),
      localTime:new Date().toLocaleString('id-ID'), isActive:true
    }, {merge:true}).then(() => {
      st.innerHTML = '✅ TERKIRIM!<br>Lat: '+latitude.toFixed(5)+', Lng: '+longitude.toFixed(5)+'<br>Akurasi: ±'+Math.round(accuracy)+'m<br>🛣️ Titik: '+routePath.length+' | ±'+(routeDistance/1000).toFixed(2)+' km'+(savedRouteId?'<br>💾 Autosave: AKTIF':'<br>💾 Menyimpan...')+'<br><small>Biarkan halaman terbuka</small>';
    }).catch(err => { st.innerHTML = '❌ Gagal: '+err.message+'<br><small>Cek Firestore Rules!</small>'; });
  }, err => {
    let m = '';
    if (err.code === 1) m = 'Izin lokasi DITOLAK. Ketuk 🔒 → Site settings → Location → Allow';
    else if (err.code === 2) m = 'Lokasi tidak tersedia. Nyalakan GPS HP';
    else if (err.code === 3) m = 'Timeout GPS';
    else m = err.message;
    st.innerHTML = '❌ Error: '+m;
    document.getElementById('btnStartTrack').style.display = 'block';
    document.getElementById('btnStopTrack').style.display = 'none';
  }, {enableHighAccuracy:true, timeout:15000, maximumAge:0});
}

function updateShareMapPublic(pt) {
  if (!maps['mapShare']) {
    maps['mapShare'] = L.map('mapShare').setView(pt, 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution:'© OSM'}).addTo(maps['mapShare']);
    shareMarker = L.marker(pt, {icon:truckIcon()}).addTo(maps['mapShare']);
    sharePolyline = L.polyline([pt], {color:'#2e7d32', weight:4, opacity:.9}).addTo(maps['mapShare']);
  } else {
    if (shareMarker) shareMarker.setLatLng(pt);
    if (sharePolyline) sharePolyline.setLatLngs(routePath.length ? routePath : [pt]);
    maps['mapShare'].panTo(pt);
  }
}

function routeBaseDoc(driverName, vehicleName, path, distance, startTime) {
  return {
    driverName, vehicleName,
    startTime: startTime ? startTime.toLocaleString('id-ID') : '-',
    endTime: null, path: path, distanceM: Math.round(distance),
    pointCount: path.length, isActiveRoute: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
}

// ============ STOP (PUBLIC & DASHBOARD) ============
function stopSharing() {
  const isDashboard = dsWatchId !== null;
  if (isDashboard) stopDashSharing();
  else stopPublicSharing();
}

function stopPublicSharing() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId); watchId = null;
  const st = document.getElementById('driverStatus');
  const driverName = document.getElementById('driverName').value.trim();
  const vehicleName = document.getElementById('vehicleName').value.trim();
  finalizeRoute('routes', savedRouteId, routePath, routeDistance, routeStartTime, driverName, vehicleName, st, 'driverStatus', 'btnStartTrack', 'btnStopTrack');
  if (routeDocId) db.collection('live_tracking').doc(routeDocId).update({isActive:false, timestamp:firebase.firestore.FieldValue.serverTimestamp()}).catch(()=>{});
  if (maps['mapShare'] && sharePolyline && routePath.length > 1) maps['mapShare'].fitBounds(sharePolyline.getBounds(), {padding:[30,30]});
  routePath = []; routeDistance = 0; routeStartTime = null; savedRouteId = null;
  document.getElementById('btnStartTrack').style.display = 'block';
  document.getElementById('btnStopTrack').style.display = 'none';
}

function finalizeRoute(collectionName, routeId, path, distance, startTime, driverName, vehicleName, statusEl, statusId, btnStartId, btnStopId) {
  if (path.length >= 2) {
    const finalData = {path, distanceM:Math.round(distance), pointCount:path.length, endTime:new Date().toLocaleString('id-ID'), isActiveRoute:false};
    const p = routeId ? db.collection(collectionName).doc(routeId).update(finalData) : db.collection(collectionName).add(Object.assign(routeBaseDoc(driverName, vehicleName, path, distance, startTime), finalData));
    p.then(() => {
      statusEl.innerHTML = '⏹️ Berhenti. 🛣️ Rute TERSIMPAN: '+path.length+' titik, ±'+(distance/1000).toFixed(2)+' km';
      loadRouteHistory();
    }).catch(err => { statusEl.innerHTML = '⏹️ Berhenti, rute GAGAL: '+err.message; });
  } else {
    statusEl.innerHTML = '⏹️ Berhenti. (titik < 2, tidak tersimpan)';
  }
}

// ============ DASHBOARD SHARE (role driver) ============
function startDashSharing() {
  const driverName = document.getElementById('dsDriverName').value.trim();
  const vehicleName = document.getElementById('dsVehicleName').value.trim();
  const st = document.getElementById('dsStatus');
  if (!driverName || !vehicleName) { st.innerHTML = '❌ Isi nama driver & armada'; return; }
  if (!window.isSecureContext) { st.innerHTML = '❌ Wajib HTTPS'; return; }
  if (!navigator.geolocation) { st.innerHTML = '❌ Browser tidak support GPS'; return; }
  dsRoutePath = []; dsRouteDistance = 0; dsRouteStartTime = new Date();
  dsSavedRouteId = null; dsLastRecordTime = 0; dsLastSaveTime = 0;
  dsRouteDocId = vehicleName.replace(/[\/\#\[\]]/g,'-').replace(/\s+/g,'_');
  if (dsShareMarker && maps['mapDashShare']) { maps['mapDashShare'].removeLayer(dsShareMarker); dsShareMarker = null; }
  if (dsSharePolyline && maps['mapDashShare']) { maps['mapDashShare'].removeLayer(dsSharePolyline); dsSharePolyline = null; }
  document.getElementById('btnStartDs').style.display = 'none';
  document.getElementById('btnStopDs').style.display = 'block';
  st.innerHTML = '📡 Mencari GPS... <small>(izinkan akses lokasi)</small>';
  setTimeout(() => { if (maps['mapDashShare']) maps['mapDashShare'].invalidateSize(); }, 300);
  dsWatchId = navigator.geolocation.watchPosition(pos => {
    const {latitude, longitude, accuracy} = pos.coords;
    const pt = [Number(latitude.toFixed(6)), Number(longitude.toFixed(6))];
    const nowMs = Date.now();
    const last = dsRoutePath[dsRoutePath.length-1];
    const moved = !last || haversineM(last, pt) >= 8;
    const timeDue = (nowMs - dsLastRecordTime) > 20000;
    if (moved || timeDue) {
      if (last) dsRouteDistance += haversineM(last, pt);
      dsRoutePath.push(pt); dsLastRecordTime = nowMs;
      if (dsRoutePath.length > 5000) dsRoutePath.shift();
    }
    updateDashShareMap(pt);
    if (dsRoutePath.length >= 2) {
      if (!dsSavedRouteId) {
        db.collection('routes').add(routeBaseDoc(driverName, vehicleName, dsRoutePath, dsRouteDistance, dsRouteStartTime)).then(ref => { dsSavedRouteId = ref.id; dsLastSaveTime = Date.now(); }).catch(err => console.error('autosave add:', err));
      } else if (nowMs - dsLastSaveTime > 30000) {
        dsLastSaveTime = nowMs;
        db.collection('routes').doc(dsSavedRouteId).update({path:dsRoutePath, distanceM:Math.round(dsRouteDistance), pointCount:dsRoutePath.length}).catch(err => console.error('autosave update:', err));
      }
    }
    db.collection('live_tracking').doc(dsRouteDocId).set({
      driverName, vehicleName, lat:latitude, lng:longitude, accuracy,
      path:dsRoutePath, distanceM:Math.round(dsRouteDistance),
      startTime:dsRouteStartTime.toLocaleString('id-ID'),
      timestamp:firebase.firestore.FieldValue.serverTimestamp(),
      localTime:new Date().toLocaleString('id-ID'), isActive:true
    }, {merge:true}).then(() => {
      st.innerHTML = '✅ TERKIRIM!<br>Lat: '+latitude.toFixed(5)+', Lng: '+longitude.toFixed(5)+'<br>🛣️ Titik: '+dsRoutePath.length+' | ±'+(dsRouteDistance/1000).toFixed(2)+' km'+(dsSavedRouteId?'<br>💾 Autosave: AKTIF':'<br>💾 Menyimpan...')+'<br><small>Biarkan halaman terbuka</small>';
    }).catch(err => { st.innerHTML = '❌ Gagal: '+err.message+'<br><small>Cek Firestore Rules!</small>'; });
  }, err => {
    let m = '';
    if (err.code === 1) m = 'Izin lokasi DITOLAK. Ketuk 🔒 → Site settings → Location → Allow';
    else if (err.code === 2) m = 'Lokasi tidak tersedia. Nyalakan GPS HP';
    else if (err.code === 3) m = 'Timeout GPS';
    else m = err.message;
    st.innerHTML = '❌ Error: '+m;
    document.getElementById('btnStartDs').style.display = 'block';
    document.getElementById('btnStopDs').style.display = 'none';
  }, {enableHighAccuracy:true, timeout:15000, maximumAge:0});
}

function updateDashShareMap(pt) {
  if (!maps['mapDashShare']) {
    maps['mapDashShare'] = L.map('mapDashShare').setView(pt, 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution:'© OSM'}).addTo(maps['mapDashShare']);
    dsShareMarker = L.marker(pt, {icon:truckIcon()}).addTo(maps['mapDashShare']);
    dsSharePolyline = L.polyline([pt], {color:'#2e7d32', weight:4, opacity:.9}).addTo(maps['mapDashShare']);
  } else {
    if (dsShareMarker) dsShareMarker.setLatLng(pt);
    if (dsSharePolyline) dsSharePolyline.setLatLngs(dsRoutePath.length ? dsRoutePath : [pt]);
    maps['mapDashShare'].panTo(pt);
  }
}

function stopDashSharing() {
  if (dsWatchId !== null) navigator.geolocation.clearWatch(dsWatchId); dsWatchId = null;
  const st = document.getElementById('dsStatus');
  const driverName = document.getElementById('dsDriverName').value.trim();
  const vehicleName = document.getElementById('dsVehicleName').value.trim();
  finalizeRoute('routes', dsSavedRouteId, dsRoutePath, dsRouteDistance, dsRouteStartTime, driverName, vehicleName, st, 'dsStatus', 'btnStartDs', 'btnStopDs');
  if (dsRouteDocId) db.collection('live_tracking').doc(dsRouteDocId).update({isActive:false, timestamp:firebase.firestore.FieldValue.serverTimestamp()}).catch(()=>{});
  if (maps['mapDashShare'] && dsSharePolyline && dsRoutePath.length > 1) maps['mapDashShare'].fitBounds(dsSharePolyline.getBounds(), {padding:[30,30]});
  dsRoutePath = []; dsRouteDistance = 0; dsRouteStartTime = null; dsSavedRouteId = null;
  document.getElementById('btnStartDs').style.display = 'block';
  document.getElementById('btnStopDs').style.display = 'none';
}

// ============ RIWAYAT RUTE ============
function loadRouteHistory() {
  db.collection('routes').orderBy('createdAt','desc').limit(20).get().then(snap => {
    const rows = []; snap.forEach(d => rows.push(Object.assign({id:d.id}, d.data())));
    window.__savedRoutes = rows;
    const tb = document.getElementById('routeTableDash'); if (!tb) return;
    tb.innerHTML = rows.map(r =>
      '<tr><td>'+(r.startTime||'-')+'</td><td>'+(r.endTime?'✅ '+r.endTime:'🔴 Live')+'</td><td><b>'+(r.vehicleName||'-')+'</b></td><td>'+(r.driverName||'-')+'</td><td>'+((r.distanceM||0)/1000).toFixed(2)+' km</td><td>'+(r.pointCount||(r.path?r.path.length:0))+'</td><td><button class="btn btn-small" onclick="viewSavedRoute(\''+r.id+'\')">🗺️ Lihat</button></td></tr>'
    ).join('') || '<tr><td colspan="7" style="text-align:center;padding:15px;color:var(--gray)">Belum ada rute tersimpan</td></tr>';
  }).catch(err => console.error('loadRouteHistory:', err));
}

function viewSavedRoute(routeId) {
  const map = maps['mapDash'];
  const r = (window.__savedRoutes || []).find(x => x.id === routeId);
  if (!map) { alert('Peta belum siap, scroll ke Live Tracking sebentar'); return; }
  if (!r || !r.path || r.path.length < 2) { alert('Rute tidak valid'); return; }
  if (savedRouteLayer.length) savedRouteLayer.forEach(l => map.removeLayer(l));
  const line = L.polyline(r.path, {color:'#ff9800', weight:5, opacity:.9}).addTo(map);
  const s = L.marker(r.path[0], {icon:flagIcon('🟢')}).addTo(map).bindPopup('<b>START</b><br>'+(r.startTime||''));
  const f = L.marker(r.path[r.path.length-1], {icon:flagIcon('🏁')}).addTo(map).bindPopup('<b>FINISH</b><br>'+(r.endTime||''));
  savedRouteLayer = [line, s, f];
  map.fitBounds(line.getBounds(), {padding:[40,40]});
  toast('🗺️ Rute '+(r.vehicleName||'')+' ditampilkan');
}

// ============ UI ============
function showLoading(t='Memuat...') { document.getElementById('loadingText').textContent = t; document.getElementById('loadingOverlay').classList.remove('hidden'); }
function hideLoading() { document.getElementById('loadingOverlay').classList.add('hidden'); }
function toast(m, t='success') { const d = document.createElement('div'); d.className = 'toast '+(t==='error'?'error':''); d.textContent = m; document.body.appendChild(d); setTimeout(()=>d.remove(), 3500); }