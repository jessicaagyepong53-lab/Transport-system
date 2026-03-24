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

function ensureYearData(year) {
  if (!DATA.monthly[year]) DATA.monthly[year] = { labels: [], gross: [], exp: [] };
  if (!DATA.expBreakdown[year]) DATA.expBreakdown[year] = { maint: 0, other: 0 };
}

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

// ─── GET TRUCK ID FROM URL ───────────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const TRUCK_ID = params.get('id');

if (!TRUCK_ID || !DATA.trucks[TRUCK_ID]) {
  window.location.href = '/index.html';
}


// ─── TRUCK COST & BREAK-EVEN HELPERS ─────────────────────────────────────────
function getTruckCost(id) {
  const c = DATA.truckCost?.[id];
  if (c) return c;
  const pp = DATA.purchasePrice?.[id];
  if (pp) return { initialValue: pp, pricePaid: pp, maintenanceCost: 0 };
  return null;
}
function getTruckBreakEvenTotal(id) {
  const c = getTruckCost(id);
  return c ? ((c.pricePaid || 0) + (c.maintenanceCost || 0)) : 0;
}
function getTruckTotalAmount(id) {
  const c = getTruckCost(id);
  return c ? ((c.initialValue || 0) + (c.pricePaid || 0) + (c.maintenanceCost || 0)) : 0;
}
function getBreakEvenYear(id) {
  const target = getTruckBreakEvenTotal(id);
  if (!target) return null;
  const years = Object.keys(DATA.trucks[id] || {}).map(Number).sort();
  let cumNet = 0;
  for (const y of years) {
    cumNet += (DATA.trucks[id][y]?.net) || 0;
    if (cumNet >= target) return y;
  }
  return null;
}
function getBreakEvenDuration(id) {
  const years = Object.keys(DATA.trucks[id] || {}).map(Number).sort();
  const beYear = getBreakEvenYear(id);
  if (!beYear || !years.length) return null;
  return beYear - years[0] + 1;
}

const truckData = DATA.trucks[TRUCK_ID];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n >= 1000000) return 'GHS ' + (n/1000000).toFixed(2) + 'M';
  if (n >= 1000) return 'GHS ' + (n/1000).toFixed(0) + 'K';
  return 'GHS ' + n.toLocaleString();
}

function fmtFull(n) { return n.toLocaleString(); }
function fmtDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getISOWeeksInYear(year) {
  const y = parseInt(year);
  const jan1 = new Date(y, 0, 1);
  const dec31 = new Date(y, 11, 31);
  return (jan1.getDay() === 4 || dec31.getDay() === 4) ? 53 : 52;
}

function getWeeksForYear(year) {
  const y = parseInt(year);
  const now = new Date();
  const currentYear = now.getFullYear();
  const totalWeeksInYear = getISOWeeksInYear(y);
  if (y < currentYear) return totalWeeksInYear;
  if (y > currentYear) return 0;
  const start = new Date(y, 0, 1);
  const diff = now - start;
  return Math.min(totalWeeksInYear, Math.floor(diff / (7 * 24 * 60 * 60 * 1000)));
}

function weekToMonth(weekNum, year) {
  const d = new Date(parseInt(year), 0, 1 + (weekNum - 1) * 7);
  return MONTH_NAMES[d.getMonth()];
}

function getWeekDates(weekNum, year) {
  const yr = parseInt(year);
  const jan1 = new Date(yr, 0, 1);
  const dayOfWeek = jan1.getDay();
  const startOfWeek1 = new Date(yr, 0, 1 - ((dayOfWeek + 6) % 7));
  const weekStart = new Date(startOfWeek1);
  weekStart.setDate(weekStart.getDate() + (weekNum - 1) * 7);
  const days = [];
  const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat'];
  for (let d = 0; d < 6; d++) {
    const dt = new Date(weekStart);
    dt.setDate(dt.getDate() + d);
    days.push({ name: dayNames[d], date: dt.getDate(), month: MONTH_NAMES[dt.getMonth()], full: `${dt.getDate()} ${MONTH_NAMES[dt.getMonth()]}` });
  }
  return days;
}

function aggregateWeeklyToMonthly(yr) {
  if (!DATA.weekly || !DATA.weekly[yr]) return;
  const monthTotals = {};
  MONTH_NAMES.forEach(m => { monthTotals[m] = { gross: 0, exp: 0 }; });
  for (const tid in DATA.weekly[yr]) {
    for (const w in DATA.weekly[yr][tid]) {
      const wk = DATA.weekly[yr][tid][w];
      const month = weekToMonth(parseInt(w), yr);
      monthTotals[month].gross += wk.gross || 0;
      monthTotals[month].exp += wk.exp || 0;
    }
  }
  const labels = [], gross = [], exp = [];
  MONTH_NAMES.forEach(m => {
    if (monthTotals[m].gross || monthTotals[m].exp) {
      labels.push(m); gross.push(monthTotals[m].gross); exp.push(monthTotals[m].exp);
    }
  });
  DATA.monthly[yr] = { labels, gross, exp };
}

function getYears() { return Object.keys(truckData).map(Number).sort(); }

function getTotals() {
  let gross=0, exp=0, net=0, weeks=0;
  for (const y in truckData) {
    gross += truckData[y].gross;
    exp   += truckData[y].exp;
    net   += truckData[y].net;
    weeks += truckData[y].weeks;
  }
  return { gross, exp, net, weeks };
}

