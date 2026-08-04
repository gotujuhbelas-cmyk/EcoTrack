// ============================================================
// ADDON v1 - EcoTRACK
// 1) Panel "Share Lokasi" untuk role DRIVER di dashboard
// 2) Notifikasi error live tracking (biar ketahuan kalau gagal)
// ============================================================

// ---- 1) Panel Share Lokasi di dashboard ----
(function injectSharePanel(){
  const track = document.getElementById('dashTracking');
  if (!track || document.getElementById('dashShare')) return;
  const sec = document.createElement('div');
  sec.id = 'dashShare';
  sec.className = 'section';
  sec.innerHTML =
    '<h2>📡 Share Lokasi Armada</h2>' +
    '<p style="color:var(--gray);margin-bottom:15px">Khusus driver: kirim posisi real-time & rekam rute otomatis.</p>' +
    '<div class="form-grid">' +
    '<div class="form-group"><label>Nama Driver</label><input type="text" id="dsDriverName"></div>' +
    '<div class="form-group"><label>Armada</label><input type="text" id="dsVehicleName" placeholder="Contoh: Truk B 1234 CD"></div>' +
    '</div>' +
    '<div class="btn-group"><button class="btn" id="btnGoShare">📡 Mulai Share Lokasi