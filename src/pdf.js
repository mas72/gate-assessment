import { jsPDF } from 'jspdf';
import { scoreState, scoreLabel, verdictFor, expectedForLevel, SCORE_MAX, FIVE_METRICS } from './lib.js';

const PAGE = { w: 595.28, h: 841.89 };
const M = 44;
const CONTENT = PAGE.w - M * 2;

const INK = [31, 29, 25];
const MUTED = [112, 107, 99];
const ACCENT = [45, 106, 79];
const BORDER = [214, 209, 197];
const SOFT = [244, 241, 234];
const WHITE = [255, 255, 255];

const VERDICT_COLOR = {
  exceptional: [37, 99, 168],
  above: [45, 106, 79],
  meets: [199, 123, 46],
  below: [194, 65, 12],
  unsat: [181, 52, 42],
};

function fileStem(name, period) {
  const parts = [name || 'assessment', period]
    .filter(Boolean)
    .map((p) => String(p).trim().replace(/\s+/g, '-').replace(/[^\w.-]/g, ''))
    .filter(Boolean);
  return `gate-assessment-${parts.join('-')}`.toLowerCase();
}

function fmt(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  return Number.isInteger(n) && digits === 0 ? String(n) : n.toFixed(digits);
}

function scoreText(value) {
  if (value == null) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? `${n}/${SCORE_MAX}` : `${n.toFixed(2)}/${SCORE_MAX}`;
}

class Sheet {
  constructor() {
    this.doc = new jsPDF({ unit: 'pt', format: 'a4' });
    this.y = M;
  }

  setFont(size, weight = 'normal', color = INK) {
    this.doc.setFont('helvetica', weight);
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
  }

  space(h) {
    this.y += h;
  }

  ensure(h) {
    if (this.y + h <= PAGE.h - 58) return;
    this.doc.addPage();
    this.y = M;
  }

  text(value, { size = 10, weight = 'normal', color = INK, x = M, width = CONTENT, leading = 1.35 } = {}) {
    this.setFont(size, weight, color);
    const lines = this.doc.splitTextToSize(String(value ?? ''), width);
    const lineHeight = size * leading;
    this.ensure(lines.length * lineHeight);
    this.doc.text(lines, x, this.y + size * 0.85);
    this.y += lines.length * lineHeight;
    return lines.length;
  }

  rule(color = BORDER) {
    this.ensure(10);
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(0.7);
    this.doc.line(M, this.y, M + CONTENT, this.y);
    this.y += 1;
  }

  sectionTitle(title, hint) {
    this.ensure(46);
    this.space(10);
    this.text(title.toUpperCase(), { size: 11, weight: 'bold', color: ACCENT });
    if (hint) this.text(hint, { size: 8.5, color: MUTED });
    this.space(3);
    this.rule();
    this.space(8);
  }

  box(h, { fill = SOFT, stroke = BORDER, x = M, w = CONTENT, radius = 6 } = {}) {
    this.doc.setFillColor(...fill);
    this.doc.setDrawColor(...stroke);
    this.doc.setLineWidth(0.7);
    this.doc.roundedRect(x, this.y, w, h, radius, radius, 'FD');
  }
}

function drawHeader(sheet, { name, roleLabel, level, period, reviewer }) {
  const { doc } = sheet;
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, PAGE.w, 92, 'F');

  sheet.setFont(17, 'bold', WHITE);
  doc.text('GATE Assessment', M, 38);
  sheet.setFont(9, 'normal', [214, 233, 222]);
  doc.text('APK Gate · individual performance review', M, 54);

  sheet.setFont(9, 'bold', WHITE);
  doc.text(period || 'No period', PAGE.w - M, 38, { align: 'right' });
  sheet.setFont(8, 'normal', [214, 233, 222]);
  doc.text(
    `Generated ${new Date().toLocaleDateString()}${reviewer ? ` · ${reviewer}` : ''}`,
    PAGE.w - M,
    54,
    { align: 'right' },
  );

  sheet.y = 116;
  sheet.text(name || 'Unnamed developer', { size: 20, weight: 'bold' });
  sheet.space(2);
  sheet.text(
    `${roleLabel || 'No role'} track · Level L${level}`,
    { size: 11, weight: 'bold', color: ACCENT },
  );
  sheet.text(
    `This report covers ${roleLabel || 'this'} technical skills and shared GATE domains only.`,
    { size: 8.5, color: MUTED },
  );
  sheet.space(10);
}

