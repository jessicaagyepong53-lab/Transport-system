// ─── AUTH UTILITIES ───────────────────────────────────────────────────────────
// Loaded on every protected page BEFORE the page-specific script.

function getAuth() {
  try { return JSON.parse(localStorage.getItem('transport_auth')); }
  catch { return null; }
}

function isAdmin() {
  const auth = getAuth();
  return auth && auth.role === 'admin';
}

function logout() {
  localStorage.removeItem('transport_auth');
  window.location.href = '/pages/login.html';
}

async function requireAuth() {
  const auth = getAuth();
  if (!auth || !auth.token) { window.location.href = '/pages/login.html'; return; }

  try {
    const resp = await fetch('/api/me', {
      headers: { 'Authorization': 'Bearer ' + auth.token }
    });
    if (!resp.ok) {
      localStorage.removeItem('transport_auth');
      window.location.href = '/pages/login.html';
      return;
    }
    const data = await resp.json();
    // Sync role in case it changed server-side
    auth.role = data.role;
    localStorage.setItem('transport_auth', JSON.stringify(auth));
  } catch {
    // Network error — allow offline use but don't redirect
  }

  hideIfViewer();
  renderUserBadge();
}

function hideIfViewer() {
  if (isAdmin()) return;
  document.querySelectorAll('[data-admin-only]').forEach(el => {
    el.style.display = 'none';
  });
}

function renderUserBadge() {
  const auth = getAuth();
  if (!auth) return;

  // Remove existing badge if re-rendered
  const existing = document.getElementById('userBadge');
  if (existing) existing.remove();

  const badge = document.createElement('div');
  badge.id = 'userBadge';
  badge.style.cssText = 'position:fixed;top:14px;right:18px;z-index:9999;display:flex;align-items:center;gap:10px;background:#1a1f2b;border:1px solid #252d3d;border-radius:10px;padding:8px 14px;font-family:"DM Sans",sans-serif;font-size:0.78rem;box-shadow:0 4px 20px rgba(0,0,0,0.4);';

  const roleBg = auth.role === 'admin' ? 'rgba(245,166,35,0.18)' : 'rgba(74,158,255,0.18)';
  const roleColor = auth.role === 'admin' ? '#f5a623' : '#4a9eff';
  const roleLabel = auth.role === 'admin' ? 'ADMIN' : 'VIEWER';

  badge.innerHTML = `
    <span style="color:#9aa4b8;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${auth.email}</span>
    <span style="font-size:0.65rem;padding:2px 7px;border-radius:4px;background:${roleBg};color:${roleColor};font-weight:700;letter-spacing:0.5px">${roleLabel}</span>
    <button onclick="logout()" style="display:flex;align-items:center;gap:6px;background:rgba(224,68,58,0.15);border:1px solid rgba(224,68,58,0.3);color:#e0443a;border-radius:5px;padding:3px 8px;cursor:pointer;font-family:inherit;font-size:0.72rem;font-weight:600" title="Logout"><i class="fa-solid fa-right-from-bracket"></i><span>Logout</span></button>
  `;

  document.body.appendChild(badge);
}

// Auto-run on page load
requireAuth();