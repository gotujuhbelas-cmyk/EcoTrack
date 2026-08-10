// ══════════════════════════════════════════════════════════════
// addon.js — EcoTRACK v10: signature pad + stempel natural
console.log("%cADDON v10 — signature pad & stempel natural", "color:#6a1b9a;font-weight:bold");
// ══════════════════════════════════════════════════════════════

(function() {

  const BASE_URL = "https://hood.rezekiamanahjaya.com";

  const ALAMAT_KOP = "Cluster Puri Flamingo FLA 06/19, Sukamantri, Pasar Kemis, Kab. Tangerang &mdash; HP. 081296580968";
  const KEPADA_HTML = "Kepada Yth.<br><b>Pengelola The Hood &mdash; Summarecon</b><br><b>BSD City</b><br>di<br><b>Tempat</b>";

  const SIGN = {
    ttdP: localStorage.getItem("raj_ttdP") || null,
    stP:  localStorage.getItem("raj_stP")  || null,
    ttdR: localStorage.getItem("raj_ttdR") || null,
    stR:  localStorage.getItem("raj_stR")  || null
  };
  let pendingDocId = null;
  const pads = {};

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

  function romanMonth(tanggal) {
    const romans = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
    let m = new Date().getMonth();
    if (tanggal) {
      const mm = parseInt(String(tanggal).split("-")[1], 10);
      if (mm >= 1 && mm <= 12) m = mm - 1;
    }
    return romans[m];
  }
  function longDate(tanggal) {
    const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    let d = new Date();
    if (tanggal) { const t = new Date(String(tanggal) + "T00:00:00"); if (!isNaN(t.getTime())) d = t; }
    return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
  }

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
    const year = ym.slice(0, 4);
    return seq + "/RAJ/" + romanMonth(tanggal) + "/" + year;
  }

  // ═══ KERANGKA CETAK v10: STEMPEL NATURAL ═══
  function printShell(docTitle, bodyHtml) {
    const printedBy = (typeof currentUser !== "undefined" && currentUser && currentUser.email) ? currentUser.email : "-";
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + docTitle + '</title>' +
    '<style>' +
    'body{font-family:Arial,sans-serif;color:#111;font-size:13px;max-width:210mm;margin:0 auto;padding:12mm 15mm;background:#fff}' +
    '.kop-img{width:100%;margin-bottom:12px}' +
    '.head{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;column-gap:14px;border-bottom:3px solid #444;padding-bottom:10px}' +
    '.head img{grid-column:1;justify-self:end;width:auto;height:95px;object-fit:contain}' +
    '.head-text{grid-column:2;text-align:center}' +
    '.head::after{content:"";grid-column:3}' +
    '.head h1{margin:0;font-size:19px;letter-spacing:1px;color:#333}' +
    '.head .sub{margin:3px 0;font-size:11.5px;color:#555;letter-spacing:2px}' +
    '.head .addr{margin:0;font-size:10px;color:#666}' +
    '.head-line{border-bottom:1px solid #444;margin-bottom:18px}' +
    'h2{font-size:14px;text-decoration:underline;margin:0 0 16px;text-align:center;letter-spacing:1px}' +
    'table{border-collapse:collapse;width:100%}' +
    'table.doc td{padding:3px 8px;vertical-align:top}' +
    'table.grid th,table.grid td{border:1px solid #333;padding:6px 8px;font-size:11.5px;text-align:left}' +
    'table.grid th{background:#e8f5e9}' +
    'p{margin:10px 0;line-height:1.55}' +
    '.foto-grid{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}' +
    '.foto-grid figure{margin:0;width:30%;text-align:center;page-break-inside:avoid}' +
    '.foto-grid img{width:100%;height:160px;object-fit:cover;border:1px solid #bbb;border-radius:6px}' +
    '.foto-grid figcaption{font-size:10.5px;color:#666;margin-top:4px}' +
    '.page-break{page-break-before:always}' +
    '.sign{display:flex;justify-content:space-between;margin-top:36px}' +
    '.sign>div{width:40%;text-align:center;position:relative}' +
    '.sign .space{height:115px;position:relative}' +
    '.sign .stempel{position:absolute;left:50%;top:2px;transform:translateX(-50%) rotate(-6deg);height:110px;opacity:.9;mix-blend-mode:multiply}' +
    '.sign .ttd{position:relative;height:60px;margin:0 auto;top:22px}' +
    '.foot{margin-top:28px;padding-top:8px;border-top:1px solid #ccc;font-size:10px;color:#777;text-align:center}' +
    '.no-print{margin-top:22px;text-align:center}' +
    'button{padding:8px 18px;background:#2e7d32;color:#fff;border:0;border-radius:6px;cursor:pointer}' +
    '@media print{.no-print{display:none}body{padding:0;max-width:none}}' +
    '</style></head><body>' +
    '<img class="kop-img" src="' + BASE_URL + '/kop.png" onerror="this.style.display=\'none\'">' +
    '<div class="head" id="headText">' +
      '<img src="' + BASE_URL + '/logo.png" onerror="this.style.display=\'none\'">' +
      '<div class="head-text">' +
        '<h1>CV REZEKI AMANAH JAYA GROUP</h1>' +
        '<p class="sub" style="margin:3px 0">SUPPLIER &amp; WASTE SOLUTION PARTNER</p>' +
        '<p class="addr" style="margin:0">' + ALAMAT_KOP + '</p>' +
      '</div>' +
    '</div>' +
    '<div class="head-line"></div>' +
    '<h2>' + docTitle + '</h2>' +
    bodyHtml +
    '<div class="foot">Dokumen dibuat otomatis oleh EcoTRACK &bull; Dicetak: ' + new Date().toLocaleString("id-ID") + ' &bull; Oleh: ' + printedBy + '</div>' +
    '<div class="no-print"><button onclick="window.print()">🖨️ Cetak / Simpan PDF</button></div>' +
    '<scr' + 'ipt>document.addEventListener("DOMContentLoaded",function(){' +
    'var k=new Image();k.onerror=function(){var h=document.getElementById("headText");if(h)h.style.display="grid";};' +
    'k.onload=function(){var h=document.getElementById("headText");if(h)h.style.display="none";};' +
    'k.src="' + BASE_URL + '/kop.png";});</scr' + 'ipt>' +
    '</body></html>';
  }

  // ═══ SIGNATURE PAD (papan coret ttd) ═══
  function initPad(side) {
    const c = pads[side].canvas;
    const ctx = c.getContext("2d");
    pads[side].ctx = ctx;
    ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#1a237e";
    let drawing = false;
    function pos(e) {
      const r = c.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return [(t.clientX - r.left) * (c.width / r.width), (t.clientY - r.top) * (c.height / r.height)];
    }
    function start(e) { e.preventDefault(); drawing = true; const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); pads[side].dirty = true; }
    function move(e) { if (!drawing) return; e.preventDefault(); const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); }
    function end() { drawing = false; }
    c.addEventListener("mousedown", start);
    c.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    c.addEventListener("touchstart", start, { passive: false });
    c.addEventListener("touchmove", move, { passive: false });
    c.addEventListener("touchend", end);
  }

  function loadPad(side) {
    const key = "ttd" + side;
    const p = pads[side];
    p.ctx.clearRect(0, 0, p.canvas.width, p.canvas.height);
    p.dirty = false;
    if (SIGN[key]) {
      const img = new Image();
      img.onload = () => { p.ctx.drawImage(img, 0, 0, p.canvas.width, p.canvas.height); };
      img.src = SIGN[key];
    }
  }

  function buildSignModal() {
    const m = document.createElement("div");
    m.id = "signModal";
    m.style.cssText = "display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;align-items:center;justify-content:center";
    m.innerHTML =
      '<div style="background:#fff;border-radius:12px;padding:20px;width:640px;max-width:94vw;max-height:90vh;overflow:auto;font-family:Arial,sans-serif">' +
      '<h3 style="margin:0 0 4px;color:#2e7d32">🖋️ Tanda Tangan & Stempel</h3>' +
      '<p style="font-size:12px;color:#666;margin:0 0 14px">Coret tanda tangan di kotak (mouse/jari). Opsional — kosong pun surat tetap tercetak. Tersimpan otomatis di browser ini.</p>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' +
        '<div style="border:1px solid #ddd;border-radius:10px;padding:12px">' +
          '<h4 style="margin:0 0 8px">Pengirim (RAJ)</h4>' +
          '<p style="font-size:12px;margin:0 0 4px">Tanda tangan:</p>' +
          '<canvas id="padP" width="260" height="90" style="width:100%;border:1px solid #bbb;border-radius:8px;background:#fff;touch-action:none"></canvas>' +
          '<button id="clrP" style="background:#888;padding:4px 10px;font-size:11px;margin-top:6px">🧹 Hapus ttd</button>' +
          '<p style="font-size:12px;margin:10px 0 4px">Stempel (upload):</p>' +
          '<input type="file" accept="image/*" id="upStP" style="font-size:11px"><br>' +
          '<img id="pvStP" style="height:60px;display:none;border:1px dashed #bbb;border-radius:6px;padding:2px;margin-top:4px">' +
        '</div>' +
        '<div style="border:1px solid #ddd;border-radius:10px;padding:12px">' +
          '<h4 style="margin:0 0 8px">Penerima</h4>' +
          '<p style="font-size:12px;margin:0 0 4px">Tanda tangan:</p>' +
          '<canvas id="padR" width="260" height="90" style="width:100%;border:1px solid #bbb;border-radius:8px;background:#fff;touch-action:none"></canvas>' +
          '<button id="clrR" style="background:#888;padding:4px 10px;font-size:11px;margin-top:6px">🧹 Hapus ttd</button>' +
          '<p style="font-size:12px;margin:10px 0 4px">Stempel (upload):</p>' +
          '<input type="file" accept="image/*" id="upStR" style="font-size:11px"><br>' +
          '<img id="pvStR" style="height:60px;display:none;border:1px dashed #bbb;border-radius:6px;padding:2px;margin-top:4px">' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end">' +
        '<button id="btnSignCancel" style="background:#888">✖ Batal</button>' +
        '<button id="btnSignPrint">🖨️ Cetak Surat Jalan</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(m);

    ["P", "R"].forEach(side => {
      pads[side] = { canvas: document.getElementById("pad" + side), dirty: false };
      initPad(side);
      document.getElementById("clr" + side).onclick = () => {
        const key = "ttd" + side;
        pads[side].ctx.clearRect(0, 0, pads[side].canvas.width, pads[side].canvas.height);
        pads[side].dirty = false;
        SIGN[key] = null;
        try { localStorage.removeItem("raj_" + key); } catch (e) {}
      };
    });

    const wireSt = (inputId, key, pvId) => {
      document.getElementById(inputId).addEventListener("change", e => {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          SIGN[key] = r.result;
          try { localStorage.setItem("raj_" + key, r.result); } catch (err) { console.warn("stempel terlalu besar utk disimpan:", err); }
          const pv = document.getElementById(pvId);
          pv.src = r.result; pv.style.display = "inline-block";
        };
        r.readAsDataURL(f);
      });
    };
    wireSt("upStP", "stP", "pvStP");
    wireSt("upStR", "stR", "pvStR");

    document.getElementById("btnSignCancel").onclick = () => { m.style.display = "none"; };
    document.getElementById("btnSignPrint").onclick = () => {
      ["P", "R"].forEach(side => {
        const key = "ttd" + side;
        if (pads[side].dirty) {
          const url = pads[side].canvas.toDataURL("image/png");
          SIGN[key] = url;
          try { localStorage.setItem("raj_" + key, url); } catch (e) {}
        }
      });
      m.style.display = "none";
      doPrintSurat(pendingDocId);
    };
  }

  function openSignModal() {
    if (!document.getElementById("signModal")) buildSignModal();
    ["P", "R"].forEach(side => loadPad(side));
    [["stP","pvStP"],["stR","pvStR"]].forEach(([k, id]) => {
      const pv = document.getElementById(id);
      if (SIGN[k]) { pv.src = SIGN[k]; pv.style.display = "inline-block"; }
    });
    document.getElementById("signModal").style.display = "flex";
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
      "<p style=\"text-align:right;margin:0 0 12px\">Tangerang, " + longDate() + "</p>" +
      '<table class="grid">' + rowsHtml + "</table>" +
      "<p style=\"margin-top:14px;text-align:center\">Total Pengambilan: <b>" + g("rptTotalPickup") + "</b> &nbsp;|&nbsp; " +
      "Total Berat: <b>" + g("rptTotalWeight") + "</b> &nbsp;|&nbsp; " +
      "Diolah: <b>" + g("rptTotalProcessed") + "</b> &nbsp;|&nbsp; " +
      "Residu: <b>" + g("rptTotalResidue") + "</b></p>" +
      '<div class="sign"><div><p>Hormat kami,</p><div class="space">' + (SIGN.stP ? '<img class="stempel" src="' + SIGN.stP + '">' : '<img class="stempel" src="' + BASE_URL + '/stempel.png" onerror="this.style.display=\'none\'">') + (SIGN.ttdP ? '<img class="ttd" src="' + SIGN.ttdP + '">' : '') + '</div><p><b>( ........................ )</b><br>Pelapor</p></div>' +
      '<div><p>Mengetahui,</p><div class="space">' + (SIGN.stR ? '<img class="stempel" src="' + SIGN.stR + '">' : '') + (SIGN.ttdR ? '<img class="ttd" src="' + SIGN.ttdR + '">' : '') + '</div><p><b>( ........................ )</b><br>Manajer Operasional</p></div></div>';

    const w = window.open("", "_blank");
    w.document.write(printShell("LAPORAN PENGAMBILAN & PENGOLAHAN SAMPAH", body));
    w.document.close();
    w.focus();
  };

  // ═══ 3) SURAT JALAN v10 ═══
  window.printSuratJalan = function(docId) {
    pendingDocId = docId;
    openSignModal();
  };

  function doPrintSurat(docId) {
    if (typeof db === "undefined") return;
    db.collection("sampah").doc(docId).get().then(doc => {
      if (!doc.exists) { if (typeof toast === "function") toast("Data tidak ditemukan.", "error"); return; }
      const d = doc.data();

      const doPrint = (nomor) => {
        const fotos = d.fotos || d.foto || [];
        let fotoHtml = "";
        if (fotos.length) {
          fotoHtml = '<div class="page-break"></div>' +
            '<h3 style="margin:0 0 8px;font-size:13px;text-decoration:underline;text-align:center">Lampiran Foto</h3>' +
            '<div class="foto-grid">' +
            fotos.map((url, i) => '<figure><img src="' + url + '"><figcaption>Foto ' + (i + 1) + ' &mdash; ' + longDate(d.tanggal) + '</figcaption></figure>').join("") +
            '</div>';
        }

        const stempelPengirim = SIGN.stP
          ? '<img class="stempel" src="' + SIGN.stP + '">'
          : '<img class="stempel" src="' + BASE_URL + '/stempel.png" onerror="this.style.display=\'none\'">';
        const ttdPengirim = SIGN.ttdP ? '<img class="ttd" src="' + SIGN.ttdP + '">' : '';
        const stempelPenerima = SIGN.stR ? '<img class="stempel" src="' + SIGN.stR + '">' : '';
        const ttdPenerima = SIGN.ttdR ? '<img class="ttd" src="' + SIGN.ttdR + '">' : '';

        const body =
          '<table style="width:100%"><tr>' +
          '<td style="width:60%;vertical-align:top"><table class="doc">' +
          '<tr><td style="width:70px">Nomor</td><td>: <b>' + nomor + '</b></td></tr>' +
          '<tr><td>Perihal</td><td>: <b>Surat Jalan Pengangkutan Sampah</b></td></tr>' +
          '</table></td>' +
          '<td style="vertical-align:top;text-align:right">Tangerang, ' + longDate(d.tanggal) + '</td>' +
          '</tr></table>' +
          '<p style="margin:18px 0 0">' + KEPADA_HTML + '</p>' +
          '<p style="text-indent:40px">Dengan hormat,</p>' +
          '<p style="text-indent:40px">Sehubungan dengan kegiatan pengangkutan sampah yang dilaksanakan oleh <b>CV Rezeki Amanah Jaya Group</b>, bersama ini kami sampaikan rincian pengambilan sebagai berikut:</p>' +
          '<table class="doc" style="margin-top:8px">' +
          "<tr><td style=\"width:150px\">Tanggal</td><td>: " + longDate(d.tanggal) + "</td></tr>" +
          "<tr><td>Jenis Sampah</td><td>: " + (d.jenis || "-") + "</td></tr>" +
          "<tr><td>Berat</td><td>: " + (d.berat || 0) + " kg</td></tr>" +
          "<tr><td>Diolah</td><td>: " + (d.diolah || 0) + " kg</td></tr>" +
          "<tr><td>Residu</td><td>: " + (d.residu || 0) + " kg</td></tr>" +
          "<tr><td>Petugas / Driver</td><td>: " + (d.petugas || "-") + "</td></tr>" +
          "<tr><td>Lokasi Asal</td><td>: The Hood, Summarecon Serpong</td></tr>" +
          "<tr><td>Tujuan</td><td>: Fasilitas Pengolahan CV Rezeki Amanah Jaya Group</td></tr>" +
          "<tr><td>Catatan</td><td>: " + (d.catatan || "-") + "</td></tr>" +
          "</table>" +
          "<p>Barang/sampah tersebut di atas telah diambil dan diangkut dengan sesungguhnya.</p>" +
          '<div class="sign">' +
            '<div><p>Hormat kami,</p><div class="space">' + stempelPengirim + ttdPengirim + '</div><p><b>( ' + (d.petugas || "........................") + ' )</b><br>Pengirim</p></div>' +
            '<div><p>Diterima oleh,</p><div class="space">' + stempelPenerima + ttdPenerima + '</div><p><b>( ........................ )</b><br>Penerima</p></div>' +
          '</div>' +
          fotoHtml;

        const w = window.open("", "_blank");
        w.document.write(printShell("SURAT JALAN", body));
        w.document.close();
        w.focus();
      };

      if (d.noSurat && d.noSurat.indexOf("SJ/") !== 0) {
        doPrint(d.noSurat);
      } else {
        nextSJNumber(d.tanggal).then(nomor => {
          db.collection("sampah").doc(docId).update({ noSurat: nomor }).catch(() => {});
          doPrint(nomor);
        });
      }
    });
  }

  // ─── Tempel tombol Surat Jalan ───
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

  // ─── Suntik tombol Export/Cetak ───
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