function drawSummary(sheet, { overall, expected, verdict, scored, total, level }) {
  const { doc } = sheet;
  const gap = 12;
  const cardW = (CONTENT - gap) / 2;
  const cards = [
    ['Final score', `${fmt(overall)} / ${SCORE_MAX}`, `${scored} of ${total} skills scored`],
    ['L' + level + ' expected', `${fmt(expected, 1)} / ${SCORE_MAX}`, 'Score expected at this level'],
  ];

  sheet.ensure(96);
  const top = sheet.y;
  cards.forEach(([label, value, hint], i) => {
    const x = M + i * (cardW + gap);
    doc.setFillColor(...SOFT);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.7);
    doc.roundedRect(x, top, cardW, 72, 6, 6, 'FD');
    sheet.setFont(8, 'bold', MUTED);
    doc.text(label.toUpperCase(), x + 12, top + 20);
    sheet.setFont(22, 'bold', INK);
    doc.text(value, x + 12, top + 48);
    sheet.setFont(7.5, 'normal', MUTED);
    doc.text(doc.splitTextToSize(hint, cardW - 24), x + 12, top + 62);
  });
  sheet.y = top + 72;

  if (!verdict) return;
  sheet.space(12);
  const color = VERDICT_COLOR[verdict.key] || ACCENT;
  sheet.setFont(10, 'normal', INK);
  const actionLines = doc.splitTextToSize(verdict.action, CONTENT - 28);
  const h = 44 + actionLines.length * 12;
  sheet.ensure(h);
  const y0 = sheet.y;
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(M, y0, CONTENT, h, 6, 6, 'FD');
  doc.setFillColor(...color);
  doc.rect(M, y0 + 1, 4, h - 2, 'F');
  sheet.setFont(7.5, 'bold', color);
  doc.text(String(verdict.band).toUpperCase(), M + 16, y0 + 18);
  sheet.setFont(12, 'bold', INK);
  doc.text(verdict.label, M + 16, y0 + 34);
  sheet.setFont(9, 'normal', MUTED);
  doc.text(actionLines, M + 16, y0 + 50);
  sheet.y = y0 + h;
}

function drawDomainTable(sheet, { domains, domainAvgs, weights, expected }) {
  const { doc } = sheet;
  const cols = [CONTENT - 230, 60, 60, 110];
  const xs = [M, M + cols[0], M + cols[0] + cols[1], M + cols[0] + cols[1] + cols[2]];

  sheet.ensure(30);
  doc.setFillColor(...SOFT);
  doc.rect(M, sheet.y, CONTENT, 22, 'F');
  sheet.setFont(8, 'bold', MUTED);
  doc.text('DOMAIN', xs[0] + 8, sheet.y + 15);
  doc.text('WEIGHT', xs[1] + 8, sheet.y + 15);
  doc.text('AVG', xs[2] + 8, sheet.y + 15);
  doc.text('VS EXPECTED', xs[3] + 8, sheet.y + 15);
  sheet.y += 22;

  for (const domain of domains) {
    const avg = domainAvgs[domain.weightKey];
    const weight = Math.round((weights[domain.weightKey] || 0) * 100);
    sheet.ensure(24);
    const rowY = sheet.y;
    sheet.setFont(9.5, 'bold', INK);
    doc.text(doc.splitTextToSize(domain.title, cols[0] - 16)[0], xs[0] + 8, rowY + 15);
    sheet.setFont(9.5, 'normal', MUTED);
    doc.text(`${weight}%`, xs[1] + 8, rowY + 15);
    sheet.setFont(9.5, 'bold', avg == null ? MUTED : INK);
    doc.text(fmt(avg), xs[2] + 8, rowY + 15);

    const barW = 84;
    const barX = xs[3] + 8;
    doc.setFillColor(...BORDER);
    doc.roundedRect(barX, rowY + 7, barW, 7, 3, 3, 'F');
    if (avg != null) {
      const pct = Math.max(0, Math.min(1, avg / SCORE_MAX));
      const color = avg >= expected ? ACCENT : VERDICT_COLOR.below;
      doc.setFillColor(...color);
      doc.roundedRect(barX, rowY + 7, Math.max(4, barW * pct), 7, 3, 3, 'F');
    }
    doc.setDrawColor(...MUTED);
    doc.setLineWidth(0.8);
    const tick = barX + barW * Math.max(0, Math.min(1, expected / SCORE_MAX));
    doc.line(tick, rowY + 4, tick, rowY + 17);

    sheet.y = rowY + 24;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.5);
    doc.line(M, sheet.y, M + CONTENT, sheet.y);
  }
  sheet.space(4);
  sheet.text('Vertical tick marks the expected score for the selected level.', { size: 7.5, color: MUTED });
}

