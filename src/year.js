// ─── SHARED STORAGE ──────────────────────────────────────────────────────────
const STORAGE_KEY = 'transport_dashboard_data';

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return null;
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
}

const TRASH_KEY = 'transport_dashboard_trash';
function loadTrash() {
  try { return JSON.parse(localStorage.getItem(TRASH_KEY)) || []; }
  catch(e) { return []; }
}
function saveTrash(trash) { localStorage.setItem(TRASH_KEY, JSON.stringify(trash)); }
function trashItem(type, label, data) {
  const trash = loadTrash();
  trash.push({ type, label, data, deletedAt: Date.now() });
  saveTrash(trash);
}

let DATA = loadData();
if (!DATA) { window.location.href = '/index.html'; }
if (!DATA.entryMeta) DATA.entryMeta = {};

function ensureEntryMeta(truckId, year) {
  if (!DATA.entryMeta) DATA.entryMeta = {};
  if (!DATA.entryMeta[truckId]) DATA.entryMeta[truckId] = {};
  if (!DATA.entryMeta[truckId][year]) DATA.entryMeta[truckId][year] = {};
  return DATA.entryMeta[truckId][year];
}

function touchEntryMeta(truckId, year, isCreate) {
  const meta = ensureEntryMeta(truckId, year);
  const now = Date.now();
  if (isCreate && !meta.createdAt) meta.createdAt = now;
  if (!meta.createdAt) meta.createdAt = now;
  meta.updatedAt = now;
}

function clearEntryMeta(truckId, year) {
  if (!DATA.entryMeta || !DATA.entryMeta[truckId]) return;
  if (year === undefined) {
    delete DATA.entryMeta[truckId];
    return;
  }
  delete DATA.entryMeta[truckId][year];
  if (Object.keys(DATA.entryMeta[truckId]).length === 0) delete DATA.entryMeta[truckId];
}

function getEntryMeta(truckId, year) {
  return DATA.entryMeta?.[truckId]?.[year] || null;
}

function fmtDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

// ─── GET YEAR FROM URL ──────────────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const YEAR = parseInt(params.get('year'));

if (!YEAR || YEAR < 2020 || YEAR > 2040) {
  window.location.href = '/index.html';
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => t.className = 'toast', 2600);
}

