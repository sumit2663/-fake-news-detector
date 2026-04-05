/**************************************************
 * TRUTHSCAN v3.0 — LIVE MULTI-SOURCE DETECTION
 *
 * LAYERS:
 *  1. Structural pattern analysis
 *  2. Vocabulary scoring (Kaggle-calibrated)
 *  3. TF-IDF dataset matching (400+ entries)
 *  4. Wikipedia REST API — entity verification
 *  5. GDELT Project API — live global news check
 *  6. Wikidata API — structured knowledge graph
 *
 * ALL APIS: Free, no key, CORS-open from browser
 *   Wikipedia:  https://en.wikipedia.org/api/rest_v1/
 *   Wikipedia Search: https://en.wikipedia.org/w/api.php
 *   GDELT:      https://api.gdeltproject.org/api/v2/doc/
 *   Wikidata:   https://www.wikidata.org/w/api.php
 **************************************************/

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let dataset    = [];
let isLoaded   = false;
let idfCache   = null;
let lastResult = null;
let exampleIdx = 0;

const SESSION = {
  analyzed: +( localStorage.getItem('ts_analyzed') || 0),
  fake:     +( localStorage.getItem('ts_fake')     || 0),
  real:     +( localStorage.getItem('ts_real')     || 0),
};
let scanHistory = JSON.parse(localStorage.getItem('ts_history') || '[]');

const EXAMPLES = [
  "Watch: Trump completely loses it on Twitter after CNN calls him out for lying again (video)",
  "Breaking: Scientists discover miracle cure doctors don't want you to know about",
  "Senate votes to advance government funding bill before December deadline: reuters",
  "Leaked email proves deep state conspired to steal the election, share before deleted!",
  "U.S. treasury secretary urges congress to raise debt ceiling amid fiscal concerns",
  "Pope Francis just called out Donald Trump during his Christmas speech and it's epic",
  "Federal judge partially lifts travel ban restrictions: nyt",
  "NASA confirms discovery of water on Mars surface in peer-reviewed study",
  "Republicans wrecked after democrats expose their insane corruption (tweet/video)",
  "WHO declares end to COVID-19 public health emergency after three years",
];

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadDataset();
  renderStats();
  renderHistory();
  startClock();

  document.getElementById('newsText').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.ctrlKey) checkNews();
  });
  document.getElementById('newsText').addEventListener('input', e => {
    document.getElementById('urlHint').style.display =
      /https?:\/\//.test(e.target.value) ? 'block' : 'none';
  });
});

// ─────────────────────────────────────────────
// DATASET LOAD
// ─────────────────────────────────────────────
function loadDataset() {
  setPillState('dataset', 'active', 'LOADING');
  fetch('data.json')
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(data => {
      dataset  = data;
      isLoaded = true;
      setPillState('dataset', 'ok', `${data.length} ENTRIES`);
      updateTicker(`DATASET ONLINE — ${data.length} ENTRIES — WIKIPEDIA · GDELT · WIKIDATA READY — PASTE NEWS TO BEGIN`);
    })
    .catch(() => {
      setPillState('dataset', 'error', 'OFFLINE');
      updateTicker('DATASET OFFLINE — RUNNING LIVE-API + KEYWORD MODE');
    });
}

// ─────────────────────────────────────────────
// API PILL HELPERS
// ─────────────────────────────────────────────
function setPillState(id, state, label) {
  const pill = document.getElementById(`pill-${id}`);
  const stEl = document.getElementById(`state-${id}`);
  if (!pill) return;
  pill.className = `api-pill ${state}`;
  if (stEl) { stEl.textContent = label; stEl.className = `api-state ${state === 'ok' ? 'ok' : state === 'error' ? 'fail' : state === 'active' ? 'loading' : ''}`; }
}

// ─────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────
function updateLineNumbers() {
  const lines = document.getElementById('newsText').value.split('\n').length;
  document.getElementById('lineNumbers').textContent =
    Array.from({ length: lines }, (_, i) => i + 1).join('\n');
}
function updateCharCount() {
  const n = document.getElementById('newsText').value.length;
  document.getElementById('charCount').textContent = `${n} char${n !== 1 ? 's' : ''}`;
}
function updateTicker(msg) {
  document.getElementById('tickerContent').textContent = msg;
}
function startClock() {
  const tick = () => { document.getElementById('footerTime').textContent = new Date().toUTCString().replace('GMT','UTC'); };
  tick(); setInterval(tick, 1000);
}
function showToast(msg) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2700);
}
function renderStats() {
  document.getElementById('stat-analyzed').textContent = SESSION.analyzed;
  document.getElementById('stat-fake').textContent     = SESSION.fake;
  document.getElementById('stat-real').textContent     = SESSION.real;
}
function saveStats() {
  localStorage.setItem('ts_analyzed', SESSION.analyzed);
  localStorage.setItem('ts_fake',     SESSION.fake);
  localStorage.setItem('ts_real',     SESSION.real);
}