function drawSkillIndex(sheet, { domains, scores, roleLabel, level }) {
  const { doc } = sheet;
  const rows = [];
  for (const domain of domains) {
    for (const metric of domain.metrics) {
      rows.push({
        title: metric.title,
        domain: domain.weightKey === 'technical' ? `${roleLabel} tech` : domain.title,
        value: scores[metric.id],
      });
    }
  }
  if (!rows.length) return;

  sheet.sectionTitle(
    `${roleLabel} skill scores`,
    `Only this person’s ${roleLabel} technical skills and shared GATE domains. Other role tracks are omitted.`,
  );

  const cols = [CONTENT - 220, 110, 50, 60];
  const xs = [M, M + cols[0], M + cols[0] + cols[1], M + cols[0] + cols[1] + cols[2]];

  sheet.ensure(26);
  doc.setFillColor(...ACCENT);
  doc.rect(M, sheet.y, CONTENT, 22, 'F');
  sheet.setFont(8, 'bold', WHITE);
  doc.text('SKILL', xs[0] + 8, sheet.y + 15);
  doc.text('DOMAIN', xs[1] + 6, sheet.y + 15);
  doc.text('SCORE', xs[2] + 6, sheet.y + 15);
  doc.text('LABEL', xs[3] + 6, sheet.y + 15);
  sheet.y += 22;

  rows.forEach((row, i) => {
    sheet.setFont(9, 'bold', INK);
    const titleLines = doc.splitTextToSize(row.title, cols[0] - 16);
    const h = Math.max(22, 10 + titleLines.length * 11);
    sheet.ensure(h);
    const y0 = sheet.y;
    if (i % 2 === 0) {
      doc.setFillColor(250, 248, 244);
      doc.rect(M, y0, CONTENT, h, 'F');
    }
    const n = row.value == null ? null : Number(row.value);
    const scored = n != null && Number.isFinite(n);
    sheet.setFont(9, 'bold', INK);
    doc.text(titleLines, xs[0] + 8, y0 + 14);
    sheet.setFont(8, 'normal', MUTED);
    doc.text(doc.splitTextToSize(row.domain, cols[1] - 10)[0], xs[1] + 6, y0 + 14);
    sheet.setFont(9.5, 'bold', scored ? INK : MUTED);
    doc.text(scored ? fmt(n, Number.isInteger(n) ? 0 : 2) : '—', xs[2] + 6, y0 + 14);
    sheet.setFont(8, 'normal', scored ? ACCENT : MUTED);
    doc.text(scoreLabel(n), xs[3] + 6, y0 + 14);
    sheet.y = y0 + h;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.4);
    doc.line(M, sheet.y, M + CONTENT, sheet.y);
  });
  sheet.space(6);
  sheet.text(`L${level} expectations for each skill are on the following pages.`, { size: 8, color: MUTED });
}

function drawSkills(sheet, { domain, scores, level, weights, roleLabel }) {
  const { doc } = sheet;
  if (!domain.metrics?.length) return;
  const weight = Math.round((weights[domain.weightKey] || 0) * 100);
  const heading =
    domain.weightKey === 'technical' ? `${roleLabel} technical skills` : domain.title;
  sheet.sectionTitle(heading, `${weight}% of the final score · L${level} bar for this person`);

  for (const metric of domain.metrics) {
    const raw = scores[metric.id];
    const value = raw == null ? null : Number(raw);
    const expectation = metric.levels?.[level] || metric.levels?.[String(level)] || '';
    const scored = value != null && Number.isFinite(value);

    const expLines = expectation
      ? doc.splitTextToSize(`L${level}: ${expectation}`, CONTENT - 96)
      : [];
    const h = 36 + (expLines.length ? expLines.length * 11 + 4 : 0);

    sheet.ensure(h + 6);
    const y0 = sheet.y;
    doc.setFillColor(...WHITE);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.7);
    doc.roundedRect(M, y0, CONTENT, h, 5, 5, 'FD');
    doc.setFillColor(...(scored ? ACCENT : BORDER));
    doc.rect(M, y0 + 1, 4, h - 2, 'F');

    const chipW = 62;
    const chipX = M + CONTENT - chipW - 10;
    doc.setFillColor(...(scored ? ACCENT : SOFT));
    doc.roundedRect(chipX, y0 + 8, chipW, 22, 5, 5, 'F');
    sheet.setFont(11, 'bold', scored ? WHITE : MUTED);
    doc.text(scoreText(value), chipX + chipW / 2, y0 + 23, { align: 'center' });

    sheet.setFont(10.5, 'bold', INK);
    doc.text(metric.title, M + 14, y0 + 18);
    sheet.setFont(8, 'normal', scored ? ACCENT : MUTED);
    doc.text(scoreLabel(value), M + 14, y0 + 30);

    if (expLines.length) {
      sheet.setFont(8.5, 'normal', MUTED);
      doc.text(expLines, M + 14, y0 + 44);
    }
    sheet.y = y0 + h + 6;
  }
}

