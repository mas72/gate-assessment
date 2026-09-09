// Idempotent Q2 1405 proposed reviews. Does not touch Q1 1405 archive numbers.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const STORE_PATH = path.join(ROOT, 'data', 'store.json');
const STAMP = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP_PATH = path.join(ROOT, 'data', `store.backup-pre-q2-${STAMP}.json`);

const W = { impact: 0.3, execution: 0.25, ownership: 0.2, collaboration: 0.15, growth: 0.1 };
const FIVE = ['impact', 'execution', 'ownership', 'collaboration', 'growth'];
const SPEC_IDS = {
  impact: ['impact-scope', 'impact-throughput', 'impact-outcome', 'impact-durability'],
  execution: ['exec-predictability', 'exec-failure-rate', 'exec-review-depth', 'exec-estimation'],
  ownership: ['own-autonomy', 'own-end-to-end', 'own-incident', 'own-judgment'],
  collaboration: ['collab-writing', 'collab-cross-role', 'collab-feedback', 'collab-influence'],
  growth: ['growth-velocity', 'growth-sharing', 'growth-mentorship', 'growth-trajectory'],
};

function finalFrom(metrics) {
  if (!metrics) return null;
  let sum = 0;
  let any = false;
  for (const key of FIVE) {
    if (typeof metrics[key] === 'number' && Number.isFinite(metrics[key])) {
      sum += metrics[key] * W[key];
      any = true;
    }
  }
  return any ? Math.round(sum * 1000) / 1000 : null;
}

function specScoresFrom(metrics) {
  if (!metrics) return {};
  const out = {};
  for (const key of FIVE) {
    const v = metrics[key];
    if (typeof v !== 'number') continue;
    for (const id of SPEC_IDS[key]) out[id] = v;
  }
  return out;
}

function archiveFingerprint(a) {
  const src = a.archive || {};
  return JSON.stringify({
    username: a.username,
    period: a.period,
    level: a.level,
    impact: src.impact,
    execution: src.execution,
    ownership: src.ownership,
    collaboration: src.collaboration,
    growth: src.growth,
    excelFinal: src.excelFinal,
    computedFinal: src.computedFinal,
  });
}

const Q2 = [
  {
    name: 'Alireza Dehghan',
    username: 'ali.dehghan',
    roleSlug: 'backend',
    level: 3,
    metrics: { impact: 4.25, execution: 3.25, ownership: 4.75, collaboration: 4, growth: 4 },
    notes:
      'Proposed Q2 1405 review (not locked). Q1 baseline 3.95. Execution remains the development area (3.00 to 3.25) while impact ticked up on owned backend work. Ownership is still the strength; calibrated from 5.00 to 4.75 so one strong quarter does not lock a 5. Collaboration and growth held.',
    evidence:
      'I +0.25 after Convertor static routes (GATE-10240) and OpenVPN (GATE-10249) landed Done. E +0.25: DHCP (GATE-10352) and 2FA user (GATE-9681) closed, but virtual-IP load-balance (GATE-10165) is still In Progress and IPS log output (GATE-10188) reopened. O 5.00->4.75 because WAF/auth (GATE-10486, GATE-10483) remain in Technical Review.',
  },
  {
    name: 'Ali Ghasemi',
    username: 'a.ghasemi',
    roleSlug: 'devops',
    level: 3,
    metrics: { impact: 3.75, execution: 4.5, ownership: 4, collaboration: 4, growth: 4.25 },
    notes:
      'Proposed Q2 1405 review (not locked). Q1 baseline 3.975. Impact was the lag at 3.5; Q2 3.75 as CI/observability work became more visible. Execution held at 4.5 (already well above L3). Growth +0.25. Collaboration and ownership unchanged.',
    evidence:
      'I 3.50->3.75 after the lab security-tests pipeline (GATE-10113), OpenSSH fix (GATE-10295), Zabbix agent/server (GATE-10347), and client security patches (GATE-10350) Done. E held at 4.50 (already above L3). G +0.25 on the CFR/changelog local model (GATE-10308). ISO 15.1 build (GATE-10459) is still In Progress, so Impact is not a jump to 4.',
  },
  {
    name: 'Abolfazl Pahlavanian',
    username: 'a.pahlavanian',
    roleSlug: 'devnet',
    level: 3,
    metrics: { impact: 4, execution: 4.25, ownership: 4.5, collaboration: 4, growth: 4.75 },
    notes:
      'Proposed Q2 1405 review (not locked). Q1 baseline 4.213, highest on the team. Collaboration was the gap (3.75 to 4.00). Execution +0.25. Ownership and growth were Q1 peaks (4.75 / 5.00) and are calibrated to 4.50 / 4.75. Net change is small on purpose.',
    evidence:
      'Smallest net move. C 3.75->4.00 after the API-test Cursor skill (GATE-10285) and vCenter auto-install (GATE-10284) that others used. E +0.25 on AFTA IPsec-certificate test (GATE-10299) and OpenVPN Wireshark (GATE-10309). O 4.75->4.50 and G 5.00->4.75: NAT log (GATE-10121) still In Progress; Linux VPN slowness (GATE-10031) reopened.',
  },
  {
    name: 'Laya Hosseini Motlagh',
    username: 'hosseini.motlagh',
    roleSlug: 'qa',
    level: 2,
    metrics: { impact: 4, execution: 3.75, ownership: 4.5, collaboration: 4, growth: 4 },
    notes:
      'Proposed Q2 1405 review (not locked). Q1 baseline 3.975 at L2. Scores stay in the high-3 / 4 band rather than jumping toward L3-L4. Execution was the relative gap (3.50 to 3.75) on Release Test follow-through. Other metrics held.',
    evidence:
      'E 3.50->3.75 after Convertor smoke tests (GATE-10254, GATE-10357) and 6.18.0 RC start (GATE-10354) Done, plus OSPF/Snort bugs (GATE-10377, GATE-10302). 6.18.0 ISO release test (GATE-10474) is still In Progress, so Impact stays 4.00. Other metrics held. L2 scores stay in the high-3/4 band on purpose.',
  },
  {
    name: 'Fatemeh Ahmadi',
    username: 'f.ahmadi',
    roleSlug: 'service',
    level: 3,
    metrics: { impact: 3.75, execution: 3.75, ownership: 3.75, collaboration: 3.5, growth: 3.5 },
    notes:
      'Proposed Q2 1405 review (not locked). Q1 baseline 3.788 (computed from the five scores, not the spreadsheet 3.038). Impact eased 4.00 to 3.75 on a more routine service quarter. Collaboration remains the development area at 3.50. Growth 3.75 to 3.50. Not a recovery story this cycle.',
    evidence:
      'Final -0.100, not a recovery. I 4.00->3.75: WAF convertor bugs stuck in Release Test (GATE-10446, GATE-10443, GATE-9018); CPU GATE-10496 still To Do. G 3.75->3.50: IDS anomaly R&D (GATE-10244) Done but did not widen service scope. C remains 3.50 (WAF access-log GATE-10482 still Technical Review). E and O held.',
  },
  {
    name: 'Mohsen Noeiaval',
    username: 'm.noeiaval',
    roleSlug: 'service',
    level: 4,
    metrics: { impact: 4, execution: 3.5, ownership: 4.25, collaboration: 3.75, growth: 3.75 },
    notes:
      'Incident response held. Business and product outcome held. Influence and alignment ticked up.',
    evidence:
      'Incident response held\nBusiness and product outcome held\nInfluence and alignment ticked up',
  },
  {
    name: 'Hamed Dehghan',
    username: 'hamed.dehghan',
    roleSlug: 'frontend',
    level: 3,
    metrics: { impact: 3.25, execution: 3.25, ownership: 3.5, collaboration: 3.25, growth: 3.25 },
    notes:
      'Proposed Q2 1405 review (not locked). Q1 baseline 3.1 was completed for this report (original sheet blank, L3). Impact, Execution, Collaboration, and Growth each +0.25; Ownership held at 3.50. Sits near L3, not in the team high-3/4 cluster.',
    evidence:
      'Q1 was completed for this report (spreadsheet blank). I/E each +0.25 after Customer Management UI (GATE-10274), APK UI library (GATE-9913), Design System Part 4 (GATE-10341), and UI bugs Done (GATE-10370, GATE-10373, GATE-10385). C +0.25 on QA-filed UI work. G 3.00->3.25. Open dashboard/logout bugs (GATE-10404, GATE-10500) keep E at 3.25.',
  },
];

