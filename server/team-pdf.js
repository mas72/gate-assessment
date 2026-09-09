import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEvaluation } from '../src/lib.js';
import { buildTeamPdf } from '../src/pdf.js';
import { listAssessments } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FALLBACK_PDF = path.join(__dirname, '..', 'data', 'GATE-team-progress.pdf');

export function generateTeamPdfBuffer() {
  const records = listAssessments();
  const evaln = buildEvaluation(records);
  evaln.generated = new Date().toISOString().slice(0, 10);
  const doc = buildTeamPdf(evaln);
  return Buffer.from(doc.output('arraybuffer'));
}

export function teamPdfFallbackPath() {
  return fs.existsSync(FALLBACK_PDF) ? FALLBACK_PDF : null;
}