// ─── MODAL / TOAST ───────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => t.className = 'toast', 2600);
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});

// ─── CHART DEFAULTS ──────────────────────────────────────────────────────────
Chart.defaults.color = '#6b7a96';
Chart.defaults.font.family = 'DM Sans';
Chart.defaults.plugins.legend.display = false;

let charts = {};

// ─── RENDER: HEADER ──────────────────────────────────────────────────────────
function renderHeader() {
  const driver = DATA.drivers[TRUCK_ID] || 'No driver assigned';
  const years = getYears();
  const range = years.length ? `${years[0]} – ${years[years.length-1]}` : '—';
  const { net } = getTotals();
  const beTotal = getTruckBreakEvenTotal(TRUCK_ID);
  const brokenEven = beTotal > 0 && net >= beTotal;
  const beDur = brokenEven ? getBreakEvenDuration(TRUCK_ID) : null;
  document.title = `${TRUCK_ID} — Truck Detail`;
  document.getElementById('truckTitle').innerHTML = TRUCK_ID +
    (brokenEven
      ? ` <span style="display:inline-block;font-size:0.65rem;padding:2px 8px;border-radius:4px;background:rgba(45,224,138,0.15);color:var(--green);border:1px solid rgba(45,224,138,0.3);margin-left:10px;font-weight:700;letter-spacing:0.5px;vertical-align:middle"><i class="fa-solid fa-check-double"></i> BROKEN EVEN</span>${beDur ? ` <span style="display:inline-block;font-size:0.62rem;padding:2px 8px;border-radius:4px;background:rgba(43,179,255,0.12);color:var(--blue);border:1px solid rgba(43,179,255,0.25);margin-left:6px;font-weight:700;letter-spacing:0.4px;vertical-align:middle">in ${beDur} yr${beDur !== 1 ? 's' : ''}</span>` : ''}`
      : '');
  document.getElementById('truckSubtitle').textContent = `Driver: ${driver} · ${range} · ${years.length} year${years.length!==1?'s':''}${beTotal > 0 ? ' · BE Target: GHS ' + beTotal.toLocaleString() : ''}`;
}

// ─── RENDER: KPIs ────────────────────────────────────────────────────────────
function renderKPIs() {
  const { gross, exp, net, weeks } = getTotals();
  const eff = gross ? Math.round(net/gross*100) : 0;
  const avgWeek = weeks ? Math.round(gross/weeks) : 0;
  const truckCost = getTruckCost(TRUCK_ID) || { initialValue: 0, pricePaid: 0, maintenanceCost: 0 };
  const beTotal = getTruckBreakEvenTotal(TRUCK_ID);
  const brokenEven = beTotal > 0 && net >= beTotal;
  const progress = beTotal > 0 ? Math.min(100, Math.round(net / beTotal * 100)) : 0;
  const remaining = beTotal > 0 ? Math.max(0, beTotal - net) : 0;
  const beDur = brokenEven ? getBreakEvenDuration(TRUCK_ID) : null;
  const totalAmount = getTruckTotalAmount(TRUCK_ID);
  let html = `
    <div class="kpi">
      <div class="kpi-label">Total Gross</div>
      <div class="kpi-value">${fmt(gross)}</div>
      <div class="kpi-sub">${getYears().length} year(s)</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Net Income</div>
      <div class="kpi-value">${fmt(net)}</div>
      <div class="kpi-sub">${net>=0?'Profit':'Loss'}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Total Expenditure</div>
      <div class="kpi-value">${fmt(exp)}</div>
      <div class="kpi-sub">${gross ? Math.round(exp/gross*100) : 0}% of gross</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Weeks Operated</div>
      <div class="kpi-value">${weeks}</div>
      <div class="kpi-sub">Avg ${fmt(avgWeek)}/week</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Efficiency</div>
      <div class="kpi-value">${eff}%</div>
      <div class="kpi-sub">Net ÷ Gross</div>
    </div>`;
  if (beTotal > 0) {
    html += `
    <div class="kpi" style="border:1px solid ${brokenEven ? 'rgba(45,224,138,0.3)' : 'rgba(245,166,35,0.2)'};border-radius:12px;background:${brokenEven ? 'rgba(45,224,138,0.06)' : 'rgba(245,166,35,0.04)'}">
      <div class="kpi-label"><i class="fa-solid fa-money-bill-transfer" style="margin-right:4px"></i>Cost & Break-Even</div>
      <div class="kpi-value" style="color:${brokenEven ? 'var(--green)' : 'var(--accent)'}">Target: ${fmt(beTotal)}</div>
      <div class="kpi-sub" style="font-size:0.66rem;line-height:1.7">Initial val: GHS ${(truckCost.initialValue || 0).toLocaleString()}<br>Paid: GHS ${(truckCost.pricePaid || 0).toLocaleString()}<br>Maint/Repairs: GHS ${(truckCost.maintenanceCost || 0).toLocaleString()}<br><strong style="color:var(--text)">Total Amount: GHS ${totalAmount.toLocaleString()}</strong></div>
      <div style="margin-top:6px;font-size:0.72rem;color:${brokenEven ? 'var(--green)' : 'var(--accent)'};font-weight:700">${brokenEven
        ? `<i class="fa-solid fa-check-double"></i> BROKEN EVEN${beDur ? ` in ${beDur} yr${beDur !== 1 ? 's' : ''}` : ''}`
        : `<span style="color:var(--accent)">${progress}% — GHS ${remaining.toLocaleString()} to go</span>`
      }</div>
      <div style="margin-top:6px;height:4px;border-radius:2px;background:rgba(255,255,255,0.08);overflow:hidden">
        <div style="height:100%;width:${progress}%;border-radius:2px;background:${brokenEven ? 'var(--green)' : 'var(--accent)'};transition:width 0.4s"></div>
      </div>
    </div>`;
  }
  document.getElementById('kpiStrip').innerHTML = html;
}

