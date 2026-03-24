// ─── STORAGE ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'transport_dashboard_data';
const TRASH_KEY = 'transport_dashboard_trash';

function loadData() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
  catch(e) { return null; }
}
function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function loadTrash() {
  try { return JSON.parse(localStorage.getItem(TRASH_KEY)) || []; }
  catch(e) { return []; }
}
function saveTrash(trash) {
  localStorage.setItem(TRASH_KEY, JSON.stringify(trash));
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show';
  setTimeout(() => t.className = 'toast', 2600);
}

// ─── AUTO-PURGE items older than 30 days ─────────────────────────────────────
function autoPurge() {
  const trash = loadTrash();
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const filtered = trash.filter(item => item.deletedAt > cutoff);
  if (filtered.length !== trash.length) saveTrash(filtered);
  return filtered;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function daysLeft(deletedAt) {
  const ms = (deletedAt + 30 * 24 * 60 * 60 * 1000) - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function fmtGHS(n) { return 'GHS ' + (n || 0).toLocaleString(); }

function buildDetail(item) {
  const d = item.data;
  if (item.type === 'truck') {
    const years = Object.keys(d.entries || {}).sort();
    const totalGross = years.reduce((s, y) => s + (d.entries[y]?.gross || 0), 0);
    return `Driver: <span>${d.driver || '—'}</span> · ${years.length} year(s) · Total Gross: <span>${fmtGHS(totalGross)}</span>`;
  }
  if (item.type === 'entry') {
    const e = d.entry || {};
    return `Gross: <span>${fmtGHS(e.gross)}</span> · Exp: <span>${fmtGHS(e.exp)}</span> · Net: <span>${fmtGHS(e.net)}</span> · ${e.weeks || 0} weeks`;
  }
  if (item.type === 'year') {
    const truckCount = Object.keys(d.trucks || {}).length;
    const totalGross = Object.values(d.trucks || {}).reduce((s, e) => s + (e.gross || 0), 0);
    return `${truckCount} truck(s) · Total Gross: <span>${fmtGHS(totalGross)}</span>`;
  }
  return '';
}

// ─── RENDER ──────────────────────────────────────────────────────────────────
function render() {
  const trash = autoPurge();
  const container = document.getElementById('trashList');
  const countEl = document.getElementById('trashCount');
  const purgeBtn = document.getElementById('purgeBtn');

  countEl.textContent = `${trash.length} item${trash.length !== 1 ? 's' : ''} in recovery`;
  purgeBtn.style.display = trash.length ? '' : 'none';

  if (!trash.length) {
    container.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-recycle"></i>
      <p>No deleted items — everything is safe!</p>
    </div>`;
    return;
  }

  // Sort newest first
  const sorted = [...trash].sort((a, b) => b.deletedAt - a.deletedAt);

  container.innerHTML = sorted.map((item, idx) => {
    const origIdx = trash.indexOf(item);
    const dl = daysLeft(item.deletedAt);
    return `<div class="trash-card">
      <div class="trash-info">
        <span class="trash-type ${item.type}">${item.type}</span>
        <div class="trash-label">${item.label}</div>
        <div class="trash-detail">${buildDetail(item)}</div>
      </div>
      <div class="trash-meta">
        <div>Deleted ${fmtDate(item.deletedAt)}</div>
        <div class="days-left">${dl} day${dl !== 1 ? 's' : ''} left</div>
      </div>
      <div class="trash-actions">
        ${isAdmin() ? `<button class="btn btn-recover" onclick="recoverItem(${origIdx})">
          <i class="fa-solid fa-rotate-left"></i> Recover
        </button>
        <button class="btn btn-danger" onclick="permanentDelete(${origIdx})">
          <i class="fa-solid fa-trash"></i>
        </button>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ─── RECOVER ─────────────────────────────────────────────────────────────────
function recoverItem(idx) {
  if (!isAdmin()) return showToast('View only — contact admin to edit', true);
  const trash = loadTrash();
  const item = trash[idx];
  if (!item) return;

  const DATA = loadData();
  if (!DATA) { showToast('Dashboard data not found'); return; }

  if (item.type === 'entry') {
    const { truckId, year, entry } = item.data;
    if (!DATA.trucks[truckId]) DATA.trucks[truckId] = {};
    DATA.trucks[truckId][year] = entry;
    if (!DATA.monthly[year]) DATA.monthly[year] = { labels: [], gross: [], exp: [] };
    if (!DATA.expBreakdown[year]) DATA.expBreakdown[year] = { maint: 0, other: 0 };
    // Restore original input/edit timestamps
    if (item.data.meta) {
      if (!DATA.entryMeta) DATA.entryMeta = {};
      if (!DATA.entryMeta[truckId]) DATA.entryMeta[truckId] = {};
      DATA.entryMeta[truckId][year] = item.data.meta;
    }
  }

  if (item.type === 'truck') {
    const { truckId, entries, driver } = item.data;
    DATA.trucks[truckId] = entries;
    if (driver) DATA.drivers[truckId] = driver;
    for (const y in entries) {
      if (!DATA.monthly[y]) DATA.monthly[y] = { labels: [], gross: [], exp: [] };
      if (!DATA.expBreakdown[y]) DATA.expBreakdown[y] = { maint: 0, other: 0 };
    }
    // Restore original timestamps for all year entries
    if (item.data.entryMeta && Object.keys(item.data.entryMeta).length) {
      if (!DATA.entryMeta) DATA.entryMeta = {};
      // Support both script.js format (truckId) and truck.js format (id)
      const tId = truckId || item.data.id;
      if (tId) DATA.entryMeta[tId] = item.data.entryMeta;
    }
  }

  if (item.type === 'year') {
    const { year, trucks, monthly, exp } = item.data;
    for (const t in trucks) {
      if (!DATA.trucks[t]) DATA.trucks[t] = {};
      DATA.trucks[t][year] = trucks[t];
    }
    if (monthly) DATA.monthly[year] = monthly;
    if (exp) DATA.expBreakdown[year] = exp;
    // Restore original timestamps for each truck's year entry
    if (item.data.entryMeta) {
      if (!DATA.entryMeta) DATA.entryMeta = {};
      for (const t in item.data.entryMeta) {
        if (!DATA.entryMeta[t]) DATA.entryMeta[t] = {};
        DATA.entryMeta[t][year] = item.data.entryMeta[t];
      }
    }
  }

  saveData(DATA);
  trash.splice(idx, 1);
  saveTrash(trash);
  showToast(`Recovered: ${item.label}`);
  render();
}

// ─── PERMANENT DELETE ────────────────────────────────────────────────────────
function permanentDelete(idx) {
  if (!isAdmin()) return showToast('View only — contact admin to edit', true);
  if (!confirm('Permanently delete this item? This cannot be undone.')) return;
  const trash = loadTrash();
  const item = trash[idx];
  trash.splice(idx, 1);
  saveTrash(trash);
  showToast(`Permanently deleted: ${item?.label || 'item'}`);
  render();
}

// ─── PURGE ALL ───────────────────────────────────────────────────────────────
function purgeAll() {
  if (!isAdmin()) return showToast('View only — contact admin to edit', true);
  if (!confirm('Permanently delete ALL items in recovery? This cannot be undone.')) return;
  saveTrash([]);
  showToast('Recovery emptied');
  render();
}

// ─── INIT ────────────────────────────────────────────────────────────────────
render();
