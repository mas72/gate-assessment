// Renders a saved assessment to PDF outside the browser, for layout checks.
// Usage: node scripts/render-sample-pdf.js <assessmentId> [outFile]
import { writeFileSync } from 'node:fs';
import { buildPdf } from '../src/pdf.js';
import { catalog as getCatalog, getAssessment } from '../server/store.js';

const id = Number(process.argv[2] || 1);
const out = process.argv[3] || `/tmp/gate-sample-${id}.pdf`;

const catalog = getCatalog();
const a = getAssessment(id);
if (!a) {
  console.error(`No assessment with id ${id}`);
  process.exit(1);
}

const doc = buildPdf({
  catalog,
  name: a.name,
  period: a.period,
  roleSlug: a.roleSlug,
  level: a.level,
  scores: a.scores,
  notes: a.notes,
  promotion: a.promotion || {},
  archive: a.archive || null,
  reviewer: 'Masoud Dehghan',
});

writeFileSync(out, Buffer.from(doc.output('arraybuffer')));
console.log(`wrote ${out} for ${a.name} (${a.period})`);
