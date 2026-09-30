/**
 * Retrieval accuracy check: `npm run assistant:eval`
 * Builds/refreshes the knowledge index, then measures whether the passage that answers each
 * question is ranked first (hit@1) or in the top 3 (hit@3), and that the expected fact is present.
 */
import 'dotenv/config';
import { rebuildIndex, searchKnowledge } from './knowledge/store.js';

const CASES: { q: string; doc: string; fact?: string }[] = [
  { q: 'What torque should the CNC spindle bearing locknut be tightened to?', doc: 'sop:SOP-MCH-001', fact: '65 Nm' },
  { q: 'How hot can I heat the new spindle bearing before fitting it?', doc: 'sop:SOP-MCH-001', fact: '110' },
  { q: 'What vibration level must the spindle pass after repair?', doc: 'sop:SOP-MCH-001', fact: '2.5 mm/s' },
  { q: 'Gland bolt torque when replacing the pump mechanical seal', doc: 'sop:SOP-PMP', fact: '35 Nm' },
  { q: 'What impeller clearance is allowed on the slurry pump?', doc: 'sop:SOP-PMP', fact: '0.50 mm' },
  { q: 'Which grease goes in the robot harmonic drive and how much?', doc: 'sop:SOP-ROB', fact: 'SK-1A' },
  { q: 'Robot gripper pneumatic line pressure setting', doc: 'sop:SOP-ROB', fact: '6.0' },
  { q: 'Filtration requirement for the hydraulic press proportional valve', doc: 'sop:SOP-PRS', fact: '3-micron' },
  { q: 'Where is the lockout box for CNC machines and what PPE do I need?', doc: 'loto:CNC' },
  { q: 'Energy isolation steps before working on a packaging machine', doc: 'loto:PACKAGING' },
  { q: 'What should be inspected on a robot during a fault?', doc: 'inspect:ROBOT' },
  { q: 'Has CNC-06 had high vibration before and what fixed it?', doc: 'incident:' },
];

async function main() {
  const status = await rebuildIndex();
  console.log(`Index: ${status.chunks} chunks / ${status.documents} docs, backend=${status.vectorBackend}`, status.bySource);
  let h1 = 0;
  let h3 = 0;
  let facts = 0;
  let factCases = 0;
  for (const c of CASES) {
    const t0 = Date.now();
    const { hits, mode } = await searchKnowledge(c.q, { topK: 5 });
    const rank = hits.findIndex((h) => h.docId.startsWith(c.doc));
    if (rank === 0) h1++;
    if (rank >= 0 && rank < 3) h3++;
    if (c.fact) {
      factCases++;
      if (hits.slice(0, 3).some((h) => h.content.includes(c.fact!))) facts++;
    }
    console.log(
      `${rank === 0 ? '✓' : rank > 0 && rank < 3 ? '~' : '✗'} [${mode}, ${Date.now() - t0}ms] ${c.q}\n    → ${hits
        .slice(0, 3)
        .map((h) => `${h.docId}${h.section ? ` (${h.section})` : ''} ${h.score}`)
        .join(' | ')}`
    );
  }
  console.log(`\nhit@1 ${h1}/${CASES.length} · hit@3 ${h3}/${CASES.length} · fact in top-3 ${facts}/${factCases}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