// ─── RENDER: YEARLY BAR CHART ────────────────────────────────────────────────
function renderYearlyChart() {
  const years = getYears();
  const ctx = document.getElementById('yearlyChart').getContext('2d');
  if (charts.yearly) charts.yearly.destroy();
  charts.yearly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: years,
      datasets: [
        { label:'Gross', data:years.map(y=>truckData[y].gross),
          backgroundColor:'rgba(245,166,35,0.7)', borderColor:'#f5a623', borderWidth:1.5, borderRadius:5 },
        { label:'Net', data:years.map(y=>truckData[y].net),
          backgroundColor:'rgba(45,224,138,0.6)', borderColor:'#2de08a', borderWidth:1.5, borderRadius:5 },
        { label:'Exp', data:years.map(y=>truckData[y].exp),
          backgroundColor:'rgba(224,68,58,0.5)', borderColor:'#e0443a', borderWidth:1.5, borderRadius:5 },
      ]
    },
    options: {
      responsive:true,
      plugins:{
        legend:{display:true, position:'top', labels:{boxWidth:12, padding:16, usePointStyle:true}},
        tooltip:{ callbacks:{ label: ctx => `${ctx.dataset.label}: GHS ${ctx.raw.toLocaleString()}` } }
      },
      scales:{
        y:{ grid:{color:'rgba(255,255,255,0.04)'}, ticks:{callback:v=>'GHS '+(v/1000)+'K'} },
        x:{ grid:{display:false} }
      }
    }
  });
}

// ─── RENDER: EFFICIENCY CHART ────────────────────────────────────────────────
function renderEffChart() {
  const years = getYears();
  const ctx = document.getElementById('effChart').getContext('2d');
  if (charts.eff) charts.eff.destroy();
  const effData = years.map(y => {
    const d = truckData[y];
    return d.gross ? Math.round(d.net/d.gross*100) : 0;
  });
  charts.eff = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: years,
      datasets: [{
        data: effData,
        backgroundColor: effData.map(v => v > 70 ? 'rgba(45,224,138,0.6)' : v > 40 ? 'rgba(245,166,35,0.6)' : 'rgba(224,68,58,0.5)'),
        borderColor: effData.map(v => v > 70 ? '#2de08a' : v > 40 ? '#f5a623' : '#e0443a'),
        borderWidth:1.5, borderRadius:5,
      }]
    },
    options: {
      responsive:true,
      plugins:{ tooltip:{ callbacks:{ label: ctx=>`Efficiency: ${ctx.raw}%` } } },
      scales:{
        y:{ grid:{color:'rgba(255,255,255,0.04)'}, min:0, max:100, ticks:{callback:v=>v+'%'} },
        x:{ grid:{display:false} }
      }
    }
  });
}

// ─── RENDER: NET TREND ───────────────────────────────────────────────────────
function renderNetTrend() {
  const years = getYears();
  const ctx = document.getElementById('netTrendChart').getContext('2d');
  if (charts.trend) charts.trend.destroy();
  charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: years,
      datasets: [{
        label:'Net Income',
        data: years.map(y=>truckData[y].net),
        borderColor:'#2de08a', backgroundColor:'rgba(45,224,138,0.1)',
        tension:0.3, fill:true, pointRadius:5, pointHoverRadius:8,
        pointBackgroundColor:'#2de08a'
      }]
    },
    options: {
      responsive:true,
      plugins:{ tooltip:{ callbacks:{ label: ctx=>`Net: GHS ${ctx.raw.toLocaleString()}` } } },
      scales:{
        y:{ grid:{color:'rgba(255,255,255,0.04)'}, ticks:{callback:v=>'GHS '+(v/1000)+'K'} },
        x:{ grid:{display:false} }
      }
    }
  });
}

