// ══════════════════════════════════════════════════════════════
// amview.js — EcoTRACK Live Tracking Viewer (FINAL v5)
// Compatible dengan antimacet.js, app.js, dan adminctl.js
// ══════════════════════════════════════════════════════════════

let liveSubs = {};
let markers = {};
let polylines = {};
let savedRouteLayer = [];

// ─── Helper: Decode path string ke array [lat, lng] ──────────
function decodePathToPoints(pathStr) {
  if (!pathStr) return [];
  return pathStr.split(";").filter(Boolean).map(s => {
    const [lat, lng] = s.split(",").map(Number);
    return [lat, lng];
  });
}

// ─── Helper: Truck Icon ───────────────────────────────────────
function getTruckIcon() {
  return L.divIcon({
    className: "truck-marker",
    html: '<div style="font-size:28px;text-shadow:0 2px 4px rgba(0,0,0,.3)">🚛</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 36]
  });
}

// ─── Helper: Flag Icon untuk start/end route ─────────────────
function flagIcon(emoji) {
  return L.divIcon({
    className: "flag-marker",
    html: `<div style="font-size:24px;text-shadow:0 2px 4px rgba(0,0,0,.3)">${emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30]
  });
}

// ═══════════════════════════════════════════
// LISTENER: Live Tracking Real-time
// ═══════════════════════════════════════════
function listenToLiveTracking(tableBodyId, mapContextId, showOverlay) {
  // Tunggu sampai db siap
  if (typeof db === "undefined") {
    setTimeout(() => listenToLiveTracking(tableBodyId, mapContextId, showOverlay), 1000);
    return;
  }

  const mapKey = mapContextId || "public";
  if (liveSubs[mapKey]) return; // sudah ada listener

  markers[mapKey] = {};
  polylines[mapKey] = {};

  liveSubs[mapKey] = db.collection("live_tracking")
    .where("isActive", "==", true)
    .onSnapshot(snap => {
      const mp = maps[mapKey];
      const tbody = tableBodyId ? document.getElementById(tableBodyId) : null;
      const overlay = showOverlay ? document.getElementById("mapOverlay") : null;

      if (snap.empty) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#888">Tidak ada armada aktif</td></tr>';
        if (overlay) overlay.style.display = "flex";
        return;
      }

      if (overlay) overlay.style.display = "none";

      let rows = "";
      snap.forEach(doc => {
        const d = doc.data();
        const id = doc.id;

        // Update marker di peta
        if (mp && d.lastLat && d.lastLng) {
          if (!markers[mapKey][id]) {
            markers[mapKey][id] = L.marker([d.lastLat, d.lastLng], { icon: getTruckIcon() })
              .addTo(mp)
              .bindPopup(`<b>${d.vehicleName || d.truckId || id}</b><br>Driver: ${d.driverName || d.driverId}<br>Jarak: ${((d.totalDistance||0)/1000).toFixed(2)} km`);
          } else {
            markers[mapKey][id].setLatLng([d.lastLat, d.lastLng]);
          }

          // Draw polyline
          if (d.path && d.path.length > 0) {
            const points = decodePathToPoints(d.path);
            if (points.length > 1) {
              if (!polylines[mapKey][id]) {
                polylines[mapKey][id] = L.polyline(points, { color: "#2e7d32", weight: 4, opacity: 0.85 }).addTo(mp);
              } else {
                polylines[mapKey][id].setLatLngs(points);
              }
            }
          }
        }

        // Update tabel
        const updateAt = d.updatedAt && d.updatedAt.toDate
          ? d.updatedAt.toDate().toLocaleString("id-ID")
          : "-";
        
        rows += `
          <tr>
            <td>${d.vehicleName || d.truckId || "-"}</td>
            <td>${d.driverName || d.driverId || "-"}</td>
            <td>${updateAt}</td>
            <td><span class="badge" style="background:#2e7d32;color:#fff;padding:2px 8px;border-radius:10px;font-size:.75rem">🟢 Aktif</span></td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="adminStopVehicle('${id}')">⏹️ Stop</button>
            </td>
          </tr>
        `;
      });

      if (tbody) tbody.innerHTML = rows;
    }, err => {
      if (typeof toast === "function") toast("❌ " + err.message, "error");
      console.error("[liveTracking]", err);
    });
}

// ═══════════════════════════════════════════
// VIEW SAVED ROUTE (dari riwayat)
// ═══════════════════════════════════════════
function viewSavedRoute(routeId) {
  const mp = maps["dash"];
  if (!mp || typeof db === "undefined") return;

  db.collection("routes").doc(routeId).get().then(doc => {
    if (!doc.exists) return;
    const r = doc.data();

    // Bersihkan layer lama
    if (savedRouteLayer.length) {
      savedRouteLayer.forEach(l => mp.removeLayer(l));
    }

    const points = decodePathToPoints(r.path);
    if (points.length < 2) return;

    const ln = L.polyline(points, { color: "#ff9800", weight: 5, opacity: 0.9 }).addTo(mp);
    savedRouteLayer = [
      ln,
      L.marker(points[0], { icon: flagIcon("🟢") }).addTo(mp),
      L.marker(points[points.length - 1], { icon: flagIcon("🏁") }).addTo(mp)
    ];
    mp.fitBounds(ln.getBounds(), { padding: [40, 40] });
  });
}

// Expose ke global
window.listenToLiveTracking = listenToLiveTracking;
window.viewSavedRoute = viewSavedRoute;