// ─────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────
function addHistory(text, cls) {
  scanHistory.unshift({ text: text.trim().slice(0, 80), cls, time: Date.now() });
  if (scanHistory.length > 12) scanHistory.pop();
  localStorage.setItem('ts_history', JSON.stringify(scanHistory));
  renderHistory();
}
function renderHistory() {
  const list = document.getElementById('historyList');
  if (!scanHistory.length) { list.innerHTML = '<div class="history-empty">No scans yet</div>'; return; }
  list.innerHTML = scanHistory.map((h, i) => `
    <div class="history-item" onclick="reloadHistory(${i})">
      <div class="history-dot ${h.cls}"></div>
      <span class="history-snippet">${h.text}</span>
      <span class="history-badge ${h.cls}">${h.cls.toUpperCase()}</span>
    </div>`).join('');
}
function reloadHistory(i) {
  const item = scanHistory[i]; if (!item) return;
  document.getElementById('newsText').value = item.text;
  updateLineNumbers(); updateCharCount(); checkNews();
}
function clearHistory() {
  scanHistory = []; localStorage.removeItem('ts_history'); renderHistory(); showToast('HISTORY CLEARED');
}
function pasteExample() {
  document.getElementById('newsText').value = EXAMPLES[exampleIdx++ % EXAMPLES.length];
  updateLineNumbers(); updateCharCount();
}
function clearAll() {
  document.getElementById('newsText').value = '';
  updateLineNumbers(); updateCharCount(); resetScan();
}
function resetScan() {
  document.getElementById('idleState').style.display     = 'flex';
  document.getElementById('scanningState').style.display = 'none';
  document.getElementById('resultState').style.display   = 'none';
  document.getElementById('scanBtn').disabled            = false;
  document.getElementById('scanIcon').style.animation   = 'none';
  ['wiki','gdelt','wikidata'].forEach(id => setPillState(id, '', 'STANDBY'));
}

