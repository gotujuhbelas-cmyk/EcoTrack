// ══════════════════════════════════════════════════════════════
// addon.js — EcoTRACK v2: Export Laporan + Surat Jalan
// Nomor SJ: SJ/001/VIII/RAJ | kop.png & stempel.png opsional
console.log("%cADDON v2 — surat jalan format RAJ aktif", "color:#6a1b9a;font-weight:bold");
// ══════════════════════════════════════════════════════════════

(function() {

  const BASE_URL = "https://hood.rezekiamanahjaya.com";

  // ─── Helper: download CSV (kompatibel Excel) ───
  function downloadCSV(filename, rows) {
    const esc = v => {
      v = (v === null || v === undefined) ? "" : String(v);
      if (/[",\n;]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    };
    const csv = "\uFEFF" + rows.map(r => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ─── Helper: bulan Romawi ───
  function romanMonth(tanggal) {
    const romans = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
    let m = new Date().getMonth();
    if (tanggal) {
      const mm = parseInt(String(tanggal).split("-")[1], 10);
      if (mm >= 1 && mm <= 12) m = mm - 1;
    }
    return romans[m];
  }

  // ─── Helper: nomor urut SJ per bulan (SJ/001/VIII/RAJ) ───
  async function nextSJNumber(tanggal) {
    const ym = (tanggal || new Date().toISOString().slice(0, 10)).slice(0, 7);
    const start = ym + "-01";
    const end = ym + "-31";
    let count = 0;
    try {
      const snap = await db.collection("sampah")
        .where("tanggal", ">=", start)
        .where("tanggal", "<=", end)
        .get();
      count = snap.size;
    } catch (e) { count = 0; }
    const seq = String(count + 1).padStart(3, "0");
    return "SJ/" + seq + "/" + romanMonth(tanggal) + "/RAJ";
  }

  // ─── Helper: kerangka dokumen cetak (kop + stempel opsional) ───
  function printShell(docTitle, bodyHtml) {
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + docTitle + '</title>' +
    '<style>' +
    'body{font-family:Arial,sans-serif;color:#111;padding:30px;font-size:14px}' +
    '.kop-img{width:100%;margin-bottom:12px}' +
    '.head{display:flex;gap:15px;align-items:center;border-bottom:3px solid #2e7d32;padding-bottom:12px;margin-bottom:18px}' +
    '.head img{width:60px;height:60px;object-fit:cover}' +
    '.head h1{margin:0;font-size:18px;color:#1b5e20}' +
    '.head p{margin:2px 0 0;font-size:12px;color:#555}' +
    'h2{font-size:16px;text-decoration:underline;margin:0 0 14px;text-align:center}' +
    'table{border-collapse:collapse;width:100%}' +
    'table.doc td{padding:5px 8px;vertical-align:top}' +
    'table.grid th,table.grid td{border:1px solid #333;padding:6px 8px;font-size:12px;text-align:left}' +
    'table.grid th{background:#e8f5e9}' +
    '.sign{display:flex;justify-content:space-between;margin-top:40px}' +
    '.sign>div{width:40%;text-align:center;position:relative}' +
    '.sign .space{height:80px}' +
    '.sign .stempel{position:absolute;left:50%;top:20px;transform:translateX(-50%);height:80px;opacity:.9}' +
    '.no-print{margin-top:25px}' +
    'button{padding:8px 18px;background:#2e7d32;color:#fff;border:0;border-radius:6px;cursor:pointer}' +
    '@media print{.no-print{display:none}}' +
    '</style></head><body>' +
    '<img class="kop-img" src="' + BASE_URL + '/kop.png" onerror="this.style.display=\'none\'">' +
    '<div class="head" id="headText">' +
      '<img src="' + BASE_URL + '/logo.png" onerror="this.style.display=\'none\'">' +
      '<div><h1>CV REZEKI AMANAH JAYA GROUP</h1>' +
      '<p>Supplier &amp; Waste Solution Partner — The Hood, Summarecon Serpong</p></div>' +
    '</div>' +
    '<h2>' + docTitle + '</h2>' +
    bodyHtml +
    '<div class="no-print"><button onclick="window.print()">🖨️ Cetak</button></div>' +
    '<scr' + 'ipt>document.addEventListener("DOMContentLoaded",function(){' +
    'var k=new Image();k.onerror=function(){var h=document.getElementById("headText");if(h)h.style.display="flex";};' +
    'k.onload=function(){var h=document.getElementById("headText");if(h)h.style.display="none";};' +
    'k.src="' + BASE_URL + '/kop.png";});</scr' + 'ipt>' +
    '</body></html>';
  }

  // ═══ 1) EXPORT CSV ═══
  window.exportReportCSV = function() {
    const tbody = document.getElementById("reportTableBody");
    if (!tbody || !tbody.rows.length) {
      if (typeof toast === "function") toast("Generate laporan dulu.", "warning");
      return;
    }
    const rows = [["Tanggal", "Jenis", "Berat (kg)", "Diolah (kg)", "Residu (kg)", "Petugas"]];
    Array.from(tbody.rows).forEach(tr => {
      const c = tr.cells;
      if (c.length >= 6) {
        rows.push([c[0].innerText, c[1].innerText, c[2].innerText, c[3].innerText, c[4].innerText, c[5].innerText]);
      }
    });
    const period = document.getElementById("reportPeriod") ? document.getElementById("reportPeriod").value : "custom";
    downloadCSV("EcoTRACK-Laporan-" + period + "-" + new Date().toISOString().slice(0, 10) + ".csv", rows);
    if (typeof toast === "function") toast("📥 Laporan di-export! Buka file CSV di Excel.", "success");
  };

  // ═══ 2) CETAK LAPORAN ═══
  window.printReport = function() {
    const tbody = document.getElementById("reportTableBody");
    if (!tbody || !tbody.rows.length) {
      if (typeof toast === "function") toast("Generate laporan dulu.", "warning");
      return;
    }
    const g = id => { const el = document.getElementById(id); return el ? el.textContent : "0"; };

    let rowsHtml = "<tr><th>Tanggal</th><th>Jenis</th><th>Berat</th><th>Diolah</th><th>Residu</th><th>Petugas</th></tr>";
    Array.from(tbody.rows).forEach(tr => {
      const c = tr.cells;
      rowsHtml += "<tr><td>" + c[0].innerText + "</td><td>" + c[1].innerText + "</td><td>" + c[2].innerText +
        "</td><td>" + c[3].innerText + "</td><td>" + c[4].innerText + "</td><td>" + c[5].innerText + "</td></tr>";
    });

    const body =
      "<p>Periode: <b>" + (document.getElementById("reportPeriod") ? document.getElementById("reportPeriod").value : "-") +
      "</b> — dicetak " + new Date().toLocaleString("id-ID") + "</p>" +
      '<table class="grid">' + rowsHtml + "</table>" +
      "<p style=\"margin-top:14px\">Total Pengambilan: <b>" + g("rptTotalPickup") + "</b> &nbsp;|&nbsp; " +
      "Total Berat: <b>" + g("rptTotalWeight") + "</b> &nbsp;|&nbsp; " +
      "Diolah: <b>" + g("rptTotalProcessed") + "</b> &nbsp;|&nbsp; " +
      "Residu: <b>" + g("rptTotalResidue") + "</b></p>" +
      '<div class="sign"><div><p>Hormat kami,</p><div class="space"></div><p><b>( ........................ )</b><br>Pelapor</p></div>' +
      '<div><p>Mengetahui,</p><div class="space"><img class="stempel" src="' + BASE_URL + '/stempel.png" onerror="this.style.display=\'none\'"></div>' +
      '<p><b>( ........................ )</b><br>Manajer Operasional</p></div></div>';

    const w = window.open("", "_blank");
    w.document.write(printShell("Laporan Pengambilan & Pengolahan Sampah", body));
    w.document.close();
    w.focus();
  };

  // ═══ 3) SURAT JALAN — nomor SJ/001/VIII/RAJ ═══
  window.printSuratJalan = function(docId) {
    if (typeof db === "undefined") return;
    db.collection("sampah").doc(docId).get().then(doc => {
      if (!doc.exists) { if (typeof toast === "function") toast("Data tidak ditemukan.", "error"); return; }
      const d = doc.data();

      const doPrint = (nomor) => {
        const body =
          '<table class="doc">' +
          "<tr><td style=\"width:150px\">Nomor</td><td>: <b>" + nomor + "</b></td></tr>" +
          "<tr><td>Tanggal</td><td>: " + (d.tanggal || "-") + "</td></tr>" +
          "<tr><td>Jenis Sampah</td><td>: " + (d.jenis || "-") + "</td></tr>" +
          "<tr><td>Berat</td><td>: " + (d.berat || 0) + " kg</td></tr>" +
          "<tr><td>Diolah</td><td>: " + (d.diolah || 0) + " kg</td></tr>" +
          "<tr><td>Residu</td><td>: " + (d.residu || 0) + " kg</td></tr>" +
          "<tr><td>Petugas / Driver</td><td>: " + (d.petugas || "-") + "</td></tr>" +
          "<tr><td>Lokasi Asal</td><td>: The Hood, Summarecon Serpong</td></tr>" +
          "<tr><td>Tujuan</td><td>: Fasilitas Pengolahan CV Rezeki Amanah Jaya Group</td></tr>" +
          "<tr><td>Catatan</td><td>: " + (d.catatan || "-") + "</td></tr>" +
          "</table>" +
          "<p style=\"margin-top:14px\">Barang/sampah tersebut di atas telah diambil dan diangkut dengan sesungguhnya.</p>" +
          '<div class="sign"><div><p>Hormat kami,</p><div class="space"><img class="stempel" src="' + BASE_URL + '/stempel.png" onerror="this.style.display=\'none\'"></div>' +
          '<p><b>( ' + (d.petugas || "........................") + ' )</b><br>Pengirim</p></div>' +
          '<div><p>Diterima oleh,</p><div class="space"></div><p><b>( ........................ )</b><br>Penerima</p></div></div>';

        const w = window.open("", "_blank");
        w.document.write(printShell("SURAT JALAN", body));
        w.document.close();
        w.focus();
      };

      // Pakai nomor tersimpan kalau ada, biar cetak ulang nomornya sama
      if (d.noSurat) {
        doPrint(d.noSurat);
      } else {
        nextSJNumber(d.tanggal).then(nomor => {
          db.collection("sampah").doc(docId).update({ noSurat: nomor }).catch(() => {});
          doPrint(nomor);
        });
      }
    });
  };

  // ─── Tempel tombol Surat Jalan ke tabel Data ───
  function attachSuratJalanButtons() {
    const tbody = document.getElementById("dashDataTable");
    if (!tbody || !tbody.rows.length || typeof db === "undefined") return;
    db.collection("sampah").orderBy("createdAt", "desc").limit(50).get().then(snap => {
      const ids = [];
      snap.forEach(doc => ids.push(doc.id));
      Array.from(tbody.rows).forEach((tr, i) => {
        if (!ids[i]) return;
        const aksiCell = tr.cells[tr.cells.length - 1];
        if (!aksiCell || aksiCell.querySelector(".sj-btn")) return;
        const b = document.createElement("button");
        b.className = "btn btn-sm sj-btn";
        b.style.background = "#6a1b9a";
        b.style.marginLeft = "4px";
        b.textContent = "🖨️ Surat Jalan";
        b.onclick = () => printSuratJalan(ids[i]);
        aksiCell.appendChild(b);
      });
    });
  }

  if (typeof window.loadDashData === "function") {
    const orig = window.loadDashData;
    window.loadDashData = function() {
      orig.apply(this, arguments);
      setTimeout(attachSuratJalanButtons, 900);
    };
  }

  // ─── Suntik tombol Export/Cetak ke section Laporan ───
  function injectReportButtons() {
    if (document.getElementById("addonReportBtns")) return true;
    const host = document.querySelector("#dashReport .report-filter");
    if (!host) return false;
    const div = document.createElement("div");
    div.id = "addonReportBtns";
    div.className = "form-group";
    div.style.cssText = "display:flex;align-items:end;gap:8px";
    div.innerHTML =
      '<button class="btn" style="background:#00695c" onclick="exportReportCSV()">📥 Export CSV</button>' +
      '<button class="btn" style="background:#6a1b9a" onclick="printReport()">🖨️ Cetak</button>';
    host.appendChild(div);
    return true;
  }
  (function retry(n) {
    n = n || 0;
    if (!injectReportButtons() && n < 30) setTimeout(() => retry(n + 1), 1000);
  })();

})();