// ─── RENDER: YEAR TABLE ──────────────────────────────────────────────────────
function renderTable() {
  const years = getYears();
  const maxNet = Math.max(...years.map(y=>truckData[y].net), 1);

  let html = `<thead><tr>
    <th>Year</th><th>Gross (GHS)</th><th>Expenditure (GHS)</th>
    <th>Net Income (GHS)</th><th>Weeks</th><th>Efficiency</th>
    <th>Net Bar</th><th>Status</th><th>Last Input / Last Edit</th><th></th>
  </tr></thead><tbody>`;

  years.forEach(y => {
    const d = truckData[y];
    const eff = d.gross ? Math.round(d.net/d.gross*100) : 0;
    const pct = maxNet ? Math.round(d.net/maxNet*100) : 0;
    const effColor = eff > 80 ? 'var(--green)' : eff > 60 ? 'var(--accent)' : 'var(--red)';
    const meta = getEntryMeta(TRUCK_ID, y);
    html += `<tr>
      <td style="font-weight:700;color:var(--blue)">${y}</td>
      <td style="color:var(--accent);font-weight:600">${fmtFull(d.gross)}</td>
      <td style="color:var(--red)">${fmtFull(d.exp)}</td>
      <td style="color:var(--green);font-weight:700">${fmtFull(d.net)}</td>
      <td style="color:var(--muted);text-align:center">${d.weeks}</td>
      <td style="color:${effColor};font-weight:600;font-family:'JetBrains Mono',monospace">${eff}%</td>
      <td style="min-width:90px">
        <div class="bar-cell">
          <div class="mini-bar-bg"><div class="mini-bar-fill" style="width:${Math.max(pct,0)}%"></div></div>
          <span style="font-size:0.7rem;color:var(--muted)">${pct}%</span>
        </div>
      </td>
      <td><span class="status-badge ${d.net>=0?'badge-profit':'badge-loss'}">${d.net>=0?'Profit':'Loss'}</span></td>
      <td style="font-size:0.68rem;line-height:1.35;color:var(--muted)"><div><strong style="color:var(--label)">Input:</strong> ${fmtDateTime(meta?.createdAt)}</div><div><strong style="color:var(--label)">Edit:</strong> ${fmtDateTime(meta?.updatedAt)}</div></td>
      ${isAdmin() ? `<td><button class="btn btn-secondary btn-sm" onclick="openEditYear(${y})">Edit</button></td>` : '<td></td>'}
    </tr>`;
  });

  // Totals row
  const tot = getTotals();
  const totEff = tot.gross ? Math.round(tot.net/tot.gross*100) : 0;
  html += `<tr style="border-top:2px solid var(--border);font-weight:700">
    <td style="color:var(--text)">TOTAL</td>
    <td style="color:var(--accent)">${fmtFull(tot.gross)}</td>
    <td style="color:var(--red)">${fmtFull(tot.exp)}</td>
    <td style="color:var(--green)">${fmtFull(tot.net)}</td>
    <td style="color:var(--muted);text-align:center">${tot.weeks}</td>
    <td style="color:var(--blue);font-family:'JetBrains Mono',monospace">${totEff}%</td>
    <td></td><td></td><td></td><td></td>
  </tr>`;

  html += `</tbody>`;
  document.getElementById('yearTable').innerHTML = html;
}

// ─── CRUD: ADD YEAR ──────────────────────────────────────────────────────────
function openAddYearModal() {
  const thisYear = new Date().getFullYear();
  document.getElementById('addYear').value = thisYear;
  document.getElementById('addWeeks').value = getWeeksForYear(thisYear);
  document.getElementById('addGross').value = '';
  document.getElementById('addExp').value = '';
  openModal('addYearModal');
}

function submitAddYear() {
  if (!isAdmin()) return showToast('View only — contact admin to edit', true);
  const year = parseInt(document.getElementById('addYear').value);
  const gross = parseFloat(document.getElementById('addGross').value) || 0;
  const exp = parseFloat(document.getElementById('addExp').value) || 0;
  const weeks = parseInt(document.getElementById('addWeeks').value) || 0;
  if (!year) return showToast('Enter a valid year', true);
  if (truckData[year]) return showToast(`${year} already exists — use Edit`, true);
  truckData[year] = { gross, exp, net: gross - exp, weeks };
  touchEntryMeta(TRUCK_ID, year, true);
  ensureYearData(year);
  saveData();
  closeModal('addYearModal');
  showToast(`Added ${year} data`);
  refreshAll();
}

// ─── CRUD: EDIT YEAR ─────────────────────────────────────────────────────────
let editingYear = null;
function openEditYear(year) {
  editingYear = year;
  const d = truckData[year];
  document.getElementById('editYearTitle').textContent = `Edit ${TRUCK_ID} — ${year}`;
  document.getElementById('editYearLabel').value = year;
  document.getElementById('editGross').value = d.gross;
  document.getElementById('editExp').value = d.exp;
  document.getElementById('editWeeks').value = d.weeks;
  openModal('editYearModal');
}

function submitEditYear() {
  if (!isAdmin()) return showToast('View only — contact admin to edit', true);
  const gross = parseFloat(document.getElementById('editGross').value) || 0;
  const exp = parseFloat(document.getElementById('editExp').value) || 0;
  const weeks = parseInt(document.getElementById('editWeeks').value) || 0;
  truckData[editingYear] = { gross, exp, net: gross - exp, weeks };
  touchEntryMeta(TRUCK_ID, editingYear, false);
  saveData();
  closeModal('editYearModal');
  showToast(`Updated ${editingYear}`);
  refreshAll();
}

function deleteYearEntry() {
  if (!isAdmin()) return showToast('View only — contact admin to edit', true);
  trashItem('entry', `${TRUCK_ID} — ${editingYear}`, { truckId: TRUCK_ID, year: editingYear, entry: truckData[editingYear], meta: getEntryMeta(TRUCK_ID, editingYear) });
  delete truckData[editingYear];
  clearEntryMeta(TRUCK_ID, editingYear);
  saveData();
  closeModal('editYearModal');
  if (Object.keys(truckData).length === 0) {
    showToast('All data removed — returning to dashboard');
    setTimeout(() => window.location.href = '/index.html', 1200);
    return;
  }
  showToast(`Deleted ${editingYear} data — recoverable for 30 days`);
  refreshAll();
}

