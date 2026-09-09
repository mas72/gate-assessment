import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import {
  TEAM_USERS,
  SCORE_MAX,
  FIVE_WEIGHTS,
} from './seed-data.js';
import {
  defaultLevels,
  defaultRoles,
  defaultScoring,
  defaultSharedDomains,
  defaultUniversalGates,
} from './seedDefaults.js';
import {
  cloneDefaultSpecs,
  fiveFromSpecScores,
  normalizeSpecCatalog,
} from '../src/metric-specs.js';

function loadEnvFile() {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

// v3 raised the scoring ceiling from 5 to 7 so it matches the L1-L7 ladder.
// Recorded scores are left as entered; only the scale and level bars change.
const STORE_VERSION = 3;

const ICON = {
  hex: '⬡',
  diamond: '◈',
  loop: '⟳',
  net: '▣',
  wrench: '⚙',
  check: '✓',
};

export function defaultPassword() {
  return process.env.ADMIN_PASSWORD || process.env.DEFAULT_PASSWORD || 'gate-admin-change-me';
}

function now() {
  return new Date().toISOString();
}

function normalizePeriod(raw) {
  let s = String(raw || '').trim();
  s = s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  s = s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  s = s.replace(/\s+/g, ' ');
  const glued = s.match(/^Q(\d)(\d{4})$/i);
  if (glued) return `Q${glued[1]} ${glued[2]}`;
  const spaced = s.match(/^Q\s*(\d+)\s+(\d{4})$/i);
  if (spaced) return `Q${spaced[1]} ${spaced[2]}`;
  const bare = s.match(/^Q\s*(\d+)$/i);
  if (bare) return `Q${bare[1]} 1405`;
  return s;
}

function slugify(label) {
  return (
    String(label)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || `role-${Date.now()}`
  );
}

function seedStore() {
  const passwordHash = bcrypt.hashSync(defaultPassword(), 10);
  return {
    version: STORE_VERSION,
    users: TEAM_USERS.map((u, i) => ({
      id: i + 1,
      username: u.username,
      displayName: u.displayName,
      title: u.title,
      access: u.access,
      passwordHash,
      createdAt: now(),
    })),
    roles: defaultRoles(),
    domains: defaultSharedDomains(),
    levels: defaultLevels(),
    scoring: defaultScoring(),
    universalGates: defaultUniversalGates(),
    assessments: [],
    employeeSpecs: {},
    nextUserId: TEAM_USERS.length + 1,
    nextAssessmentId: 1,
  };
}

function looksLikeV2(data) {
  return Boolean(data?.roles?.[0]?.name && data?.domains && data?.levels?.[0]?.promotionGates);
}

function backupStore(tag) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const target = path.join(DATA_DIR, `store.backup-${tag}-${stamp}.json`);
  if (!fs.existsSync(target)) fs.copyFileSync(STORE_PATH, target);
  return target;
}

const ARCHIVE_METRICS = ['impact', 'execution', 'ownership', 'collaboration', 'growth'];

function restoreOriginalScores(assessment) {
  const originalScores = assessment.scoresOriginal?.scores;
  if (originalScores && typeof originalScores === 'object') {
    assessment.scores = { ...originalScores };
  }
  delete assessment.scoresOriginal;

  const archive = assessment.archive;
  if (!archive) return;
  const original = archive.original;
  if (original && typeof original === 'object') {
    for (const key of [...ARCHIVE_METRICS, 'excelFinal', 'computedFinal']) {
      if (typeof original[key] === 'number') archive[key] = original[key];
    }
  }
  delete archive.original;
  delete archive.rescaledFrom;
  delete archive.rescaledAt;
  delete archive.scoreMax;
}

function migrateToScoreMax(data) {
  data.scoring = data.scoring || defaultScoring();
  data.scoring.max = SCORE_MAX;
  data.scoring.scale = defaultScoring().scale;
  data.scoring.verdicts = defaultScoring().verdicts;

  const expectations = defaultLevels();
  for (const level of data.levels || []) {
    const fresh = expectations.find((l) => l.id === level.id);
    if (fresh) level.expected = fresh.expected;
  }

  for (const assessment of data.assessments || []) {
    restoreOriginalScores(assessment);
  }

  data.version = STORE_VERSION;
  return data;
}

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    const seeded = seedStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(seeded, null, 2));
    return seeded;
  }
  const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  if (!looksLikeV2(data)) {
    const seeded = seedStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(seeded, null, 2));
    return seeded;
  }
  data.employeeSpecs = data.employeeSpecs && typeof data.employeeSpecs === 'object' ? data.employeeSpecs : {};
  const needsScale = Number(data.version) < STORE_VERSION || data.scoring?.max !== SCORE_MAX;
  const needsRestore = (data.assessments || []).some(
    (a) => a.scoresOriginal || a.archive?.rescaledFrom || a.archive?.original,
  );
  if (needsScale || needsRestore) {
    const backup = backupStore(needsRestore ? 'restore-original' : 'pre-scale7');
    const migrated = migrateToScoreMax(data);
    migrated.employeeSpecs = data.employeeSpecs || {};
    fs.writeFileSync(STORE_PATH, JSON.stringify(migrated, null, 2));
    console.log(
      `Store on 1-${SCORE_MAX} scale${needsRestore ? ' · original scores restored' : ''} · previous file kept at ${path.basename(backup)}`,
    );
    return migrated;
  }
  return data;
}

