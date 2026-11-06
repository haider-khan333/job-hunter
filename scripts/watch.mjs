#!/usr/bin/env node
// Hourly job watcher. Pulls every source that answers a plain HTTP request,
// drops anything already in tracker.json, applies the hard skip rules, scores
// what survives, and writes a queue of candidates worth a real look.
//
// This half runs unattended with no browser and no login. The sources that sit
// behind bot protection (Bayt, Indeed, LinkedIn content posts) cannot be read
// this way at all - they need a logged-in browser, which is the second half of
// the system, driven by a live Claude session. See docs/03-watcher.md.
//
// EVERYTHING PERSON-SPECIFIC IS IN config/search.config.mjs. The title filters
// below are the one exception: they are long regexes with worked examples in
// their comments, so they are edited here, in place.
//
//   node scripts/watch.mjs              sweep, write queue, print digest
//   node scripts/watch.mjs --quiet      only print when something new is found
//   node scripts/watch.mjs --hours 24   look back further (default 2)
//   node scripts/watch.mjs --no-ats     LinkedIn only, much faster
//   node scripts/watch.mjs --dry        do not write queue.json or the log
//   node scripts/watch.mjs --rescan     ignore seen.json, so a posting that an
//                                       earlier run dropped on its title gets
//                                       judged again. Use this after widening
//                                       the filters, not on the hourly task.

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanJd, COVERAGE, WEIGHT } from './lib/keywords.mjs';
import CFG from '../config/search.config.mjs';
import { requireSetup } from './lib/setup-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
requireSetup(ROOT, ["profile/profile.json","profile/companies.json","tracker.json","profile/resume.json"]);
const WATCH_DIR = path.join(ROOT, 'applications', '_watch');
const QUEUE = path.join(WATCH_DIR, 'queue.json');
const SEEN = path.join(WATCH_DIR, 'seen.json');
const LOG = path.join(WATCH_DIR, 'watch.log');
const LATEST = path.join(WATCH_DIR, 'LATEST.md');

const argv = process.argv.slice(2);
const OPT = {
  quiet: argv.includes('--quiet'),
  dry: argv.includes('--dry'),
  noAts: argv.includes('--no-ats'),
  notify: argv.includes('--notify'),
  rescan: argv.includes('--rescan'),
  hours: argv.includes('--hours') ? +argv[argv.indexOf('--hours') + 1] : 2,
};

const profile = JSON.parse(fs.readFileSync(path.join(ROOT, 'profile/profile.json'), 'utf8'));
const tracker = JSON.parse(fs.readFileSync(path.join(ROOT, 'tracker.json'), 'utf8'));
const boards = JSON.parse(fs.readFileSync(path.join(ROOT, 'profile/companies.json'), 'utf8'));

fs.mkdirSync(WATCH_DIR, { recursive: true });
const seen = fs.existsSync(SEEN) ? JSON.parse(fs.readFileSync(SEEN, 'utf8')) : {};