// ─── CRUD: EDIT DRIVER ───────────────────────────────────────────────────────
function openEditDriverModal() {
  document.getElementById('driverNameInput').value = DATA.drivers[TRUCK_ID] || '';
  const cost = getTruckCost(TRUCK_ID) || { initialValue: 0, pricePaid: 0, maintenanceCost: 0 };
  document.getElementById('truckInitialValueInput').value = cost.initialValue || '';
  document.getElementById('truckPricePaidInput').value = cost.pricePaid || '';
  document.getElementById('truckMaintCostInput').value = cost.maintenanceCost || '';
  updateTruckTotalAmountPreview();
  // Show break-even preview
  const { net } = getTotals();
  const el = document.getElementById('breakEvenPreview');
  const beTotal = getTruckBreakEvenTotal(TRUCK_ID);
  if (beTotal > 0) {
    const brokenEven = net >= beTotal;
    const progress = Math.min(100, Math.round(net / beTotal * 100));
    const beDur = brokenEven ? getBreakEvenDuration(TRUCK_ID) : null;
    el.innerHTML = `<div style="padding:10px;border-radius:8px;background:${brokenEven ? 'rgba(45,224,138,0.08)' : 'rgba(245,166,35,0.06)'};border:1px solid ${brokenEven ? 'rgba(45,224,138,0.3)' : 'rgba(245,166,35,0.2)'}">
      <div style="font-size:0.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px"><i class="fa-solid fa-chart-line" style="margin-right:4px"></i>Break-Even Progress</div>
      <div style="font-size:1rem;font-weight:700;color:${brokenEven ? 'var(--green)' : 'var(--accent)'}">${brokenEven ? `<i class="fa-solid fa-check-double"></i> BROKEN EVEN${beDur ? ` in ${beDur} yr${beDur !== 1 ? 's' : ''}` : ''}` : progress + '% — GHS ' + Math.max(0, beTotal - net).toLocaleString() + ' remaining'}</div>
      <div style="font-size:0.68rem;line-height:1.6;color:var(--muted);margin-top:4px">Initial val: GHS ${(cost.initialValue || 0).toLocaleString()} · Paid: GHS ${(cost.pricePaid || 0).toLocaleString()} · Maint: GHS ${(cost.maintenanceCost || 0).toLocaleString()} · Total: GHS ${((cost.initialValue || 0) + (cost.pricePaid || 0) + (cost.maintenanceCost || 0)).toLocaleString()}</div>
      <div style="margin-top:6px;height:4px;border-radius:2px;background:rgba(255,255,255,0.08);overflow:hidden"><div style="height:100%;width:${progress}%;border-radius:2px;background:${brokenEven ? 'var(--green)' : 'var(--accent)'}"></div></div>
    </div>`;
  } else {
    el.innerHTML = '';
  }
  openModal('editDriverModal');
}

function submitDriver() {
  if (!isAdmin()) return showToast('View only — contact admin to edit', true);
  const name = document.getElementById('driverNameInput').value.trim();
  if (name) DATA.drivers[TRUCK_ID] = name;
  else delete DATA.drivers[TRUCK_ID];
  const initialValue = parseFloat(document.getElementById('truckInitialValueInput').value) || 0;
  const pricePaid = parseFloat(document.getElementById('truckPricePaidInput').value) || 0;
  const maintCost = parseFloat(document.getElementById('truckMaintCostInput').value) || 0;
  if (!DATA.truckCost) DATA.truckCost = {};
  if (initialValue > 0 || pricePaid > 0 || maintCost > 0) {
    DATA.truckCost[TRUCK_ID] = { initialValue, pricePaid, maintenanceCost: maintCost };
  } else {
    delete DATA.truckCost[TRUCK_ID];
  }
  if (DATA.purchasePrice) delete DATA.purchasePrice[TRUCK_ID];
  saveData();
  closeModal('editDriverModal');
  showToast('Truck settings updated');
  refreshAll();
}

function updateTruckTotalAmountPreview() {
  const initialValue = parseFloat(document.getElementById('truckInitialValueInput')?.value) || 0;
  const pricePaid = parseFloat(document.getElementById('truckPricePaidInput')?.value) || 0;
  const maintCost = parseFloat(document.getElementById('truckMaintCostInput')?.value) || 0;
  const total = initialValue + pricePaid + maintCost;
  const el = document.getElementById('truckTotalAmountPreview');
  if (el) {
    el.textContent = `Total Amount: GHS ${total.toLocaleString()} (init GHS ${initialValue.toLocaleString()} + paid GHS ${pricePaid.toLocaleString()} + maint GHS ${maintCost.toLocaleString()})`;
  }
}

// ─── SPREADSHEET LINKS ───────────────────────────────────────────────────────
function renderSpreadsheetLinks() {
  const years = getYears();
  const container = document.getElementById('spreadsheetLinks');
  if (!years.length) { container.innerHTML = '<span style="color:var(--muted);font-size:0.78rem">No years yet</span>'; return; }
  container.innerHTML = years.map(y =>
    `<a href="year.html?year=${y}" class="btn btn-secondary btn-sm" style="font-size:0.72rem;padding:4px 12px"><i class="fa-solid fa-table-cells"></i> ${y}</a>`
  ).join('');
}

// ─── MONTHLY DATA EDITOR (SCOPED TO TRUCK) ───────────────────────────────────
function openTruckMonthlyEditor() {
  const years = getYears();
  if (!years.length) return showToast('No years available — add a year first', true);
  const ySel = document.getElementById('truckMonthlyYear');
  ySel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
  ySel.value = years[years.length - 1];
  loadTruckMonthlyForm();
  openModal('truckMonthlyModal');
}

