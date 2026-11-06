#!/usr/bin/env node
// Probe candidate company slugs against public ATS APIs and record which ones
// actually serve a job board. Run occasionally to refresh profile/companies2.json.
//   node scripts/discover.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// UAE / MENA tech, fintech, banking, e-commerce, logistics, telco.
const CANDIDATES = [
  'careem','talabat','noon','namshi','instashop','deliveroo','zomato',
  'tabby','tamara','ziina','pyypl','mamopay','telr','postpay','spotii','cashew',
  'networkinternational','magnati','nymcard','tarabut','tarabutgateway','lean','leantech',
  'baraka','sarwa','wio','wiobank','liv','yap','yapp','rain','rainfinancial','bitoasis','coinmena',
  'huspy','propertyfinder','bayut','dubizzle','emergingmarketsproperty',
  'kitopi','swvl','cafu','udrive','ekar','fetchr','aramex','shipa','shipablue',
  'anghami','starzplay','shahid','yalla','yallagroup',
  'bayzat','sprinto','alefeducation','alef','classera',
  'g42','core42','presight','m42','injazat','khazna',
  'emiratesnbd','mashreq','adcb','fab','dib','enbd',
  'emirates','etihad','flydubai','airarabia',
  'majidalfuttaim','chalhoub','landmarkgroup','alshaya','gmg','americana','apparelgroup',
  'dpworld','adnoc','mubadala','aldar','emaar','damac',
  'etisalat','edigital','duae','astratech','botim',
  'amazon','souq','microsoft','oracle','sap','ibm','accenture','pwc','deloitte','kpmg','ey',
  'thoughtworks','globant','epam','luxoft','andela','turing',
  'hellofresh','glovo','bolt','uber','lyft','revolut','wise','checkout','adyen','stripe','paypal',
  'binance','kraken','okx','bybit','crypto',
  'trukker','loadme','fodel','barq','onelog',
  'alamiya','sary','jahez','nana','foodics','unifonic','salla','zid','rewaa','nuwa',
  'vezeeta','altibbi','okadoc','medcare','aster',
  'gomotive','zbooni','cartlow','floward','fresha','washmen','elgrocer','nowpay',
,
  'emaar','emaarproperties','dubaiholding','meraas','nakheel','azizi','sobha','binghatti','talabatuae','careemnow','deliveryherouae','instashopme','elgrocer','yallamarket','nana','trolley','mashreqbank','liv','enbd','emiratesnbdbank','adib','rakbank','cbd','commercialbankdubai','hsbcuae','aldar','miral','farahexperiences','yasisland','atlantis','jumeirah','kerzner','emaarhospitality','majidalfuttaimretail','carrefouruae','luluexchange','alansari','alfardanexchange','uaeexchange','etisalatdigital','edigitaluae','ewings','duuae','virginmobileuae','g42ai','presightai','space42','bayanat','yahsat','thales','honeywell','siemens','schneider','tabbyai','tamarahq','postpayme','cashewpayments','risecards','nymcardme','ziinapay','mamo','telrpay','huspyhq','propertyfinderae','bayutcom','dubizzlecom','houzahq','stake','smartcrowd','chalhoubgroup','apparelgroupuae','landmarkgroupuae','alshayagroup','gmggroup','alfuttaim','alfuttaimgroup','dpworldglobal','abudhabiports','adnocdigital','mubadalacapital','g42healthcare','zomato','swiggy','careem','uber','bolteu','yandex','inDrive','indriver','kitopiuae','swvltech','cafuapp','udriveme','ekarapp','trukkerapp','loadme','shipaae','anghamiapp','starzplayarabia','shahidmbc','osn','yallalive','tarabutgateway','sarwaapp','barakaapp','wiobank','yapme','pyyplapp','bitoasisme','rainfinancial','coinmenaexchange','bayzatapp','sprintohq','alefeducationgroup','classeraedu','noonacademy','vezeetahealth','okadocare','foodicsapp','unifonicinc','salla','zidsa','rewaa','sary','jahezgroup','nanadirect','agilitylogistics','aramexglobal','fetchrme','barqit','onelogme','fodeldelivery','thoughtworksuae','globantuae','epamuae','luxoftdxc','dxctechnology','ntt','wipro','infosys','tcs','hcltech','techmahindra','cognizant','capgemini','atos','ibmuae','accentureuae','deloittedigital','oracleuae','sapuae','microsoftuae','awsuae','googleuae','metauae','amazonuae','noonecom','souqcom',
];

const PROVIDERS = [
  { name: 'greenhouse', url: s => `https://boards-api.greenhouse.io/v1/boards/${s}/jobs`,
    count: d => Array.isArray(d?.jobs) ? d.jobs.length : null },
  { name: 'lever', url: s => `https://api.lever.co/v0/postings/${s}?mode=json`,
    count: d => Array.isArray(d) ? d.length : null },
  { name: 'ashby', url: s => `https://api.ashbyhq.com/posting-api/job-board/${s}`,
    count: d => Array.isArray(d?.jobs) ? d.jobs.length : null },
  { name: 'recruitee', url: s => `https://${s}.recruitee.com/api/offers/`,
    count: d => Array.isArray(d?.offers) ? d.offers.length : null },
  { name: 'workable', url: s => `https://apply.workable.com/api/v1/widget/accounts/${s}?details=true`,
    count: d => Array.isArray(d?.jobs) ? d.jobs.length : null },
];

const CONCURRENCY = 12;
const TIMEOUT = 12000;

async function probe(slug, provider) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(provider.url(slug), {
      signal: ctl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const n = provider.count(data);
    if (n === null || n === 0) return null;
    return { slug, provider: provider.name, jobCount: n };
  } catch { return null; }
  finally { clearTimeout(t); }
}

const tasks = [];
for (const slug of CANDIDATES) for (const p of PROVIDERS) tasks.push([slug, p]);

const found = [];
let done = 0;
async function worker() {
  while (tasks.length) {
    const [slug, p] = tasks.shift();
    const hit = await probe(slug, p);
    done++;
    if (hit) { found.push(hit); console.log(`  ✓ ${hit.provider.padEnd(11)} ${hit.slug.padEnd(22)} ${hit.jobCount} jobs`); }
    if (done % 100 === 0) console.log(`  … ${done} probes`);
  }
}

console.log(`Probing ${CANDIDATES.length} companies across ${PROVIDERS.length} ATS providers (${tasks.length} requests)…\n`);
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

found.sort((a, b) => b.jobCount - a.jobCount);
const out = path.join(ROOT, 'profile/companies.json');
fs.writeFileSync(out, JSON.stringify({
  _note: 'Verified public ATS job boards. Regenerate with: node scripts/discover.mjs',
  generated: new Date().toISOString().slice(0, 10),
  companies: found,
}, null, 2) + '\n');

console.log(`\n  ${found.length} live boards found → profile/companies.json`);
console.log(`  Total jobs reachable: ${found.reduce((s, f) => s + f.jobCount, 0)}`);