function drawPromotion(sheet, { levelMeta, level, promotion, universal }) {
  const gates = levelMeta?.gates || [];
  if (!gates.length && !universal?.length) return;
  const done = gates.filter((_, i) => promotion[i]).length;
  sheet.sectionTitle(
    `Promotion checklist — L${level} to L${Math.min(7, level + 1)}`,
    `${done} of ${gates.length} criteria met`,
  );
  gates.forEach((gate, i) => {
    const checked = Boolean(promotion[i]);
    sheet.text(`${checked ? '[x]' : '[ ]'}  ${gate}`, {
      size: 9.5,
      color: checked ? INK : MUTED,
      weight: checked ? 'bold' : 'normal',
    });
    sheet.space(3);
  });
  if (universal?.length) {
    sheet.space(6);
    sheet.text('Universal gate requirements', { size: 9.5, weight: 'bold' });
    sheet.space(3);
    universal.forEach((item) => {
      sheet.text(`•  ${item}`, { size: 9, color: MUTED });
      sheet.space(2);
    });
  }
}

function drawArchive(sheet, archive, level, expectations) {
  if (!archive) return;
  const { doc } = sheet;
  const levelBar = expectedForLevel(level, expectations);
  sheet.sectionTitle(
    'Five main metrics',
    `Score out of ${SCORE_MAX} · L${level} expects ${fmt(levelBar, 1)}${archive.band ? ` · ${archive.band}` : ''}`,
  );
  const rows = [
    ['Impact', '30%', archive.impact],
    ['Execution', '25%', archive.execution],
    ['Ownership', '20%', archive.ownership],
    ['Collaboration', '15%', archive.collaboration],
    ['Growth', '10%', archive.growth],
  ];
  const colW = (CONTENT - 16) / 5;
  sheet.ensure(66);
  const top = sheet.y;
  rows.forEach(([label, weight, value], i) => {
    const x = M + i * colW;
    doc.setFillColor(...SOFT);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, top, colW - 6, 56, 5, 5, 'FD');
    sheet.setFont(7.5, 'bold', MUTED);
    doc.text(`${label} · ${weight}`, x + 8, top + 16);
    sheet.setFont(16, 'bold', INK);
    doc.text(fmt(value), x + 8, top + 38);
    sheet.setFont(6.5, 'normal', MUTED);
    doc.text(value == null ? 'not scored' : label, x + 8, top + 50);
  });
  sheet.y = top + 62;
  sheet.space(6);
  const bonus = archive.bonus ? `${Math.round(Number(archive.bonus) * 100)}%` : '—';
  sheet.text(
    `Spreadsheet final ${fmt(archive.excelFinal)}${archive.computedFinal != null ? ` · recomputed ${fmt(archive.computedFinal)}` : ''} · bonus ${bonus}`,
    { size: 9.5, weight: 'bold' },
  );
  if (archive.incomplete) {
    sheet.space(4);
    sheet.text('No numeric scores were filled in for this person in the original file.', {
      size: 9,
      color: MUTED,
    });
  }
}

function drawFooters(sheet, name) {
  const { doc } = sheet;
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.5);
    doc.line(M, PAGE.h - 44, PAGE.w - M, PAGE.h - 44);
    sheet.setFont(7.5, 'normal', MUTED);
    doc.text(`GATE Assessment · ${name || 'Unnamed'} · confidential`, M, PAGE.h - 30);
    doc.text(`Page ${i} of ${pages}`, PAGE.w - M, PAGE.h - 30, { align: 'right' });
  }
}

