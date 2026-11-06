// ============================================================================
//  SEARCH CONFIG - edit this file before your first run.
// ============================================================================
//
//  Everything in here is a decision about YOU and YOUR search. The scoring and
//  filtering engine in scripts/ reads these values; it has no opinions of its
//  own about where you can work or how experienced you are.
//
//  The one number that matters most is `yearsExperience`. Across 234 tracked
//  postings in the original run of this system, the years bar was the single
//  largest reason roles were skipped: 32 of 144 skips, more than every missing
//  technology combined. Get it wrong and the watcher either floods you with
//  roles you cannot win or hides the ones you can.
//
//  After editing, prove it still works:
//      node scripts/test-title-filter.mjs
//      node scripts/test-stack-veto.mjs
//      node scripts/watch.mjs --hours 24 --no-ats
//
// ============================================================================

export default {
  // --------------------------------------------------------------- experience
  // Your real total professional experience, in years, as a decimal.
  // 4 years 7 months = 4.6. Be honest: this is the number the filter trusts.
  yearsExperience: 4.6,

  // How far above your number a posting's stated bar can go before it is
  // dropped. 1.0 keeps "5+ years" visible against 4.6 and labels it a near
  // miss. Raise it and you will see more roles you are formally short of;
  // lower it and you will see fewer.
  yearsTolerance: 1.0,

  // ------------------------------------------------------------------ regions
  // Which geographies to accept. Turn on only what you can actually be hired
  // in, counting visas. Each one maps to a location regex inside
  // scripts/watch.mjs; add a region there if yours is not listed.
  regions: {
    gulf: true,       // UAE, Saudi Arabia, Oman, Kuwait, Qatar
    europe: false,    // EU/EEA, UK, Ireland, Switzerland
    remoteGlobal: true, // postings that say remote with no country lock
  },

  // Locations to drop outright, whatever the score. These are your own
  // judgements about markets not worth your time, not facts about the market.
  // Example from the original run: Sharjah, dropped because the listings were
  // overwhelmingly low quality.
  excludeLocations: [
    // /sharjah/i,
  ],

  // ------------------------------------------------------------- thresholds
  thresholds: {
    // Score at or above this is reported as "worth applying".
    worthApplying: 60,
    // Below worthApplying but at or above this is shown as "marginal" rather
    // than silently dropped. Set equal to worthApplying to hide marginals.
    showMarginal: 45,
    // Minimum weighted evidence a posting must carry for its percentage score
    // to be taken at face value. This exists because of a real failure: a
    // "Technical Manager - Landscape & Swimming Pool" advert scored 100 off
    // two matched categories while a genuine Android role scored 67 off ten.
    // 10 was chosen by measurement over 2,257 stored descriptions. Do not
    // raise it above about 12 without re-measuring; 12 starts demoting real
    // engineering roles.
    evidenceFloor: 10,
  },

  // -------------------------------------------------------------- job sources
  linkedin: {
    enabled: true,

    // Each geo names a LinkedIn LOCATION STRING, exactly as LinkedIn spells it,
    // and which query set to run against it. Three sets are defined inside
    // scripts/watch.mjs near 'source 1: LinkedIn':
    //
    //   'full'  every query, including the lead and management titles
    //   'core'  the core engineering titles only, for secondary markets
    //   'eu'    the European set, which leans full-stack and backend
    //
    // You can also pass your own array of query strings instead of a set name.
    //
    // Each query is one HTTP round trip per geo per page, so the cost is
    // roughly geos x queries x 2. Eight geos on the shipped sets is about 200
    // requests and takes two to three minutes. Start with one geo.
    geos: [
      { name: 'United Arab Emirates', queries: 'full' },
      // { name: 'Saudi Arabia', queries: 'core' },
      // { name: 'Qatar',        queries: 'core' },
      // { name: 'Kuwait',       queries: 'core' },
      // { name: 'Oman',         queries: 'core' },
      // { name: 'Germany',      queries: 'eu' },
      // { name: 'Netherlands',  queries: 'eu' },
      // { name: 'Ireland',      queries: 'eu' },
      // { name: 'Remote',       queries: ['android developer', 'flutter developer'] },
    ],
  },

  // ATS boards (Greenhouse, Lever, Ashby, Recruitee, Workable) are read from
  // profile/companies.json. Copy companies.example.json to companies.json and
  // put the companies you actually want to watch in it. The example ships with
  // roughly 140 that were useful for a Gulf and Europe software search.
  ats: {
    enabled: true,
  },

  // --------------------------------------------------------- stack vetoes
  // Read from the BODY of the posting, not the title, and this is the rule
  // that saves the most wasted work. Four roles in the original run cleared
  // the title filter while being built entirely on a stack the candidate did
  // not have, because the title never said so: a "Senior Backend Developer"
  // that was .NET, a "Senior Software Engineer" that was Oracle EBS, a
  // "Senior GCS Software Engineer" that was UAV firmware.
  //
  // One passing mention never vetoes anything. `hits` is how many times a
  // stack must appear before the posting is dropped as "this IS the job".
  //
  // DELETE the entries that describe stacks you actually have. Everything left
  // here is treated as a technology you cannot do.
  stackVeto: {
    hits: 3,
    stacks: {
      '.NET / C#': /\b(\.net|c#|asp\.net|entity framework|xunit|nsubstitute|blazor|mass ?transit)\b/gi,
      'Oracle EBS': /\b(oracle ebs|e-business suite|rice components|pl\/sql|oracle forms|oracle reports|bi publisher|oracle workflow)\b/gi,
      'embedded / firmware': /\b(embedded|firmware|rtos|freertos|vxworks|zephyr|mcuboot|cortex-m|microcontroller|mcu|bare.?metal|do-178c|adc interfac)\b/gi,
      // NOTE the lookbehind rather than \b. The obvious `/\bc\+\+\b/` looks
      // right and is broken: '+' is not a word character, so the trailing \b
      // never matches "C++" followed by a space, which is how adverts almost
      // always write it. That rule silently never fired. Found by
      // scripts/test-stack-veto.mjs, which is why that test exists.
      'C / C++': /(?<![\w+])(?:c\/c\+\+|c\+\+|cpp(?![a-z]))/gi,
      'Angular': /\b(angular|ngrx|rxjs)\b/gi,
      'Go': /\b(golang|go lang)\b/gi,
      'Ruby / Rails': /\b(ruby|rails|rspec)\b/gi,
      'PHP / Laravel': /\b(php|laravel|symfony)\b/gi,
      // These three exist because widening a search into lead and consultant
      // titles drags in roles that are not software at all. In the Gulf,
      // "Technical Consultant" and "Solutions Engineer" mean VMware
      // datacentres, Salesforce admin work and AV installation far more often
      // than they mean engineering. Seven such postings reached the queue in
      // two sweeps and every one was a skip.
      'VMware / datacentre networking': /\b(vmware|vcf|nsx-?t|nsx-?v|vsphere|vcenter|cisco nexus|cisco catalyst|\bbgp\b|\bospf\b|eigrp|palo alto|f5 ltm|aria operations|vrni|micro-?segmentation)\b/gi,
      'Salesforce platform': /\b(salesforce|sfdc|apex|visualforce|lightning web component|\blwc\b|sales ?cloud|service ?cloud)\b/gi,
      'AV / audio systems': /\b(audio.?visual|microphone|loudspeaker|crestron|extron|dante|cts certification|teams rooms|zoom certified|touring production|theater production|theatre production)\b/gi,
      'enterprise sales / presales': /\b(demand generation|prospecting|quota|sales targets?|channel partners?|upsell|cross.?sell|pre.?sales|proof of concept trials)\b/gi,
    },
  },

  // ------------------------------------------------------------------- titles
  // The title filters themselves live in scripts/watch.mjs, near the top, under
  // "hard rules". They are tuned for a software engineering search and are
  // long regexes with worked examples in the comments, so they are easier to
  // read and edit in place than to express here.
  //
  // Edit them if you are not looking for software roles, and run
  // `node scripts/test-title-filter.mjs` afterwards. That test holds 43 real
  // titles: 22 that must pass and 21 that must not, including the ones that
  // caught this system out, such as "Design Team Lead (Aluminum
  // Manufacturing)" and "Technical Manager - Landscape & Swimming Pool".
  titles: {
    // Grades to drop as too senior for your years. Remove entries as you grow.
    dropTooSenior: true,
    // Drop internships, working-student and graduate-scheme postings.
    dropEntryLevel: true,
  },

  // ------------------------------------------------------------ notifications
  notify: {
    // Windows toast when a sweep finds something above `worthApplying`.
    toast: true,
    // WhatsApp via the Meta Cloud API. Needs .env filled in. Off by default
    // because it costs money and needs a Meta business account.
    whatsapp: false,
  },
};