const now = new Date();
// Local time, not UTC. The machine runs five hours ahead of UTC, so the first
// runs stamped a digest in UTC, which reads as five hours in the past to
// anyone looking at a Gulf clock.
const pad2 = n => String(n).padStart(2, '0');
const local = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  + ` ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const stamp = local(now);
const today = stamp.slice(0, 10);

// ---------------------------------------------------------------- dedupe keys
// Two independent keys, because the sources disagree about both. A posting is
// already known if EITHER matches: the URL (same requisition reposted keeps its
// id) or company+role (the same job listed on LinkedIn and on the ATS board).
const normUrl = u => String(u || '').replace(/^https?:\/\//, '').replace(/^www\./, '')
  .replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();

// Company strings in the tracker are sometimes compound - "Autane-tech (via
// Cebin Tain, FTechnologies LLC)" - which is how a duplicate slipped through on
// 2026-10-11. Split them so every named entity becomes its own key.
const companyKeys = s => String(s || '').toLowerCase()
  .split(/[(),/]|\bvia\b/)
  .map(x => x.replace(/\b(llc|fzco|fz-?llc|dmcc|group|technologies|technology|solutions|systems|labs|inc|ltd|limited|pvt|global|middle east|uae|dubai)\b/g, '')
             .replace(/[^a-z0-9]+/g, '').trim())
  .filter(x => x.length > 2);

const roleKey = s => String(s || '').toLowerCase()
  .replace(/\b(senior|sr|junior|jr|lead|principal|staff|mid|level|i{1,3}|[0-9])\b/g, '')
  .replace(/[^a-z]+/g, '');

const knownUrls = new Set();
const knownPairs = new Set();
for (const r of tracker) {
  if (r.urlNorm) knownUrls.add(normUrl(r.urlNorm));
  if (r.url) knownUrls.add(normUrl(r.url));
  for (const c of companyKeys(r.company)) knownPairs.add(c + '|' + roleKey(r.role));
}
const isKnown = (company, role, url) =>
  knownUrls.has(normUrl(url)) ||
  companyKeys(company).some(c => knownPairs.has(c + '|' + roleKey(role)));

// ----------------------------------------------------------------- hard rules
// These mirror the decisions already made by hand across 226 tracked postings.
// Each one records WHY, so the digest explains itself rather than just a score.
const TITLE_WANTED = /android|\bios\b|mobile|flutter|kotlin|swift|react.?native|app developer|software (engineer|developer)|full.?stack|backend|back.?end|frontend|front.?end|engineering (lead|manager)|tech(nical)? lead|mobile lead/i;
// Added 2026-10-15: pure Android and iOS openings dried up, so the net widened
// to the roles a mobile lead with 4y7m can actually step into. Unambiguous
// ones go here; the ones that mean something else in another industry go in
// TITLE_AMBIGUOUS below and have to prove themselves.
const TITLE_WANTED_MGMT = /\b(technical|tech|software|development|squad|mobile|platform|engineering) (lead|leader|manager)\b|\btechnical (project|program|programme|delivery|product) manager\b|\b(it|digital|software) project manager\b|\bscrum master\b|\bproduct owner\b|\bsolutions? engineer\b|\bimplementation (engineer|consultant|specialist|lead|manager)\b|\bintegration (engineer|lead)\b|\btechnical account manager\b|\btechnical consultant\b|\bcustomer engineer\b|\bengineering (program|programme) manager\b/i;
const TITLE_BLOCKED = /\b(qa|quality assurance|tester|test automation|sdet|manual tester|junior|fresher|entry.?level|intern|internship|trainee|graduate programme|sales|business development|recruiter|support engineer|network engineer|it support|helpdesk|devops|sre|data (engineer|scientist|analyst)|machine learning engineer|ml engineer|salesforce|sap|odoo|sharepoint|wordpress|php|laravel|\.net|c#|c[+][+]|golang|go developer|ruby|rust|scala|embedded|firmware|unity|game|security engineer|penetration)\b/i;
// A "Team Leader" at a dark store or a warehouse is not an engineering lead.
// Deliveroo's "HOP Team Leader" cleared the lead pattern on the first run.
// Azizi's "Design Team Lead (Aluminum Manufacturing)" scored 88 on the same day:
// facade and curtain-wall drafting words now go with it.
const TITLE_NON_ENG = /\b(hop|dark store|warehouse|rider|driver|courier|kitchen|store|retail|operations|logistics|customer|account|facilities|housekeeping|aluminum|aluminium|facade|curtain wall|fabrication|draughtsman|draftsman|joinery|hvac|mep|civil|mechanical|structural|architectural)\b/i;
// "Delivery Manager" is a courier job at Talabat and a software job at an IT
// services firm. "Team Leader" is a dark store at Deliveroo. Only the words
// beside them tell the two apart, so these titles are accepted only when the
// title itself carries a technology word.
const TITLE_AMBIGUOUS = /\b(project manager|programme? manager|delivery (manager|lead)|account manager|consultant|team lead(er)?|product manager|service manager)\b/i;
// Deliberately no "engineer" or "engineering" here: that is the word that makes
// "Mechanical Engineer" look technical, and TITLE_NON_ENG has to keep winning
// against it.
const TITLE_TECH_SIGNAL = /\b(software|technical|tech|digital|it|ict|mobile|app|apps|application|android|ios|flutter|platform|cloud|api|web|fintech|payments?|banking|e.?commerce|developer|development|devops|saas)\b/i;
// Added 2026-10-17. A chef job scored 87 and reached the queue: "Menu
// DEVELOPMENT Specialist | Culinary Innovation CONSULTANT" cleared the gate
// because "development" is a tech signal and "consultant" is an ambiguous
// title, so the two combined to look like a technical consultancy role.
// These domain words are practitioner trades, never software, so unlike
// TITLE_NON_ENG a tech signal does NOT override them.
const TITLE_NON_SOFTWARE = /\b(enterprise planning|corporate planning|strategic planning|business development manager|facade|façade|curtain wall|cladding|structural glazing|quantity survey(?:or|ing)?|draughtsman|draftsman|hvac|\bmep\b|civil engineer|structural engineer|culinary|menu development|executive chef|sous chef|head chef|chef de|pastry|barista|housekeeping|janitorial|limpieza|rolling stock|signalling|railway|dry dock|shipyard|dry bulk|bulk carrier|handysize|supramax|ultramax|chief engineer|marine engineer(?:ing)?|technical superintendent|classification society|airworthiness|aviation maintenance|telesales|call cent(?:re|er)|organisational development|organizational development|learning (?:and|&) development|training (?:and|&) development)\b/i;
// Principal and Staff sit two grades above 4y7m. Surface nothing that senior.
const TITLE_TOO_SENIOR = /\b(principal|staff(?:\s+\w+){0,3}\s+engineer|director|head of|vp|chief|architect)\b/i;
// Added 2026-10-17. Eight Engineering Manager titles have now been surfaced and
// all eight were skipped, because the standing rule is absolute: never claim an
// Engineering Manager title or a team larger than three, target Lead/Team Lead.
// An EM posting therefore cannot ever end in an application, so it is wasted
// reading. Both wanted-lists match "engineering manager", so the reject has to
// sit in the gate rather than be edited out of one of them. "Engineering Lead",
// "Technical Lead", "Development Manager" and "Technical Program Manager" stay.
const TITLE_ENG_MANAGER = /\bengineering\s+manager\b|\bmanager,?\s+engineering\b/i;
// Added 2026-10-24 after the first real outcome review: 75 applications in 5.6
// weeks produced 14 rejections, 10 acknowledgements, 1 screening and ZERO
// interviews. The review split the failure in two. Europe answers fast and says
// no (23 applications, 11 rejections, Cisco in 30 hours, Certivity in 16); the
// Gulf mostly does not answer at all (52 applications, 41 silent). The three
// filters below come out of that review, and they exist to stop spending reads
// on postings that cannot convert rather than to find more postings.
//
// (1) GRADE. TITLE_BLOCKED already holds junior, fresher, entry-level, intern,
// internship, trainee and "graduate programme", and it still let through five
// student or graduate postings in six passes plus a "Dual Study Program" at 83
// that is sitting in the backlog now. The German and Dutch vocabulary was the
// hole: Werkstudent, Praktikum and the rest never matched an English word list.
// "Graduate" alone is deliberately NOT here, because "graduate" also appears in
// "recent graduate preferred" on real roles; the programme words are.
const TITLE_GRADE = /\b(werkstudent(?:in)?|praktikum|praktikant(?:in)?|pflichtpraktikum|dual(?:es)? stud(?:y|ium)|duales studium|studentische[rn]?|student assistant|studentenjob|traineeship|apprentice(?:ship)?|ausbildung|azubi|school leaver|placement year|sandwich placement|working student|graduate (?:scheme|program(?:me)?|developer|engineer|trainee)|abschlussarbeit|bachelorand|masterand|thesis)\b/i;

// (2) LAST-NOUN TEST. The thing the title actually IS is usually its last noun.
// "Technical Product Delivery Manager" is a manager; "Senior Mobile Business
// Manager" is a manager; "Software Solution Consultant" is a consultant. The
// existing TITLE_AMBIGUOUS gate lets these through whenever any technology word
// appears anywhere in the title, and because these titles are stuffed with
// technology words they always clear it. In the current backlog of 359 unread
// entries, 29 are this shape and they include BOTH of the two scores of 100.
// So the technology word has to sit AFTER the role noun to count, not anywhere.
const TITLE_ROLE_NOUN = /\b(manager|consultant|owner|master|director|analyst|administrator|technician|specialist|advisor|adviser|partner|associate|representative|executive|officer|coordinator|planner|strategist|evangelist|trainer|instructor|recruiter)\b\s*$/i;
// ...unless the whole title is one of the technical-management shapes already
// deliberately in scope. TITLE_WANTED_MGMT is checked before this fires.

// (3) WORK AUTHORISATION, read from the body. Six European postings have now
// been read in full and skipped on exactly this and nothing else: ZABEL Berlin
// and SSC Space Gilching both demanded EU or NATO citizenship outright, and
// AGNTX Hamburg, Basic-Fit Tilburg, Inverto Cologne and Jedox all refused to
// sponsor. He is a Pakistani national in Dubai and every one of these was a
// guaranteed dead end that cost a browser read to discover. DELIBERATELY TIGHT:
// it matches a stated requirement or a stated refusal, never a neutral mention
// of visas, because "we support relocation and visa sponsorship" must survive.
const BODY_NO_SPONSOR = /\b(?:no|not|cannot|can['’]?t|unable to|do(?:es)? not|will not|won['’]?t)\s+(?:currently\s+|presently\s+|unfortunately\s+)?(?:offer|provide|support|sponsor|arrange|facilitate)\s+(?:any\s+)?(?:work\s+)?(?:visa\s+|immigration\s+|relocation\s+)?(?:sponsorship|visas?|permits?)\b|\b(?:visa|work permit)\s+sponsorship\s+is\s+not\s+(?:available|offered|provided|possible)\b|\bwe\s+do\s+not\s+sponsor\b|\bno\s+visa\s+sponsorship\b|\bwithout\s+(?:the\s+)?need\s+for\s+sponsorship\b|\bmust\s+(?:already\s+)?(?:have|hold|possess)\s+(?:the\s+)?(?:valid\s+|existing\s+|unrestricted\s+)?(?:right\s+to\s+work|work\s+(?:permit|authori[sz]ation)|permission\s+to\s+work)\b|\b(?:eu|eea|european union|nato|german|dutch|irish|swiss|uk|british)\s*(?:\/\s*(?:eu|eea|nato)\s*)?citizenship\s+(?:is\s+)?(?:required|mandatory|essential|a\s+(?:must|requirement|prerequisite))\b|\brequirement:?\s*(?:eu|eea|nato)\s+citizenship\b|\bonly\s+(?:eu|eea)\s+citizens\b|\bmust\s+be\s+(?:an?\s+)?(?:eu|eea|nato)\s+citizen\b|\bsecurity\s+clearance\s+(?:is\s+)?required\b/i;
// The positive signal, kept separate and used to RANK rather than to filter. A
// posting that says this out loud is worth more of his time than one that is
// silent, because silence in Europe has been resolving as a no.
const BODY_WILL_SPONSOR = /\b(?:visa|work permit|immigration)\s+(?:sponsorship|support|assistance)\b|\bwe\s+(?:will\s+)?sponsor\b|\bsponsorship\s+(?:is\s+)?(?:available|offered|provided)\b|\brelocation\s+(?:package|support|assistance|bonus|allowance)\b|\bblue\s*card\b|\bwe\s+(?:help|assist|support)\s+(?:you\s+)?with\s+(?:your\s+)?(?:visa|relocation|work permit)\b|\brecognised\s+sponsor\b|\brecognized\s+sponsor\b|\bhighly\s+skilled\s+migrant\b|\b30%\s*ruling\b/i;

// Emiratisation, Saudisation and the other GCC national-quota schemes.
// Added 2026-10-17 after a third such posting reached the queue: a CNS role
// titled "Software Engineer - Emirati Talent", a Mashreq "(UAE Nationals Only)"
// team lead, and an Astek "Android Developer (Saudi National)" whose own
// requirements block he cleared outright. He is a Pakistani national and is
// ineligible for all of them, so they are rejected on the card rather than
// costing a browser read. DELIBERATELY TIGHT: the parenthetical form, an
// explicit "nationals only", or the "Emirati talent" phrasing. A loose
// /saudi nationals?/ would wrongly catch the Saudi National Bank.
// (3b) THE LOCAL LANGUAGE, STATED AS A REQUIREMENT. Added 2026-10-25 after the
// two most expensive reads of the day both died on this and neither was
// visible to any existing filter. petaFuel Freising scored 87 and ended its
// qualification list with "Fließende Deutschkenntnisse (B2 Niveau)", and the
// Dutch Ministry of Defence role said "De Nederlandse nationaliteit is
// vereist" and demanded the CV and letter in Dutch. He speaks neither German
// nor Dutch. UNLIKE the title filters measured at 3% of the backlog, language
// requirements are common in exactly the two markets he applies to most, so
// this one should actually pay for itself.
// DELIBERATELY TIGHT, and the reason matters: a German or Dutch posting is
// usually WRITTEN in German or Dutch without requiring the language, and
// Chrono24's advert said "German is a plus" while requiring only English. So
// this matches a STATED REQUIREMENT ONLY, with a level (B2/C1/C2) or an
// explicit "required/fluent/mother tongue" wording, and never a bare mention.
const BODY_LOCAL_LANGUAGE = /\b(?:deutsch|deutschkenntnisse|german|niederlandisch|nederlands|dutch|fran[cç]ais|french)\b[^.!?\n]{0,60}\b(?:[bc][12]\s*(?:niveau|level|lvl)?|niveau\s*[bc][12])\b|\b(?:flie(?:ss|ß)end(?:e|es)?|verhandlungssicher(?:e|es)?|sehr\s+gute)\s+deutschkenntnisse\b|\bdeutschkenntnisse\s+(?:sind\s+)?(?:erforderlich|zwingend|vorausgesetzt|notwendig|ein\s+muss)\b|\b(?:gute|sehr\s+gute|flie(?:ss|ß)ende)\s+kenntnisse\s+der\s+deutschen\s+sprache\b|\b(?:fluent|native|business[- ]level)\s+(?:german|dutch|french)\s+(?:is\s+)?(?:required|essential|mandatory|a\s+must)\b|\b(?:german|dutch|french)\s+(?:language\s+)?(?:skills\s+)?(?:is|are)\s+(?:required|mandatory|essential|a\s+must)\b|\bbeheersing\s+van\s+de\s+nederlandse\s+taal\b|\bnederlands\s+(?:is\s+)?(?:een\s+)?(?:vereiste|verplicht)\b|\b(?:cv|lebenslauf|motivatiebrief)\s+(?:en|and)?\s*(?:brief\s+)?(?:aan(?:leveren)?\s+)?in\s+het\s+nederlands\b|\bbewerbung\s+(?:bitte\s+)?(?:auf|in)\s+deutsch\b/i;

// (3c) NATIONALITY REQUIRED, IN THE LOCAL LANGUAGE. Added 2026-10-25 for the
// same reason. NATIONALITY_RESTRICTED below only ever covered the Gulf's
// English phrasings ("(Saudi Nationals)", "Nationals only"), so
// "De Nederlandse nationaliteit is vereist" sailed straight through and cost a
// full read on a posting that was closed to him before it started.
const BODY_NATIONALITY_REQUIRED = /\b(?:de\s+)?(?:nederlandse|belgische|duitse)\s+nationaliteit\s+is\s+(?:een\s+)?(?:vereist|vereiste|verplicht)\b|\b(?:deutsche|niederlandische|osterreichische)\s+staatsangehorigkeit\s+(?:ist\s+)?(?:erforderlich|vorausgesetzt|zwingend)\b|\bu\s+(?:heeft|bezit)\s+de\s+nederlandse\s+nationaliteit\b|\b(?:this\s+)?(?:role|position|vacancy|opportunity)\s+is\s+(?:restricted|limited|open)\s+(?:only\s+)?to\s+(?:emirati|uae|qatari|saudi|kuwaiti|bahraini|omani|gcc)\s*(?:nationals?|citizens?|candidates?)\b|\b(?:restricted|limited)\s+to\s+(?:emirati|qatari|saudi|kuwaiti|bahraini|omani)\s+(?:nationals?|citizens?|candidates?)\b|\bopen\s+(?:only\s+)?to\s+(?:uae|emirati|qatari|saudi)\s+(?:nationals?|citizens?)\s+only\b/i;

const NATIONALITY_RESTRICTED = /\(\s*(?:saudi|emirati|qatari|kuwaiti|omani|bahraini|uae|gcc)\s+nationals?\s*\)|\bnationals?\s+only\b|\bemirati\s+talent\b/i;
const LOC_UAE = /dubai|abu ?dhabi|u\.?a\.?e|united arab emirates|\bemirates\b|ajman|ras al khaimah|fujairah|umm al quwain/i;
// The Gulf set. Switch the whole region on or off in config/search.config.mjs
// under `regions.gulf`. Saudi Arabia, Oman,
// Kuwait and Qatar now count as in-target alongside the UAE. Bahrain was NOT
// asked for and stays foreign. NOTE FOR TAILORING: outside the UAE his
// self-sponsored residency and Emirates ID are worth nothing - those roles
// need employer sponsorship and relocation, so the "already resident, no
// permit needed" argument must never appear in a non-UAE application.
const LOC_KSA = /saudi|\bksa\b|riyadh|jeddah|dammam|khobar|dhahran|jubail|mecca|makkah|medina|madinah|neom|yanbu|tabuk|abha|taif|qassim|buraidah|hail/i;
const LOC_OMAN = /\boman\b|muscat|salalah|sohar|nizwa|duqm|seeb/i;
const LOC_KUWAIT = /kuwait|\bhawalli\b|farwaniya|jahra|salmiya|ahmadi/i;
const LOC_QATAR = /qatar|doha|lusail|\bwakrah\b|rayyan|mesaieed|ras laffan/i;
const LOC_GULF = loc => LOC_UAE.test(loc) || LOC_KSA.test(loc)
  || LOC_OMAN.test(loc) || LOC_KUWAIT.test(loc) || LOC_QATAR.test(loc);

// Europe, behind `regions.europe` in config/search.config.mjs. THIS IS A
// DIFFERENT KIND OF
// TARGET FROM THE GULF AND THE TAILORING MUST REFLECT IT: every one of these
// needs a work visa he does not hold, most need visa sponsorship the employer
// has to want to pay for, and relocation is months not weeks. The UAE residency
// argument is meaningless here, exactly as in Saudi, Oman, Kuwait and Qatar.
// Kept to the countries that actually sponsor non-EU software engineers at
// volume, plus the EU Blue Card route; deliberately NOT the whole continent.
const LOC_EUROPE = /\b(germany|deutschland|berlin|munich|m(ü|u)nchen|hamburg|frankfurt|cologne|k(ö|o)ln|stuttgart|d(ü|u)sseldorf|leipzig|netherlands|holland|amsterdam|rotterdam|utrecht|eindhoven|the hague|ireland|dublin|cork|galway|poland|polska|warsaw|warszawa|krak(ó|o)w|wroc(ł|l)aw|gda(ń|n)sk|pozna(ń|n)|portugal|lisbon|lisboa|porto|spain|espa(ñ|n)a|madrid|barcelona|valencia|sweden|stockholm|gothenburg|g(ö|o)teborg|malm(ö|o)|denmark|copenhagen|k(ø|o)benhavn|aarhus|norway|oslo|bergen|finland|helsinki|espoo|tampere|austria|vienna|wien|belgium|brussels|bruxelles|antwerp|czech|czechia|prague|praha|brno|estonia|tallinn|tartu|lithuania|vilnius|kaunas|latvia|riga|romania|bucharest|bucure(ș|s)ti|cluj|timi(ș|s)oara|switzerland|zurich|z(ü|u)rich|geneva|gen(è|e)ve|basel|lausanne|luxembourg|italy|italia|milan|milano|rome|roma|turin|torino|bologna|france|paris|lyon|toulouse|bordeaux|nantes|lille|united kingdom|england|scotland|wales|london|manchester|edinburgh|glasgow|bristol|cambridge|oxford|leeds|birmingham)\b/i;

// Which target region a posting sits in, for the tracker and the report.
const gulfCountry = loc => LOC_UAE.test(loc) ? 'UAE'
  : LOC_KSA.test(loc) ? 'Saudi Arabia'
  : LOC_OMAN.test(loc) ? 'Oman'
  : LOC_KUWAIT.test(loc) ? 'Kuwait'
  : LOC_QATAR.test(loc) ? 'Qatar'
  : LOC_EUROPE.test(loc) ? 'Europe' : '';
// Which regions count as reachable, from config/search.config.mjs.
const inTarget = loc =>
     !!(CFG.regions?.gulf   && LOC_GULF(loc))
  || !!(CFG.regions?.europe && LOC_EUROPE.test(loc));
// Locations you have decided not to look at, from config/search.config.mjs.
const EXCLUDED_LOCS = CFG.excludeLocations ?? [];
const isExcludedLoc = loc => EXCLUDED_LOCS.some(re => re.test(loc));
// "Remote" alone is fine. "US-Remote", "Canada-Remote", "Remote - Bengaluru"
// are not: they are geo-locked somewhere he cannot be hired. Stripe's US-Remote
// postings cleared the first run on the word "remote" alone.
// European countries and cities were REMOVED from this list on 2026-10-17 when
// Europe became a target: a "Remote - Berlin" posting is now reachable rather
// than geo-locked. EMEA went too, since both his regions sit inside it.
const LOC_FOREIGN = /\b(us|usa|united states|canada|india|pakistan|philippines|vietnam|brazil|mexico|colombia|hungary|ukraine|russia|belarus|australia|new zealand|japan|china|taiwan|hong kong|singapore|malaysia|thailand|korea|israel|turkey|egypt|nigeria|kenya|south africa|bahrain|manama|amer|apac|latam|nyc|sf|sea|seattle|san francisco|new york|toronto|vancouver|bengaluru|bangalore|lahore|karachi|manila|sydney|shanghai|taipei|chicago|austin|boston|denver|atlanta)\b/i;
// A remote posting is reachable only if nothing else in the location string
// pins it to another country, or it explicitly says global.
const remoteReachable = loc => /remote|anywhere|distributed/i.test(loc)
  && (/global|worldwide|anywhere|mena|middle east|gulf/i.test(loc) || !LOC_FOREIGN.test(loc));

// Years bar. The single largest reason roles get skipped - 32 of 144 skips,
// more than every stack gap combined - so the watcher reads it explicitly
// rather than letting the keyword score bury it.
const HAS_YEARS = CFG.yearsExperience;            // your real total, from config
const YEARS_TOLERANCE = CFG.yearsTolerance ?? 1;  // how far above it still shows
// A figure attached to overall professional experience is the real bar. One
// attached to a named sub-skill ("3+ years in an Engineering Manager role",
// "2 years with React") is a component of it and is always smaller.
const YEARS_OVERALL = /(?:professional|software engineering|overall|total|industry|work(?:ing)?)\s+experience|experience\s+in\s+(?:software|full.?stack|backend|front.?end|mobile|engineering)/i;
function yearsBar(raw) {
  // A stated range means its lower bound is the bar, so "5-7 years" is
  // collapsed to "5 years" before anything else looks at the text. Without
  // this the overall-experience rule below picks the 7.
  const text = String(raw).replace(/(\d{1,2})\s*(?:[-–]|to)\s*(\d{1,2})(\s*(?:years|yrs))/gi, '$1$3');
  const hits = [];       // every figure stated
  const overall = [];    // figures sitting next to an overall-experience phrase
  const pats = [
    /(\d{1,2})\s*\+\s*(?:years|yrs)/gi,
    // Added 2026-10-24. The plus sign also appears BEFORE the number, as in
    // Jedox's "(+8 years)", which read as no bar at all and cost a full
    // browser read on a role eight years out of reach.
    /\+\s*(\d{1,2})\s*(?:years|yrs)/gi,
    /(?:minimum|min\.?|at least|over)\s*(?:of\s*)?(\d{1,2})\s*(?:years|yrs)/gi,
    /(\d{1,2})\s*[-–to]+\s*(\d{1,2})\s*(?:years|yrs)/gi,
    /(\d{1,2})\s*(?:years|yrs)\s*(?:of\s*)?(?:relevant\s*|professional\s*|hands.?on\s*|proven\s*)?experience/gi,
  ];
  for (const p of pats) {
    for (const m of text.matchAll(p)) {
      const n = +m[1];
      if (n < 1 || n > 20) continue;
      hits.push(n);
      // Look at the 90 characters after the match for an overall-experience
      // phrase. FIXED 2026-10-16: this used to return Math.min of every figure
      // found, so the Kuwait Engineering Manager role reported "3y - clears"
      // off its "3+ years in an Engineering Manager position" line while
      // ignoring "10+ years of professional software engineering experience"
      // in the line above. The smallest figure is the wrong one to trust.
      if (YEARS_OVERALL.test(text.slice(m.index, m.index + 90))) overall.push(n);
    }
  }
  if (overall.length) return Math.max(...overall);
  return hits.length ? Math.min(...hits) : null;
}

// True when a posting states overall-experience figures that disagree, e.g.
// "8+ years preferred" next to "minimum 4 years required". The bar above
// reports the higher one, but a disagreement must never cause a SILENT hard
// reject - those postings get surfaced with both numbers so the apply pass
// reads the posting and decides.
// Added 2026-10-17 after THREE entry-level postings scored 94, 81 and 75 in one
// day - Torentify, HiredBuddy and Spait Infotech. The mechanism inverts the
// usual false positive: a thin, undemanding body gives the scorer nothing to
// fail him on, so the gap list comes back almost empty and an empty gap list
// looks like a perfect match. None of the three carried a grade in the title,
// so TITLE_BLOCKED (which already has "junior" and "entry-level") never saw
// them. This has to match the ROLE being junior, never a senior role that
// merely mentions mentoring juniors - K-tronik, Infor and Toast all do that.
// The emoji-metadata template family: 12 confirmed instances since 2026-10-17, scoring 50-90 with
// correct-looking titles ("Android Developer" at 89 and 90). Title filters cannot catch it, so it is
// matched on the body shape: a "We're Hiring" banner plus emoji-prefixed Employment Type / Level lines.
// Deliberately narrow: Qonto's posting uses emoji headings too and must not be caught.
const TPL_HIRING  = /We\s*[\u2019'`]?\s*re\s+Hiring/i;
const TPL_EMPTYPE = /Employment\s+Type\s*:/i;
const TPL_LEVEL   = /\b(?:Experience\s+)?Level\s*:\s*(?:Mid|Entry|Junior|Management|Senior)/i;
const isTemplateSpam = d => TPL_HIRING.test(d) && (TPL_EMPTYPE.test(d) || TPL_LEVEL.test(d));
const BODY_ENTRY_LEVEL = /\b(?:this|an?)\s+entry.?level\s+(?:role|position|opportunity)\b|\bentry.?level\s+(?:\w+\s+){0,2}(?:developer|engineer)\b|\bfreshers?\b|\b0\s*(?:[-\u2013]|to)\s*[12]\s*years?\b|\b(?:looking for|seeking|hiring|recruiting)\s+an?\s+(?:junior|graduate|entry.?level|fresher)\b|\bopportunit(?:y|ies)\s+for\s+junior\s+(?:developers?|engineers?)\b/i;