export function buildPdf({ catalog, name, period, roleSlug, level, scores, notes, promotion = {}, archive, reviewer }) {
  const { role, domains, domainAvgs, overall, scored, total } = scoreState(catalog, roleSlug, scores);
  const expected = catalog.levelExpectations[level];
  const verdict = verdictFor(overall, level, catalog.levelExpectations);
  const levelMeta = catalog.levels.find((l) => l.id === Number(level));
  const roleLabel = role?.label || 'Role';
  const relatedDomains = domains.filter((d) => d.metrics?.length);

  const sheet = new Sheet();

  drawHeader(sheet, {
    name,
    roleLabel,
    level,
    period,
    reviewer,
  });
  drawSummary(sheet, { overall, expected, verdict, scored, total, level });
  drawArchive(sheet, archive, level, catalog.levelExpectations);

  sheet.sectionTitle('Domain summary', `Weighted ${roleLabel} score versus L${level} expectation`);
  drawDomainTable(sheet, { domains: relatedDomains, domainAvgs, weights: catalog.weights, expected });
  drawSkillIndex(sheet, { domains: relatedDomains, scores, roleLabel, level });

  for (const domain of relatedDomains) {
    drawSkills(sheet, { domain, scores, level, weights: catalog.weights, roleLabel });
  }

  drawPromotion(sheet, {
    levelMeta,
    level,
    promotion,
    universal: catalog.universalPromotion,
  });

  sheet.sectionTitle('Evidence notes', 'Named examples behind the scores');
  sheet.text(notes?.trim() || 'No notes recorded.', { size: 9.5, color: notes?.trim() ? INK : MUTED });

  drawFooters(sheet, name);

  return sheet.doc;
}

export function exportPdf(payload) {
  buildPdf(payload).save(`${fileStem(payload.name, payload.period)}.pdf`);
}

function signed(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;
}

function deltaColor(value) {
  if (value == null || !Number.isFinite(Number(value))) return MUTED;
  if (Number(value) > 0.001) return ACCENT;
  if (Number(value) < -0.001) return VERDICT_COLOR.below;
  return MUTED;
}

