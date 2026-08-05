// antimacet.js — bagian 1: state, inisialisasi, helper
// Dimuat SEBELUM amview.js karena mengekspos amP()

let amSession = null;          // { driverId, role, truckId, docId }
let amPath = [];               // [{lat, lng, t}] array titik
let amDist = 0;                // total jarak meter
let amTimer = null;            // setInterval lokasi
let amSaveTimer = null;        // setInterval save routes tiap 30s
let amIsActive = false;
let amLastPos = null;
let amStartTime = null;

// ========== amP() — dipakai oleh amview.js ==========
function amP() {
  return amSession ? {
    active: amIsActive,
    path: amPath,
    distance: amDist,
    driverId: amSession.driverId,
    truckId: amSession.truckId || null
  } : null;
}

// ========== helper: encode path ke string ==========
function encodePath(arr) {
  return arr.map(p => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join(";");
}
function decodePath(str) {
  if (!str) return [];
  return str.split(";").map(s => {
    const [lat, lng] = s.split(",").map(Number);
    return { lat, lng, t: Date.now() };
  });
}

// ========== helper: cari tombol sharing di DOM ==========
function getShareBtn() {
  return document.querySelector("[data-am-btn]") ||
         document.getElementById("btnStartSharing") ||
         document.querySelector(".btn-share-location");
}

function updateBtnUI(label, cls) {
  const btn = getShareBtn();
  if (!btn) return;
  btn.innerHTML = label;
  btn.className = btn.className.replace(/btn-(success|warning|danger|primary)/g, "");
  btn.classList.add(cls || "btn-warning");
}

// ========== inisialisasi saat halaman dimuat ==========
function amInit() {
  const saved = localStorage.getItem("am_session");
  if (!saved) return;

  try {
    amSession = JSON.parse(saved);
  } catch (e) {
    localStorage.removeItem("am_session");
    return;
  }

  // Cek apakah trip masih aktif di Firestore
  if (!db) return console.warn("[antimacet] db belum siap");
  db.collection("live_tracking").doc(amSession.docId || amSession.driverId)
    .get()
    .then(doc => {
      if (doc.exists && doc.data().isActive === true) {
        // Restore path & distance dari dokumen lama
        const data = doc.data();
        amPath = decodePath(data.path || "");
        amDist = data.totalDistance || 0;
        amStartTime = data.startTime || Date.now();
        amIsActive = true;
        amLastPos = amPath.length ? amPath[amPath.length - 1] : null;

        updateBtnUI("🔄 Lanjutkan Berbagi Lokasi", "btn-success");
        toast("Sesi ditemukan. Tekan tombol untuk melanjutkan tracking.", "info");
        loadRouteHistory && loadRouteHistory();
      } else {
        // Trip sudah berakhir, bersihkan
        localStorage.removeItem("am_session");
        amSession = null;
      }
    })
    .catch(err => {
      console.warn("[antimacet] gagal cek sesi:", err);
    });
}

// Jalankan inisialisasi saat DOM ready
document.addEventListener("DOMContentLoaded", amInit);
// antimacet.js — bagian 2: startPublicSharing, startDashSharing, stopSharing

function startPublicSharing(e) {
  if (e) e.preventDefault && e.preventDefault();
  _startSharing("public");
}

function startDashSharing() {
  _startSharing("dash");
}

function _startSharing(role) {
  if (!navigator.geolocation) {
    toast("Geolocation tidak didukung browser ini.", "error");
    return;
  }

  // Kalau ada sesi aktif yang belum di-restore, lanjutkan
  if (amSession && amIsActive) {
    _beginWatch();
    updateBtnUI("⏹ Hentikan Berbagi Lokasi", "btn-danger");
    toast("Tracking dilanjutkan!", "success");
    return;
  }

  // Buat sesi baru
  const driverId = (window.currentUser && window.currentUser.uid) ||
                   ("drv_" + Date.now());
  const truckId = (window.currentTruck && window.currentTruck.id) || null;
  const docId = driverId;

  amSession = { driverId, role, truckId, docId };
  amPath = [];
  amDist = 0;
  amStartTime = Date.now();
  amIsActive = true;
  amLastPos = null;

  localStorage.setItem("am_session", JSON.stringify(amSession));
  updateBtnUI("⏹ Hentikan Berbagi Lokasi", "btn-danger");
  toast("Berbagi lokasi dimulai!", "success");

  // Tulis data awal ke Firestore
  db.collection("live_tracking").doc(docId).set({
    driverId,
    truckId,
    role,
    isActive: true,
    startTime: amStartTime,
    path: "",
    totalDistance: 0,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true })
  .then(() => _beginWatch())
  .catch(err => {
    toast("Gagal memulai tracking: " + err.message, "error");
  });
}

function _beginWatch() {
  if (amTimer) clearInterval(amTimer);
  if (amSaveTimer) clearInterval(amSaveTimer);

  // Kirim lokasi tiap 5 detik
  amTimer = setInterval(_sendLocation, 5000);

  // Autosave ke collection routes tiap 30 detik
  amSaveTimer = setInterval(_saveToRoutes, 30000);

  // Kirim lokasi pertama segera
  _sendLocation();
}

function _sendLocation() {
  if (!amIsActive) return;

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const point = { lat, lng, t: Date.now() };

      // Hitung jarak dari titik terakhir
      if (amLastPos && typeof haversineM === "function") {
        amDist += haversineM(amLastPos.lat, amLastPos.lng, lat, lng);
      }

      amPath.push(point);
      amLastPos = point;

      // Update live_tracking dengan merge
      db.collection("live_tracking").doc(amSession.docId).set({
        lastLat: lat,
        lastLng: lng,
        path: encodePath(amPath),
        totalDistance: Math.round(amDist),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true })
      .catch(err => console.warn("[antimacet] kirim lokasi gagal:", err));
    },
    err => console.warn("[antimacet] geolocation error:", err.message),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function _saveToRoutes() {
  if (!amIsActive || !amSession || amPath.length < 2) return;

  const routeDoc = {
    driverId: amSession.driverId,
    truckId: amSession.truckId,
    startTime: amStartTime,
    path: encodePath(amPath),
    totalDistance: Math.round(amDist),
    pointCount: amPath.length,
    isActive: true,
    savedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection("routes").doc(amSession.docId).set(routeDoc, { merge: true })
    .catch(err => console.warn("[antimacet] autosave routes gagal:", err));
}

// ========== stopSharing ==========
function stopSharing() {
  amIsActive = false;

  if (amTimer) { clearInterval(amTimer); amTimer = null; }
  if (amSaveTimer) { clearInterval(amSaveTimer); amSaveTimer = null; }

  // Finalisasi: update live_tracking → isActive false
  if (amSession && db) {
    const docId = amSession.docId;

    db.collection("live_tracking").doc(docId).set({
      isActive: false,
      path: encodePath(amPath),
      totalDistance: Math.round(amDist),
      endTime: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Finalisasi juga ke collection routes
    db.collection("routes").doc(docId).set({
      driverId: amSession.driverId,
      truckId: amSession.truckId,
      startTime: amStartTime,
      endTime: firebase.firestore.FieldValue.serverTimestamp(),
      path: encodePath(amPath),
      totalDistance: Math.round(amDist),
      pointCount: amPath.length,
      isActive: false,
      savedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  // Bersihkan state
  localStorage.removeItem("am_session");
  amSession = null;
  amPath = [];
  amDist = 0;
  amLastPos = null;

  updateBtnUI("📍 Mulai Berbagi Lokasi", "btn-primary");
  toast("Berbagi lokasi dihentikan.", "info");

  // Refresh riwayat rute jika tersedia
  loadRouteHistory && loadRouteHistory();
}

// ========== expose ke global ==========
window.amP = amP;
window.startPublicSharing = startPublicSharing;
window.startDashSharing = startDashSharing;
window.stopSharing = stopSharing;