function yearsConflict(raw) {
  const text = String(raw).replace(/(\d{1,2})\s*(?:[-–]|to)\s*(\d{1,2})(\s*(?:years|yrs))/gi, '$1$3');
  const overall = new Set();
  const pats = [
    /(\d{1,2})\s*\+\s*(?:years|yrs)/gi,
    // Added 2026-10-24. The plus sign also appears BEFORE the number, as in
    // Jedox's "(+8 years)", which read as no bar at all and cost a full
    // browser read on a role eight years out of reach.
    /\+\s*(\d{1,2})\s*(?:years|yrs)/gi,
    /(?:minimum|min\.?|at least|over)\s*(?:of\s*)?(\d{1,2})\s*(?:years|yrs)/gi,
    /(\d{1,2})\s*(?:years|yrs)\s*(?:of\s*)?(?:relevant\s*|professional\s*|hands.?on\s*|proven\s*)?experience/gi,
  ];
  for (const p of pats) {
    for (const m of text.matchAll(p)) {
      const n = +m[1];
      if (n >= 1 && n <= 20 && YEARS_OVERALL.test(text.slice(m.index, m.index + 90))) overall.add(n);
    }
  }
  return overall.size > 1;
}

// Stack veto, read from the DESCRIPTION rather than the title. Four roles have
// now cleared the title filter while being built on a stack he does not have,
// because the title never said so:
//   Edenred  "Senior Backend Developer (L3)"  -> body wanted C# and .NET Core
//   Cinergie "Senior Software Engineer"       -> body was entirely Oracle EBS
//   TII      "Senior Software Engineer"       -> body was embedded C/C++ on Zephyr
//   ADASI    "Senior GCS Software Engineer"   -> body was UAV firmware and RTOS
// A single passing mention is normal and must not veto anything; a stack that
// is mentioned repeatedly IS the job. Three hits is the threshold, and the
// reason is reported so a wrong veto is visible rather than silent.
// Loaded from config/search.config.mjs so the stacks you cannot do live with
// the rest of your decisions. The comment block above explains why the rule
// exists and is worth reading before you shorten the list.
const HARD_GAP_STACKS = CFG.stackVeto.stacks;
const STACK_VETO_HITS = CFG.stackVeto.hits ?? 3;
// (the shipped example stacks now live in config/search.config.mjs)
function stackVeto(desc) {
  const found = [];
  for (const [name, re] of Object.entries(HARD_GAP_STACKS)) {
    const n = (desc.match(re) || []).length;
    if (n >= STACK_VETO_HITS) found.push(`${name} x${n}`);
  }
  return found.length ? found.join(', ') : null;
}

