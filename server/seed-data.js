export const TEAM_USERS = [
  {
    username: 'm.dehghan',
    displayName: 'Masoud Dehghan',
    title: 'Team lead',
    access: 'admin',
  },
  {
    username: 'ali.dehghan',
    displayName: 'Ali Dehghan',
    title: 'Backend developer',
    access: 'readonly',
  },
  {
    username: 'a.ghasemi',
    displayName: 'A. Ghasemi',
    title: 'DevOps',
    access: 'readonly',
  },
  {
    username: 'f.ahmadi',
    displayName: 'F. Ahmadi',
    title: 'Service engineer',
    access: 'readonly',
  },
  {
    username: 'a.pahlavanian',
    displayName: 'A. Pahlavanian',
    title: 'DevNet',
    access: 'readonly',
  },
  {
    username: 'hamed.dehghan',
    displayName: 'Hamed Dehghan',
    title: 'Frontend developer',
    access: 'readonly',
  },
  {
    username: 'hosseini.motlagh',
    displayName: 'Hosseini Motlagh',
    title: 'QA',
    access: 'readonly',
  },
  {
    username: 'm.noeiaval',
    displayName: 'M. Noeiaval',
    title: 'Service developer',
    access: 'readonly',
  },
];

export const WEIGHTS = {
  technical: 0.5,
  agile: 0.15,
  soft: 0.15,
  delivery: 0.1,
  growth: 0.1,
};

// Scores run 1-7 so the scale lines up with the L1-L7 ladder: an LN engineer is
// expected around N. L7 stops at 6.8 so the top of the scale stays reachable
// without requiring a literal perfect score on every metric.
export const SCORE_MAX = 7;

export const LEVEL_EXPECTATIONS = {
  1: 1.0,
  2: 2.0,
  3: 3.0,
  4: 4.0,
  5: 5.0,
  6: 6.0,
  7: 6.8,
};

function L(l1, l2, l3, l4, l5, l6, l7) {
  return { 1: l1, 2: l2, 3: l3, 4: l4, 5: l5, 6: l6, 7: l7 };
}

export const LEVELS = [
  {
    id: 1,
    summary:
      'Works with close guidance on well-defined GATE work. Learns product, process, and team norms. Impact is local and learning-driven.',
    gates: [
      'Finish small, well-scoped tickets end-to-end with support',
      'Follow GATE workflows: branching, review, OSP, and status updates',
      'Raise blockers early with enough context for Technical Review',
      'Apply feedback from Code Review and Technical Review',
      'Show steady improvement across several sprints',
    ],
  },
  {
    id: 2,
    summary:
      'Delivers well-defined work with moderate guidance. Impact is consistent contribution to sprint goals on APK Gate.',
    gates: [
      'Deliver well-defined features or fixes to production with little rework',
      'Work cleanly with QA, PO Checking, and Release Test',
      'Give useful review comments, not only style nits',
      'Keep quality and delivery predictable across sprints',
      'Clarify requirements when a ticket is incomplete',
    ],
  },
  {
    id: 3,
    summary:
      'Delivers independently across design, implementation, test, and release. Handles moderate ambiguity at team level.',
    gates: [
      'Own features end-to-end with predictable quality and little oversight',
      'Turn partially defined problems into a clear plan and a working change',
      'Lead work that spans more than one sprint',
      'Mentor newer teammates through pairing and review',
      'Make technical calls and explain the trade-offs',
    ],
  },
  {
    id: 4,
    summary:
      'Leads complex GATE work, reduces ambiguity, and raises team effectiveness. Impact is amplified through others.',
    gates: [
      'Lead complex initiatives and cut delivery risk',
      'Improve engineering practice with visible quality or speed gains',
      'Grow others into independent contributors',
      'Align the team on standards for APK Gate',
      'Sustain delivery across multiple cycles',
    ],
  },
  {
    id: 5,
    summary:
      'Aligns architecture and execution across adjacent teams. Handles high-impact ambiguity. Impact is cross-team.',
    gates: [
      'Lead work that spans teams with aligned execution',
      'Set technical direction for a shared GATE subsystem',
      'Shape roadmap choices with clear risk and trade-off framing',
      'Move multi-team metrics: reliability, lead time, quality',
      'Coach seniors to take broader ownership',
    ],
  },
  {
    id: 6,
    summary:
      'Sets long-term technical direction, removes systemic risk, and ties GATE engineering to business outcomes.',
    gates: [
      'Define and execute a multi-year technical strategy with measurable results',
      'Fix systemic issues that span domains or teams',
      'Grow strong technical decision-makers',
      'Align GATE direction with product and business constraints',
      'Influence senior stakeholders with credible judgment',
    ],
  },
  {
    id: 7,
    summary:
      'Shapes the company technical path and engineering culture. Impact is durable and organisation-wide.',
    gates: [
      'Sustain company-wide technical impact over time',
      'Raise engineering quality and culture at scale',
      'Develop the next generation of senior technical leaders',
      'Influence company direction through technical vision',
      'Represent GATE engineering credibly outside the team',
    ],
  },
];

