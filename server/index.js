import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import {
  catalog,
  createRole,
  deleteAssessment,
  deleteRole,
  findUserById,
  findUserByUsername,
  getAssessment,
  getEmployeeSpecs,
  listAssessments,
  personVisibleTo,
  publicConfig,
  publicUser,
  recordVisibleTo,
  saveAssessment,
  saveEmployeeSpecs,
  setPasswordHash,
  updateAssessment,
  updateRole,
} from './store.js';
import { generateTeamPdfBuffer, teamPdfFallbackPath } from './team-pdf.js';

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
const HTTP_PORT = Number(process.env.HTTP_PORT) || 3080;
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'change-this-dev-session-secret';
const isProd = process.env.NODE_ENV === 'production';
const useHttps = isProd && process.env.HTTPS === 'true';
const proxyTls = process.env.PROXY_TLS === 'true';
const terminateAtProxy = useHttps && proxyTls;
const bindHost = process.env.BIND_HOST || (terminateAtProxy ? '127.0.0.1' : '0.0.0.0');
const COOKIE = 'gate_session';
const sessions = new Map();
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  const len = Math.max(bufA.length, bufB.length, 1);
  const padA = Buffer.alloc(len);
  const padB = Buffer.alloc(len);
  bufA.copy(padA);
  bufB.copy(padB);
  return bufA.length === bufB.length && crypto.timingSafeEqual(padA, padB);
}

function createSession(userId) {
  const id = crypto.randomBytes(24).toString('hex');
  sessions.set(id, { userId, createdAt: Date.now() });
  return id;
}

function invalidateUserSessions(userId) {
  for (const [id, session] of sessions) {
    if (session.userId === userId) sessions.delete(id);
  }
}

function loginKey(req, username) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return `${ip}\n${String(username || '').trim().toLowerCase()}`;
}

function loginRateLimited(req, username) {
  const key = loginKey(req, username);
  const now = Date.now();
  const rec = loginAttempts.get(key);
  if (!rec || rec.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > LOGIN_MAX_ATTEMPTS;
}

function clearLoginFailures(req, username) {
  loginAttempts.delete(loginKey(req, username));
}

function readSession(req) {
  const raw = req.cookies?.[COOKIE];
  if (!raw) return null;
  const [id, mac] = String(raw).split('.');
  if (!id || !mac || !timingSafeEqualStr(sign(id), mac)) return null;
  const session = sessions.get(id);
  if (!session) return null;
  return { id, ...session };
}

function setSessionCookie(res, sessionId) {
  res.cookie(COOKIE, `${sessionId}.${sign(sessionId)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: useHttps,
    path: '/',
    maxAge: 14 * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure: useHttps });
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
if (terminateAtProxy) {
  app.set('trust proxy', 1);
}
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (loginRateLimited(req, username)) {
    return res.status(429).json({ error: 'Too many sign-in attempts. Try again later.' });
  }
  const user = findUserByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  clearLoginFailures(req, username);
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
  if (req.user.access === 'admin') sessions.clear();
  else invalidateUserSessions(req.user.id);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/config', requireAuth, (_req, res) => {
  res.json(publicConfig());
});

app.get('/api/catalog', requireAuth, (_req, res) => {
  res.json(catalog());
});

app.get('/api/specs', requireAuth, (req, res) => {
  const person = String(req.query.person || '').trim();
  if (!person) return res.status(400).json({ error: 'person is required' });
  if (!personVisibleTo(person, req.user)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json({ specs: getEmployeeSpecs(person, req.query.role) });
});

app.put('/api/specs', requireAuth, requireAdmin, (req, res) => {
  const person = String(req.body?.person || req.query.person || '').trim();
  try {
    res.json({ specs: saveEmployeeSpecs(person, req.body || {}) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/assessments', requireAuth, (req, res) => {
  res.json({ assessments: listAssessments(req.user) });
});

app.get('/api/assessments/:id', requireAuth, (req, res) => {
  const assessment = getAssessment(req.params.id);
  if (!assessment || !recordVisibleTo(assessment, req.user)) {
    return res.status(404).json({ error: 'Not found' });
  }
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

app.get('/api/reports/team.pdf', requireAuth, requireAdmin, (_req, res) => {
  const sendPdf = (buf) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="GATE-team-progress.pdf"');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  };
  try {
    sendPdf(generateTeamPdfBuffer());
  } catch (err) {
    console.error('team PDF generation failed:', err);
    const fallback = teamPdfFallbackPath();
    if (fallback) {
      try {
        sendPdf(fs.readFileSync(fallback));
        return;
      } catch (readErr) {
        console.error('team PDF fallback read failed:', readErr);
      }
    }
    res.status(500).json({ error: err.message || 'Could not generate team report' });
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use('/data', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
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

function resolveProjectPath(file) {
  return path.isAbsolute(file) ? file : path.join(__dirname, '..', file);
}

function loadTlsOptions() {
  const certFile = resolveProjectPath(process.env.TLS_CERT || 'certs/cert.pem');
  const keyFile = resolveProjectPath(process.env.TLS_KEY || 'certs/key.pem');
  if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
    throw new Error(`HTTPS is enabled but TLS files are missing (${certFile}, ${keyFile})`);
  }
  return {
    cert: fs.readFileSync(certFile),
    key: fs.readFileSync(keyFile),
  };
}

function redirectHttpToHttps(req, res) {
  const host = String(req.headers.host || '').split(':')[0] || '127.0.0.1';
  const portSuffix = PORT === 443 ? '' : `:${PORT}`;
  const location = `https://${host}${portSuffix}${req.url || '/'}`;
  res.writeHead(301, { Location: location });
  res.end();
}

if (terminateAtProxy) {
  app.listen(PORT, bindHost, () => {
    console.log(`GATE assessment API on http://${bindHost}:${PORT} (TLS terminated at proxy)`);
  });
} else if (useHttps) {
  https.createServer(loadTlsOptions(), app).listen(PORT, bindHost, () => {
    console.log(`GATE assessment API on https://${bindHost}:${PORT}`);
  });
  if (HTTP_PORT > 0) {
    http.createServer(redirectHttpToHttps).listen(HTTP_PORT, '0.0.0.0', () => {
      console.log(`HTTP redirect to HTTPS on port ${HTTP_PORT}`);
    });
  }
} else {
  app.listen(PORT, bindHost, () => {
    console.log(`GATE assessment API on http://${bindHost}:${PORT}`);
  });
}