function score(text) {
  const hits = scanJd(text);
  let earned = 0, possible = 0;
  const gaps = [], strong = [];
  for (const c of Object.keys(hits)) {
    const w = WEIGHT[c] ?? 1;
    possible += w;
    const cov = COVERAGE[c] ?? 'GAP';
    if (cov === 'STRONG') { earned += w; strong.push(c); }
    else if (cov === 'HAVE') earned += w * 0.6;
    else gaps.push(c);
  }
  // EVIDENCE WEIGHTING, ADDED 2026-10-31. The score was a percentage with no
  // floor under the denominator, so a job description that matched almost
  // nothing scored 100 for covering the little it did match. Measured on the
  // live queue: 'Technical Manager - Landscape & Swimming Pool' in Dubai scored
  // 100 off TWO categories worth 5 points, and so did 'Fire Fighting & Plumbing
  // Team Leader' and 'Team Lead - Aviation Maintenance'. A real Android role in
  // the same queue scored 67 off ten categories worth 19. The whole Gulf top of
  // list was thin non-software postings, which is why he kept asking whether
  // there were any UAE jobs: there were, ranked underneath swimming pools.
  // A 100% match on 5 points of evidence is not better than 70% on 19, so the
  // raw percentage is multiplied by how much evidence it rests on, capped at 1.
  // FLOOR 10 WAS CHOSEN BY MEASUREMENT, not taste: across 2257 stored
  // descriptions it discounts 9%, and of those only 3 are in his actual trade,
  // all three thin German postings matching 2 to 6 categories. Floor 12 starts
  // demoting genuine Android roles (one dropped 90 to 75), so 10 is the edge.
  // raw and evidence are both kept so a surprising rank can be audited later.
  const EVIDENCE_FLOOR = CFG.thresholds?.evidenceFloor ?? 10;
  const raw = possible ? Math.round(earned / possible * 100) : 0;
  const conf = Math.min(1, possible / EVIDENCE_FLOOR);
  return { score: Math.round(raw * conf), raw, evidence: possible, gaps, strong };
}