export const SHARED_DOMAINS = [
  {
    id: 'agile',
    title: 'Agile & Scrum',
    weightKey: 'agile',
    metrics: [
      {
        id: 'sprint-reliability',
        title: 'Sprint Reliability',
        description:
          'Protects sprint goals: honest scope, capacity-aware commitments, and visible progress on the GATE board.',
        levels: L(
          'Needs reminders to update tickets and often overcommits.',
          'Meets most commitments on well-defined tickets.',
          'Protects sprint goals and flags scope risk mid-sprint.',
          'Helps the team plan realistic sprints and recover from slips.',
          'Improves team-level predictability across sprints.',
          'Sets planning norms used by multiple teams.',
          'Defines organisational delivery cadence and planning quality.',
        ),
      },
      {
        id: 'flow',
        title: 'Flow Efficiency',
        description:
          'Keeps work moving: limited WIP, fewer idle handoffs between Code Review, Technical Review, and Release Test.',
        levels: L(
          'Starts many items and leaves them waiting.',
          'Finishes assigned work without extra WIP.',
          'Pulls the next right item and unblocks handoffs.',
          'Removes recurring wait states on the board.',
          'Improves team flow metrics and queue health.',
          'Designs flow across teams and shared queues.',
          'Sets org-wide WIP and flow standards.',
        ),
      },
      {
        id: 'blockers',
        title: 'Blocker Handling',
        description:
          'Surfaces blockers early with enough context for the team lead, PO, or reviewer to act.',
        levels: L(
          'Raises blockers late or without context.',
          'Flags blockers in standup with a next step.',
          'Drives blockers to a decision the same day when possible.',
          'Prevents repeated blockers by fixing the cause.',
          'Coaches others on how to escalate well.',
          'Removes systemic blockers across teams.',
          'Builds the organisation’s escalation culture.',
        ),
      },
      {
        id: 'dod',
        title: 'Definition of Done',
        description:
          'Marks work done only when review, tests, OSP, and acceptance checks are actually complete.',
        levels: L(
          'Moves tickets forward before checks are finished.',
          'Follows DoD on own tickets when reminded.',
          'Never marks done without review, tests, and OSP.',
          'Holds the team to DoD in review.',
          'Improves DoD based on production misses.',
          'Aligns DoD across related teams.',
          'Owns organisational quality gates.',
        ),
      },
      {
        id: 'process',
        title: 'Process Contribution',
        description:
          'Improves GATE process through retrospectives, board hygiene, and practical follow-through.',
        levels: L(
          'Attends ceremonies but rarely contributes.',
          'Shares useful retro notes on own work.',
          'Takes retro actions and closes them.',
          'Leads a process change the team keeps using.',
          'Improves multi-sprint operating rhythm.',
          'Spreads working practices to other teams.',
          'Shapes engineering operating model.',
        ),
      },
      {
        id: 'breakdown',
        title: 'Task Breakdown',
        description:
          'Splits work into testable tickets with clear scope, dependencies, and acceptance.',
        levels: L(
          'Needs others to slice the work.',
          'Breaks a story into tasks with help.',
          'Writes clear, testable tickets independently.',
          'Helps the team slice risky or large work.',
          'Sets the pattern for epic breakdown.',
          'Improves planning quality across teams.',
          'Defines how the organisation scopes work.',
        ),
      },
      {
        id: 'estimation',
        title: 'Estimation Quality',
        description:
          'Gives realistic SP/OSP based on complexity and risk, and updates them when facts change.',
        levels: L(
          'Estimates are guesses with no risk note.',
          'Estimates simple work reasonably.',
          'Sets OSP before Technical Review and revises when needed.',
          'Improves team estimate quality in planning.',
          'Calibrates estimates across a domain.',
          'Teaches estimation practice to other teams.',
          'Owns organisational planning accuracy.',
        ),
      },
    ],
  },
  {
    id: 'soft',
    title: 'Soft Skills',
    weightKey: 'soft',
    metrics: [
      {
        id: 'communication',
        title: 'Communication',
        description:
          'Writes and speaks clearly in Jira, review, and Rocket.Chat so others can act without extra questions.',
        levels: L(
          'Updates are late or hard to follow.',
          'Gives a clear status when asked.',
          'Writes self-contained tickets and review notes.',
          'Frames problems and options for the team.',
          'Communicates across roles without noise.',
          'Sets communication norms for the team.',
          'Represents GATE clearly to the company.',
        ),
      },
      {
        id: 'collaboration',
        title: 'Collaboration',
        description:
          'Works well with backend, frontend, DevOps, QA, service, and PO Checking without throwing work over the wall.',
        levels: L(
          'Stays in own lane and waits to be pulled in.',
          'Helps adjacent roles when asked.',
          'Coordinates handoffs without being chased.',
          'Builds working habits between roles.',
          'Unblocks cross-role delivery as a default.',
          'Improves collaboration across teams.',
          'Designs how GATE works with the rest of APK.',
        ),
      },
      {
        id: 'ownership',
        title: 'Ownership',
        description:
          'Stays with a problem until production is healthy; does not drop issues at the team boundary.',
        levels: L(
          'Stops at “I finished my part”.',
          'Owns assigned tickets through release.',
          'Follows production issues related to own changes.',
          'Takes messy problems nobody clearly owns.',
          'Owns a subsystem’s health over time.',
          'Owns outcomes across teams.',
          'Owns organisational results, not just delivery.',
        ),
      },
      {
        id: 'give-feedback',
        title: 'Giving Feedback',
        description:
          'Gives specific, kind, useful feedback in review and 1:1s.',
        levels: L(
          'Feedback is absent or only negative.',
          'Leaves basic review comments.',
          'Gives actionable review that improves the change.',
          'Coaches through feedback, not only corrections.',
          'Raises the quality of team feedback culture.',
          'Calibrates feedback across seniors.',
          'Sets organisational review culture.',
        ),
      },
      {
        id: 'receive-feedback',
        title: 'Receiving Feedback',
        description:
          'Takes review and coaching without defensiveness and changes behaviour.',
        levels: L(
          'Pushes back on most review comments.',
          'Applies clear, concrete feedback.',
          'Seeks feedback and shows the change next sprint.',
          'Uses feedback to change how they work, not one ticket.',
          'Helps others receive feedback well.',
          'Models growth under hard feedback.',
          'Turns organisational feedback into system change.',
        ),
      },
      {
        id: 'mentoring',
        title: 'Mentoring',
        description:
          'Helps teammates learn GATE product, tools, and judgment.',
        levels: L(
          'Does not yet teach others.',
          'Answers questions when asked.',
          'Pairs regularly and documents what they teach.',
          'Has a clear mentee impact over a cycle.',
          'Develops several engineers toward independence.',
          'Builds a bench of seniors.',
          'Develops the next generation of leads.',
        ),
      },
      {
        id: 'stakeholders',
        title: 'Stakeholder Clarity',
        description:
          'Keeps PO, QA, and operators informed about risk, status, and what is needed from them.',
        levels: L(
          'Stakeholders are surprised by status.',
          'Gives status when asked.',
          'Proactively shares risk and next decision needed.',
          'Manages expectations on non-trivial work.',
          'Aligns stakeholders on messy, high-impact work.',
          'Influences stakeholders across teams.',
          'Shapes executive understanding of GATE.',
        ),
      },
    ],
  },
  {
    id: 'delivery',
    title: 'Delivery & Quality',
    weightKey: 'delivery',
    metrics: [
      {
        id: 'predictable',
        title: 'Predictable Delivery',
        description:
          'Finishes what the sprint promised, or renegotiates early — no silent slips into PO Checking or Release Test.',
        levels: L(
          'Dates and scope slip without warning.',
          'Delivers simple committed work on time.',
          'Renegotiates scope before the sprint is lost.',
          'Makes team delivery more predictable.',
          'Stabilises delivery for a whole stream.',
          'Improves predictability across teams.',
          'Owns organisational delivery reliability.',
        ),
      },
      {
        id: 'prod-quality',
        title: 'Production Quality',
        description:
          'Changes land on APK Gate without avoidable rollbacks, Sev-1 noise, or missing test evidence.',
        levels: L(
          'Changes often bounce from QA or production.',
          'Own changes usually stick with support.',
          'Own changes are stable; bugs are rare and owned.',
          'Raises the bar in review so fewer defects escape.',
          'Improves a subsystem’s production defect rate.',
          'Improves quality across shared platforms.',
          'Sets company quality baseline.',
        ),
      },
      {
        id: 'incidents',
        title: 'Incident Handling',
        description:
          'When GATE breaks, debugs with evidence, communicates, and closes the loop with a real fix or follow-up.',
        levels: L(
          'Needs someone else to drive the incident.',
          'Helps with logs and reproduction.',
          'Owns an incident from alert to fix and note.',
          'Leads incidents and writes useful post-incident notes.',
          'Reduces repeat incidents in an area.',
          'Improves incident practice across teams.',
          'Designs organisational incident response.',
        ),
      },
    ],
  },
  {
    id: 'growth',
    title: 'Growth',
    weightKey: 'growth',
    metrics: [
      {
        id: 'learning',
        title: 'Learning Velocity',
        description:
          'Picks up APK Gate internals, adjacent skills, and new tools fast enough to stay useful as the product moves.',
        levels: L(
          'Learns only when scheduled.',
          'Learns assigned tools with guidance.',
          'Self-studies and applies it on real tickets.',
          'Learns a new area and becomes a local reference.',
          'Builds deep expertise that others rely on.',
          'Guides how the team learns.',
          'Sets organisational technical learning agenda.',
        ),
      },
      {
        id: 'sharing',
        title: 'Knowledge Sharing',
        description:
          'Leaves the team smarter: notes, runbooks, demos, and clearer tickets — not knowledge locked in one head.',
        levels: L(
          'Knowledge stays in private notes.',
          'Shares when asked.',
          'Documents what they learn on real work.',
          'Runs short demos or write-ups the team uses.',
          'Builds a living knowledge base for a domain.',
          'Spreads knowledge across teams.',
          'Shapes company technical communication.',
        ),
      },
      {
        id: 'self-direction',
        title: 'Self-direction',
        description:
          'Finds the next useful problem without waiting for a perfectly specified ticket.',
        levels: L(
          'Waits to be assigned every step.',
          'Takes the next ticket from the board.',
          'Proposes the next slice when blocked.',
          'Finds and lands useful work in the backlog.',
          'Sets direction for a stream between planning meetings.',
          'Directs work across teams.',
          'Sets organisational technical priorities.',
        ),
      },
      {
        id: 'scope',
        title: 'Scope Expansion',
        description:
          'Grows from task execution toward design, review, and influence matching the next level.',
        levels: L(
          'Scope is still single tasks.',
          'Owns small features.',
          'Owns a feature area through release.',
          'Owns initiatives spanning sprints.',
          'Owns a subsystem and its users.',
          'Owns a multi-team technical area.',
          'Owns company-level technical bets.',
        ),
      },
    ],
  },
];