// ─────────────────────────────────────────────
// ENTITY EXTRACTION
// Extracts named entities (proper nouns, orgs, etc.) from text
// ─────────────────────────────────────────────
function extractEntities(text) {
  const entities = new Set();

  // Capitalised words (likely proper nouns) — skip start of sentence
  const words = text.split(/\s+/);
  words.forEach((w, i) => {
    const clean = w.replace(/[^a-zA-Z'-]/g, '');
    if (clean.length > 2 && /^[A-Z]/.test(clean) && i > 0) {
      entities.add(clean);
    }
  });

  // 2-word phrases (First Last, New York, etc.)
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i].replace(/[^a-zA-Z'-]/g,'');
    const b = words[i+1].replace(/[^a-zA-Z'-]/g,'');
    if (/^[A-Z]/.test(a) && /^[A-Z]/.test(b) && a.length > 1 && b.length > 1) {
      entities.add(`${a} ${b}`);
    }
  }

  // Known political figures / orgs mentioned in lower case too
  const KNOWN = ['trump','obama','biden','congress','senate','fbi','cia','nasa','who','nfl','nba','russia','china','ukraine','putin','clinton'];
  const lower = text.toLowerCase();
  KNOWN.forEach(k => { if (lower.includes(k)) entities.add(k.charAt(0).toUpperCase() + k.slice(1)); });

  // De-dupe subsets (if "Donald Trump" present, skip "Donald" and "Trump")
  const arr = Array.from(entities);
  return arr.filter(e => !arr.some(f => f !== e && f.includes(e))).slice(0, 6);
}

// ─────────────────────────────────────────────
// QUERY BUILDER — extract key phrase for GDELT
// ─────────────────────────────────────────────
function buildSearchQuery(text) {
  const stopWords = new Set(['the','a','an','is','are','was','were','be','been','being',
    'have','has','had','do','does','did','will','would','could','should','may','might',
    'of','in','on','at','to','for','with','by','from','up','about','into','through',
    'this','that','these','those','it','its','he','she','they','we','you','i','and','or','but',
    'not','so','if','as','just','over','after','before','during','while','watch','breaking']);
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g,' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
  // pick top 4 most significant words
  return [...new Set(words)].slice(0, 4).join(' ');
}

// ─────────────────────────────────────────────
// LAYER 4 — WIKIPEDIA API
// ─────────────────────────────────────────────
async function checkWikipedia(text) {
  setPillState('wiki', 'active', 'QUERYING');
  document.getElementById('wikiStatus').textContent  = 'QUERYING';
  document.getElementById('wikiStatus').className    = 'live-source-status loading';
  document.getElementById('wikiCard').classList.add('wiki-active');
  document.getElementById('wikiBody').innerHTML      = '<span class="shimmer-text">Querying Wikipedia REST API...</span>';
  document.getElementById('wikiEntities').innerHTML  = '';

  const entities = extractEntities(text);
  const signals  = [];
  let score      = 0;
  let foundCount = 0;
  const entityResults = [];

  // Check each entity against Wikipedia
  await Promise.allSettled(entities.map(async entity => {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(entity)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        if (data.type !== 'disambiguation' && data.extract) {
          foundCount++;
          entityResults.push({ entity, found: true, summary: data.extract.slice(0,120), url: data.content_urls?.desktop?.page });
          score -= 1.5; // Real entity found → credibility boost
        } else {
          entityResults.push({ entity, found: false });
        }
      } else {
        entityResults.push({ entity, found: false });
      }
    } catch {
      entityResults.push({ entity, found: null }); // timeout/error
    }
  }));

  // Also do a Wikipedia SEARCH on the full headline (checks if story exists)
  let searchHit = false;
  try {
    const query = buildSearchQuery(text);
    if (query.length > 4) {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=3`;
      const res  = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      const hits = data?.query?.search || [];
      if (hits.length > 0) {
        searchHit = true;
        score -= 0.5;
        signals.push({ type: 'wiki', msg: `Wikipedia: Found ${hits.length} related article(s) for "${query}" — topic is documented` });
      }
    }
  } catch { /* ignore */ }

  // Scoring
  if (foundCount === 0 && entities.length > 2) {
    score += 1.5;
    signals.push({ type: 'fake', msg: `Wikipedia: None of ${entities.length} extracted entities found (${entities.slice(0,3).join(', ')}) — unverifiable claims` });
  } else if (foundCount >= 2) {
    signals.push({ type: 'wiki', msg: `Wikipedia: ${foundCount}/${entities.length} entities verified (${entityResults.filter(e=>e.found).map(e=>e.entity).join(', ')})` });
  }

  // Render entity pills
  const pillsHtml = entityResults.map(r => {
    if (r.found === null) return `<span class="entity-pill neutral"><span class="pill-icon">?</span>${r.entity}</span>`;
    if (r.found) return `<span class="entity-pill found"><span class="pill-icon">✓</span><a href="${r.url}" target="_blank" rel="noopener">${r.entity}</a></span>`;
    return `<span class="entity-pill missing"><span class="pill-icon">✕</span>${r.entity}</span>`;
  }).join('');

  const summaryEntity = entityResults.find(e => e.found && e.summary);
  const bodyText = summaryEntity
    ? `Verified: <strong style="color:var(--green)">${summaryEntity.entity}</strong> — ${summaryEntity.summary}...`
    : (foundCount > 0 ? `${foundCount} entity(ies) verified on Wikipedia.` : `No entities matched on Wikipedia.${entities.length ? ' Checked: ' + entities.join(', ') : ''}`);

  document.getElementById('wikiBody').innerHTML      = bodyText;
  document.getElementById('wikiEntities').innerHTML  = pillsHtml;
  document.getElementById('wikiStatus').textContent  = foundCount > 0 ? `${foundCount} VERIFIED` : 'NOT FOUND';
  document.getElementById('wikiStatus').className    = `live-source-status ${foundCount > 0 ? 'ok' : 'fail'}`;
  document.getElementById('wikiCard').classList.remove('wiki-active');
  document.getElementById('wikiCard').classList.add(foundCount > 0 ? 'ok' : 'fail');
  setPillState('wiki', foundCount > 0 ? 'ok' : 'error', foundCount > 0 ? `${foundCount} FOUND` : 'UNVERIFIED');

  return { score, signals, entityResults, foundCount };
}

// ─────────────────────────────────────────────
// LAYER 5 — GDELT PROJECT (Live Global News)
// ─────────────────────────────────────────────
async function checkGDELT(text) {
  setPillState('gdelt', 'active', 'QUERYING');
  document.getElementById('gdeltStatus').textContent = 'QUERYING';
  document.getElementById('gdeltStatus').className   = 'live-source-status loading';
  document.getElementById('gdeltCard').classList.add('gdelt-active');
  document.getElementById('gdeltBody').innerHTML = 'GDELT unavailable — skipping live news check';
  document.getElementById('gdeltArticles').innerHTML = '';

  const query    = buildSearchQuery(text);
  const signals  = [];
  let score      = 0;
  let articles   = [];

  if (!query || query.trim().length < 4) {
    document.getElementById('gdeltBody').innerHTML   = 'Query too short for GDELT search.';
    document.getElementById('gdeltStatus').textContent = 'SKIPPED';
    document.getElementById('gdeltStatus').className  = 'live-source-status';
    setPillState('gdelt', '', 'SKIPPED');
    return { score: 0, signals: [], articles: [] };
  }

  try {
    // GDELT Doc 2.0 API — no key, CORS open
    const rawUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=8&timespan=2months&sort=DateDesc&format=json`;
    const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!res.ok) throw new Error('GDELT HTTP ' + res.status);
    const data = await res.json();
    articles   = data.articles || [];

    if (articles.length === 0) {
      score += 2;
      signals.push({ type: 'fake', msg: `GDELT: No coverage found in 10,000+ global outlets for "${query}" — topic absent from real news` });
      document.getElementById('gdeltBody').innerHTML = `Zero articles found in global news index for: <em>"${query}"</em> — not covered by any verified outlet.`;
      document.getElementById('gdeltStatus').textContent = 'NO COVERAGE';
      document.getElementById('gdeltStatus').className   = 'live-source-status fail';
      document.getElementById('gdeltCard').classList.remove('gdelt-active');
      document.getElementById('gdeltCard').classList.add('fail');
      setPillState('gdelt', 'error', 'NO HITS');
    } else {
      score -= Math.min(articles.length * 0.4, 3); // more coverage = more credible
      signals.push({ type: 'gdelt', msg: `GDELT: ${articles.length} real news article(s) found for "${query}" in last 2 months` });

      const artHtml = articles.slice(0, 4).map((a, i) => `
        <div class="gdelt-article" style="animation-delay:${i*0.08}s">
          <div class="gdelt-art-title">
            <a href="${a.url}" target="_blank" rel="noopener">${a.title || 'Article'}</a>
          </div>
          <div class="gdelt-art-meta">${a.domain || ''} ${a.seendate ? '· ' + a.seendate.slice(0,8) : ''}</div>
        </div>`).join('');

      document.getElementById('gdeltBody').innerHTML     = `Found <strong style="color:var(--green)">${articles.length}</strong> real news article(s) covering this topic:`;
      document.getElementById('gdeltArticles').innerHTML = artHtml;
      document.getElementById('gdeltStatus').textContent = `${articles.length} ARTICLES`;
      document.getElementById('gdeltStatus').className   = 'live-source-status ok';
      document.getElementById('gdeltCard').classList.remove('gdelt-active');
      document.getElementById('gdeltCard').classList.add('ok');
      setPillState('gdelt', 'ok', `${articles.length} HITS`);
    }
  } catch (e) {
    document.getElementById('gdeltBody').innerHTML     = `GDELT API error: ${e.message}. This may be a CORS or network issue.`;
    document.getElementById('gdeltStatus').textContent = 'ERROR';
    document.getElementById('gdeltStatus').className   = 'live-source-status fail';
    document.getElementById('gdeltCard').classList.remove('gdelt-active');
    setPillState('gdelt', 'error', 'ERROR');
  }

  return { score, signals, articles };
}

// ─────────────────────────────────────────────
// LAYER 6 — WIKIDATA KNOWLEDGE GRAPH
// ─────────────────────────────────────────────
async function checkWikidata(text) {
  setPillState('wikidata', 'active', 'QUERYING');
  document.getElementById('wikidataStatus').textContent = 'QUERYING';
  document.getElementById('wikidataStatus').className   = 'live-source-status loading';
  document.getElementById('wikidataCard').classList.add('wikidata-active');
  document.getElementById('wikidataBody').innerHTML     = '<span class="shimmer-text">Querying Wikidata knowledge graph...</span>';
  document.getElementById('wikidataFacts').innerHTML    = '';

  const entities = extractEntities(text).slice(0, 3);
  const signals  = [];
  let score      = 0;
  let foundItems = [];

  await Promise.allSettled(entities.map(async entity => {
    try {
      const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(entity)}&format=json&language=en&type=item&limit=1&origin=*`;
      const res  = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      const hits = data.search || [];
      if (hits.length > 0) {
        const item = hits[0];
        foundItems.push({
          entity,
          id:    item.id,
          label: item.label,
          desc:  item.description || '',
          url:   `https://www.wikidata.org/wiki/${item.id}`,
        });
        score -= 0.8;
      }
    } catch { /* ignore */ }
  }));

  if (foundItems.length === 0 && entities.length > 1) {
    score += 1;
    signals.push({ type: 'fake', msg: `Wikidata: Entities not found in knowledge graph (${entities.slice(0,3).join(', ')})` });
    document.getElementById('wikidataBody').innerHTML = `No matching entities found in Wikidata for: ${entities.join(', ')}.`;
    document.getElementById('wikidataStatus').textContent = 'NOT FOUND';
    document.getElementById('wikidataStatus').className   = 'live-source-status fail';
    document.getElementById('wikidataCard').classList.remove('wikidata-active');
    setPillState('wikidata', 'error', 'NOT FOUND');
  } else if (foundItems.length > 0) {
    signals.push({ type: 'wikidata', msg: `Wikidata: ${foundItems.length} entity(ies) confirmed in knowledge graph (${foundItems.map(f=>f.label).join(', ')})` });

    const factsHtml = foundItems.map(f => `
      <div class="wikidata-fact">
        <span class="wdf-label">${f.label}</span>
        <span class="wdf-val">${f.desc || f.id}</span>
      </div>`).join('');

    document.getElementById('wikidataBody').innerHTML    = `<strong style="color:var(--wikidata)">${foundItems.length}</strong> entity(ies) confirmed in Wikidata:`;
    document.getElementById('wikidataFacts').innerHTML   = factsHtml;
    document.getElementById('wikidataStatus').textContent = `${foundItems.length} CONFIRMED`;
    document.getElementById('wikidataStatus').className   = 'live-source-status ok';
    document.getElementById('wikidataCard').classList.remove('wikidata-active');
    document.getElementById('wikidataCard').classList.add('ok');
    setPillState('wikidata', 'ok', `${foundItems.length} FOUND`);
  } else {
    document.getElementById('wikidataBody').innerHTML    = 'No entities extracted from text for Wikidata check.';
    document.getElementById('wikidataStatus').textContent = 'NO ENTITIES';
    document.getElementById('wikidataStatus').className   = 'live-source-status';
    document.getElementById('wikidataCard').classList.remove('wikidata-active');
    setPillState('wikidata', '', 'NO DATA');
  }

  return { score, signals, foundItems };
}

