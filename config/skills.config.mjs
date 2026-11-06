// ============================================================================
//  SKILLS CONFIG - what you can honestly claim.
// ============================================================================
//
//  This is the file that keeps the agent honest, and it is the second thing to
//  fill in after profile/resume.json.
//
//  `scripts/lib/keywords.mjs` holds a TAXONOMY: a list of canonical skills and
//  the surface forms a job description might use for each ("compose" also
//  appears as "jetpack compose" and "declarative ui"). That taxonomy is
//  generic and you should not need to change it.
//
//  What IS yours is the COVERAGE map below: for each canonical skill, whether
//  you have it. Three values, and the distinction matters:
//
//    STRONG  Headline experience. You would be comfortable being interviewed
//            on it for an hour. Earns full weight in the score.
//    HAVE    Real but secondary. You have shipped something with it, you are
//            not an expert. Earns 60% weight.
//    GAP     Not on your CV. Earns nothing, and is reported as a gap so the
//            agent writes about it honestly instead of quietly claiming it.
//
//  BE STINGY WITH `STRONG`. A score is only useful if it is comparable
//  between postings, and if everything is STRONG then nothing ranks. In the
//  original profile, 24 of 69 skills were STRONG and the rest were HAVE or GAP.
//
//  THE GAP LIST IS THE POINT. A skill marked GAP is not a weakness to hide; it
//  is an instruction to the agent that it must not write that word onto your
//  CV. Every application this system has sent names its own gaps in the first
//  paragraph. That is deliberate, it is what recruiters reply to, and it is
//  the only thing standing between "tailoring" and lying on a job application.
//
//  Anything in the taxonomy that you do not list here defaults to GAP, which
//  is the safe direction to fail in.
//
// ============================================================================

// ---------------------------------------------------------------- COVERAGE
// Delete this entire block and write your own. The values shipped here are an
// EXAMPLE from a mobile-heavy full-stack profile, not a default.
export const COVERAGE = {
  // --- mobile
  kotlin: 'STRONG', java: 'STRONG', compose: 'STRONG', androidsdk: 'STRONG',
  flutter: 'STRONG', dart: 'STRONG', bloc: 'STRONG',
  swift: 'HAVE', uikit: 'HAVE', ios: 'HAVE',
  reactnative: 'GAP',

  // --- architecture
  mvvm: 'STRONG', clean: 'STRONG', di: 'STRONG', coroutines: 'STRONG',

  // --- APIs and transport
  rest: 'STRONG', websocket: 'STRONG',
  graphql: 'GAP', grpc: 'GAP',

  // --- storage
  room: 'STRONG', offline: 'STRONG',

  // --- platform services
  firebase: 'HAVE', maps: 'STRONG',

  // --- AI and media
  ml: 'STRONG', camera: 'STRONG', biometric: 'STRONG',

  // --- domain and security
  fintech: 'STRONG', security: 'STRONG',

  // --- delivery
  testing: 'HAVE', cicd: 'HAVE', release: 'HAVE',
  performance: 'STRONG', git: 'STRONG', agile: 'STRONG', leadership: 'STRONG',
  accessibility: 'GAP',

  // --- backend and cloud
  python: 'HAVE', backendsvc: 'STRONG', springboot: 'HAVE', pyweb: 'HAVE',
  sqldb: 'HAVE', cloud: 'HAVE', containers: 'HAVE', llm: 'HAVE',

  // --- web
  web: 'HAVE', jsfw: 'HAVE', typescript: 'HAVE',

  // --- explicitly not claimed
  nodejs: 'GAP', dotnet: 'GAP', golang: 'GAP', phpruby: 'GAP',
  microservices: 'GAP', messaging: 'GAP', orm: 'GAP', nosql: 'GAP',
  k8s: 'GAP', terraform: 'GAP', otherlang: 'GAP',

  // dbdesign is the one worth explaining, because it is the easiest honest
  // line to blur. Using PostgreSQL daily is not the same as owning schema
  // design, migrations, constraints or query tuning. If you have only ever
  // consumed a database someone else designed, this is a GAP, and the agent
  // will then list SQL as a skill while never claiming design ownership.
  dbdesign: 'GAP',
};

// ------------------------------------------------------------------ WEIGHT
// How much a mention of this skill in a job description should move the score.
// 1 = incidental, 2 = matters, 3 = central to the role, 4 = decisive.
//
// Note the deliberate asymmetry: skills you do NOT have are weighted HIGH on
// purpose. A posting that mentions Go three times should be pushed down hard,
// not politely discounted. `otherlang` sits at 4 because a posting naming
// Rust, Scala or C++ is almost never retrainable inside a hiring process.
export const WEIGHT = {
  kotlin: 3, flutter: 3, swift: 3, ios: 2, androidsdk: 3, reactnative: 3,
  compose: 2, mvvm: 2, clean: 2, di: 1, coroutines: 1,
  fintech: 3, security: 2, biometric: 2, ml: 2, camera: 1,
  rest: 1, websocket: 1, graphql: 2, grpc: 1,
  room: 1, offline: 1, firebase: 1, maps: 1,
  testing: 2, cicd: 2, release: 1, performance: 1,
  git: 1, agile: 1, leadership: 3, accessibility: 1,
  java: 1, dart: 1, uikit: 1, bloc: 1,
  python: 2, backendsvc: 3, springboot: 3, pyweb: 2, sqldb: 2,
  cloud: 2, containers: 2, web: 1, llm: 2,
  nodejs: 3, dotnet: 3, golang: 3, phpruby: 2, microservices: 2, messaging: 2,
  dbdesign: 2, orm: 1, nosql: 2, k8s: 2, terraform: 1,
  jsfw: 3, typescript: 2, otherlang: 4,
};

// --------------------------------------------------------------- HARD_GAPS
// Gaps that are load-bearing rather than nice-to-have. Two or more of these in
// one posting means the role is built on ground you do not stand on, whatever
// the score says, and the agent should say so rather than apply.
export const HARD_GAPS = new Set([
  'dotnet', 'nodejs', 'golang', 'phpruby', 'k8s',
  'dbdesign', 'messaging', 'microservices', 'reactnative', 'graphql', 'otherlang',
]);