export const ROLES = [
  {
    slug: 'backend',
    label: 'Backend',
    icon: '⬡',
    metrics: [
      {
        id: 'be-testing',
        title: 'Testing',
        description:
          'Writes backend tests that catch regressions in APK Gate services, policy, and APIs before Release Test.',
        levels: L(
          'Adds a happy-path test only when asked.',
          'Adds negative cases for assigned changes.',
          'Covers business logic and error paths on owned features.',
          'Designs test strategy for a service and its integrations.',
          'Raises team backend test confidence and stability.',
          'Standardises backend testing across services.',
          'Sets organisation-wide backend quality baseline.',
        ),
      },
      {
        id: 'be-code',
        title: 'Clean Code',
        description:
          'Writes readable, review-friendly GATE backend code with clear names and low accidental complexity.',
        levels: L(
          'Code works but needs heavy review cleanup.',
          'Follows team style with occasional guidance.',
          'PRs are easy to review and change later.',
          'Simplifies messy areas without breaking behaviour.',
          'Raises the team’s code standard in review.',
          'Defines backend conventions used across services.',
          'Sets organisational backend engineering standards.',
        ),
      },
      {
        id: 'be-data',
        title: 'Data & Persistence',
        description:
          'Models data for policy, sessions, logs, and config so integrity and queries stay correct as GATE evolves.',
        levels: L(
          'Changes schema only with close guidance.',
          'Makes safe, local schema changes.',
          'Designs models that match real query and integrity needs.',
          'Plans migrations that production can survive.',
          'Improves data design for a whole subsystem.',
          'Sets data standards across GATE services.',
          'Owns organisational data architecture.',
        ),
      },
      {
        id: 'be-design',
        title: 'System Design',
        description:
          'Designs GATE services with clear boundaries, contracts, HA, security, and operability — not only happy-path code.',
        levels: L(
          'Implements a provided design.',
          'Proposes a small design for an assigned feature.',
          'Designs a feature including failure and ops cases.',
          'Designs a service or integration with explicit trade-offs.',
          'Evolves architecture for a GATE subsystem.',
          'Aligns architecture across teams.',
          'Sets long-term GATE technical direction.',
        ),
      },
      {
        id: 'be-delivery',
        title: 'Delivery Quality',
        description:
          'Backend changes reach production reliably and meet non-functional needs (perf, logging, rollback).',
        levels: L(
          'Needs help to land a change safely.',
          'Lands well-defined changes with review.',
          'Owns feature delivery including logging and failure modes.',
          'Prevents classes of production failures in an area.',
          'Improves subsystem reliability in production.',
          'Improves reliability across services.',
          'Owns organisational reliability outcomes.',
        ),
      },
      {
        id: 'be-solve',
        title: 'Problem Solving',
        description:
          'Diagnoses backend issues with evidence (logs, traces, repro) and ships a justified fix.',
        levels: L(
          'Needs a senior to find the cause.',
          'Fixes issues with a clear repro and hints.',
          'Finds root cause on owned services independently.',
          'Solves ambiguous, cross-service failures.',
          'Teaches a diagnostic approach to the team.',
          'Solves systemic backend problems.',
          'Sets how the organisation debugs production.',
        ),
      },
    ],
  },
  {
    slug: 'frontend',
    label: 'Frontend',
    icon: '◈',
    metrics: [
      {
        id: 'fe-ui',
        title: 'UI Quality',
        description:
          'Builds GATE UI that is clear, consistent, and usable for operators under time pressure.',
        levels: L(
          'Implements screens from a spec with lots of guidance.',
          'Matches existing GATE UI patterns on assigned pages.',
          'Ships polished UI with sensible empty, error, and loading states.',
          'Improves complex flows (policy, logs, status) for real operators.',
          'Raises UI quality across GATE screens.',
          'Defines UI patterns used by multiple products.',
          'Sets organisational product UI standard.',
        ),
      },
      {
        id: 'fe-arch',
        title: 'State & Architecture',
        description:
          'Structures frontend state, APIs, and components so GATE screens stay maintainable.',
        levels: L(
          'Copies nearby code without seeing the structure.',
          'Follows the app’s state patterns with help.',
          'Chooses sound component and state boundaries.',
          'Refactors tangled UI without regressions.',
          'Owns frontend architecture for a GATE area.',
          'Aligns frontend architecture across apps.',
          'Sets company frontend architecture.',
        ),
      },
      {
        id: 'fe-test',
        title: 'Testing',
        description:
          'Protects GATE UI with meaningful unit, integration, or e2e coverage on risky flows.',
        levels: L(
          'Tests only when asked.',
          'Adds tests for a bug they just fixed.',
          'Covers critical user paths on owned screens.',
          'Designs test strategy for a complex flow.',
          'Improves frontend test reliability for the team.',
          'Standardises UI testing across apps.',
          'Sets organisational frontend quality gates.',
        ),
      },
      {
        id: 'fe-ux',
        title: 'Operator UX',
        description:
          'Designs for firewall/UTM operators: dense data, dangerous actions, and clear confirmation — not decorative UI.',
        levels: L(
          'Needs design to specify every interaction.',
          'Uses existing GATE patterns for danger and confirm.',
          'Spots UX risks (wrong default, hidden status) and fixes them.',
          'Redesigns a painful operator flow with evidence.',
          'Improves UX quality across GATE.',
          'Influences UX across related products.',
          'Sets organisational operator-experience bar.',
        ),
      },
      {
        id: 'fe-delivery',
        title: 'Delivery Quality',
        description:
          'UI changes ship without layout regressions, broken API wiring, or surprise operator behaviour.',
        levels: L(
          'UI often bounces from QA for obvious issues.',
          'Assigned screens land with minor follow-up.',
          'Owned UI is stable across browsers used by ops.',
          'Prevents classes of UI defects in review.',
          'Stabilises a whole GATE frontend area.',
          'Improves frontend quality across teams.',
          'Owns organisational frontend reliability.',
        ),
      },
      {
        id: 'fe-solve',
        title: 'Problem Solving',
        description:
          'Debugs UI, API contract, and browser issues with evidence rather than guess-and-refresh.',
        levels: L(
          'Needs a senior to find the broken layer.',
          'Fixes issues when the repro is clear.',
          'Isolates frontend vs API vs data quickly.',
          'Solves ambiguous operator-reported UI failures.',
          'Teaches frontend diagnosis to others.',
          'Solves systemic frontend problems.',
          'Defines how the org debugs client issues.',
        ),
      },
    ],
  },
  {
    slug: 'devops',
    label: 'DevOps',
    icon: '⟳',
    metrics: [
      {
        id: 'do-cicd',
        title: 'CI / CD',
        description:
          'Keeps GATE build, test, and release pipelines fast, green, and trustworthy.',
        levels: L(
          'Runs existing jobs; needs help to change them.',
          'Fixes a broken job with guidance.',
          'Owns pipeline changes for a repo or image.',
          'Designs pipeline stages that catch real faults.',
          'Improves CI signal and time for the team.',
          'Standardises pipelines across GATE repos.',
          'Sets organisational delivery platform.',
        ),
      },
      {
        id: 'do-infra',
        title: 'Infrastructure',
        description:
          'Manages environments, packaging, and runtime for APK Gate so labs and production stay reproducible.',
        levels: L(
          'Follows runbooks for known environments.',
          'Provisions or updates a known environment with help.',
          'Owns an environment’s config and recovery steps.',
          'Designs infra changes with rollback and cost in mind.',
          'Improves environment reliability for the team.',
          'Aligns infra across sites or products.',
          'Owns organisational infrastructure strategy.',
        ),
      },
      {
        id: 'do-obs',
        title: 'Observability',
        description:
          'Makes GATE visible: logs, metrics, alerts that operators and developers can actually use.',
        levels: L(
          'Looks at logs when someone points to them.',
          'Adds a useful log or dashboard field when asked.',
          'Instruments owned changes and useful alerts.',
          'Designs dashboards that shorten incident time.',
          'Improves observability for a GATE subsystem.',
          'Sets telemetry standards across services.',
          'Owns organisational observability.',
        ),
      },
      {
        id: 'do-release',
        title: 'Release Safety',
        description:
          'Ships GATE versions with known artifacts, notes, and a path back — no mystery tarballs.',
        levels: L(
          'Needs a senior to run a release.',
          'Follows the release checklist reliably.',
          'Owns a release including notes and rollback.',
          'Hardens release so classes of mistakes cannot recur.',
          'Improves release quality for the whole team.',
          'Aligns release practice across products.',
          'Sets company release engineering.',
        ),
      },
      {
        id: 'do-sec',
        title: 'Security & Access',
        description:
          'Protects secrets, access, and supply chain for GATE build and runtime systems.',
        levels: L(
          'Uses access they are given; does not yet design it.',
          'Follows secret and access rules on assigned work.',
          'Fixes access or secret handling issues they find.',
          'Designs safer defaults for a system.',
          'Raises security posture of GATE delivery systems.',
          'Aligns security practice across teams.',
          'Sets organisational security-for-delivery bar.',
        ),
      },
      {
        id: 'do-inc',
        title: 'Incident Response',
        description:
          'When CI, environments, or GATE runtime fail, restores service and records what changed.',
        levels: L(
          'Escalates immediately without first checks.',
          'Runs known recovery steps.',
          'Diagnoses and restores a failed pipeline or env.',
          'Leads infra incidents and writes a real follow-up.',
          'Reduces repeat infra incidents.',
          'Improves incident practice across platforms.',
          'Designs organisational infra incident response.',
        ),
      },
    ],
  },
  {
    slug: 'devnet',
    label: 'DevNet',
    icon: '☰',
    metrics: [
      {
        id: 'dn-auto',
        title: 'Network Automation',
        description:
          'Automates repeatable network and firewall work instead of one-off CLI on APK Gate and adjacent platforms.',
        levels: L(
          'Runs scripts others wrote.',
          'Changes a small automation with help.',
          'Writes reliable automation for a real workflow.',
          'Designs idempotent automation others can run.',
          'Replaces a class of manual ops with automation.',
          'Standardises automation across network domains.',
          'Sets organisational network-as-code direction.',
        ),
      },
      {
        id: 'dn-api',
        title: 'APIs & Integrations',
        description:
          'Uses and extends GATE and device APIs (REST, events) with stable contracts and error handling.',
        levels: L(
          'Calls an API from an example.',
          'Integrates a documented endpoint with guidance.',
          'Owns an integration including auth and failure paths.',
          'Designs API usage that other tools can share.',
          'Improves integration quality for a whole area.',
          'Aligns API practice across platforms.',
          'Owns organisational integration architecture.',
        ),
      },
      {
        id: 'dn-policy',
        title: 'Policy as Code',
        description:
          'Expresses firewall/UTM policy in reviewable, testable form rather than undocumented live clicks.',
        levels: L(
          'Applies policy changes only in the GUI with help.',
          'Captures a simple policy change in a reviewable file.',
          'Models real policy with validation before apply.',
          'Designs policy pipelines with dry-run and rollback.',
          'Moves a domain onto policy-as-code.',
          'Spreads policy-as-code across teams.',
          'Sets company policy-as-code standard.',
        ),
      },
      {
        id: 'dn-platform',
        title: 'Platform Knowledge',
        description:
          'Knows APK Gate and adjacent network/security platforms well enough to choose the right control, not a cargo-cult rule.',
        levels: L(
          'Needs a senior to pick the right feature.',
          'Configures well-documented features correctly.',
          'Chooses the right GATE/network control for the problem.',
          'Explains trade-offs across platforms to the team.',
          'Is the reference for a GATE/network domain.',
          'Aligns platform choices across teams.',
          'Sets organisational network/security architecture.',
        ),
      },
      {
        id: 'dn-delivery',
        title: 'Delivery Quality',
        description:
          'Network automation and integrations land without breaking production policy or management paths.',
        levels: L(
          'Changes often need emergency revert.',
          'Lands simple changes with review.',
          'Owns changes including validation and rollback.',
          'Prevents classes of policy/automation failures.',
          'Improves reliability of a network automation area.',
          'Improves reliability across network tooling.',
          'Owns organisational network-delivery quality.',
        ),
      },
      {
        id: 'dn-solve',
        title: 'Problem Solving',
        description:
          'Debugs packet, policy, API, and device issues with captures and evidence — not guesswork.',
        levels: L(
          'Needs someone else to read the capture.',
          'Fixes issues when the symptom is localised.',
          'Isolates GATE vs network vs client independently.',
          'Solves messy, multi-layer failures.',
          'Teaches diagnosis to others.',
          'Solves systemic network-automation problems.',
          'Defines organisational network troubleshooting.',
        ),
      },
    ],
  },
  {
    slug: 'service',
    label: 'Service',
    icon: '◇',
    metrics: [
      {
        id: 'sv-deploy',
        title: 'Deployment & Environments',
        description:
          'Installs and upgrades APK Gate in customer and lab environments with a repeatable, documented path.',
        levels: L(
          'Follows a senior through an install.',
          'Completes a known install with a checklist.',
          'Owns an install/upgrade including pre-checks.',
          'Designs a safer deploy path for a class of sites.',
          'Improves deploy quality for the service function.',
          'Aligns deploy practice across regions or products.',
          'Sets organisational field-engineering standard.',
        ),
      },
      {
        id: 'sv-trouble',
        title: 'Troubleshooting',
        description:
          'Turns operator symptoms into a GATE diagnosis with logs, config, and a clear next action.',
        levels: L(
          'Collects logs but cannot interpret them yet.',
          'Resolves common issues from the knowledge base.',
          'Diagnoses new issues in owned product areas.',
          'Solves ambiguous field issues without bouncing blindly.',
          'Raises first-time-fix quality for the team.',
          'Improves troubleshooting across the service org.',
          'Defines organisational support engineering.',
        ),
      },
      {
        id: 'sv-config',
        title: 'Configuration Quality',
        description:
          'Produces policy and system config that is correct, minimal, and supportable — not a pile of leftover rules.',
        levels: L(
          'Copies a template without checking fit.',
          'Applies a known-good template with light review.',
          'Builds config that matches the actual requirement.',
          'Cleans and structures config so the next engineer can own it.',
          'Sets config standards for a product area.',
          'Aligns config practice across the service team.',
          'Owns organisational configuration standard.',
        ),
      },
      {
        id: 'sv-esc',
        title: 'Escalation & Communication',
        description:
          'Escalates to development with a repro, impact, and what was already tried — and keeps the customer informed.',
        levels: L(
          'Escalates with “it does not work”.',
          'Includes logs and steps when asked.',
          'Writes complete escalations and status without chasing.',
          'Improves how the team escalates and closes the loop.',
          'Reduces noisy escalations through better first-line work.',
          'Aligns service–dev interface across teams.',
          'Sets organisational support–engineering contract.',
        ),
      },
      {
        id: 'sv-kb',
        title: 'Knowledge Base',
        description:
          'Turns solved field problems into notes the next engineer can use.',
        levels: L(
          'Fixes stay in chat history.',
          'Updates a note when reminded.',
          'Writes a usable article after non-trivial fixes.',
          'Keeps a domain’s runbooks current.',
          'Builds the service knowledge base others rely on.',
          'Spreads KB practice across teams.',
          'Owns organisational operational knowledge.',
        ),
      },
      {
        id: 'sv-solve',
        title: 'Problem Solving',
        description:
          'Separates product bugs, misconfig, and environment issues, and drives the right owner to a fix.',
        levels: L(
          'Treats every issue as a product bug.',
          'Splits obvious misconfig from defects with help.',
          'Classifies issues correctly and drives the fix.',
          'Solves messy multi-cause field failures.',
          'Teaches diagnosis to other service engineers.',
          'Improves how service and dev share hard problems.',
          'Defines organisational field-problem solving.',
        ),
      },
    ],
  },
  {
    slug: 'qa',
    label: 'QA',
    icon: '✓',
    metrics: [
      {
        id: 'qa-design',
        title: 'Test Design',
        description:
          'Designs GATE test coverage around risk: policy, HA, upgrade, and operator paths — not only the happy click path.',
        levels: L(
          'Executes a list someone else wrote.',
          'Adds cases for a well-specified story.',
          'Designs a test set that matches real risk.',
          'Designs coverage for a complex GATE area.',
          'Improves test design quality for the team.',
          'Aligns test design across products.',
          'Sets organisational QA strategy.',
        ),
      },
      {
        id: 'qa-reg',
        title: 'Regression Discipline',
        description:
          'Protects Release Test: known suites, clear results, and no silent skips of high-risk GATE paths.',
        levels: L(
          'Skips unclear cases instead of asking.',
          'Runs assigned regression with a result log.',
          'Owns regression for a GATE area each release.',
          'Hardens regression so missed bugs cannot hide.',
          'Improves regression signal-to-noise for the team.',
          'Standardises regression across streams.',
          'Owns organisational release-test quality.',
        ),
      },
      {
        id: 'qa-release',
        title: 'Release Test Ownership',
        description:
          'Keeps the Release Test queue honest: what is blocked, what is signed off, what still burns.',
        levels: L(
          'Waits to be told what to test next.',
          'Clears assigned Release Test items.',
          'Makes queue status visible without being asked.',
          'Unblocks Release Test by tightening inputs from dev.',
          'Improves Release Test throughput and quality.',
          'Aligns release-test practice across teams.',
          'Sets organisational release gating.',
        ),
      },
      {
        id: 'qa-defects',
        title: 'Defect Quality',
        description:
          'Files bugs developers can act on: repro, expected/actual, version, logs, severity.',
        levels: L(
          'Reports “broken” without repro.',
          'Includes steps when reminded.',
          'Files complete, correctly-severed defects.',
          'Improves defect quality across the team’s reports.',
          'Reduces bounce rate between QA and dev.',
          'Sets defect standards across teams.',
          'Owns organisational quality reporting.',
        ),
      },
      {
        id: 'qa-auto',
        title: 'Test Automation',
        description:
          'Automates stable GATE checks so humans spend time on exploratory and high-risk paths.',
        levels: L(
          'Does not yet automate.',
          'Extends an existing automated case with help.',
          'Adds reliable automation for a repetitive check.',
          'Designs automation that stays green and useful.',
          'Grows automation coverage for a GATE area.',
          'Standardises automation across products.',
          'Sets organisational test-automation platform.',
        ),
      },
      {
        id: 'qa-solve',
        title: 'Problem Solving',
        description:
          'Separates product failure, test-env failure, and bad data, and drives the right fix.',
        levels: L(
          'Treats every fail as a product bug.',
          'Re-runs and collects evidence with help.',
          'Isolates env vs product independently.',
          'Solves flaky or ambiguous failures.',
          'Teaches diagnosis to other testers.',
          'Improves how QA and dev debug together.',
          'Defines organisational test diagnosis.',
        ),
      },
    ],
  },
];

export const UNIVERSAL_PROMOTION = [
  'Show next-level scope for at least one full review cycle (scope, autonomy, influence).',
  'Keep delivery quality reliable, with no open critical performance concerns.',
  'Show collaboration, ownership, and knowledge sharing at the next level.',
  'Submit a short impact packet: outcomes, decisions, and evidence.',
  'Get a manager recommendation based on evidence, not tenure.',
];
