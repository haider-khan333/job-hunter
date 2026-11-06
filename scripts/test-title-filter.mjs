// Regression check for the title filters, which now have to let management and
// technical-delivery titles through without re-opening the door to the
// warehouse and facade roles that forced TITLE_NON_ENG into existence.
//
//   node scripts/test-title-filter.mjs

const TITLE_WANTED = /android|\bios\b|mobile|flutter|kotlin|swift|react.?native|app developer|software (engineer|developer)|full.?stack|backend|back.?end|frontend|front.?end|engineering (lead|manager)|tech(nical)? lead|team lead|mobile lead/i;
const TITLE_WANTED_MGMT = /\b(technical|tech|software|development|squad|mobile|platform|engineering) (lead|leader|manager)\b|\btechnical (project|program|programme|delivery|product) manager\b|\b(it|digital|software) project manager\b|\bscrum master\b|\bproduct owner\b|\bsolutions? engineer\b|\bimplementation (engineer|consultant|specialist|lead|manager)\b|\bintegration (engineer|lead)\b|\btechnical account manager\b|\btechnical consultant\b|\bcustomer engineer\b|\bengineering (program|programme) manager\b/i;
const TITLE_BLOCKED = /\b(qa|quality assurance|tester|test automation|sdet|manual tester|junior|fresher|entry.?level|intern|internship|trainee|graduate programme|sales|business development|recruiter|support engineer|network engineer|it support|helpdesk|devops|sre|data (engineer|scientist|analyst)|machine learning engineer|ml engineer|salesforce|sap|odoo|sharepoint|wordpress|php|laravel|\.net|c#|c[+][+]|golang|go developer|ruby|rust|scala|embedded|firmware|unity|game|security engineer|penetration)\b/i;
const TITLE_NON_ENG = /\b(hop|dark store|warehouse|rider|driver|courier|kitchen|store|retail|operations|logistics|customer|account|facilities|housekeeping|aluminum|aluminium|facade|curtain wall|fabrication|draughtsman|draftsman|joinery|hvac|mep|civil|mechanical|structural|architectural)\b/i;
const TITLE_AMBIGUOUS = /\b(project manager|programme? manager|delivery (manager|lead)|account manager|consultant|team lead(er)?|product manager|service manager)\b/i;
const TITLE_TECH_SIGNAL = /\b(software|technical|tech|digital|it|ict|mobile|app|apps|application|android|ios|flutter|platform|cloud|api|web|fintech|payments?|banking|e.?commerce|developer|development|devops|saas)\b/i;
const TITLE_TOO_SENIOR = /\b(principal|staff engineer|director|head of|vp|chief|architect)\b/i;

function verdict(title) {
  const techy = TITLE_TECH_SIGNAL.test(title);
  const wanted = TITLE_WANTED.test(title) || TITLE_WANTED_MGMT.test(title)
    || (TITLE_AMBIGUOUS.test(title) && techy);
  if (!wanted) return 'drop: not a target role';
  if (TITLE_BLOCKED.test(title)) return 'drop: blocked list';
  if (TITLE_NON_ENG.test(title) && !techy) return 'drop: not engineering';
  if (TITLE_TOO_SENIOR.test(title)) return 'drop: too senior';
  return 'KEEP';
}

// [title, should it survive the title filters]
const CASES = [
  // the core search, unchanged
  ['Senior Android Developer', true],
  ['Flutter Developer', true],
  ['iOS Engineer', true],
  ['Mobile Engineer - React Native', true],
  ['Software Engineer', true],
  ['Backend Engineer, Payments Platform', true],
  // the management half this file exists to cover
  ['Technical Lead', true],
  ['Engineering Manager', true],
  ['Software Development Manager', true],
  ['Mobile Team Lead', true],
  ['Technical Project Manager', true],
  ['IT Project Manager', true],
  ['Scrum Master', true],
  ['Product Owner', true],
  ['Technical Product Manager', true],
  ['Solutions Engineer', true],
  ['Implementation Consultant', true],
  ['Integration Engineer', true],
  ['Technical Account Manager', true],
  ['Technical Consultant - Digital Banking', true],
  ['Delivery Manager - Software Projects', true],
  ['Project Manager (Mobile Apps)', true],
  // everything the filters already learned to refuse, which must stay refused
  ['HOP Team Leader', false],
  ['Design Team Lead (Aluminum Manufacturing)', false],
  ['Mechanical Engineer', false],
  ['Civil Project Manager', false],
  ['MEP Project Manager', false],
  ['Facade Design Manager', false],
  ['Warehouse Team Leader', false],
  ['Retail Store Manager', false],
  ['Delivery Manager', false],              // courier work until a tech word says otherwise
  ['Project Manager', false],               // same
  ['Account Manager', false],               // same
  ['Customer Service Manager', false],
  ['Operations Manager', false],
  ['Principal Software Engineer', false],
  ['Head of Engineering', false],
  ['Director of Technology', false],
  ['Software Architect', false],
  ['QA Lead - Mobile', false],
  ['Senior .NET Developer', false],
  ['Business Development Manager - Technology', false],
  ['Technical Support Engineer', false],
  // Two grades DOWN is as wrong as two grades up. OPUS FINE's "Junior Software
  // Engineer" scored 66 on 2026-10-15 at entry level, below his salary floor.
  ['Junior Software Engineer', false],
  ['Entry Level Android Developer', false],
  ['Software Engineer (Fresher)', false],
  ['Senior Software Engineer', true],
];

let fails = 0;
for (const [title, shouldKeep] of CASES) {
  const v = verdict(title);
  const kept = v === 'KEEP';
  const ok = kept === shouldKeep;
  if (!ok) fails++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${title.padEnd(44)} ${v}`);
}
console.log(fails ? `\n  ${fails} FAILED` : `\n  all ${CASES.length} titles behave as intended`);
process.exit(fails ? 1 : 0);