export function buildTeamPdf(evaln) {
  const sheet = new Sheet();
  const { doc } = sheet;
  const hasPrior = Boolean(evaln.previous);

  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, PAGE.w, 78, 'F');
  sheet.setFont(17, 'bold', WHITE);
  doc.text('GATE Evaluation Report', M, 34);
  sheet.setFont(9.5, 'normal', [214, 233, 222]);
  doc.text(
    hasPrior
      ? `${evaln.latest} compared with ${evaln.previous} · five main metrics and final score`
      : `${evaln.latest} · five main metrics and final score`,
    M,
    52,
  );
  sheet.setFont(8, 'normal', [214, 233, 222]);
  doc.text(`Generated ${new Date().toLocaleDateString()}`, PAGE.w - M, 34, { align: 'right' });

  sheet.y = 100;

  const cards = hasPrior
    ? [
        ['Final · previous', fmt(evaln.teamPreviousFinal), evaln.previous, INK],
        ['Final · latest', fmt(evaln.teamLatestFinal), evaln.latest, INK],
        ['Change', signed(evaln.teamDelta), 'Latest minus previous', deltaColor(evaln.teamDelta)],
      ]
    : [['Team final', fmt(evaln.teamLatestFinal), evaln.latest, INK]];
  const gap = 12;
  const cardW = (CONTENT - gap * (cards.length - 1)) / cards.length;
  const top = sheet.y;
  cards.forEach(([label, value, hint, color], i) => {
    const x = M + i * (cardW + gap);
    doc.setFillColor(...SOFT);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, top, cardW, 62, 6, 6, 'FD');
    sheet.setFont(8, 'bold', MUTED);
    doc.text(label.toUpperCase(), x + 12, top + 18);
    sheet.setFont(20, 'bold', color);
    doc.text(value, x + 12, top + 42);
    sheet.setFont(7.5, 'normal', MUTED);
    doc.text(hint, x + 12, top + 54);
  });
  sheet.y = top + 62;

  if (!hasPrior) {
    sheet.space(10);
    sheet.text(
      `${evaln.latest} is the only quarter on record, so there is no previous quarter to compare against yet.`,
      { size: 9, color: MUTED },
    );
  }

  sheet.sectionTitle(
    'Five main metrics — team average',
    hasPrior ? `${evaln.previous} compared with ${evaln.latest}` : evaln.latest,
  );
  const colW = (CONTENT - 16) / 5;
  const mTop = sheet.y;
  FIVE_METRICS.forEach((m, i) => {
    const x = M + i * colW;
    const now = evaln.teamLatest[m.key];
    const before = evaln.teamPrevious[m.key];
    const delta = now != null && before != null ? now - before : null;
    doc.setFillColor(...SOFT);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, mTop, colW - 6, 68, 5, 5, 'FD');
    sheet.setFont(7.5, 'bold', MUTED);
    doc.text(`${m.label.toUpperCase()} · ${Math.round(m.weight * 100)}%`, x + 8, mTop + 15);
    sheet.setFont(16, 'bold', INK);
    doc.text(fmt(now), x + 8, mTop + 37);
    if (hasPrior) {
      sheet.setFont(7.5, 'normal', MUTED);
      doc.text(`was ${fmt(before)}`, x + 8, mTop + 50);
      sheet.setFont(8.5, 'bold', deltaColor(delta));
      doc.text(signed(delta), x + 8, mTop + 61);
    } else {
      sheet.setFont(7.5, 'normal', MUTED);
      doc.text(m.hint, x + 8, mTop + 52);
    }
  });
  sheet.y = mTop + 76;

  sheet.sectionTitle(
    'Per person — comparison scores and final score',
    hasPrior
      ? 'Each metric shows the latest score with the change against the previous quarter'
      : 'Weighted result of the five metrics',
  );

  const cols = hasPrior
    ? ['Name', 'Lvl', 'Impact', 'Exec', 'Owner', 'Collab', 'Growth', 'Final', 'Change']
    : ['Name', 'Lvl', 'Impact', 'Exec', 'Owner', 'Collab', 'Growth', 'Final'];
  const widths = hasPrior
    ? [108, 30, 52, 52, 52, 52, 52, 50, 50]
    : [138, 32, 58, 58, 58, 58, 58, 46];

  doc.setFillColor(...ACCENT);
  doc.rect(M, sheet.y, CONTENT, 20, 'F');
  sheet.setFont(7.5, 'bold', WHITE);
  let hx = M;
  cols.forEach((h, i) => {
    doc.text(h.toUpperCase(), hx + 5, sheet.y + 13);
    hx += widths[i];
  });
  sheet.y += 20;

  evaln.people.forEach((p, idx) => {
    sheet.ensure(24);
    const rowH = 22;
    if (idx % 2 === 0) {
      doc.setFillColor(250, 248, 244);
      doc.rect(M, sheet.y, CONTENT, rowH, 'F');
    }
    let cx = M;
    let w = 0;
    sheet.setFont(8.5, 'bold', INK);
    doc.text(String(p.name), cx + 5, sheet.y + 14);
    cx += widths[w++];

    sheet.setFont(8, 'bold', MUTED);
    doc.text(`L${p.level}`, cx + 5, sheet.y + 14);
    cx += widths[w++];

    FIVE_METRICS.forEach((m) => {
      const now = p.latest?.[m.key];
      const before = p.previous?.[m.key];
      const delta = now != null && before != null ? now - before : null;
      sheet.setFont(8.5, 'normal', INK);
      doc.text(fmt(now), cx + 5, sheet.y + (hasPrior ? 11 : 14));
      if (hasPrior) {
        sheet.setFont(7, 'bold', deltaColor(delta));
        doc.text(delta == null ? '-' : signed(delta), cx + 5, sheet.y + 19);
      }
      cx += widths[w++];
    });

    sheet.setFont(9, 'bold', INK);
    doc.text(fmt(p.latestFinal), cx + 5, sheet.y + 14);
    cx += widths[w++];

    if (hasPrior) {
      sheet.setFont(8.5, 'bold', deltaColor(p.delta));
      doc.text(signed(p.delta), cx + 5, sheet.y + 14);
      cx += widths[w++];
    }

    sheet.y += rowH;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.4);
    doc.line(M, sheet.y, M + CONTENT, sheet.y);
  });

  sheet.space(6);
  sheet.text(
    `All figures are scores out of ${SCORE_MAX}, matching the L1-L${SCORE_MAX} ladder. Final score is the weighted result of the five main metrics; Change is the movement against the previous quarter.`,
    { size: 7.5, color: MUTED },
  );

  drawFooters(sheet, 'Team evaluation');
  return sheet.doc;
}

export function exportTeamPdf(evaln) {
  buildTeamPdf(evaln).save(`${fileStem('evaluation-report', evaln.latest)}.pdf`);
}
