import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import {
  catalog,
  createRole,
  defaultPassword,
  deleteAssessment,
  deleteRole,
  findUserById,
  findUserByUsername,
  getAssessment,
  listAssessments,
  publicConfig,
  publicUser,
  saveAssessment,
  setPasswordHash,
  updateAssessment,
  updateRole,
} from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile();

const PORT = Number(process.env.PORT) || 3001;
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'change-this-dev-session-secret';
const isProd = process.env.NODE_ENV === 'production';
const COOKIE = 'gate_session';
const sessions = new Map();

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}

function createSession(userId) {
  const id = crypto.randomBytes(24).toString('hex');
  sessions.set(id, { userId, createdAt: Date.now() });
  return id;
}

function readSession(req) {
  const raw = req.cookies?.[COOKIE];
  if (!raw) return null;
  const [id, mac] = String(raw).split('.');
  if (!id || !mac || sign(id) !== mac) return null;
  const session = sessions.get(id);
  if (!session) return null;
  return { id, ...session };
}

function setSessionCookie(res, sessionId) {
  res.cookie(COOKIE, `${sessionId}.${sign(sessionId)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 14 * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

function requireAuth(req, res, next) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: 'Sign in required' });
  const user = findUserById(session.userId);
  if (!user) return res.status(401).json({ error: 'Sign in required' });
  req.user = user;
  req.sessionId = session.id;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.access !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const user = findUserByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const sessionId = createSession(user.id);
  setSessionCookie(res, sessionId);
  res.json({ user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
  const session = readSession(req);
  if (session) sessions.delete(session.id);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post('/api/password', requireAuth, (req, res) => {
  const current = String(req.body?.currentPassword || '');
  const next = String(req.body?.newPassword || '');
  if (next.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  if (!bcrypt.compareSync(current, req.user.passwordHash)) {
    return res.status(400).json({ error: 'Current password is wrong' });
  }
  setPasswordHash(req.user.id, bcrypt.hashSync(next, 10));
  res.json({ ok: true });
});

app.get('/api/config', requireAuth, (_req, res) => {
  res.json(publicConfig());
});

app.get('/api/catalog', requireAuth, (_req, res) => {
  res.json(catalog());
});

app.get('/api/assessments', requireAuth, (_req, res) => {
  res.json({ assessments: listAssessments() });
});

app.get('/api/assessments/:id', requireAuth, (req, res) => {
  const assessment = getAssessment(req.params.id);
  if (!assessment) return res.status(404).json({ error: 'Not found' });
  res.json({ assessment });
});

app.post('/api/assessments', requireAuth, requireAdmin, (req, res) => {
  res.status(201).json({ assessment: saveAssessment(req.body || {}, req.user.username) });
});

app.put('/api/assessments/:id', requireAuth, requireAdmin, (req, res) => {
  const assessment = updateAssessment(req.params.id, req.body || {}, req.user.username);
  if (!assessment) return res.status(404).json({ error: 'Not found' });
  res.json({ assessment });
});

app.delete('/api/assessments/:id', requireAuth, requireAdmin, (req, res) => {
  if (!deleteAssessment(req.params.id)) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

app.get('/api/roles', requireAuth, (_req, res) => {
  res.json({ roles: catalog().roles });
});

app.post('/api/roles', requireAuth, requireAdmin, (req, res) => {
  try {
    res.status(201).json({ role: createRole(req.body || {}) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/roles/:id', requireAuth, requireAdmin, (req, res) => {
  const role = updateRole(req.params.id, req.body || {});
  if (!role) return res.status(404).json({ error: 'Role not found' });
  res.json({ role });
});

app.delete('/api/roles/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    if (!deleteRole(req.params.id)) return res.status(404).json({ error: 'Role not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

if (isProd) {
  const dist = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(dist, 'index.html'));
    });
  }
}

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`GATE assessment API on http://127.0.0.1:${PORT}`);
  console.log(`Default password (first seed only): ${defaultPassword()}`);
});