// ------------------------------------------------------------------ fetch util
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
async function grab(url, { json = false, ms = 20000, headers = {} } = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: c.signal,
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', ...headers },
    });
    if (!r.ok) return null;
    return json ? await r.json() : await r.text();
  } catch { return null; } finally { clearTimeout(t); }
}

const strip = h => String(h)
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<li>/gi, '\n- ').replace(/<\/(p|div|li|h\d|ul|ol|tr)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&[a-z]+;/gi, ' ')
  .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

// ------------------------------------------------------- source 1: LinkedIn
// The guest endpoint needs no login and no cookie. f_TPR=r<seconds> is the
// posted-within window, which is what makes an hourly cadence worth running.
const LI_QUERIES = [
  'android developer', 'mobile developer', 'flutter developer', 'kotlin',
  'ios developer', 'react native', 'mobile application developer',
  'software engineer', 'software developer', 'full stack developer',
  'backend developer', 'mobile lead', 'engineering lead',
  // The management and technical-delivery half, added 2026-10-15. Pure mobile
  // openings had gone quiet for days, and these are the titles a lead with
  // 4y7m and a team of three can realistically step into.
  'technical lead', 'team lead software', 'engineering manager',
  'technical project manager', 'delivery manager software', 'scrum master',
  'product owner', 'technical product manager', 'solutions engineer',
  'implementation engineer', 'technical account manager',
  'technical consultant', 'integration engineer', 'development manager',
];

// The eleven queries that have actually produced anything worth reading. The
// non-UAE Gulf markets run on these rather than the full 26, because 26 queries
// across five countries is 260 guest-API requests an hour and the guest API is
// the one part of this watcher that cannot be replaced if LinkedIn throttles it.
const LI_QUERIES_CORE = [
  'android developer', 'mobile developer', 'flutter developer', 'ios developer',
  'react native', 'mobile application developer', 'software engineer',
  'software developer', 'full stack developer', 'backend developer',
  'technical lead',
];
// UAE first and on the full query list: it is his home market and the only one
// of the five where he needs no sponsorship. If LinkedIn throttles mid-run,
// the UAE results are already in hand.
// Europe runs on an even shorter list than the other Gulf states. The heavy
// lifting for Europe is already done for free by the ATS boards: greenhouse,
// lever and ashby return roughly 3,000 postings a sweep and most of their
// European roles were previously thrown away by LOC_FOREIGN, so simply making
// Europe in-target surfaces them at no extra request cost. These three geos are
// the markets that actually sponsor non-EU software engineers at volume and
// work in English - Germany on the Blue Card, the Netherlands on the highly
// skilled migrant scheme, Ireland on the critical skills permit.
const LI_QUERIES_EU = [
  'android developer', 'mobile developer', 'flutter developer',
  'software engineer', 'full stack developer', 'backend developer',
];
// From config/search.config.mjs. Each geo names a LinkedIn location string and
// which of the query sets above to run against it, either by name ('full',
// 'core', 'eu') or as its own array.
const QUERY_SETS = { full: LI_QUERIES, core: LI_QUERIES_CORE, eu: LI_QUERIES_EU };
const LI_GEOS = (CFG.linkedin?.enabled === false ? [] : (CFG.linkedin?.geos ?? []))
  .map(g => ({
    name: g.name,
    queries: Array.isArray(g.queries) ? g.queries : (QUERY_SETS[g.queries] ?? LI_QUERIES_CORE),
  }));

async function linkedin(windowSecs) {
  const found = new Map();
  for (const geo of LI_GEOS) {
    for (const q of geo.queries) {
      for (const start of [0, 25]) {
        const url = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
          + `?keywords=${encodeURIComponent(q)}&location=${encodeURIComponent(geo.name)}`
          + `&f_TPR=r${windowSecs}&start=${start}`;
        const html = await grab(url);
        if (!html) break;
        const cards = html.split(/<li[\s>]/).slice(1);
        if (!cards.length) break;
        for (const card of cards) {
          const id = (card.match(/jobPosting:(\d+)/) || card.match(/-(\d{9,})\?/) || [])[1];
          if (!id) continue;
          const title = strip((card.match(/base-search-card__title[^>]*>([\s\S]*?)</) || [])[1] || '');
          const company = strip((card.match(/base-search-card__subtitle[\s\S]*?>([^<]*)</) || [])[1] || '');
          const location = strip((card.match(/job-search-card__location[^>]*>([\s\S]*?)</) || [])[1] || '');
          if (!title) continue;
          if (!found.has(id)) found.set(id, { source: 'linkedin', id, title, company, location, url: `https://www.linkedin.com/jobs/view/${id}/`, query: q, geo: geo.name });
        }
        if (cards.length < 25) break;
      }
    }
  }
  return [...found.values()];
}