let cache = load();

function persist() {
  const tmp = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, STORE_PATH);
}

function toCatalogRole(role) {
  return {
    id: role.id,
    slug: role.id,
    label: role.name,
    icon: ICON[role.icon] || role.icon || '●',
    metrics: role.metrics,
  };
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    title: user.title,
    isAdmin: user.access === 'admin',
    access: user.access,
  };
}

export function findUserByUsername(username) {
  return cache.users.find((u) => u.username.toLowerCase() === String(username).toLowerCase());
}

export function findUserById(id) {
  return cache.users.find((u) => u.id === id);
}

export function setPasswordHash(userId, hash) {
  const user = findUserById(userId);
  if (!user) return false;
  user.passwordHash = hash;
  persist();
  return true;
}

export function publicConfig() {
  return {
    roles: cache.roles,
    domains: cache.domains,
    levels: cache.levels,
    scoring: cache.scoring,
    universalGates: cache.universalGates,
  };
}

export function catalog() {
  return {
    roles: cache.roles.map(toCatalogRole),
    sharedDomains: (cache.domains || []).map((d) => ({
      id: d.id,
      title: d.title,
      weightKey: d.id,
      metrics: d.metrics,
    })),
    levels: (cache.levels || []).map((l) => ({
      id: l.id,
      summary: l.summary,
      gates: l.promotionGates || l.gates || [],
    })),
    weights: {
      technical: 0.5,
      agile: 0.15,
      soft: 0.15,
      delivery: 0.1,
      growth: 0.1,
    },
    levelExpectations: Object.fromEntries((cache.levels || []).map((l) => [l.id, l.expected])),
    scoreMax: cache.scoring?.max || SCORE_MAX,
    scale: cache.scoring?.scale || [],
    verdicts: cache.scoring?.verdicts || [],
    universalPromotion: cache.universalGates || [],
  };
}