function loadTruckMonthlyForm() {
  const yr = parseInt(document.getElementById('truckMonthlyYear').value);
  const mSel = document.getElementById('truckMonthlyMonth');
  if (!DATA.monthly[yr]) DATA.monthly[yr] = { labels: [], gross: [], exp: [] };
  mSel.innerHTML = MONTH_NAMES.map((m, i) => {
    const idx = DATA.monthly[yr].labels.indexOf(m);
    const hasData = idx >= 0 && (DATA.monthly[yr].gross[idx] || DATA.monthly[yr].exp[idx]);
    return `<option value="${i}">${m}${hasData ? ' ●' : ''}</option>`;
  }).join('');
  mSel.value = '0';
  loadTruckMonthlyMonth();
}

function loadTruckMonthlyMonth() {
  const yr = parseInt(document.getElementById('truckMonthlyYear').value);
  const mIdx = parseInt(document.getElementById('truckMonthlyMonth').value);
  const m = MONTH_NAMES[mIdx];
  const d = DATA.monthly[yr];
  const idx = d.labels.indexOf(m);
  const gross = idx >= 0 ? d.gross[idx] : 0;
  const exp = idx >= 0 ? d.exp[idx] : 0;
  const net = gross - exp;

  const truckWeeks = truckData[yr] ? truckData[yr].weeks : 0;
  let html = `<div style="text-align:center;padding:8px 0">`;
  html += `<div style="font-size:1.6rem;font-weight:800;color:var(--accent);font-family:'Bebas Neue',sans-serif;letter-spacing:2px">${m} ${yr}</div>`;
  html += `<div style="font-size:0.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">${TRUCK_ID} — All Trucks Combined</div>`;
  html += `<div style="font-size:0.72rem;color:var(--green);margin-top:4px"><i class="fa-solid fa-truck" style="margin-right:4px"></i>${TRUCK_ID} worked <strong>${truckWeeks}</strong> week${truckWeeks !== 1 ? 's' : ''} in ${yr}</div>`;
  html += `</div>`;
  html += `<div class="form-row" style="gap:16px">`;
  html += `<div class="form-group" style="flex:1"><label><i class="fa-solid fa-arrow-trend-up" style="margin-right:4px;color:var(--accent)"></i>Gross Income (GHS)</label>`;
  html += `<input type="number" id="tMonthGross" value="${gross}" min="0"></div>`;
  html += `<div class="form-group" style="flex:1"><label><i class="fa-solid fa-arrow-trend-down" style="margin-right:4px;color:var(--red)"></i>Expenditure (GHS)</label>`;
  html += `<input type="number" id="tMonthExp" value="${exp}" min="0"></div>`;
  html += `</div>`;
  if (gross || exp) {
    html += `<div style="text-align:center;margin-top:8px;padding:8px;border-radius:6px;background:rgba(255,255,255,0.03);border:1px solid var(--border)">`;
    html += `<span style="font-size:0.7rem;color:var(--muted);text-transform:uppercase">Net: </span>`;
    html += `<span style="font-weight:700;color:${net >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(net)}</span></div>`;
  }
  document.getElementById('truckMonthlyForm').innerHTML = html;

  document.getElementById('tMonthPrevBtn').disabled = mIdx <= 0;
  document.getElementById('tMonthNextBtn').disabled = mIdx >= 11;
}

function saveTruckMonthlyMonth() {
  if (!isAdmin()) return showToast('View only — contact admin to edit', true);
  const yr = parseInt(document.getElementById('truckMonthlyYear').value);
  const mIdx = parseInt(document.getElementById('truckMonthlyMonth').value);
  const m = MONTH_NAMES[mIdx];
  const gross = parseFloat(document.getElementById('tMonthGross').value) || 0;
  const exp = parseFloat(document.getElementById('tMonthExp').value) || 0;
  const d = DATA.monthly[yr];
  const idx = d.labels.indexOf(m);
  if (gross || exp) {
    if (idx >= 0) {
      d.gross[idx] = gross; d.exp[idx] = exp;
    } else {
      let insertAt = d.labels.length;
      for (let i = 0; i < d.labels.length; i++) {
        if (MONTH_NAMES.indexOf(d.labels[i]) > MONTH_NAMES.indexOf(m)) { insertAt = i; break; }
      }
      d.labels.splice(insertAt, 0, m); d.gross.splice(insertAt, 0, gross); d.exp.splice(insertAt, 0, exp);
    }
  } else if (idx >= 0) {
    d.labels.splice(idx, 1); d.gross.splice(idx, 1); d.exp.splice(idx, 1);
  }
  saveData();
  showToast(`${m} ${yr} saved`);
  loadTruckMonthlyForm();
  refreshAll();
}

function truckMonthlyNav(dir) {
  const sel = document.getElementById('truckMonthlyMonth');
  const newVal = parseInt(sel.value) + dir;
  if (newVal >= 0 && newVal <= 11) { sel.value = newVal; loadTruckMonthlyMonth(); }
}