copyFileSync(STORE_PATH, BACKUP_PATH);
const store = JSON.parse(readFileSync(STORE_PATH, 'utf8'));
const q1Before = (store.assessments || [])
  .filter((a) => a.archived && String(a.period).trim() === 'Q1 1405')
  .map(archiveFingerprint)
  .sort();

const now = new Date().toISOString();
let nextId = Number(store.nextAssessmentId) || 1;
const keep = (store.assessments || []).filter((a) => !(
  !a.archived && String(a.period || '').trim() === 'Q2 1405'
));
if (keep.length) {
  nextId = Math.max(nextId, ...keep.map((a) => Number(a.id) || 0)) + 1;
}

const q2Rows = Q2.map((row) => {
  const id = nextId++;
  const metrics = row.metrics;
  return {
    id,
    name: row.name,
    username: row.username,
    period: 'Q2 1405',
    roleSlug: row.roleSlug,
    level: row.level,
    scores: {},
    metrics: metrics || null,
    specScores: specScoresFrom(metrics),
    finalScore: finalFrom(metrics),
    notes: row.notes,
    evidence: row.evidence || '',
    promotion: {},
    archived: false,
    source: 'q2-1405-proposed',
    archive: null,
    createdBy: 'm.dehghan',
    createdAt: now,
    updatedAt: now,
  };
});

store.assessments = [...keep, ...q2Rows];
store.nextAssessmentId = nextId;
writeFileSync(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`);

const after = JSON.parse(readFileSync(STORE_PATH, 'utf8'));
const q1After = (after.assessments || [])
  .filter((a) => a.archived && String(a.period).trim() === 'Q1 1405')
  .map(archiveFingerprint)
  .sort();

if (q1Before.length !== 7) {
  console.error(`Expected 7 Q1 archives before write, got ${q1Before.length}`);
  process.exit(1);
}
if (JSON.stringify(q1Before) !== JSON.stringify(q1After)) {
  console.error('Q1 1405 archive metric numbers changed. Restoring backup.');
  copyFileSync(BACKUP_PATH, STORE_PATH);
  process.exit(1);
}

console.log(`backup: ${BACKUP_PATH}`);
console.log(`wrote ${q2Rows.length} Q2 1405 assessments (ids ${q2Rows.map((r) => r.id).join(', ')})`);
for (const row of q2Rows) {
  const m = row.metrics;
  console.log(
    `${row.name.padEnd(24)} L${row.level} ${row.username.padEnd(20)} `
    + (m
      ? `I${m.impact} E${m.execution} O${m.ownership} C${m.collaboration} G${m.growth} final ${row.finalScore}`
      : 'unscored'),
  );
}
console.log('Q1 1405 archive fingerprints unchanged.');