function normalizeMetrics(metrics) {
  if (!Array.isArray(metrics)) return [];
  return metrics.map((m, i) => {
    const levels = {};
    for (let n = 1; n <= 7; n += 1) {
      levels[n] = String(m.levels?.[n] ?? m.levels?.[String(n)] ?? '').trim();
    }
    const id =
      String(m.id || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-') || `metric-${i + 1}`;
    return {
      id,
      title: String(m.title || '').trim(),
      description: String(m.description || '').trim(),
      levels,
    };
  });
}

export function createRole(payload) {
  const name = String(payload.name || payload.label || '').trim();
  if (!name) throw new Error('Role name is required');
  let id = slugify(payload.id || payload.slug || name);
  if (cache.roles.some((r) => r.id === id)) id = `${id}-${Date.now()}`;
  const role = {
    id,
    name,
    icon: String(payload.icon || 'hex').slice(0, 20),
    technicalWeight: Number(payload.technicalWeight) || 0.5,
    metrics: normalizeMetrics(payload.metrics || []),
    createdAt: now(),
    updatedAt: now(),
  };
  cache.roles.push(role);
  persist();
  return toCatalogRole(role);
}

export function updateRole(id, payload) {
  const role = cache.roles.find((r) => String(r.id) === String(id));
  if (!role) return null;
  if (payload.name != null || payload.label != null) {
    role.name = String(payload.name || payload.label).trim() || role.name;
  }
  if (payload.icon != null) role.icon = String(payload.icon).slice(0, 20);
  if (payload.technicalWeight != null) {
    role.technicalWeight = Number(payload.technicalWeight) || role.technicalWeight;
  }
  if (Array.isArray(payload.metrics)) role.metrics = normalizeMetrics(payload.metrics);
  role.updatedAt = now();
  persist();
  return toCatalogRole(role);
}

export function deleteRole(id) {
  if (cache.roles.length <= 1) throw new Error('Keep at least one role');
  const idx = cache.roles.findIndex((r) => String(r.id) === String(id));
  if (idx === -1) return false;
  cache.roles.splice(idx, 1);
  persist();
  return true;
}

function specPersonKey(a) {
  return String(a?.username || a?.name || '')
    .trim()
    .toLowerCase();
}

const USER_ALIASES = {
  'ali.dehghan': ['Alireza Dehghan', 'Ali Dehghan'],
  'a.ghasemi': ['Ali Ghasemi', 'A. Ghasemi'],
  'f.ahmadi': ['Fatemeh Ahmadi', 'F. Ahmadi'],
  'a.pahlavanian': ['Abolfazl Pahlavanian', 'A. Pahlavanian'],
  'hamed.dehghan': ['Hamed Dehghan'],
  'hosseini.motlagh': ['Laya Hosseini Motlagh', 'Hosseini Motlagh'],
  'm.noeiaval': ['Mohsen Noeiaval', 'M. Noeiaval'],
  'm.dehghan': ['Masoud Dehghan'],
};

function identityKeys(user) {
  const username = String(user?.username || '').trim().toLowerCase();
  const aliases = USER_ALIASES[username] || [];
  return [user?.username, user?.displayName, ...aliases]
    .map((s) => String(s || '').trim().toLowerCase())
    .filter(Boolean);
}

export function recordVisibleTo(record, user) {
  if (!user) return false;
  if (user.access === 'admin') return true;
  const keys = new Set(identityKeys(user));
  const username = String(record?.username || '').trim().toLowerCase();
  const name = String(record?.name || '').trim().toLowerCase();
  return (username && keys.has(username)) || (name && keys.has(name));
}

export function personVisibleTo(personKey, user) {
  if (!user) return false;
  if (user.access === 'admin') return true;
  const key = String(personKey || '').trim().toLowerCase();
  if (!key) return false;
  const allowed = new Set(identityKeys(user));
  for (const a of cache.assessments || []) {
    if (recordVisibleTo(a, user)) {
      allowed.add(specPersonKey(a));
      if (a.username) allowed.add(String(a.username).trim().toLowerCase());
      if (a.name) allowed.add(String(a.name).trim().toLowerCase());
    }
  }
  return allowed.has(key);
}

export function getEmployeeSpecs(personKey, roleSlug) {
  const key = String(personKey || '')
    .trim()
    .toLowerCase();
  cache.employeeSpecs = cache.employeeSpecs || {};
  const saved = key ? cache.employeeSpecs[key] : null;
  if (saved && Array.isArray(saved.metrics) && saved.metrics.length) {
    return {
      personKey: key,
      roleSlug: saved.roleSlug || roleSlug || 'backend',
      metrics: normalizeSpecCatalog(saved.metrics, saved.roleSlug || roleSlug),
      fromDefaults: false,
      updatedAt: saved.updatedAt || null,
    };
  }
  return {
    personKey: key,
    roleSlug: roleSlug || 'backend',
    metrics: cloneDefaultSpecs(roleSlug),
    fromDefaults: true,
    updatedAt: null,
  };
}

export function saveEmployeeSpecs(personKey, payload) {
  const key = String(personKey || '')
    .trim()
    .toLowerCase();
  if (!key) throw new Error('Employee is required');
  const roleSlug = payload.roleSlug || payload.role || 'backend';
  const metrics = normalizeSpecCatalog(payload.metrics, roleSlug);
  cache.employeeSpecs = cache.employeeSpecs || {};
  cache.employeeSpecs[key] = {
    personKey: key,
    roleSlug,
    metrics,
    updatedAt: now(),
  };
  persist();
  return {
    ...cache.employeeSpecs[key],
    fromDefaults: false,
  };
}

function fiveFromAssessment(a) {
  // Archived Q1 rows keep the original five-column values. Newer reviews
  // roll specification-parameter scores into the five metrics.
  if (a.archived && a.archive) {
    const src = a.archive;
    const metrics = {
      impact: typeof src.impact === 'number' ? src.impact : null,
      execution: typeof src.execution === 'number' ? src.execution : null,
      ownership: typeof src.ownership === 'number' ? src.ownership : null,
      collaboration: typeof src.collaboration === 'number' ? src.collaboration : null,
      growth: typeof src.growth === 'number' ? src.growth : null,
    };
    const any = Object.values(metrics).some((v) => v != null);
    return { metrics: any ? metrics : null, finalScore: any ? weightedFive(metrics) : null };
  }

  const specs = getEmployeeSpecs(specPersonKey(a), a.roleSlug);
  const rolled = fiveFromSpecScores(specs, a.specScores);
  const src = rolled || a.metrics || {};
  const metrics = {
    impact: typeof src.impact === 'number' ? src.impact : null,
    execution: typeof src.execution === 'number' ? src.execution : null,
    ownership: typeof src.ownership === 'number' ? src.ownership : null,
    collaboration: typeof src.collaboration === 'number' ? src.collaboration : null,
    growth: typeof src.growth === 'number' ? src.growth : null,
  };
  const any = Object.values(metrics).some((v) => v != null);
  return { metrics: any ? metrics : null, finalScore: any ? weightedFive(metrics) : null };
}

function weightedFive(metrics) {
  let sum = 0;
  let any = false;
  for (const [k, weight] of Object.entries(FIVE_WEIGHTS)) {
    if (typeof metrics[k] === 'number') {
      sum += metrics[k] * weight;
      any = true;
    }
  }
  return any ? Math.round(sum * 1000) / 1000 : null;
}

export function listAssessments(viewer) {
  return (cache.assessments || [])
    .filter((a) => !viewer || recordVisibleTo(a, viewer))
    .map((a) => {
      const { metrics, finalScore } = fiveFromAssessment(a);
      return {
        id: a.id,
        name: a.name,
        username: a.username || null,
        period: normalizePeriod(a.period),
        roleSlug: a.roleSlug,
        level: a.level,
        archived: Boolean(a.archived),
        source: a.source || null,
        metrics,
        finalScore,
        notes: a.notes || '',
        evidence: a.evidence || '',
        updatedAt: a.updatedAt,
        createdBy: a.createdBy,
      };
    })
    .sort((a, b) => {
      const ap = String(a.period || '');
      const bp = String(b.period || '');
      if (ap !== bp) return ap.localeCompare(bp);
      return String(a.name).localeCompare(String(b.name));
    });
}

export function getAssessment(id) {
  return (cache.assessments || []).find((a) => a.id === Number(id)) || null;
}

export function saveAssessment(payload, username) {
  cache.assessments = cache.assessments || [];
  cache.nextAssessmentId = cache.nextAssessmentId || 1;
  const period = normalizePeriod(payload.period);
  const key = specPersonKey(payload);
  if (key && !payload.archived) {
    const existing = cache.assessments.find(
      (a) => !a.archived && specPersonKey(a) === key && normalizePeriod(a.period) === period,
    );
    if (existing) return updateAssessment(existing.id, payload, username);
  }
  const assessment = {
    id: cache.nextAssessmentId++,
    name: String(payload.name || '').trim(),
    period: normalizePeriod(payload.period),
    roleSlug: payload.roleSlug,
    level: Number(payload.level) || 1,
    scores: payload.scores || {},
    metrics: payload.metrics || null,
    specScores: payload.specScores || {},
    finalScore: payload.finalScore == null || Number.isNaN(Number(payload.finalScore))
      ? null
      : Number(payload.finalScore),
    notes: payload.notes || '',
    promotion: payload.promotion || {},
    archived: Boolean(payload.archived),
    source: payload.source || null,
    archive: payload.archive || null,
    username: payload.username || null,
    createdBy: username,
    createdAt: now(),
    updatedAt: now(),
  };
  cache.assessments.push(assessment);
  persist();
  return assessment;
}

export function updateAssessment(id, payload, username) {
  const assessment = getAssessment(id);
  if (!assessment) return null;
  if (payload.name != null) assessment.name = String(payload.name).trim();
  if (payload.period != null) {
    assessment.period = normalizePeriod(payload.period);
  }
  if (payload.roleSlug != null) assessment.roleSlug = payload.roleSlug;
  if (payload.level != null) assessment.level = Number(payload.level) || assessment.level;
  if (payload.scores != null) assessment.scores = payload.scores;
  if (payload.metrics != null) assessment.metrics = payload.metrics;
  if (payload.specScores != null) assessment.specScores = payload.specScores;
  if (payload.finalScore !== undefined) {
    assessment.finalScore = payload.finalScore == null || Number.isNaN(Number(payload.finalScore))
      ? null
      : Number(payload.finalScore);
  }
  if (payload.notes != null) assessment.notes = payload.notes;
  if (payload.promotion != null) assessment.promotion = payload.promotion;
  if (payload.username != null) assessment.username = payload.username;
  assessment.updatedAt = now();
  assessment.updatedBy = username;
  persist();
  return assessment;
}

export function deleteAssessment(id) {
  const idx = (cache.assessments || []).findIndex((a) => a.id === Number(id));
  if (idx === -1) return false;
  cache.assessments.splice(idx, 1);
  persist();
  return true;
}