// ─────────────────────────────────────────────
// LAYER 1 — STRUCTURAL PATTERNS
// ─────────────────────────────────────────────
function analyzeStructure(text) {
  const t = text.toLowerCase().trim();
  const signals = [];
  let score = 0;
  const add = (pts, type, msg) => { score += pts; signals.push({ type, msg }); };

  if (/^watch\s*:/.test(t))          add(3,  'fake', '"Watch:" prefix — in 25%+ of fake dataset headlines');
  if (/^breaking\s*:/.test(t))       add(2,  'fake', '"Breaking:" prefix — often precedes unverified dramatic claims');
  if (/\((video|tweet|tweets|image|images|details|screenshots|graphic images|pics)\)/.test(t))
                                      add(2,  'fake', 'Parenthetical media tag (video)/(images)/(details) — tabloid format');
  if (/\b\w+[*]+\w*\b/.test(t))      add(3,  'fake', 'Censored words (*) — sensationalist language');
  if (/ just /.test(t))              add(1.5,'fake', '"Just" for dramatic immediacy — outrage headline pattern');
  if (/\b(wrecked|destroyed|obliterated|demolished|eviscerated|nuked|torched|shredded|blistered|scorched|dragged|schooled)\b/.test(t))
                                      add(2,  'fake', 'Combat/destruction verb — opinion editorial style, not reporting');
  if (/\b(hilarious|epic|brilliant|stunning|amazing|perfect|incredible|unbelievable|insane|psychotic|disgusting|despicable|vile)\b/.test(t))
                                      add(2,  'fake', 'Emotional superlative — editorialising, not neutral reporting');
  if (/[\u2018\u2019\u201C\u201D]/.test(text))
                                      add(1,  'fake', 'Smart quotes — often used to mock or misrepresent statements');
  if (/\b(busted|exposed|leaked|bombshell|explosive|scandal)\b/.test(t))
                                      add(2,  'fake', 'Tabloid trigger word (busted/leaked/bombshell)');
  if (/\b(conspiracy|cover.?up|they don.?t want|what they.?re hiding)\b/.test(t))
                                      add(3,  'fake', 'Conspiracy framing language');
  if (/\b(share before|deleted|censored|banned)\b/.test(t))
                                      add(4,  'fake', 'Urgency/censorship appeal — manipulation tactic');
  if (/\b(miracle|guaranteed|100%|secret cure|one weird trick)\b/.test(t))
                                      add(3,  'fake', 'Miracle/guarantee language — health misinformation pattern');
  if (/\b(proves?|confirms?)\b.{0,30}\b(trump|obama|clinton|russia|cia|fbi)\b/.test(t))
                                      add(1.5,'fake', 'Claims to "prove" something about a major figure');

  // Real signals (negative)
  if (/^factbox\s*:/.test(t))        add(-5, 'real', '"Factbox:" — exclusive Reuters/AP structured format');
  if (/^exclusive\s*:/.test(t))      add(-2, 'real', '"Exclusive:" — attributed sourced reporting');
  if (/:\s*(nyt|cnn|ap|cnbc|bloomberg|sources?|reports?|filing|officials?|poll|statement|reuters|lawmakers?|aide)\s*$/i.test(t))
                                      add(-3, 'real', 'Source attribution tag at end — wire journalism format');
  if (/\bu\.s\.\b/.test(t))          add(-2, 'real', '"u.s." abbreviation — formal wire journalism style');
  if (/\b(says|said|seeks|urges|calls for|warns|vows|pledges|announces|plans to)\b/.test(t))
                                      add(-1.5,'real','Neutral attribution verb — journalistic reporting style');
  if (/trump on twitter \(/.test(t)) add(-5, 'real', '"Trump on Twitter (date)" — Reuters factbox series');
  if (/^(senator|congress|house|senate|u\.s\.|federal|white house|pentagon)/.test(t))
                                      add(-1.5,'real','Institutional noun at headline start — formal news structure');

  return { score, signals };
}

// ─────────────────────────────────────────────
// LAYER 2 — VOCABULARY
// ─────────────────────────────────────────────
const VOCAB = {
  hilarious:3,wrecked:3,obliterate:3,clown:2,meltdown:3,tantrum:3,
  humiliated:2,embarrassing:2,disgusting:2,pathetic:3,idiot:3,moron:3,
  lunatic:3,psycho:3,unhinged:3,panics:3,panicking:3,seething:3,
  furious:2,outrage:2,shocking:2,horrifying:2,vile:2,scumbag:4,
  dumbass:4,coward:2,hypocrite:3,nazis:2,racist:2,sexist:2,
  molester:3,pedophile:4,pedo:4,conspiracy:3,leaked:2,bombshell:2,
  busted:2,exposed:2,epic:2,brilliant:2,amazing:1.5,stunning:1.5,
  incredible:1.5,destroys:2,obliterates:2,nukes:2,torches:2,blisters:2,shreds:2,
  // Real
  'u.s.':-3,senate:-1,congress:-1,republican:-0.5,democrat:-0.5,
  legislation:-2,committee:-2,amendment:-2,subpoena:-2,testimony:-1,
  nomination:-2,bipartisan:-2,judiciary:-2,exclusive:-1,factbox:-3,
  reuters:-3,spokeswoman:-1,spokesman:-1,officials:-1,lawmakers:-1,
  regulators:-2,intelligence:-1,pentagon:-1,treasury:-1,department:-1,
  appropriations:-2,resolution:-1,
};
function analyzeVocabulary(text) {
  const t     = text.toLowerCase().replace(/[^\w\s.]/g,' ');
  const words = t.split(/\s+/);
  let score   = 0;
  const found = { fake:[], real:[] };
  words.forEach(w => {
    const s = VOCAB[w];
    if (s !== undefined) { score += s; if (s > 0) found.fake.push(w); else found.real.push(w.replace('-','')); }
  });
  return { score: Math.max(-8, Math.min(score, 14)), found };
}

// ─────────────────────────────────────────────
// LAYER 3 — TF-IDF DATASET
// ─────────────────────────────────────────────
const STOP = new Set(['the','is','at','on','in','and','of','to','a','an','it','its','was','are','be','for','that','this','with','as','by','from','or','but','not','have','had','has','he','she','they','we','you','his','her','their','our','been','were','will','would','could','should','after','before','over','about','into','than','when','who','what','how','all','also','just','more','some','such','then','there','so']);
function getWords(text) {
  return text.toLowerCase().replace(/[^\w\s]/g,' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
}
function buildIDF() {
  if (idfCache) return;
  const allW = new Set(); dataset.forEach(d => getWords(d.text).forEach(w => allW.add(w)));
  const vocab = Array.from(allW); const N = dataset.length; idfCache = {};
  vocab.forEach(w => { const df = dataset.filter(d => getWords(d.text).includes(w)).length; idfCache[w] = Math.log((N+1)/(df+1))+1; });
}
function getTFIDF(text) {
  const words = getWords(text); const tf = {};
  words.forEach(w => { tf[w] = (tf[w]||0)+1; });
  const vec = {}; for (const w in tf) vec[w] = tf[w] * (idfCache[w]||0); return vec;
}
function cosine(v1,v2) {
  let dot=0,m1=0,m2=0;
  const keys = new Set([...Object.keys(v1),...Object.keys(v2)]);
  keys.forEach(w => { const a=v1[w]||0,b=v2[w]||0; dot+=a*b; m1+=a*a; m2+=b*b; });
  return dot/(Math.sqrt(m1)*Math.sqrt(m2)||1);
}
function analyzeDataset(text) {
  if (!isLoaded || !dataset.length) return { score:0, topMatches:[] };
  buildIDF();
  const inp = getTFIDF(text);
  const scored = dataset.map(item => ({ item, sim: cosine(inp, getTFIDF(item.text)) })).sort((a,b) => b.sim-a.sim);
  const topMatches = scored.slice(0,5).filter(s => s.sim > 0.06).map(s => ({ text:s.item.text, label:s.item.label, sim:s.sim }));
  let fakeW=0,realW=0; topMatches.forEach(m => { if (m.label==='fake') fakeW+=m.sim; else realW+=m.sim; });
  const score = (fakeW+realW > 0.06) ? ((fakeW/(fakeW+realW))-0.5)*8 : 0;
  return { score, topMatches };
}

// ─────────────────────────────────────────────
// VERDICT + CONFIDENCE
// ─────────────────────────────────────────────
function decideResult(score) {
  if (score >= 7)  return { text:'LIKELY FAKE NEWS',          cls:'fake', icon:'✕' };
  if (score >= 3.5)return { text:'SUSPICIOUS CONTENT',        cls:'warn', icon:'!' };
  if (score >= 1)  return { text:'SLIGHT FAKE INDICATORS',    cls:'warn', icon:'?' };
  if (score <= -5) return { text:'CREDIBLE NEWS',             cls:'real', icon:'✓' };
  if (score <= -2) return { text:'PROBABLY REAL NEWS',        cls:'real', icon:'✓' };
  return                  { text:'UNCERTAIN — VERIFY SOURCE', cls:'warn', icon:'?' };
}
function calcConf(score) {
  const a = Math.abs(score);
  if (a>=10) return 96; if (a>=7) return 90; if (a>=5) return 84;
  if (a>=3)  return 75; if (a>=1) return 63; return 52;
}

// ─────────────────────────────────────────────
// SCAN STEP ANIMATION
// ─────────────────────────────────────────────
function advanceStep(n) {
  for (let i = 1; i < n; i++) {
    const el = document.getElementById(`step${i}`);
    if (el && !el.classList.contains('done')) {
      el.className = 'scan-step done';
      el.textContent = '✓ ' + el.textContent.replace(/^◈ /,'');
    }
  }
  const cur = document.getElementById(`step${n}`);
  if (cur) cur.className = 'scan-step active';
}

// ─────────────────────────────────────────────
// MAIN CONTROLLER
// ─────────────────────────────────────────────
async function checkNews() {
  const text = document.getElementById('newsText').value.trim();
  if (!text) { showToast('ENTER TEXT FIRST'); return; }
  if (text.length < 8) { showToast('TEXT TOO SHORT'); return; }

  // UI — switch to scanning
  document.getElementById('idleState').style.display     = 'none';
  document.getElementById('scanningState').style.display = 'flex';
  document.getElementById('resultState').style.display   = 'none';

  const scanBtn = document.getElementById('scanBtn');
  scanBtn.disabled = true;
  scanBtn.classList.add('loading'); // ✅ ADDED HERE
  
  try {

  for (let i=1;i<=7;i++) {
    const s = document.getElementById(`step${i}`);
    if (s) { 
      s.className='scan-step'; 
      s.textContent = s.textContent.replace(/^✓ /,'◈ ');
    }
  }

  // Step 1: Structure
  advanceStep(1);
  const structural = analyzeStructure(text);
  await delay(300);

  // Step 2: Vocabulary
  advanceStep(2);
  const vocabulary = analyzeVocabulary(text);
  await delay(250);

  // Step 3: Dataset
  advanceStep(3);
  const datasetResult = analyzeDataset(text);
  await delay(300);

  // Steps 4–6: Live APIs (run in parallel, update UI as each resolves)
  advanceStep(4);
    
  // Start APIs separately
    const wikiPromise = checkWikipedia(text).then(r => {
      advanceStep(5); // ✅ Wikipedia = step 5
      return r;
    });
    
    const gdeltPromise = checkGDELT(text).then(r => {
      advanceStep(6); // ✅ GDELT = step 6
      return r;
    });
    
    const wikidataPromise = checkWikidata(text).then(r => {
      advanceStep(7); // ✅ Wikidata = step 7
      return r;
    });
    
  // Wait for all
    const [wikiResult, gdeltResult, wikidataResult] =
      await Promise.all([wikiPromise, gdeltPromise, wikidataPromise]);
    
    await delay(200);

  // Combine scores
  const total =
    structural.score    * 1.0  +
    vocabulary.score    * 0.8  +
    datasetResult.score * 0.6  +
    wikiResult.score    * 0.9  +
    gdeltResult.score   * 1.0  +
    wikidataResult.score* 0.7;

  displayResult({ structural, vocabulary, datasetResult, wikiResult, gdeltResult, wikidataResult, total, text });
} 
  
  finally {
  scanBtn.disabled = false;
  scanBtn.classList.remove('loading'); // ✅ ADD THIS LINE

}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─────────────────────────────────────────────
// DISPLAY RESULT
// ─────────────────────────────────────────────
function displayResult(analysis) {
  const { structural, vocabulary, datasetResult, wikiResult, gdeltResult, wikidataResult, total, text } = analysis;
  const result = decideResult(total);
  const conf   = calcConf(total);

  // Stats
  SESSION.analyzed++;
  if (result.cls === 'fake') SESSION.fake++;
  else if (result.cls === 'real') SESSION.real++;
  saveStats(); renderStats();
  addHistory(text, result.cls);
  lastResult = { result, conf, analysis };

  // Show result
  document.getElementById('scanningState').style.display = 'none';
  document.getElementById('resultState').style.display   = 'block';

  // Result indicator
  const ri = document.getElementById('resultIndicator');
  ri.style.background = result.cls === 'fake' ? 'var(--red)' : result.cls === 'real' ? 'var(--green)' : 'var(--amber)';
  ri.style.boxShadow  = result.cls === 'fake' ? '0 0 6px var(--red)' : result.cls === 'real' ? '0 0 6px var(--green)' : '0 0 6px var(--amber)';

  // Verdict banner
  document.getElementById('verdictBanner').className = `verdict-banner ${result.cls}-banner`;
  document.getElementById('verdictIcon').textContent = result.icon;
  document.getElementById('verdictIcon').className   = `verdict-icon ${result.cls}`;
  document.getElementById('verdictPulse').className  = `verdict-pulse ${result.cls}`;
  document.getElementById('verdictLabel').textContent = result.text;
  document.getElementById('verdictLabel').className   = `verdict-label ${result.cls}`;
  document.getElementById('verdictSub').textContent   = `Confidence: ${conf}% | Score: ${total.toFixed(2)} | Sources: Dataset + Wikipedia + GDELT + Wikidata`;
  document.getElementById('verdictScore').textContent = (total >= 0 ? '+' : '') + total.toFixed(1);

  // Meters
  const fakePct = Math.min(100, Math.max(0, Math.round(50 + total * 4.5)));
  const realPct = 100 - fakePct;
  setTimeout(() => {
    setMeter('fakeBar','fakePct', fakePct);
    setMeter('realBar','realPct', realPct);
    setMeter('confBar','confPct', conf);
  }, 120);

  // Breakdown
  setBD('bdStruct',  'bdStructVal',  structural.score);
  setBD('bdVocab',   'bdVocabVal',   vocabulary.score);
  setBD('bdDataset', 'bdDatasetVal', datasetResult.score);
  setBD('bdWiki',    'bdWikiVal',    wikiResult.score);
  setBD('bdGdelt',   'bdGdeltVal',   gdeltResult.score);
  setBD('bdTotal',   'bdTotalVal',   total);

  // All signals
  const allSignals = [
    ...structural.signals,
    ...vocabulary.found.fake.slice(0,4).map(w => ({ type:'fake', msg:`Fake-signal word: "${w}"` })),
    ...vocabulary.found.real.slice(0,3).map(w => ({ type:'real', msg:`Credibility marker: "${w}"` })),
    ...wikiResult.signals,
    ...gdeltResult.signals,
    ...wikidataResult.signals,
  ];
  document.getElementById('signalCount').textContent = allSignals.length;
  document.getElementById('signalsList').innerHTML   = allSignals.length
    ? allSignals.map((s,i) => `<div class="signal-item ${s.type}-sig" style="animation-delay:${i*0.04}s"><div class="signal-dot"></div>${s.msg}</div>`).join('')
    : '<div class="signal-item neutral-sig"><div class="signal-dot"></div>No strong signals — result driven by dataset similarity</div>';

  // Dataset matches
  const matches = datasetResult.topMatches || [];
  document.getElementById('matchesList').innerHTML = matches.length
    ? matches.slice(0,4).map((m,i) => `
        <div class="match-item" style="animation-delay:${i*0.07}s">
          <div class="match-meta">
            <span class="match-pct ${m.label}">${Math.round(m.sim*100)}%</span>
            <span class="match-label ${m.label}">${m.label.toUpperCase()}</span>
          </div>
          <div class="match-text">${m.text.trim()}</div>
        </div>`).join('')
    : '<div class="match-item"><div class="match-text">No close dataset matches — result driven by live API sources</div></div>';

  updateTicker(`SCAN COMPLETE — VERDICT: ${result.text} — CONFIDENCE: ${conf}% — WIKIPEDIA: ${wikiResult.foundCount} entities — GDELT: ${(gdeltResult.articles||[]).length} articles — WIKIDATA: ${(wikidataResult.foundItems||[]).length} confirmed`);
}

function setMeter(barId, valId, pct) {
  document.getElementById(barId).style.width   = pct + '%';
  document.getElementById(valId).textContent   = pct + '%';
}
function setBD(cellId, valId, score) {
  const r = Math.round(score*10)/10;
  const v = document.getElementById(valId);
  v.textContent = (r >= 0 ? '+' : '') + r;
  v.className   = 'bd-val ' + (r > 0 ? 'pos' : r < 0 ? 'neg' : '');
  document.getElementById(cellId).className = 'breakdown-cell ' + (r > 0 ? 'positive' : r < 0 ? 'negative' : '');
}

// ─────────────────────────────────────────────
// COPY / SHARE
// ─────────────────────────────────────────────
function copyResult() {
  if (!lastResult) { showToast('NO RESULT TO COPY'); return; }
  const { result, conf, analysis: { structural, vocabulary, datasetResult, wikiResult, gdeltResult, wikidataResult, total, text } } = lastResult;
  const lines = [
    '=== TRUTHSCAN v3.0 REPORT ===',
    `VERDICT:    ${result.text}`,
    `CONFIDENCE: ${conf}%`,
    `SCORE:      ${total.toFixed(2)}`,
    '',
    '--- SCORE BREAKDOWN ---',
    `Structural:  ${structural.score.toFixed(1)}`,
    `Vocabulary:  ${vocabulary.score.toFixed(1)}`,
    `Dataset:     ${datasetResult.score.toFixed(1)}`,
    `Wikipedia:   ${wikiResult.score.toFixed(1)} (${wikiResult.foundCount} entities verified)`,
    `GDELT:       ${gdeltResult.score.toFixed(1)} (${(gdeltResult.articles||[]).length} articles found)`,
    `Wikidata:    ${wikidataResult.score.toFixed(1)} (${(wikidataResult.foundItems||[]).length} entities confirmed)`,
    '',
    '--- DETECTED SIGNALS ---',
    ...structural.signals.map(s => `[${s.type.toUpperCase()}] ${s.msg}`),
    ...wikiResult.signals.map(s => `[WIKIPEDIA] ${s.msg}`),
    ...gdeltResult.signals.map(s => `[GDELT] ${s.msg}`),
    ...wikidataResult.signals.map(s => `[WIKIDATA] ${s.msg}`),
    '',
    `INPUT:   ${text}`,
    `SCANNED: ${new Date().toUTCString()}`,
    `SOURCES: Wikipedia REST API · GDELT Project · Wikidata · Kaggle Dataset`,
    '=== END REPORT ===',
  ];
  navigator.clipboard.writeText(lines.join('\n'))
    .then(() => showToast('REPORT COPIED'))
    .catch(() => showToast('CLIPBOARD UNAVAILABLE'));
}
function shareResult() {
  if (!lastResult) { showToast('NO RESULT TO SHARE'); return; }
  const { result, conf } = lastResult;
  const shareData = { title:'TruthScan Result', text:`TruthScan: ${result.text} (${conf}% confidence) — Verified via Wikipedia, GDELT & Wikidata`, url: window.location.href };
  if (navigator.share) { navigator.share(shareData).catch(()=>{}); }
  else { navigator.clipboard.writeText(`${shareData.text} — ${shareData.url}`).then(()=>showToast('LINK COPIED')).catch(()=>showToast('SHARE UNAVAILABLE')); }
}