// ─── WEEKLY DATA EDITOR (SCOPED TO TRUCK) ────────────────────────────────────
function openTruckWeeklyEditor() {
  const years = getYears();
  if (!years.length) return showToast('No years available — add a year first', true);
  const ySel = document.getElementById('truckWeeklyYear');
  ySel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
  ySel.value = years[years.length - 1];
  loadTruckWeeklyForm();
  openModal('truckWeeklyModal');
}

function loadTruckWeeklyForm() {
  const yr = parseInt(document.getElementById('truckWeeklyYear').value);
  if (!DATA.weekly) DATA.weekly = {};
  if (!DATA.weekly[yr]) DATA.weekly[yr] = {};
  if (!DATA.weekly[yr][TRUCK_ID]) DATA.weekly[yr][TRUCK_ID] = {};
  const totalWeeks = getISOWeeksInYear(yr);
  const wd = DATA.weekly[yr][TRUCK_ID];

  const wSel = document.getElementById('truckWeeklyWeek');
  const prevVal = wSel.value;
  wSel.innerHTML = '';
  for (let w = 1; w <= totalWeeks; w++) {
    const month = weekToMonth(w, yr);
    const wk = wd[w];
    const hasData = wk && (wk.gross || wk.exp || (wk.days && wk.days.length));
    wSel.innerHTML += `<option value="${w}">Week ${w} — ${month}${hasData ? ' ●' : ''}</option>`;
  }
  if (prevVal && parseInt(prevVal) <= totalWeeks) wSel.value = prevVal;
  else wSel.value = '1';

  const truckWeeks = truckData[yr] ? truckData[yr].weeks : 0;
  document.getElementById('truckWeeklyInfo').innerHTML = `${totalWeeks} weeks in ${yr} · <span style="color:var(--green)"><i class="fa-solid fa-truck"></i> ${TRUCK_ID}: ${truckWeeks} week${truckWeeks !== 1 ? 's' : ''} worked</span>`;
  loadTruckWeeklyWeek();
}

function loadTruckWeeklyWeek() {
  const yr = parseInt(document.getElementById('truckWeeklyYear').value);
  const w = parseInt(document.getElementById('truckWeeklyWeek').value);
  const totalWeeks = getISOWeeksInYear(yr);
  if (!DATA.weekly[yr]) DATA.weekly[yr] = {};
  if (!DATA.weekly[yr][TRUCK_ID]) DATA.weekly[yr][TRUCK_ID] = {};
  const wk = DATA.weekly[yr][TRUCK_ID][w] || {};
  const month = weekToMonth(w, yr);
  const days = getWeekDates(w, yr);
  const savedDays = wk.days || [];

  let html = `<div style="text-align:center;padding:12px 0 6px">`;
  html += `<div style="font-size:1.8rem;font-weight:800;color:var(--accent);font-family:'Bebas Neue',sans-serif;letter-spacing:2px"><i class="fa-solid fa-calendar-week" style="margin-right:6px"></i>Week ${w}</div>`;
  html += `<div style="font-size:0.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">${TRUCK_ID} · ${month} ${yr} · Week ${w} of ${totalWeeks}</div>`;
  html += `</div>`;

  html += `<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:16px 0">`;
  days.forEach((d, di) => {
    const isSelected = savedDays.includes(di);
    html += `<label style="display:flex;flex-direction:column;align-items:center;padding:10px 4px;border-radius:8px;cursor:pointer;
      background:${isSelected ? 'rgba(245,166,35,0.15)' : 'rgba(255,255,255,0.03)'};
      border:1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'};transition:all 0.15s" class="day-label">
      <span style="font-weight:700;color:${isSelected ? 'var(--accent)' : 'var(--muted)'};font-size:0.68rem;text-transform:uppercase">${d.name}</span>
      <span style="font-weight:700;color:${isSelected ? 'var(--text)' : 'var(--label)'};font-size:1.1rem;margin:4px 0">${d.date}</span>
      <span style="color:var(--muted);font-size:0.62rem">${d.month}</span>
      <input type="checkbox" class="twk-day" data-week="${w}" data-day="${di}" ${isSelected ? 'checked' : ''} style="display:none" onchange="toggleTruckDayStyle(this)">
    </label>`;
  });
  html += `</div>`;

  html += `<div style="text-align:center;margin-bottom:12px"><span style="font-size:0.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px">Working days: </span>`;
  html += `<span id="tDayCount${w}" style="font-weight:700;color:var(--green);font-size:0.9rem">${savedDays.length}/6</span></div>`;

  html += `<div class="form-row" style="gap:16px">`;
  html += `<div class="form-group" style="flex:1"><label><i class="fa-solid fa-arrow-trend-up" style="margin-right:4px;color:var(--accent)"></i>Gross Income (GHS)</label>`;
  html += `<input type="number" id="tWeeklyGross" data-week="${w}" value="${wk.gross || 0}" min="0" style="font-size:1.1rem;font-weight:600"></div>`;
  html += `<div class="form-group" style="flex:1"><label><i class="fa-solid fa-arrow-trend-down" style="margin-right:4px;color:var(--red)"></i>Expenditure (GHS)</label>`;
  html += `<input type="number" id="tWeeklyExp" data-week="${w}" value="${wk.exp || 0}" min="0" style="font-size:1.1rem;font-weight:600"></div>`;
  html += `</div>`;

  if (wk.gross || wk.exp) {
    const net = (wk.gross || 0) - (wk.exp || 0);
    html += `<div style="text-align:center;margin-top:8px;padding:8px;border-radius:6px;background:rgba(255,255,255,0.03);border:1px solid var(--border)">`;
    html += `<span style="font-size:0.7rem;color:var(--muted);text-transform:uppercase">Net: </span>`;
    html += `<span style="font-weight:700;color:${net >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(net)}</span></div>`;
  }

  document.getElementById('truckWeeklyForm').innerHTML = html;
  document.getElementById('tWeekPrevBtn').disabled = w <= 1;
  document.getElementById('tWeekNextBtn').disabled = w >= totalWeeks;

  document.querySelectorAll('#truckWeeklyForm .day-label').forEach(label => {
    label.addEventListener('click', function(e) {
      if (e.target.tagName === 'INPUT') return;
      const cb = this.querySelector('input[type=checkbox]');
      cb.checked = !cb.checked;
      toggleTruckDayStyle(cb);
    });
  });
}