// LinkedIn serves a sign-in wall instead of the job body for some postings.
// The wall is long enough to pass the "description too thin" check, so the
// posting then gets SCORED ON THE LOGIN BOILERPLATE. On 2026-10-16 a GAL
// aviation maintenance role came back as score 100 with "gaps: none" that way,
// while its real requirement was 15+ years of aircraft maintenance. Stripping
// the wall first lets the thin check catch it honestly.
const LI_WALL = /(Email or phone|Forgot password\??|New to LinkedIn\??|Join now|Join or sign in|Join to save|Sign in with|Sign in to [a-z ]+|By clicking Continue to join[^.]*\.|User Agreement|Privacy Policy|Cookie Policy|Report this job|Use AI to assess how you fit|Get AI-powered advice[^.]*\.|Am I a good fit for this job\??|Tailor my resume|Help me stand out|See who [A-Za-z0-9 .&-]+ has hired for this role|Be among the first \d+ applicants)/gi;
function cleanLinkedInDesc(s) {
  return String(s).replace(LI_WALL, ' ').replace(/\s+/g, ' ').trim();
}

async function linkedinDesc(id) {
  const html = await grab(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`);
  return html ? cleanLinkedInDesc(strip(html)) : '';
}

// --------------------------------------------------------- source 2: NaukriGulf
async function naukrigulf() {
  const out = [];
  const NG_LOCS = ['uae', 'saudi-arabia', 'qatar', 'kuwait', 'oman'];
  for (const q of ['android-developer', 'mobile-application-developer', 'flutter-developer', 'software-engineer'])
  for (const loc of NG_LOCS) {
    const url = `https://www.naukrigulf.com/spapi/jobapi/search?Keyword=${q}&Location=${loc}&sort=freshness&pageNo=1`;
    const d = await grab(url, { json: true, headers: { appid: '205', systemid: '2323', Accept: 'application/json' } });
    const jobs = d?.jobs || d?.results || [];
    for (const j of jobs) {
      const u = j.jobDetailUrl || j.jdURL || j.url;
      if (!u) continue;
      out.push({
        source: 'naukrigulf', id: String(j.jobId || j.id || u),
        title: j.designation || j.title || '', company: j.company?.name || j.companyName || '',
        location: (j.location || j.locations || []).toString(),
        url: u.startsWith('http') ? u : `https://www.naukrigulf.com${u}`,
        desc: strip(j.description || j.jobDescription || ''),
      });
    }
  }
  return out;
}

// --------------------------------------------------------- source 3: ATS boards
const ATS = {
  greenhouse: async s => (await grab(`https://boards-api.greenhouse.io/v1/boards/${s}/jobs`, { json: true }))?.jobs
    ?.map(j => ({ company: s, title: j.title, location: j.location?.name || '', url: j.absolute_url, id: String(j.id), updated: j.updated_at })) || [],
  lever: async s => (await grab(`https://api.lever.co/v0/postings/${s}?mode=json`, { json: true }))
    ?.map(j => ({ company: s, title: j.text, location: j.categories?.location || '', url: j.hostedUrl, id: j.id, desc: j.descriptionPlain, updated: j.createdAt })) || [],
  ashby: async s => (await grab(`https://api.ashbyhq.com/posting-api/job-board/${s}`, { json: true }))?.jobs
    ?.map(j => ({ company: s, title: j.title, location: j.location || '', url: j.jobUrl, id: j.id, desc: j.descriptionPlain, updated: j.publishedAt })) || [],
  recruitee: async s => (await grab(`https://${s}.recruitee.com/api/offers/`, { json: true }))?.offers
    ?.map(j => ({ company: s, title: j.title, location: [j.city, j.country].filter(Boolean).join(', '), url: j.careers_url, id: String(j.id), desc: strip(j.description), updated: j.published_at })) || [],
  workable: async s => (await grab(`https://apply.workable.com/api/v1/widget/accounts/${s}?details=true`, { json: true }))?.jobs
    ?.map(j => ({ company: s, title: j.title, location: [j.city, j.country].filter(Boolean).join(', '), url: j.url || j.application_url, id: j.shortcode, desc: strip(j.description), updated: j.published_on })) || [],
};

// One board must never cost the others. FIXED 2026-10-16: this used a bare
// Promise.all, so a single rejecting board - a changed response shape, a
// truncated body, an aborted socket - rejected the whole thing and the caller's
// .catch turned roughly 3,000 postings into an empty array. It happened twice
// at 03:41 and read as a quiet night. Each board is now isolated and named.
const atsFail = [];
async function atsBoards() {
  const out = [];
  await Promise.all(boards.companies.map(async c => {
    let jobs = [];
    try {
      jobs = await ATS[c.provider]?.(c.slug) || [];
    } catch (e) {
      atsFail.push(`${c.provider}:${c.slug} (${e?.message || e})`);
      return;
    }
    for (const j of jobs) out.push({ ...j, source: c.provider });
  }));
  return out;
}

// ------------------------------------------------------------------------ run
const windowSecs = Math.round(OPT.hours * 3600);
// A source that throws used to be swallowed into an empty array, so a failed
// run looked exactly like a quiet one. On 2026-10-16 at 03:41 the ATS boards
// returned nothing at all - roughly 3,000 postings missing - and the only clue
// was a pulled count of 26. Failures are now named in the output.
const srcFail = [];
const guard = (name, p) => p.catch(e => {
  srcFail.push(`${name}: ${e?.message || e}`);
  return [];
});
const sources = [guard('linkedin', linkedin(windowSecs)), guard('naukrigulf', naukrigulf())];
if (!OPT.noAts && CFG.ats?.enabled !== false) sources.push(guard('ats', atsBoards()));
const raw = (await Promise.all(sources)).flat();

const counts = {};
for (const j of raw) counts[j.source] = (counts[j.source] || 0) + 1;
// An ATS run that yields zero is a failure, not a quiet hour: these are whole
// job boards, not a time window, so they are never all empty at once.
if (!OPT.noAts && !raw.some(j => ['greenhouse', 'ashby', 'lever', 'recruitee', 'workable'].includes(j.source))) {
  srcFail.push('ats: returned 0 postings across all boards - transient network failure or every board changed shape');
}

// Stage 1: cheap filters on the card alone, before spending a request on the JD.
const rejected = [];
const reject = (j, why) => { rejected.push({ ...j, why }); return false; };
// In-run duplicate guard. See the note at the dupKey check below.
const runSeen = new Set();
// Body-hash guard for the same advert reposted across cities. See stage 2.
// Seeded from the queue that already exists, so a repost queued on an earlier
// sweep is still recognised. Also seeds the company+title pair guard for the
// same reason.
const priorQueue = fs.existsSync(QUEUE) ? JSON.parse(fs.readFileSync(QUEUE, "utf8")) : [];
const runBodies = new Set(
  priorQueue.map(e => String(e.desc || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 600))
            .filter(k => k.length > 200));

