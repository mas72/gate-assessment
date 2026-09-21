import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';
import * as opentypeNs from 'opentype.js';
import reshaper from 'arabic-persian-reshaper';
import bidiFactory from 'bidi-js';
import { scoreState, scoreLabel, verdictFor, expectedForLevel, SCORE_MAX, FIVE_METRICS, resolveFiveMetrics, finalFromFive, finalFormulaText } from './lib.js';
import { fiveFromSpecScores, rollupHint, METRIC_SPEC_BY_KEY } from './metric-specs.js';

const bidi = bidiFactory();
const opentype = opentypeNs.default?.parse ? opentypeNs.default : opentypeNs;
const convertArabic =
  reshaper?.PersianShaper?.convertArabic ||
  reshaper?.default?.PersianShaper?.convertArabic;
const PERSIAN_FONT = 'Vazirmatn';

function loadVazirmatnFonts() {
  if (typeof process === 'undefined' || !process.versions?.node) return null;
  const dirs = [];
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    dirs.push(join(here, 'fonts'));
    dirs.push(join(here, '..', 'public', 'fonts'));
  } catch {
    /* import.meta.url unavailable */
  }
  dirs.push(join(process.cwd(), 'src', 'fonts'));
  dirs.push(join(process.cwd(), 'public', 'fonts'));
  for (const dir of dirs) {
    try {
      const regular = readFileSync(join(dir, 'Vazirmatn-Regular.ttf'), 'base64');
      const bold = readFileSync(join(dir, 'Vazirmatn-Bold.ttf'), 'base64');
      if (!regular || !bold) continue;
      let medium;
      try {
        medium = readFileSync(join(dir, 'Vazirmatn-Medium.ttf'), 'base64');
      } catch {
        medium = null;
      }
      return { regular, bold, medium };
    } catch {
      continue;
    }
  }
  return null;
}