function truckWeeklyNav(dir) {
  const sel = document.getElementById('truckWeeklyWeek');
  const newVal = parseInt(sel.value) + dir;
  const max = sel.options.length;
  if (newVal >= 1 && newVal <= max) { sel.value = newVal; loadTruckWeeklyWeek(); }
}

function saveTruckWeeklyWeek() {
  if (!isAdmin()) return showToast('View only — contact admin to edit', true);
  const yr = parseInt(document.getElementById('truckWeeklyYear').value);
  const w = parseInt(document.getElementById('truckWeeklyWeek').value);
  if (!DATA.weekly) DATA.weekly = {};
  if (!DATA.weekly[yr]) DATA.weekly[yr] = {};
  if (!DATA.weekly[yr][TRUCK_ID]) DATA.weekly[yr][TRUCK_ID] = {};

  const gross = parseFloat(document.getElementById('tWeeklyGross').value) || 0;
  const exp = parseFloat(document.getElementById('tWeeklyExp').value) || 0;
  const dayCheckboxes = document.querySelectorAll(`.twk-day[data-week="${w}"]`);
  const days = [...dayCheckboxes].map((c, i) => c.checked ? i : -1).filter(i => i >= 0);

  if (gross || exp || days.length) {
    DATA.weekly[yr][TRUCK_ID][w] = { gross, exp, days };
  } else {
    delete DATA.weekly[yr][TRUCK_ID][w];
  }

  if (truckData[yr]) touchEntryMeta(TRUCK_ID, yr, false);
  aggregateWeeklyToMonthly(yr);
  saveData();
  showToast(`Week ${w} saved for ${TRUCK_ID}`);
  loadTruckWeeklyForm();
  refreshAll();
}

function toggleTruckDayStyle(cb) {
  const w = cb.dataset.week;
  const label = cb.closest('.day-label');
  if (cb.checked) {
    label.style.background = 'rgba(245,166,35,0.15)';
    label.style.borderColor = 'var(--accent)';
    label.querySelectorAll('span')[0].style.color = 'var(--accent)';
    label.querySelectorAll('span')[1].style.color = 'var(--text)';
  } else {
    label.style.background = 'rgba(255,255,255,0.03)';
    label.style.borderColor = 'var(--border)';
    label.querySelectorAll('span')[0].style.color = 'var(--muted)';
    label.querySelectorAll('span')[1].style.color = 'var(--label)';
  }
  const allDays = document.querySelectorAll(`.twk-day[data-week="${w}"]`);
  const checked = [...allDays].filter(c => c.checked).length;
  const counter = document.getElementById(`tDayCount${w}`);
  if (counter) counter.textContent = `${checked}/6`;
}

// ─── DELETE TRUCK ────────────────────────────────────────────────────────────
function openDeleteTruckModal() {
  document.getElementById('deleteTruckName').textContent = `${TRUCK_ID} (${DATA.drivers[TRUCK_ID] || 'No driver'})`;
  openModal('deleteTruckModal');
}

function confirmDeleteTruck() {
  if (!isAdmin()) return showToast('View only — contact admin to edit', true);
  trashItem('truck', TRUCK_ID, { id: TRUCK_ID, years: { ...truckData }, driver: DATA.drivers[TRUCK_ID] || '', entryMeta: DATA.entryMeta?.[TRUCK_ID] ? JSON.parse(JSON.stringify(DATA.entryMeta[TRUCK_ID])) : {} });
  delete DATA.trucks[TRUCK_ID];
  delete DATA.drivers[TRUCK_ID];
  clearEntryMeta(TRUCK_ID);
  if (DATA.endOfTerm) delete DATA.endOfTerm[TRUCK_ID];
  // Remove weekly data for this truck
  if (DATA.weekly) {
    for (const yr in DATA.weekly) {
      if (DATA.weekly[yr][TRUCK_ID]) delete DATA.weekly[yr][TRUCK_ID];
    }
  }
  saveData();
  closeModal('deleteTruckModal');
  showToast('Truck deleted — recoverable for 30 days');
  setTimeout(() => window.location.href = '/index.html', 1200);
}

// ─── REFRESH ALL ─────────────────────────────────────────────────────────────
function refreshAll() {
  renderHeader();
  renderKPIs();
  renderYearlyChart();
  renderEffChart();
  renderNetTrend();
  renderTable();
  renderSpreadsheetLinks();
}

// ─── INIT ────────────────────────────────────────────────────────────────────
refreshAll();

['truckInitialValueInput', 'truckPricePaidInput', 'truckMaintCostInput'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', updateTruckTotalAmountPreview);
});