let pass = raw.filter(j => {
  const key = j.source + ':' + j.id;
  if (seen[key] && !OPT.rescan) return false;                        // seen on an earlier run
  const techy = TITLE_TECH_SIGNAL.test(j.title);
  const wanted = TITLE_WANTED.test(j.title) || TITLE_WANTED_MGMT.test(j.title)
    || (TITLE_AMBIGUOUS.test(j.title) && techy);
  if (!wanted) return reject(j, 'title not a target role');
  if (TITLE_BLOCKED.test(j.title)) return reject(j, 'title on the blocked list');
  if (TITLE_NON_SOFTWARE.test(j.title)) return reject(j, 'non-software trade');
  if (TITLE_ENG_MANAGER.test(j.title)) return reject(j, 'engineering manager - standing no');
  if (NATIONALITY_RESTRICTED.test(j.title)) return reject(j, 'reserved for GCC nationals');
  // A technology word in the title overrides the non-engineering list, so
  // "Technical Account Manager" survives while "Design Team Lead (Aluminum
  // Manufacturing)" and "Mechanical Engineer" still do not.
  if (TITLE_NON_ENG.test(j.title) && !techy) return reject(j, 'not an engineering role');
  if (TITLE_TOO_SENIOR.test(j.title)) return reject(j, 'principal/staff/director grade');
  // Added 2026-10-24. See the TITLE_GRADE note: the hole was German and Dutch
  // vocabulary, and it cost five wasted reads in six passes.
  if (TITLE_GRADE.test(j.title)) return reject(j, 'student/graduate/apprentice programme');
  // Added 2026-10-24. The last-noun test. Only fires when the title was NOT
  // already accepted as one of the technical-management shapes, so "Technical
  // Lead", "Scrum Master", "Product Owner" and "Technical Program Manager" are
  // untouched; what it removes is "Senior Mobile Business Manager" and the
  // twenty-eight others of that shape now sitting unread in the queue.
  if (!TITLE_WANTED_MGMT.test(j.title) && TITLE_ROLE_NOUN.test(j.title))
    return reject(j, 'title is a management/consulting role, not an engineering one');
  if (isExcludedLoc(j.location)) return reject(j, `excluded location (${j.location})`);
  if (!inTarget(j.location) && !remoteReachable(j.location)) return reject(j, `outside target regions (${j.location})`);
  if (isKnown(j.company, j.title, j.url)) return reject(j, 'already in tracker');
  // Added 2026-10-24. isKnown only compares against the tracker, so the same
  // role reposted twice inside ONE sweep passed twice. Keyed on company plus
  // normalised title, so a genuine second opening at the same firm under a
  // different title still gets through.
  //
  // ONLY FIRES WHEN THE COMPANY IS ACTUALLY KNOWN, and that restriction is the
  // whole correctness of it. A first attempt keyed on company-or-blank, and
  // because LinkedIn cards frequently carry no company name the key collapsed
  // to "|softwareengineer" and merged 77 unrelated postings in a single replay
  // over the live backlog: every bare "Software Engineer" in Munich, Eindhoven,
  // Galway and Dubai became one row. The same-requisition reposts are caught
  // instead by the body hash in stage 2, which is the right signal for them
  // because a reposted advert carries the same text.
  const comp = companyKeys(j.company)[0] || '';
  if (comp) {
    const dupKey = `${comp}|${roleKey(j.title)}`;
    if (runSeen.has(dupKey)) return reject(j, 'duplicate of another entry in this same sweep');
    runSeen.add(dupKey);
  }
  return true;
});

// Stage 2: pull the description, read the years bar, score it.
const candidates = [];
for (const j of pass) {
  let desc = j.desc || '';
  if (!desc && j.source === 'linkedin') desc = await linkedinDesc(j.id);
  if (!desc && j.source === 'greenhouse') {
    const d = await grab(`https://boards-api.greenhouse.io/v1/boards/${j.company}/jobs/${j.id}`, { json: true });
    desc = d?.content ? strip(d.content) : '';
  }
  const text = `${j.title}\n${desc}`;
  const bar = yearsBar(desc);
  const barConflict = yearsConflict(desc);
  const s = score(text);

  // A stated bar more than a year above him is the one filter that overrides a
  // good score. Within a year is a near-miss worth surfacing, not auto-binning.
  const barVerdict = bar === null ? 'none stated'
    : bar <= HAS_YEARS ? `${bar}y - clears`
    : bar - HAS_YEARS <= YEARS_TOLERANCE ? `${bar}y - short by ${(bar - HAS_YEARS).toFixed(1)}y, near miss`
    : `${bar}y - short by ${(bar - HAS_YEARS).toFixed(1)}y, over the line`;

  // A conflicting pair of stated bars is surfaced rather than binned, so a
  // figure attached to a sub-skill or to a "preferred" aspiration can never
  // silently drop a role whose real minimum he clears.
  const hardFail = bar !== null && bar - HAS_YEARS > YEARS_TOLERANCE && !barConflict;
  const thin = desc.length < 200;

  const veto = stackVeto(desc);
  // Added 2026-10-24. Work authorisation, and the one place the Europe strategy
  // actually bites. A stated refusal to sponsor or a stated citizenship
  // requirement is absolute for a Pakistani national in Dubai, so it rejects
  // here instead of costing a browser read. The positive signal is recorded
  // rather than filtered on, and then used to sort.
  const noSponsor = BODY_NO_SPONSOR.test(desc);
  const localLang = BODY_LOCAL_LANGUAGE.test(desc);
  const natReq = BODY_NATIONALITY_REQUIRED.test(desc);
  const willSponsor = BODY_WILL_SPONSOR.test(desc);
  const euLoc = LOC_EUROPE.test(j.location);
  // "Senior" is no longer treated as neutral. 24 of the 75 applications to date
  // carried a Senior or Lead title and they returned 0 interviews, because 4y7m
  // reads as short against the 5+ years those adverts almost always state. The
  // same work advertised as "Engineer II" or with no grade at all makes him a
  // strong candidate instead of a weak one, so grade is recorded and mid-level
  // sorts first. This is a ranking change, not a filter: a Senior role with no
  // stated bar is still worth his time and still gets surfaced.
  const seniorTitle = /\b(senior|sr\.?|lead|leader)\b/i.test(j.title);
  const rec = { ...j, desc, descLen: desc.length, yearsBar: bar, barConflict, barVerdict,
                stackVeto: veto, noSponsor, willSponsor, localLang, natReq, euLoc, seniorTitle, ...s, foundAt: stamp };
  if (hardFail) { rejected.push({ ...rec, why: `years bar ${bar} vs 4.6` }); continue; }
  if (thin) { rejected.push({ ...rec, why: 'description too thin to judge' }); continue; }
  if (BODY_ENTRY_LEVEL.test(desc)) { rejected.push({ ...rec, why: 'body describes a junior/entry-level role' }); continue; }
  if (isTemplateSpam(desc)) { rejected.push({ ...rec, why: 'emoji-metadata template posting (mismatched company family)' }); continue; }
  if (noSponsor) { rejected.push({ ...rec, why: 'body refuses sponsorship or requires citizenship/right to work' }); continue; }
  if (natReq) { rejected.push({ ...rec, why: 'body requires local nationality (stated in the local language)' }); continue; }
  if (localLang) { rejected.push({ ...rec, why: 'body requires German/Dutch/French he does not speak' }); continue; }
  if (veto) { rejected.push({ ...rec, why: `stack he does not have runs through the body: ${veto}` }); continue; }
  // Added 2026-10-24. Body-hash duplicate, which catches the one shape the
  // company+title key cannot: the SAME advert reposted under several cities or
  // countries by a company the card does not name. The live backlog holds these
  // pairs, all with identical bodies: "Backend Engineer, Solving" in both the
  // Netherlands and Ireland, "Senior+ Full-Stack Engineer" in both, "Senior iOS
  // Developer (Swift)" in three countries, "Senior Android Developer (Kotlin)"
  // in Saudi Arabia and Germany, and "Senior Flutter Developer (all genders)"
  // in Hamburg and Nuremberg. Keyed on the normalised first 600 characters of
  // the body, which is enough to identify a shared advert and short enough that
  // a per-city sentence further down does not break the match.
  // SEEDED FROM THE EXISTING QUEUE, not just from this run. A replay over the
  // live 359-entry backlog caught zero duplicates when the set started empty
  // each sweep, because the pairs that matter were queued in DIFFERENT sweeps:
  // a reposted advert gets a fresh posting id, so the seen[] map lets it
  // through, and an hourly run only ever compared it against its own handful of
  // new rows. Comparing against everything already queued is what actually
  // closes it.
  const bodyKey = desc.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 600);
  if (bodyKey.length > 200) {
    if (runBodies.has(bodyKey)) {
      rejected.push({ ...rec, why: 'same advert already queued under another location' });
      continue;
    }
    runBodies.add(bodyKey);
  }
  candidates.push(rec);
}

// Sort rewritten 2026-10-24 off the first outcome review. The old order was
// "no stated years bar first, then score". Score alone has been a poor guide
// (Ziina at 53 was the best fit of its sweep; two roles at 100 were not jobs he
// could do) and the review found two signals that track conversion better than
// any keyword count, so they sort above it now.
//   1. An explicit offer to sponsor, or relocation support, on a European role.
//      Silence in Europe has been resolving as a no: 23 applications, 11 fast
//      rejections, 0 interviews. A posting that says it out loud is a different
//      proposition from one that does not mention it.
//   2. No stated years bar, which is the pattern that was already converting.
//   3. Mid-level grade ahead of Senior, for the reason in the seniorTitle note.
// Score is the tie-break, which is roughly the weight it has earned.
const sponsorRank = c => (c.euLoc && c.willSponsor) ? 0 : 1;
candidates.sort((a, b) =>
  sponsorRank(a) - sponsorRank(b)
  || (a.yearsBar === null ? 0 : 1) - (b.yearsBar === null ? 0 : 1)
  || (a.seniorTitle ? 1 : 0) - (b.seniorTitle ? 1 : 0)
  || b.score - a.score);

