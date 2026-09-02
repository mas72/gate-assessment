// Specification model behind the five main metrics.
//
// Level bands follow the scope-and-autonomy ladder used by modern engineering
// ladders (task -> component -> system -> cross-team -> org) rather than tenure.
// Volume signals (commits, PRs, lines, story points) are deliberately excluded:
// AI assistants inflate all of them, so throughput is weighted by difficulty
// instead. Delivery parameters use the DORA set (lead time, change failure rate,
// MTTR) and the collaboration parameters use SPACE-style observable artifacts.

// Recommended score window per level, L1 through L7, on the 1-7 scale. Core
// parameters are centred on the level itself, so an L3 is expected around 3.
const RAMPS = {
  // Hygiene parameters: expected to be solid early and then saturate.
  early: [[1.5, 2.5], [2.5, 3.5], [3.5, 4.5], [4.5, 5.5], [5.0, 6.0], [5.5, 6.5], [6.0, 7.0]],
  // Core parameters: track the level expectation directly.
  standard: [[1.0, 1.5], [1.5, 2.5], [2.5, 3.5], [3.5, 4.5], [4.5, 5.5], [5.5, 6.5], [6.3, 7.0]],
  // Leadership parameters: stay low until the scope actually widens.
  late: [[1.0, 1.0], [1.0, 1.5], [1.5, 2.5], [2.5, 3.5], [4.0, 5.0], [5.0, 6.0], [6.0, 7.0]],
};

export const RAMP_LABELS = {
  early: 'Hygiene — expected solid early',
  standard: 'Core — tracks the level',
  late: 'Leadership — unlocks at senior levels',
};

export function bandFor(spec, level) {
  const rows = RAMPS[spec.ramp] || RAMPS.standard;
  const lv = Math.min(7, Math.max(1, Number(level) || 1));
  const [min, max] = rows[lv - 1];
  return { min, max };
}

export function allBands(spec) {
  return (RAMPS[spec.ramp] || RAMPS.standard).map(([min, max], i) => ({ level: i + 1, min, max }));
}

export function bandVerdict(spec, level, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const { min, max } = bandFor(spec, level);
  if (value < min) return { key: 'below', label: 'Below the L' + level + ' range' };
  if (value > max) return { key: 'above', label: 'Above the L' + level + ' range' };
  return { key: 'in', label: 'Inside the L' + level + ' range' };
}