function ttfFromBase64(b64) {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(b64, 'base64');
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function parseVazirmatn(b64) {
  return opentype.parse(ttfFromBase64(b64));
}

function registerPersianFonts(doc, fonts) {
  const loaded = fonts || loadVazirmatnFonts();
  if (!loaded?.regular || !loaded?.bold) {
    throw new Error('Vazirmatn TTF missing (src/fonts or public/fonts) — cannot render Persian evidence');
  }
  doc.addFileToVFS('Vazirmatn-Regular.ttf', loaded.regular);
  doc.addFont('Vazirmatn-Regular.ttf', PERSIAN_FONT, 'normal');
  doc.addFileToVFS('Vazirmatn-Bold.ttf', loaded.bold);
  doc.addFont('Vazirmatn-Bold.ttf', PERSIAN_FONT, 'bold');
  if (loaded.medium) {
    doc.addFileToVFS('Vazirmatn-Medium.ttf', loaded.medium);
    doc.addFont('Vazirmatn-Medium.ttf', PERSIAN_FONT, 'medium');
  }
  return {
    regular: parseVazirmatn(loaded.regular),
    bold: parseVazirmatn(loaded.bold),
    medium: loaded.medium ? parseVazirmatn(loaded.medium) : null,
  };
}

/** Contextual forms + Unicode bidi so presentation-form glyphs join. */
function shapePersian(text) {
  const raw = String(text ?? '');
  if (!raw) return '';
  if (typeof convertArabic !== 'function') {
    throw new Error('arabic-persian-reshaper convertArabic unavailable');
  }
  const reshaped = convertArabic(raw);
  const levels = bidi.getEmbeddingLevels(reshaped, 'rtl');
  return bidi.getReorderedString(reshaped, levels);
}

function quadToCubic(x0, y0, x1, y1, x2, y2) {
  return [
    x0 + (2 / 3) * (x1 - x0),
    y0 + (2 / 3) * (y1 - y0),
    x2 + (2 / 3) * (x1 - x2),
    y2 + (2 / 3) * (y1 - y2),
    x2,
    y2,
  ];
}

function fillOtPath(doc, path) {
  const cmds = path.commands || [];
  if (!cmds.length) return;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let started = false;
  for (const c of cmds) {
    if (c.type === 'M') {
      doc.moveTo(c.x, c.y);
      cx = c.x;
      cy = c.y;
      sx = c.x;
      sy = c.y;
      started = true;
    } else if (c.type === 'L') {
      doc.lineTo(c.x, c.y);
      cx = c.x;
      cy = c.y;
    } else if (c.type === 'C') {
      doc.curveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
      cx = c.x;
      cy = c.y;
    } else if (c.type === 'Q') {
      const [x1, y1, x2, y2, x, y] = quadToCubic(cx, cy, c.x1, c.y1, c.x, c.y);
      doc.curveTo(x1, y1, x2, y2, x, y);
      cx = x;
      cy = y;
    } else if (c.type === 'Z') {
      doc.close();
      cx = sx;
      cy = sy;
    }
  }
  if (started) doc.fill();
}

/** Draw Vazirmatn outlines so every PDF rasterizer (incl. pdftocairo) shows connected Persian. */
function drawVazirRun(doc, otFont, text, x, y, fontSize, { align = 'left', color = INK, rtl = false } = {}) {
  const visual = rtl ? shapePersian(text) : String(text ?? '');
  if (!visual || !otFont) return 0;
  const glyphs = [...visual].map((ch) => otFont.charToGlyph(ch));
  const scale = fontSize / otFont.unitsPerEm;
  let width = 0;
  for (const g of glyphs) width += (g.advanceWidth || 0) * scale;
  let pen = align === 'right' ? x - width : x;
  doc.setFillColor(...color);
  for (const g of glyphs) {
    fillOtPath(doc, g.getPath(pen, y, fontSize));
    pen += (g.advanceWidth || 0) * scale;
  }
  return width;
}

const PAGE = { w: 595.28, h: 841.89 };
const M = 44;
const CONTENT = PAGE.w - M * 2;

const INK = [31, 29, 25];
const MUTED = [112, 107, 99];
const ACCENT = [45, 106, 79];
const BORDER = [214, 209, 197];
const SOFT = [244, 241, 234];
const WHITE = [255, 255, 255];
const PEACH = [221, 141, 62];
const PEACH_SOFT = [248, 234, 216];
const SAGE_SOFT = [229, 242, 238];

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

function asciiSafe(value) {
  return String(value ?? '')
    .replace(/→/g, '->')
    .replace(/[–—]/g, '-')
    .replace(/·/g, ' | ')
    .replace(/[^\t\n\r\x20-\x7E]/g, '');
}

function fmt(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  const n = Number(value);
  return Number.isInteger(n) && digits === 0 ? String(n) : n.toFixed(digits);
}

/** Print a stored metric as-is (4, 3.5, 3.75) without rounding to 2 decimals. */
function fmtMetric(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  const rounded = Math.round(n * 1000) / 1000;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

/** Final is formula output stored to thousandths: 3.95, 3.975, 3.788. */
function fmtFinal(value) {
  return fmtMetric(value);
}

const FORMULA_ASCII =
  'Final = 0.30 Impact + 0.25 Execution + 0.20 Ownership + 0.15 Collaboration + 0.10 Growth';

function scoreText(value) {
  if (value == null) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? `${n}/${SCORE_MAX}` : `${n.toFixed(2)}/${SCORE_MAX}`;
}

class Sheet {
  constructor() {
    this.doc = new jsPDF({ unit: 'pt', format: 'a4' });
    this.write = this.doc.text.bind(this.doc);
    const origText = this.write;
    this.doc.text = (text, ...rest) => {
      if (Array.isArray(text)) return origText(text.map((line) => asciiSafe(line)), ...rest);
      return origText(asciiSafe(text), ...rest);
    };
    this.y = M;
    this.ot = null;
  }

  setFont(size, weight = 'normal', color = INK) {
    this.doc.setFont('helvetica', weight);
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
  }

  otFace(weight = 'normal') {
    if (!this.ot) throw new Error('Vazirmatn outlines not registered');
    if (weight === 'bold') return this.ot.bold;
    if (weight === 'medium') return this.ot.medium || this.ot.regular;
    return this.ot.regular;
  }

  vazirText(value, x, y, { size = 11.5, weight = 'normal', color = INK, align = 'right', rtl = true } = {}) {
    drawVazirRun(this.doc, this.otFace(weight), value, x, y, size, { align, color, rtl });
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
    const lines = this.doc.splitTextToSize(asciiSafe(value ?? ''), width);
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
  doc.text(asciiSafe('APK Gate | individual performance review'), M, 54);

  sheet.setFont(9, 'bold', WHITE);
  doc.text(period || 'No period', PAGE.w - M, 38, { align: 'right' });
  sheet.setFont(8, 'normal', [214, 233, 222]);
  doc.text(
    asciiSafe(`Generated ${new Date().toLocaleDateString()}${reviewer ? ` | ${reviewer}` : ''}`),
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

function drawSummary(sheet, { overall, expected, verdict, scored, total, level, formula }) {
  const { doc } = sheet;
  const gap = 12;
  const cardW = (CONTENT - gap) / 2;
  const cards = [
    ['Final score', `${fmt(overall)} / ${SCORE_MAX}`, 'Weighted five-metric score'],
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
  if (formula) {
    sheet.space(8);
    sheet.text(asciiSafe(formula), { size: 8, color: MUTED });
    sheet.text('Unscored metrics count as 0 and keep their weight.', { size: 7.5, color: MUTED });
  }

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

function drawFiveMain(sheet, metrics, { level, expectations, hint }) {
  if (!metrics) return;
  const { doc } = sheet;
  const levelBar = expectedForLevel(level, expectations);
  sheet.sectionTitle(
    'Five main metrics',
    asciiSafe(hint || `${finalFormulaText()} | L${level} expects ${fmt(levelBar, 1)}`),
  );
  const colW = (CONTENT - 16) / 5;
  sheet.ensure(66);
  const top = sheet.y;
  FIVE_METRICS.forEach((m, i) => {
    const x = M + i * colW;
    const value = metrics[m.key];
    doc.setFillColor(...SOFT);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, top, colW - 6, 56, 5, 5, 'FD');
    sheet.setFont(7.5, 'bold', MUTED);
    doc.text(asciiSafe(`${m.label} | ${Math.round(m.weight * 100)}%`), x + 8, top + 16);
    sheet.setFont(16, 'bold', INK);
    doc.text(fmt(value), x + 8, top + 38);
    sheet.setFont(6.5, 'normal', MUTED);
    doc.text(value == null ? 'not scored' : asciiSafe(m.hint), x + 8, top + 50);
  });
  sheet.y = top + 62;
}

function drawSpecParams(sheet, employeeSpecs, specScores, five) {
  const metrics = employeeSpecs?.metrics;
  if (!metrics?.length) return;
  sheet.sectionTitle(
    'Specification parameters',
    'Each parent metric is the average of its scored parameters (weighted when weights differ).',
  );
  const { doc } = sheet;
  for (const metric of metrics) {
    const rolled = five?.[metric.key];
    sheet.ensure(28);
    sheet.setFont(10, 'bold', INK);
    doc.text(
      asciiSafe(`${metric.label}  ${fmt(rolled)}  (${rollupHint(metric, specScores)})`),
      M,
      sheet.y + 12,
    );
    sheet.y += 18;
    for (const spec of metric.specs || []) {
      const value = specScores?.[spec.id];
      const scored = typeof value === 'number' && Number.isFinite(value);
      const titleLines = doc.splitTextToSize(asciiSafe(spec.title), CONTENT - 90);
      const h = Math.max(22, 8 + titleLines.length * 11);
      sheet.ensure(h);
      const y0 = sheet.y;
      sheet.setFont(9, 'bold', INK);
      doc.text(titleLines, M + 8, y0 + 14);
      sheet.setFont(9.5, 'bold', scored ? INK : MUTED);
      doc.text(scored ? fmt(value, Number.isInteger(value) ? 0 : 2) : '-', M + CONTENT - 36, y0 + 14);
      sheet.y = y0 + h;
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.4);
      doc.line(M, sheet.y, M + CONTENT, sheet.y);
    }
    sheet.space(8);
  }
}

function drawArchiveExtras(sheet, archive) {
  if (!archive) return;
  const bonus = archive.bonus ? `${Math.round(Number(archive.bonus) * 100)}%` : '-';
  sheet.space(6);
  sheet.text(
    asciiSafe(
      `Spreadsheet final ${fmt(archive.excelFinal)}${archive.computedFinal != null ? ` | recomputed ${fmt(archive.computedFinal)}` : ''} | bonus ${bonus}`,
    ),
    { size: 9.5, weight: 'bold' },
  );
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

export function buildPdf({
  catalog,
  name,
  period,
  roleSlug,
  level,
  scores,
  notes,
  promotion = {},
  archive,
  reviewer,
  specScores,
  employeeSpecs,
  metrics,
}) {
  const { role, domains, domainAvgs, overall, scored, total } = scoreState(catalog, roleSlug, scores);
  const five = resolveFiveMetrics({
    metrics,
    archive,
    catalog,
    roleSlug,
    scores,
    specScores,
    employeeSpecs,
    archived: Boolean(archive),
  });
  const fiveFinal = finalFromFive(five);
  const headline = fiveFinal;
  const expected = catalog.levelExpectations[level];
  const verdict = verdictFor(headline, level, catalog.levelExpectations);
  const levelMeta = catalog.levels.find((l) => l.id === Number(level));
  const roleLabel = role?.label || 'Role';
  const relatedDomains = domains.filter((d) => d.metrics?.length);
  const fromSpecs = fiveFromSpecScores(employeeSpecs, specScores);

  const sheet = new Sheet();

  drawHeader(sheet, {
    name,
    roleLabel,
    level,
    period,
    reviewer,
  });
  drawSummary(sheet, {
    overall: headline,
    expected,
    verdict,
    scored,
    total,
    level,
    formula: fiveFinal != null ? finalFormulaText() : 'No parent metrics scored yet',
  });
  drawFiveMain(sheet, five, {
    level,
    expectations: catalog.levelExpectations,
    hint: archive
      ? `Original archived scores out of ${SCORE_MAX} | ${finalFormulaText()}`
      : fromSpecs
        ? `Rolled up from specification parameters | ${finalFormulaText()}`
        : `${finalFormulaText()} | L${level} expects ${fmt(expected, 1)}`,
  });
  if (archive) drawArchiveExtras(sheet, archive);
  else if (employeeSpecs?.metrics?.length) drawSpecParams(sheet, employeeSpecs, specScores, five || fromSpecs);

  const hasSkillScores = scores && Object.values(scores).some((v) => typeof v === 'number');
  if (hasSkillScores) {
    sheet.sectionTitle('Domain summary', `Weighted ${roleLabel} score versus L${level} expectation`);
    drawDomainTable(sheet, { domains: relatedDomains, domainAvgs, weights: catalog.weights, expected });
    drawSkillIndex(sheet, { domains: relatedDomains, scores, roleLabel, level });
    for (const domain of relatedDomains) {
      drawSkills(sheet, { domain, scores, level, weights: catalog.weights, roleLabel });
    }
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
  if (value == null || !Number.isFinite(Number(value))) return '-';
  const n = Number(value);
  if (Math.abs(n) < 0.0005) return '0.000';
  const rounded = Math.round(n * 1000) / 1000;
  const body = Math.abs(rounded).toFixed(3);
  return `${rounded > 0 ? '+' : '-'}${body}`;
}

function deltaColor(value) {
  if (value == null || !Number.isFinite(Number(value))) return MUTED;
  if (Number(value) > 0.0005) return ACCENT;
  if (Number(value) < -0.0005) return VERDICT_COLOR.below;
  return MUTED;
}

const ROLE_LABELS = {
  backend: 'Backend',
  frontend: 'Frontend',
  devops: 'DevOps',
  devnet: 'DevNet',
  service: 'Service',
  qa: 'QA',
};

function isPeriod(value, want) {
  return String(value || '').trim().toLowerCase() === String(want || '').trim().toLowerCase();
}

function finalForPeriod(person, period) {
  if (!period) return null;
  if (isPeriod(person.latestPeriod, period)) return person.latestFinal ?? null;
  if (isPeriod(person.previousPeriod, period)) return person.previousFinal ?? null;
  return null;
}

function shortSigned(value) {
  if (value == null || !Number.isFinite(Number(value))) return '-';
  const n = Number(value);
  if (Math.abs(n) < 0.0005) return '0.00';
  const rounded = Math.round(n * 100) / 100;
  const body = Math.abs(rounded).toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
  return `${rounded > 0 ? '+' : '-'}${body}`;
}

function compactDeltaStrip(previous, latest) {
  return FIVE_METRICS.map((m) => {
    const a = previous?.[m.key];
    const b = latest?.[m.key];
    const letter = m.label[0];
    if (typeof a !== 'number' || typeof b !== 'number') return `${letter} -`;
    return `${letter} ${shortSigned(b - a)}`;
  }).join('    ');
}

function specTitle(metricKey, specId) {
  const spec = METRIC_SPEC_BY_KEY[metricKey]?.specs?.find((s) => s.id === specId);
  return spec?.title || specId;
}

function standingPhrase(metricKey, specId, verb) {
  return { metricKey, specId, verb };
}

const METRIC_FA = {
  impact: 'تأثیر',
  execution: 'اجرا',
  ownership: 'مالکیت',
  collaboration: 'همکاری',
  growth: 'رشد',
};

const SPEC_FA = {
  'impact-scope': 'گستره اثر',
  'impact-throughput': 'خروجی با وزن سختی',
  'impact-outcome': 'نتیجه کسب‌وکار',
  'impact-durability': 'ماندگاری کار',
  'exec-predictability': 'پیش‌بینی‌پذیری تحویل',
  'exec-failure-rate': 'نرخ شکست تغییرات',
  'exec-review-depth': 'عمق بازبینی',
  'exec-estimation': 'دقت تخمین',
  'own-autonomy': 'استقلال عمل',
  'own-end-to-end': 'پاسخگویی سرتاسری',
  'own-incident': 'پاسخ به حادثه',
  'own-judgment': 'قضاوت در ابهام',
  'collab-writing': 'ارتباط نوشتاری',
  'collab-cross-role': 'هماهنگی بین‌نقشی',
  'collab-feedback': 'کیفیت بازخورد',
  'collab-influence': 'نفوذ و هم‌راستایی',
  'growth-velocity': 'سرعت یادگیری',
  'growth-sharing': 'اشتراک دانش',
  'growth-mentorship': 'منتورشیپ',
  'growth-trajectory': 'مسیر گستره',
};

const VERB_FA = {
  widened: 'وسیع‌تر شد',
  'ticked up': 'بهتر شد',
  held: 'پایدار ماند',
  eased: 'کمی افت کرد',
  tightened: 'منسجم‌تر شد',
};

/** Page-2 copy: exactly three spec phrases. No tickets, no extra prose. */
const STANDING_BY_USER = {
  'ali.dehghan': [
    standingPhrase('impact', 'impact-scope', 'widened'),
    standingPhrase('execution', 'exec-review-depth', 'ticked up'),
    standingPhrase('ownership', 'own-end-to-end', 'eased'),
  ],
  'a.ghasemi': [
    standingPhrase('impact', 'impact-outcome', 'widened'),
    standingPhrase('execution', 'exec-failure-rate', 'held'),
    standingPhrase('growth', 'growth-sharing', 'ticked up'),
  ],
  'a.pahlavanian': [
    standingPhrase('impact', 'impact-scope', 'held'),
    standingPhrase('collaboration', 'collab-writing', 'tightened'),
    standingPhrase('ownership', 'own-incident', 'eased'),
  ],
  'hosseini.motlagh': [
    standingPhrase('impact', 'impact-durability', 'held'),
    standingPhrase('execution', 'exec-review-depth', 'ticked up'),
    standingPhrase('ownership', 'own-judgment', 'held'),
  ],
  'f.ahmadi': [
    standingPhrase('impact', 'impact-durability', 'held'),
    standingPhrase('collaboration', 'collab-cross-role', 'held'),
    standingPhrase('execution', 'exec-failure-rate', 'ticked up'),
  ],
  'm.noeiaval': [
    standingPhrase('ownership', 'own-incident', 'held'),
    standingPhrase('impact', 'impact-outcome', 'held'),
    standingPhrase('collaboration', 'collab-influence', 'ticked up'),
  ],
  'hamed.dehghan': [
    standingPhrase('impact', 'impact-scope', 'widened'),
    standingPhrase('collaboration', 'collab-cross-role', 'ticked up'),
    standingPhrase('growth', 'growth-velocity', 'ticked up'),
  ],
};

function standingFromDeltas(previous, latest) {
  const moved = [];
  const held = [];
  for (const m of FIVE_METRICS) {
    const a = previous?.[m.key];
    const b = latest?.[m.key];
    if (typeof a !== 'number' || typeof b !== 'number') continue;
    const d = b - a;
    const specId = METRIC_SPEC_BY_KEY[m.key]?.specs?.[0]?.id;
    let verb = 'held';
    if (d > 0.0005) verb = m.key === 'execution' || m.key === 'collaboration' ? 'ticked up' : 'widened';
    else if (d < -0.0005) verb = 'eased';
    const phrase = standingPhrase(m.key, specId, verb);
    if (Math.abs(d) < 0.0005) held.push(phrase);
    else moved.push(phrase);
  }
  return [...moved, ...held].slice(0, 3);
}

const STANDING_BY_NAME = {
  'alireza dehghan': 'ali.dehghan',
  'ali ghasemi': 'a.ghasemi',
  'abolfazl pahlavanian': 'a.pahlavanian',
  'laya hosseini motlagh': 'hosseini.motlagh',
  'fatemeh ahmadi': 'f.ahmadi',
  'mohsen noeiaval': 'm.noeiaval',
  'hamed dehghan': 'hamed.dehghan',
};

function standingFor(person) {
  const user = String(person.username || '').trim().toLowerCase();
  const name = String(person.name || '').trim().toLowerCase();
  const rows =
    STANDING_BY_USER[user] ||
    STANDING_BY_USER[STANDING_BY_NAME[name]] ||
    standingFromDeltas(person.previous, person.latest);
  return rows.slice(0, 3);
}

function drawEvidencePage(sheet, people, { q1Period, q2Period }) {
  const { doc } = sheet;
  doc.addPage();
  sheet.y = M;

  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, PAGE.w, 52, 'F');
  sheet.setFont(16, 'bold', WHITE);
  doc.text('Metric evidence', M, 28);
  sheet.vazirText('شواهد مشخصات', PAGE.w - M, 28, {
    size: 13,
    weight: 'bold',
    color: WHITE,
    align: 'right',
    rtl: true,
  });
  sheet.setFont(9, 'normal', [214, 233, 222]);
  doc.text(asciiSafe(`${q2Period} vs ${q1Period}`), M, 44);

  sheet.y = 66;

  people.forEach((p) => {
    const q1 = p.previousFinal;
    const q2 = p.latestFinal;
    const delta = typeof q1 === 'number' && typeof q2 === 'number' ? q2 - q1 : null;
    const phrases = standingFor(p);
    const phraseLeading = 20;
    const cardH = 28 + phrases.length * phraseLeading + 10;
    sheet.ensure(cardH + 4);

    const y0 = sheet.y;
    doc.setFillColor(...WHITE);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.55);
    doc.roundedRect(M, y0, CONTENT, cardH, 5, 5, 'FD');
    doc.setFillColor(...ACCENT);
    doc.rect(M, y0 + 6, 4, cardH - 12, 'F');

    const innerRight = M + CONTENT - 14;
    const innerLeft = M + 16;

    sheet.setFont(11.5, 'bold', INK);
    doc.text(asciiSafe(p.name || 'Unnamed'), innerLeft, y0 + 20);
    sheet.setFont(11, 'bold', deltaColor(delta));
    doc.text(signed(delta), innerRight, y0 + 20, { align: 'right' });

    let by = y0 + 40;
    phrases.forEach((row) => {
      const metric = FIVE_METRICS.find((m) => m.key === row.metricKey);
      const metricEn = metric?.label || row.metricKey;
      const specEn = specTitle(row.metricKey, row.specId);
      const specFa = SPEC_FA[row.specId] || specEn;
      const metricFa = METRIC_FA[row.metricKey] || '';
      const verbFa = VERB_FA[row.verb] || row.verb;
      const latin = `${metricEn}  -  ${specEn}`;
      const persian = `${metricFa}، ${specFa}  ·  ${verbFa}`;

      sheet.setFont(9, 'bold', INK);
      doc.text(asciiSafe(latin), innerLeft, by);
      sheet.vazirText(persian, innerRight, by, {
        size: 10,
        weight: 'normal',
        color: MUTED,
        align: 'right',
        rtl: true,
      });
      by += phraseLeading;
    });

    sheet.y = y0 + cardH + 4;
  });
}

/** Simple CTO comparison: one table plus evidence page. */
export function buildTeamPdf(evaln, options = {}) {
  const sheet = new Sheet();
  sheet.ot = registerPersianFonts(sheet.doc, options.fonts);
  const { doc } = sheet;
  const people = evaln.people || [];
  const q1Period = evaln.q1Period || 'Q1 1405';
  const q2Period = isPeriod(evaln.latest, 'Q2 1405') ? evaln.latest : 'Q2 1405';
  const generated = evaln.generated || new Date().toISOString().slice(0, 10);

  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, PAGE.w, 86, 'F');
  sheet.setFont(17, 'bold', WHITE);
  doc.text('GATE Team Report', M, 34);
  sheet.setFont(10, 'bold', WHITE);
  doc.text(asciiSafe(`${q1Period} vs ${q2Period}`), M, 52);
  sheet.setFont(8.5, 'normal', [214, 233, 222]);
  doc.text(asciiSafe(`${people.length} employees | scale 1-${SCORE_MAX}`), M, 68);
  sheet.setFont(8, 'normal', [214, 233, 222]);
  doc.text(`Generated ${generated}`, PAGE.w - M, 34, { align: 'right' });

  sheet.y = 108;
  sheet.text(
    'One row per employee. Improvement is Q2 Final minus Q1 Final.',
    { size: 9, color: MUTED },
  );
  sheet.text(`${FORMULA_ASCII}. Unscored metrics count as 0.`, {
    size: 8,
    color: MUTED,
  });

  sheet.space(12);
  const cols = ['Name', 'Role', 'Level', 'Q1 Final', 'Q2 Final', 'Improvement'];
  const widths = [148, 68, 44, 78, 78, CONTENT - 148 - 68 - 44 - 78 - 78];

  doc.setFillColor(...ACCENT);
  doc.rect(M, sheet.y, CONTENT, 22, 'F');
  sheet.setFont(7.5, 'bold', WHITE);
  let hx = M;
  cols.forEach((label, i) => {
    doc.text(label.toUpperCase(), hx + 6, sheet.y + 15);
    hx += widths[i];
  });
  sheet.y += 22;

  people.forEach((p, idx) => {
    const q1 = finalForPeriod(p, q1Period);
    const q2 = finalForPeriod(p, q2Period);
    const delta = typeof q1 === 'number' && typeof q2 === 'number' ? q2 - q1 : null;
    const unscored = q1 == null && q2 == null;
    const rowH = 24;
    sheet.ensure(rowH + 4);
    if (idx % 2 === 0) {
      doc.setFillColor(250, 248, 244);
      doc.rect(M, sheet.y, CONTENT, rowH, 'F');
    }
    const cells = [
      asciiSafe(p.name || 'Unnamed'),
      asciiSafe(ROLE_LABELS[p.roleSlug] || p.roleSlug || '-'),
      p.level ? `L${p.level}` : '-',
      unscored || q1 == null ? '-' : fmtFinal(q1),
      unscored || q2 == null ? '-' : fmtFinal(q2),
      signed(delta),
    ];
    let cx = M;
    cells.forEach((value, i) => {
      const alignRight = i >= 3;
      if (i === 0) sheet.setFont(9, 'bold', INK);
      else if (i === 5) sheet.setFont(9, 'bold', deltaColor(delta));
      else sheet.setFont(9, i === 1 || i === 2 ? 'normal' : 'bold', unscored ? MUTED : INK);
      const x = alignRight ? cx + widths[i] - 8 : cx + 6;
      doc.text(String(value), x, sheet.y + 16, alignRight ? { align: 'right' } : undefined);
      cx += widths[i];
    });
    sheet.y += rowH;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.4);
    doc.line(M, sheet.y, M + CONTENT, sheet.y);
  });

  drawEvidencePage(sheet, people, { q1Period, q2Period });
  drawFooters(sheet, 'GATE team');
  return sheet.doc;
}

export function exportTeamPdf(evaln) {
  buildTeamPdf(evaln).save(`${fileStem('team-progress', evaln.latest)}.pdf`);
}