const MIN = profile.preferences.minMatchScoreToStage;
const worth = candidates.filter(c => c.score >= MIN);
const marginal = candidates.filter(c => c.score < MIN);

// -------------------------------------------------------------------- persist
if (!OPT.dry) {
  for (const j of raw) seen[j.source + ':' + j.id] = today;
  // Keep the seen map from growing without bound - 60 days is well past the
  // point where a posting would still be live.
  const cutoff = local(new Date(now - 60 * 864e5)).slice(0, 10);   // same clock as the keys
  for (const k of Object.keys(seen)) if (seen[k] < cutoff) delete seen[k];
  fs.writeFileSync(SEEN, JSON.stringify(seen, null, 0) + '\n');

  // The queue is additive: a candidate stays until the Claude session resolves
  // it, so nothing is lost if an hourly run fires while nobody is looking.
  const prior = fs.existsSync(QUEUE) ? JSON.parse(fs.readFileSync(QUEUE, 'utf8')) : [];
  const haveKey = new Set(prior.map(p => p.source + ':' + p.id));
  const merged = [...prior];
  for (const c of [...worth, ...marginal]) {
    if (haveKey.has(c.source + ':' + c.id)) continue;
    merged.push({ ...c, queuedAt: stamp, state: c.score >= MIN ? 'pending' : 'marginal' });
  }
  fs.writeFileSync(QUEUE, JSON.stringify(merged, null, 2) + '\n');

  fs.appendFileSync(LOG, `${stamp}  pulled=${raw.length} ${JSON.stringify(counts)} `
    + `new=${pass.length} queued=${worth.length} marginal=${marginal.length} `
    + `rejected=${rejected.length}\n`);
}

// -------------------------------------------------- digest file and the toast
// LATEST.md is the one file to open after an unattended run. It is rewritten
// every sweep so it always reflects the most recent one, and the queue keeps
// the history. Marginal roles are listed too, with the reason, because a score
// below the bar has twice now turned out to be a scorer artefact rather than a
// real mismatch.
if (!OPT.dry) {
  // The Visa column was added 2026-10-24. It is the first thing to look at on a
  // European row, because silence on sponsorship has been resolving as a no.
  // "offers" means the body says so out loud; "silent" means it does not, and a
  // silent European posting is a long shot however well it scores. Gulf rows
  // show "n/a" since he is already resident there and it is not the question.
  const visaCell = c => !c.euLoc ? 'n/a' : c.willSponsor ? '**offers**' : 'silent';
  const gradeCell = c => c.seniorTitle ? 'senior' : 'mid';
  const row = c => `| ${c.score} | ${visaCell(c)} | ${gradeCell(c)} | ${c.barVerdict} | ${c.company || '(see posting)'} | ${c.title} | ${c.location} | [open](${c.url}) |`;
  const head = '| Score | Visa | Grade | Years bar | Company | Role | Location | Link |\n|---|---|---|---|---|---|---|---|\n';
  const md = [
    `# Job watcher - ${stamp}`,
    '',
    `Window ${OPT.hours}h. Pulled ${raw.length} postings (${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}).`,
    `${pass.length} passed the card filters, ${candidates.length} cleared the years bar.`,
    '',
    worth.length ? `## Worth applying (score >= ${MIN})\n\n`
      + head
      + worth.map(row).join('\n') : '## Worth applying\n\nNothing cleared the bar this run.',
    '',
    marginal.length ? `## Marginal (below ${MIN}, shown rather than dropped)\n\n`
      + head
      + marginal.map(row).join('\n') : '',
    '',
    '## Why the rest were dropped',
    '',
    ...Object.entries(rejected.reduce((a, r) => (a[r.why] = (a[r.why] || 0) + 1, a), {}))
      .sort((a, b) => b[1] - a[1]).slice(0, 15).map(([w, n]) => `- ${n} - ${w}`),
    '',
    '---',
    '',
    'Bayt, Indeed, NaukriGulf search pages and LinkedIn recruiter posts are not in',
    'this sweep: they refuse scripted requests and need a logged-in browser. Ask',
    'Claude for a browser sweep to cover those.',
    '',
  ].join('\n');
  fs.writeFileSync(LATEST, md);

  if (OPT.notify && worth.length) {
    const top = worth[0];
    const body = worth.length === 1
      ? `${top.title} at ${top.company || 'see posting'} (${top.location}), score ${top.score}`
      : `${worth.length} roles worth applying. Top: ${top.title}, score ${top.score}`;
    try {
      execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
        path.join(ROOT, 'scripts', 'notify.ps1'),
        '-Title', 'New roles found', '-Body', body], { stdio: 'pipe', timeout: 20000 });
    } catch { /* a failed toast must never fail the sweep */ }

    // WhatsApp, if .env is configured. Silent and harmless when it is not.
    // The toast only works if he is at the machine; this reaches him anywhere,
    // which is the point - the Augmented Era role closed while a saved draft
    // sat waiting on one answer.
    try {
      const { sendWhatsApp, waConfigured } = await import('./whatsapp.mjs');
      if (waConfigured()) {
        const lines = worth.slice(0, 5).map(c =>
          `• ${c.score} ${c.title}${c.company ? ' @ ' + c.company : ''} (${c.location})\n  ${c.url}`);
        const res = await sendWhatsApp(
          `Job watcher ${stamp}\n${worth.length} worth applying:\n\n${lines.join('\n\n')}`);
        if (!res.ok) console.log(`  whatsapp not sent: ${res.detail}`);
      }
    } catch (e) { console.log(`  whatsapp error: ${e?.message || e}`); }
  }
}

// --------------------------------------------------------------------- digest
if (OPT.quiet && !worth.length && !marginal.length) process.exit(0);

const pad = (s, n) => String(s ?? '').slice(0, n).padEnd(n);
console.log(`\n  WATCH ${stamp}   window ${OPT.hours}h`);
console.log(`  pulled ${raw.length}  ${JSON.stringify(counts)}`);
for (const f of srcFail) console.log(`  SOURCE FAILED  ${f}`);
if (atsFail.length) console.log(`  boards that failed this run: ${atsFail.join(', ')}`);
console.log(`  ${pass.length} survived the card filters, ${candidates.length} survived the years bar\n`);

if (worth.length) {
  console.log(`  WORTH APPLYING (score >= ${MIN})`);
  console.log('  ' + pad('SC', 4) + pad('YEARS BAR', 26) + pad('COMPANY', 22) + pad('TITLE', 38) + 'LOCATION');
  console.log('  ' + '-'.repeat(118));
  for (const c of worth) console.log('  ' + pad(c.score, 4) + pad(c.barVerdict, 26) + pad(c.company, 22) + pad(c.title, 38) + c.location);
  console.log('');
  for (const c of worth) console.log(`    ${c.company} - ${c.title}\n      ${c.url}\n      strong: ${c.strong.join(', ') || 'none'}\n      gaps:   ${c.gaps.join(', ') || 'none'}\n`);
}

if (marginal.length) {
  console.log(`  MARGINAL (below ${MIN}, listed so nothing is silently dropped)`);
  for (const c of marginal) console.log('  ' + pad(c.score, 4) + pad(c.barVerdict, 26) + pad(c.company, 22) + pad(c.title, 38) + c.location);
  console.log('');
}

if (!worth.length && !marginal.length) console.log('  Nothing new cleared the filters this run.\n');

const byWhy = {};
for (const r of rejected) byWhy[r.why] = (byWhy[r.why] || 0) + 1;
if (Object.keys(byWhy).length) {
  console.log('  why the rest were dropped');
  for (const [w, n] of Object.entries(byWhy).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${w}`);
  console.log('');
}

// Node will not exit on its own here: global fetch keeps its keep-alive sockets
// and their timers in the event loop, which left the scheduled task stuck in
// "Running" and blocked the following hour's run. Everything is written by this
// point, so exit explicitly.
process.exit(0);