export const METRIC_SPECS = [
  {
    key: 'impact',
    label: 'Impact',
    weight: 0.3,
    question: 'Did the product actually move because this person was on the team?',
    basis: 'Scope-and-autonomy ladder, complexity-weighted throughput, code durability.',
    specs: [
      {
        id: 'impact-scope',
        title: 'Scope of impact',
        ramp: 'standard',
        what: 'The size of the surface their work changes, from a single task up to the whole organisation. This is the primary level signal — everything else is secondary to it.',
        evidence: 'Name the widest thing they changed this quarter and who else depended on it.',
        byRole: {
          backend: 'endpoint → service → bounded domain → platform contract',
          frontend: 'component → screen → shared design system → whole product surface',
          devops: 'single job → pipeline → cluster → the delivery platform every team uses',
          devnet: 'device config → site → region → network architecture',
          service: 'ticket → customer account → service process → service organisation',
          qa: 'test case → suite → release gate → the team’s quality strategy',
        },
      },
      {
        id: 'impact-throughput',
        title: 'Complexity-adjusted throughput',
        ramp: 'standard',
        what: 'How much genuinely hard work lands, weighted by difficulty (easy 1, medium 3, hard 8). Never count commits, pull requests, lines, or story points — AI assistants inflate every one of those.',
        evidence: 'Two or three of the hardest items they finished, and why each was hard.',
      },
      {
        id: 'impact-outcome',
        title: 'Business and product outcome',
        ramp: 'late',
        what: 'Whether shipped work moved a number someone outside the team cares about: revenue, cost, latency, incident count, customer resolution time.',
        evidence: 'The metric before and after, plus who confirmed the change.',
        byRole: {
          devops: 'deployment frequency, infrastructure cost, or platform uptime',
          devnet: 'network availability, link utilisation, or provisioning turnaround',
          service: 'first-response time, resolution time, or repeat-ticket rate',
          qa: 'escaped defects and change failure rate after release',
        },
      },
      {
        id: 'impact-durability',
        title: 'Durability of the work',
        ramp: 'early',
        what: 'What they ship survives. Work that is rewritten, reverted, or hot-fixed within the first sprint after merge is not impact — it is rework moved forward.',
        evidence: 'Rollbacks, reverts, and rewrite rate on their changes in the first weeks after release.',
      },
    ],
  },
  {
    key: 'execution',
    label: 'Execution',
    weight: 0.25,
    question: 'Is the way the work gets done reliable and predictable?',
    basis: 'DORA delivery metrics (lead time, change failure rate) plus review depth.',
    specs: [
      {
        id: 'exec-predictability',
        title: 'Delivery predictability',
        ramp: 'standard',
        what: 'Lead time from start to production is stable enough to forecast, and what they commit to in sprint planning lands in that sprint.',
        evidence: 'Carry-over count across the last three sprints and the reasons behind it.',
      },
      {
        id: 'exec-failure-rate',
        title: 'Change failure rate',
        ramp: 'early',
        what: 'Share of their changes that cause a rollback, hotfix, or production defect. This is hygiene: it should be solid well before senior levels.',
        evidence: 'Production defects traced back to their changes this quarter.',
        byRole: {
          devops: 'failed deployments and changes that needed an emergency window',
          devnet: 'config changes that caused a link or service outage',
          qa: 'defects that escaped the gate they owned',
        },
      },
      {
        id: 'exec-review-depth',
        title: 'Review depth',
        ramp: 'standard',
        what: 'Their reviews catch design and failure-mode problems, not formatting. Review is the main bottleneck in AI-assisted work, so rubber-stamped approvals count against this.',
        evidence: 'A review where their comment prevented a real production problem.',
      },
      {
        id: 'exec-estimation',
        title: 'Estimation accuracy',
        ramp: 'standard',
        what: 'The Original Story Point set before Technical Review holds up against the actual effort, and they flag the gap early when it does not.',
        evidence: 'Original versus final story points across the quarter, and how early the deviation was raised.',
      },
    ],
  },
  {
    key: 'ownership',
    label: 'Ownership',
    weight: 0.2,
    question: 'Do they carry the outcome, or only the task they were handed?',
    basis: 'Autonomy ladder (needs direction → independent → sets direction) plus MTTR.',
    specs: [
      {
        id: 'own-autonomy',
        title: 'Autonomy',
        ramp: 'standard',
        what: 'How much direction they need: told what to do → given a goal → finds the goal → sets the direction others follow.',
        evidence: 'How much of their quarter came from a backlog item versus something they identified.',
      },
      {
        id: 'own-end-to-end',
        title: 'End-to-end accountability',
        ramp: 'standard',
        what: 'They follow work through release, monitoring, and the first production week. "My part is merged" is not done.',
        evidence: 'A case where they stayed with a change after merge until it was proven in production.',
      },
      {
        id: 'own-incident',
        title: 'Incident response',
        ramp: 'standard',
        what: 'Contribution to time-to-restore: they detect, communicate clearly during the incident, restore service, and write the follow-up.',
        evidence: 'An incident they handled and the postmortem that came out of it.',
        byRole: {
          devops: 'on-call primary rotation and platform incident command',
          devnet: 'network outage response and escalation to the carrier',
          service: 'customer-facing incident communication and escalation',
          qa: 'reproduction, severity call, and the regression that closes the gap',
        },
      },
      {
        id: 'own-judgment',
        title: 'Judgment under uncertainty',
        ramp: 'late',
        what: 'They make defensible calls without complete information, raise risk before it becomes a problem, and push back with evidence rather than opinion.',
        evidence: 'A decision they made under ambiguity and how it turned out.',
      },
    ],
  },
  {
    key: 'collaboration',
    label: 'Collaboration',
    weight: 0.15,
    question: 'Is the team faster because this person is in it?',
    basis: 'SPACE communication dimension, judged on async-observable artifacts only.',
    specs: [
      {
        id: 'collab-writing',
        title: 'Written communication',
        ramp: 'early',
        what: 'Tickets, design notes, and pull request descriptions that someone in another timezone can act on without a meeting. Being talkative in standup is not a signal.',
        evidence: 'A ticket or document of theirs that needed no follow-up questions.',
      },
      {
        id: 'collab-cross-role',
        title: 'Cross-role coordination',
        ramp: 'standard',
        what: 'Handoffs with QA, PO, DevOps, and Service go through cleanly without needing escalation to a lead.',
        evidence: 'A delivery that crossed at least two roles and moved without a lead unblocking it.',
      },
      {
        id: 'collab-feedback',
        title: 'Feedback quality',
        ramp: 'standard',
        what: 'Feedback they give is specific and actionable; feedback they receive gets absorbed without friction or repetition.',
        evidence: 'A review thread showing both directions working well.',
      },
      {
        id: 'collab-influence',
        title: 'Influence and alignment',
        ramp: 'late',
        what: 'They change other people’s technical decisions through reasoning and written proposals, not through seniority or volume.',
        evidence: 'A decision outside their own work that went their way on the strength of the argument.',
      },
    ],
  },
  {
    key: 'growth',
    label: 'Growth',
    weight: 0.1,
    question: 'Is this person more capable than they were a quarter ago?',
    basis: 'Learning velocity, durable knowledge artifacts, and scope trajectory.',
    specs: [
      {
        id: 'growth-velocity',
        title: 'Learning velocity',
        ramp: 'early',
        what: 'How quickly they become productive in a stack, tool, or domain they had not touched before.',
        evidence: 'Something new they picked up this quarter and how long it took to ship with it.',
      },
      {
        id: 'growth-sharing',
        title: 'Knowledge sharing',
        ramp: 'standard',
        what: 'They leave artifacts that outlive the task: runbooks, documentation, internal sessions that other people actually use.',
        evidence: 'A document or tool of theirs that someone else used without asking them.',
      },
      {
        id: 'growth-mentorship',
        title: 'Mentorship',
        ramp: 'late',
        what: 'A named colleague credits them with measurable progress. Highest-signal artifact in a promotion packet.',
        evidence: 'Who they mentored and what that person can now do unaided.',
      },
      {
        id: 'growth-trajectory',
        title: 'Scope trajectory',
        ramp: 'late',
        what: 'They are visibly operating wider than last quarter, consistently rather than in a single one-off project.',
        evidence: 'Compare their scope of impact this quarter with the previous review.',
      },
    ],
  },
];

export const METRIC_SPEC_BY_KEY = Object.fromEntries(METRIC_SPECS.map((m) => [m.key, m]));
