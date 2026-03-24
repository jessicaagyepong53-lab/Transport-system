const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3000;
const USERS_FILE = path.join(__dirname, 'users.json');
const ADMIN_EMAILS = [
  'rnogardiner@gmail.com',
  'jessicaagyepong53@gmail.com'
];

const MIME_TYPES = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

// ─── User Storage ────────────────────────────────────────────────────────────
function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch { return []; }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// ─── JSON body parser ────────────────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e5) { req.destroy(); reject(new Error('Body too large')); }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ─── Server ──────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // ── API: Sign Up ───────────────────────────────────────────────────────────
  if (req.method === 'POST' && urlPath === '/api/signup') {
    try {
      const { email } = await parseBody(req);
      if (!email || typeof email !== 'string') return json(res, 400, { error: 'Email required' });
      const clean = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return json(res, 400, { error: 'Invalid email' });

      const users = loadUsers();
      if (users.find(u => u.email === clean)) return json(res, 409, { error: 'Email already registered' });

      const role = ADMIN_EMAILS.includes(clean) ? 'admin' : 'viewer';
      const token = crypto.randomBytes(32).toString('hex');
      users.push({ email: clean, role, token });
      saveUsers(users);
      return json(res, 201, { token, email: clean, role });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }

  // ── API: Login ─────────────────────────────────────────────────────────────
  if (req.method === 'POST' && urlPath === '/api/login') {
    try {
      const { email } = await parseBody(req);
      if (!email || typeof email !== 'string') return json(res, 400, { error: 'Email required' });
      const clean = email.trim().toLowerCase();

      const users = loadUsers();
      const user = users.find(u => u.email === clean);
      if (!user) return json(res, 404, { error: 'Email not found — please sign up first' });

      // Issue a fresh token on each login
      user.token = crypto.randomBytes(32).toString('hex');
      saveUsers(users);
      return json(res, 200, { token: user.token, email: user.email, role: user.role });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }

  // ── API: Me (validate token) ───────────────────────────────────────────────
  if (req.method === 'GET' && urlPath === '/api/me') {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return json(res, 401, { error: 'Not authenticated' });

    const users = loadUsers();
    const user = users.find(u => u.token === token);
    if (!user) return json(res, 401, { error: 'Invalid token' });
    return json(res, 200, { email: user.email, role: user.role });
  }

  // ── Block direct access to users.json ──────────────────────────────────────
  if (urlPath === '/users.json') {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // ── Redirect root to login.html ────────────────────────────────────────────
  let filePath = urlPath === '/' ? '/pages/login.html' : urlPath;

  // Prevent directory traversal
  const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
  const fullPath = path.join(__dirname, safePath);

  if (!fullPath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