function flashSave() {
  const el = document.getElementById('saveStatus');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

function getAllYears() {
  const yrs = new Set();
  for (const t in DATA.trucks) {
    for (const y in DATA.trucks[t]) yrs.add(Number(y));
  }
  for (const y in DATA.monthly) yrs.add(Number(y));
  if (!yrs.has(YEAR)) yrs.add(YEAR);
  return [...yrs].sort();
}

// ─── RENDER: HEADER ─────────────────────────────────────────────────────────
function renderHeader() {
  document.title = `${YEAR} Spreadsheet — Transport Dashboard`;
  document.getElementById('pageTitle').textContent = `${YEAR} Spreadsheet`;
  document.getElementById('pageSubtitle').textContent = `Edit all data for ${YEAR} · Changes reflect on the dashboard`;

  const years = getAllYears();
  const nav = document.getElementById('yearNav');
  nav.innerHTML = years.map(y =>
    `<a href="year.html?year=${y}" class="${y===YEAR?'active':''}">${y}</a>`
  ).join('');
}

// ─── RENDER: TRUCK TABLE ────────────────────────────────────────────────────
function renderTruckTable() {
  const trucks = Object.keys(DATA.trucks);
  const yearTrucks = trucks.filter(id => DATA.trucks[id][YEAR]);
  document.getElementById('truckCount').textContent = `${yearTrucks.length} truck${yearTrucks.length!==1?'s':''}`;

  let html = `<thead><tr>
    <th style="width:40px"></th>
    <th>Truck ID</th>
    <th>Driver</th>
    <th class="num">Gross Income (GHS)</th>
    <th class="num">Expenditure (GHS)</th>
    <th class="num">Net Income (GHS)</th>
    <th class="num">Weeks</th>
    <th class="num">Efficiency</th>
    <th>Last Input / Last Edit</th>
  </tr></thead><tbody>`;

  let totGross = 0, totExp = 0, totNet = 0, totWeeks = 0;

  yearTrucks.forEach(id => {
    const d = DATA.trucks[id][YEAR];
    const net = d.gross - d.exp;
    const eff = d.gross ? Math.round(net / d.gross * 100) : 0;
    totGross += d.gross; totExp += d.exp; totNet += net; totWeeks += d.weeks;

    const meta = getEntryMeta(id, YEAR);
    html += `<tr data-truck="${id}">
      ${isAdmin() ? `<td style="text-align:center"><button class="delete-btn" onclick="removeTruckRow('${id}')" title="Remove">✕</button></td>` : '<td></td>'}
      <td class="label-cell"><a href="truck.html?id=${encodeURIComponent(id)}">${id}</a></td>
      <td><input type="text" value="${DATA.drivers[id]||''}" data-field="driver" data-truck="${id}" style="text-align:left" placeholder="—" ${isAdmin()?'':'readonly'}></td>
      <td><input type="number" value="${d.gross}" data-field="gross" data-truck="${id}" min="0" placeholder="0" ${isAdmin()?'':'readonly'}></td>
      <td><input type="number" value="${d.exp}" data-field="exp" data-truck="${id}" min="0" placeholder="0" ${isAdmin()?'':'readonly'}></td>
      <td class="computed ${net>=0?'positive':'negative'}" data-net="${id}">${net.toLocaleString()}</td>
      <td><input type="number" value="${d.weeks}" data-field="weeks" data-truck="${id}" min="0" max="52" placeholder="0" ${isAdmin()?'':'readonly'}></td>
      <td class="computed neutral" data-eff="${id}">${eff}%</td>
      <td style="font-size:0.68rem;line-height:1.35;color:var(--muted)"><div><strong style="color:var(--label)">Input:</strong> ${fmtDateTime(meta?.createdAt)}</div><div><strong style="color:var(--label)">Edit:</strong> ${fmtDateTime(meta?.updatedAt)}</div></td>
    </tr>`;
  });

  const totEff = totGross ? Math.round(totNet / totGross * 100) : 0;
  html += `<tr class="total-row">
    <td></td>
    <td class="label-cell" style="color:var(--text);font-family:'DM Sans',sans-serif;font-weight:700">TOTAL</td>
    <td></td>
    <td class="computed neutral" id="totGross">${totGross.toLocaleString()}</td>
    <td class="computed negative" id="totExp">${totExp.toLocaleString()}</td>
    <td class="computed ${totNet>=0?'positive':'negative'}" id="totNet">${totNet.toLocaleString()}</td>
    <td class="computed neutral" id="totWeeks">${totWeeks}</td>
    <td class="computed neutral" id="totEff">${totEff}%</td>
    <td></td>
  </tr>`;

  html += `</tbody>`;
  document.getElementById('truckTable').innerHTML = html;

  // Attach live-edit listeners
  document.querySelectorAll('#truckTable input').forEach(inp => {
    inp.addEventListener('input', onTruckCellEdit);
  });
}

function onTruckCellEdit(e) {
  if (!isAdmin()) return showToast('View only — contact admin to edit', true);
  const inp = e.target;
  const truck = inp.dataset.truck;
  const field = inp.dataset.field;

  if (field === 'driver') {
    const val = inp.value.trim();
    if (val) DATA.drivers[truck] = val;
    else delete DATA.drivers[truck];
  } else {
    const val = parseFloat(inp.value) || 0;
    DATA.trucks[truck][YEAR][field] = val;
    DATA.trucks[truck][YEAR].net = DATA.trucks[truck][YEAR].gross - DATA.trucks[truck][YEAR].exp;
    touchEntryMeta(truck, YEAR, false);
  }

  updateTruckComputedCells();
}

function updateTruckComputedCells() {
  let totGross = 0, totExp = 0, totNet = 0, totWeeks = 0;
  const trucks = Object.keys(DATA.trucks).filter(id => DATA.trucks[id][YEAR]);

  trucks.forEach(id => {
    const d = DATA.trucks[id][YEAR];
    const net = d.gross - d.exp;
    const eff = d.gross ? Math.round(net / d.gross * 100) : 0;
    d.net = net;

    const netCell = document.querySelector(`[data-net="${id}"]`);
    const effCell = document.querySelector(`[data-eff="${id}"]`);
    if (netCell) {
      netCell.textContent = net.toLocaleString();
      netCell.className = `computed ${net >= 0 ? 'positive' : 'negative'}`;
    }
    if (effCell) effCell.textContent = `${eff}%`;

    totGross += d.gross; totExp += d.exp; totNet += net; totWeeks += d.weeks;
  });

  const totEff = totGross ? Math.round(totNet / totGross * 100) : 0;
  document.getElementById('totGross').textContent = totGross.toLocaleString();
  document.getElementById('totExp').textContent = totExp.toLocaleString();
  const totNetEl = document.getElementById('totNet');
  totNetEl.textContent = totNet.toLocaleString();
  totNetEl.className = `computed ${totNet >= 0 ? 'positive' : 'negative'}`;
  document.getElementById('totWeeks').textContent = totWeeks;
  document.getElementById('totEff').textContent = `${totEff}%`;
}

function addTruckRow() {
  if (!isAdmin()) return showToast('View only — contact admin to edit', true);
  const id = prompt('Enter Truck ID (e.g. GN 1234-25):');
  if (!id) return;
  const truckId = id.trim().toUpperCase();
  if (!truckId) return;
  if (!DATA.trucks[truckId]) DATA.trucks[truckId] = {};
  if (DATA.trucks[truckId][YEAR]) {
    showToast(`${truckId} already has ${YEAR} data`, true);
    return;
  }
  DATA.trucks[truckId][YEAR] = { gross: 0, exp: 0, net: 0, weeks: 0 };
  touchEntryMeta(truckId, YEAR, true);
  saveData();
  renderTruckTable();
  showToast(`Added ${truckId} to ${YEAR}`);
}

function removeTruckRow(truckId) {
  if (!isAdmin()) return showToast('View only — contact admin to edit', true);
  if (!confirm(`Remove ${truckId} data for ${YEAR}?`)) return;
  trashItem('entry', `${truckId} — ${YEAR}`, { truckId, year: YEAR, entry: DATA.trucks[truckId][YEAR] });
  delete DATA.trucks[truckId][YEAR];
  clearEntryMeta(truckId, YEAR);
  if (Object.keys(DATA.trucks[truckId]).length === 0) {
    delete DATA.trucks[truckId];
    delete DATA.drivers[truckId];
  }
  saveData();
  renderTruckTable();
  showToast(`Removed ${truckId} from ${YEAR} — recoverable for 30 days`);
}

// ─── RENDER: MONTHLY TABLE ──────────────────────────────────────────────────
function renderMonthlyTable() {
  if (!DATA.monthly[YEAR]) DATA.monthly[YEAR] = { labels: [], gross: [], exp: [] };
  const m = DATA.monthly[YEAR];

  let html = `<thead><tr>
    <th>Month</th>
    <th class="num">Gross Income (GHS)</th>
    <th class="num">Expenditure (GHS)</th>
    <th class="num">Net (GHS)</th>
  </tr></thead><tbody>`;

  let totG = 0, totE = 0;

  MONTHS.forEach((month, i) => {
    const labelIdx = m.labels ? m.labels.indexOf(month) : -1;
    const gross = labelIdx >= 0 ? (m.gross[labelIdx] || 0) : 0;
    const exp = labelIdx >= 0 ? (m.exp[labelIdx] || 0) : 0;
    const net = gross - exp;
    totG += gross; totE += exp;

    html += `<tr>
      <td class="label-cell" style="color:var(--label);font-family:'DM Sans',sans-serif">${month}</td>
      <td><input type="number" value="${gross}" data-month="${month}" data-mfield="gross" min="0" placeholder="0" ${isAdmin()?'':'readonly'}></td>
      <td><input type="number" value="${exp}" data-month="${month}" data-mfield="exp" min="0" placeholder="0" ${isAdmin()?'':'readonly'}></td>
      <td class="computed ${net>=0?'positive':'negative'}" data-mnet="${month}">${net.toLocaleString()}</td>
    </tr>`;
  });

  const totNet = totG - totE;
  html += `<tr class="total-row">
    <td class="label-cell" style="color:var(--text);font-family:'DM Sans',sans-serif;font-weight:700">TOTAL</td>
    <td class="computed neutral" id="mTotGross">${totG.toLocaleString()}</td>
    <td class="computed negative" id="mTotExp">${totE.toLocaleString()}</td>
    <td class="computed ${totNet>=0?'positive':'negative'}" id="mTotNet">${totNet.toLocaleString()}</td>
  </tr></tbody>`;

  document.getElementById('monthlyTable').innerHTML = html;

  document.querySelectorAll('#monthlyTable input').forEach(inp => {
    inp.addEventListener('input', onMonthlyCellEdit);
  });
}

function onMonthlyCellEdit() {
  if (!isAdmin()) return showToast('View only — contact admin to edit', true);
  // Rebuild monthly arrays from all inputs
  const labels = [];
  const grossArr = [];
  const expArr = [];

  let totG = 0, totE = 0;

  MONTHS.forEach(month => {
    const gInput = document.querySelector(`[data-month="${month}"][data-mfield="gross"]`);
    const eInput = document.querySelector(`[data-month="${month}"][data-mfield="exp"]`);
    const g = parseFloat(gInput.value) || 0;
    const e = parseFloat(eInput.value) || 0;
    const net = g - e;
    totG += g; totE += e;

    // Only include months with data
    if (g > 0 || e > 0) {
      labels.push(month);
      grossArr.push(g);
      expArr.push(e);
    }

    const netCell = document.querySelector(`[data-mnet="${month}"]`);
    if (netCell) {
      netCell.textContent = net.toLocaleString();
      netCell.className = `computed ${net >= 0 ? 'positive' : 'negative'}`;
    }
  });

  DATA.monthly[YEAR] = { labels, gross: grossArr, exp: expArr };

  const totNet = totG - totE;
  document.getElementById('mTotGross').textContent = totG.toLocaleString();
  document.getElementById('mTotExp').textContent = totE.toLocaleString();
  const mTotNetEl = document.getElementById('mTotNet');
  mTotNetEl.textContent = totNet.toLocaleString();
  mTotNetEl.className = `computed ${totNet >= 0 ? 'positive' : 'negative'}`;
}

// ─── RENDER: EXPENSE TABLE ──────────────────────────────────────────────────
function renderExpTable() {
  if (!DATA.expBreakdown[YEAR]) DATA.expBreakdown[YEAR] = { maint: 0, other: 0 };
  const d = DATA.expBreakdown[YEAR];
  const total = (d.maint || 0) + (d.other || 0);

  const html = `<thead><tr>
    <th>Category</th>
    <th class="num">Amount (GHS)</th>
    <th class="num">% of Total</th>
  </tr></thead><tbody>
  <tr>
    <td class="label-cell" style="color:var(--label);font-family:'DM Sans',sans-serif">Maintenance / Oil Changes</td>
    <td><input type="number" value="${d.maint||0}" id="expMaintInput" min="0" placeholder="0" oninput="onExpEdit()" ${isAdmin()?'':'readonly'}></td>
    <td class="computed neutral" id="expMaintPct">${total ? Math.round((d.maint||0)/total*100) : 0}%</td>
  </tr>
  <tr>
    <td class="label-cell" style="color:var(--label);font-family:'DM Sans',sans-serif">Other / Parts / Miscellaneous</td>
    <td><input type="number" value="${d.other||0}" id="expOtherInput" min="0" placeholder="0" oninput="onExpEdit()" ${isAdmin()?'':'readonly'}></td>
    <td class="computed neutral" id="expOtherPct">${total ? Math.round((d.other||0)/total*100) : 0}%</td>
  </tr>
  <tr class="total-row">
    <td class="label-cell" style="color:var(--text);font-family:'DM Sans',sans-serif;font-weight:700">TOTAL</td>
    <td class="computed neutral" id="expTotal">${total.toLocaleString()}</td>
    <td class="computed neutral">100%</td>
  </tr></tbody>`;

  document.getElementById('expTable').innerHTML = html;
}

function onExpEdit() {
  if (!isAdmin()) return showToast('View only — contact admin to edit', true);
  const maint = parseFloat(document.getElementById('expMaintInput').value) || 0;
  const other = parseFloat(document.getElementById('expOtherInput').value) || 0;
  DATA.expBreakdown[YEAR] = { maint, other };
  const total = maint + other;

  document.getElementById('expMaintPct').textContent = total ? Math.round(maint/total*100) + '%' : '0%';
  document.getElementById('expOtherPct').textContent = total ? Math.round(other/total*100) + '%' : '0%';
  document.getElementById('expTotal').textContent = total.toLocaleString();
}

// ─── SAVE / RESET ───────────────────────────────────────────────────────────
function saveAll() {
  if (!isAdmin()) return showToast('View only — contact admin to edit', true);
  saveData();
  flashSave();
  showToast('All changes saved — dashboard updated');
}

function resetYear() {
  if (!confirm(`Reset all ${YEAR} data to last saved state?`)) return;
  DATA = loadData();
  renderAll();
  showToast('Reset to last saved state');
}

// ─── RENDER ALL ─────────────────────────────────────────────────────────────
function renderAll() {
  renderHeader();
  renderTruckTable();
  renderMonthlyTable();
  renderExpTable();
}

// ─── INIT ───────────────────────────────────────────────────────────────────
renderAll();
