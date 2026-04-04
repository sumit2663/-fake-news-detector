/**************************************************
 * TRUTHSCAN v2.4 — COMPLETE SCRIPT
 * Features:
 *  - 3-layer detection (Structure + Vocabulary + TF-IDF Dataset)
 *  - Scan history with click-to-reload
 *  - Session stats (analyzed / fake / real counters)
 *  - Animated step-by-step scanning UI
 *  - Score breakdown per layer
 *  - Copy report to clipboard
 *  - Share via Web Share API
 *  - Example headlines loader
 *  - Line numbers in textarea
 *  - URL detection hint
 *  - Live clock in footer
 *  - LocalStorage persistence for history & stats
 *  - Ticker feed updater
 **************************************************/


// ==============================
// STATE
// ==============================

let dataset = [];
let isLoaded = false;
let idfCache = null;
let vocabCache = null;
let lastResult = null;

const SESSION = {
  analyzed: parseInt(localStorage.getItem('ts_analyzed') || '0'),
  fake:     parseInt(localStorage.getItem('ts_fake')     || '0'),
  real:     parseInt(localStorage.getItem('ts_real')     || '0'),
};

let scanHistory = JSON.parse(localStorage.getItem('ts_history') || '[]');

const EXAMPLES = [
  "Watch: Trump completely loses it on Twitter after CNN calls him out for lying again (video)",
  "Breaking: Scientists discover miracle cure doctors don't want you to know about",
  "Senate votes to advance government funding bill before December deadline",
  "Leaked email proves deep state conspired to steal the election, share before deleted!",
  "U.S. treasury secretary urges congress to raise debt ceiling: sources",
  "Pope Francis just called out Donald Trump during his Christmas speech and it's epic",
  "Federal judge partially lifts travel ban restrictions, ruling to be appealed: reuters",
  "Republicans wrecked after democrats expose their insane corruption (tweet/video)",
];
let exampleIdx = 0;


// ==============================
// INIT
// ==============================

document.addEventListener('DOMContentLoaded', () => {
  loadDataset();
  renderStats();
  renderHistory();
  startClock();

  document.getElementById('newsText').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.ctrlKey) checkNews();
  });

  document.getElementById('newsText').addEventListener('input', e => {
    const v = e.target.value;
    if (/https?:\/\//.test(v)) {
      document.getElementById('urlHint').style.display = 'block';
    } else {
      document.getElementById('urlHint').style.display = 'none';
    }
  });
});


// ==============================
// DATASET LOAD
// ==============================

function loadDataset() {
  fetch('data.json')
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(data => {
      dataset = data;
      isLoaded = true;
      console.log(`✅ Dataset: ${dataset.length} entries`);
      updateTicker(`DATASET LOADED — ${dataset.length} VERIFIED ENTRIES ONLINE — MULTI-LAYER DETECTION READY`);
    })
    .catch(e => {
      console.warn('data.json not found — keyword mode only:', e.message);
      updateTicker('KEYWORD-ONLY MODE — ADD data.json FOR FULL DATASET MATCHING');
    });
}


// ==============================
// UI UTILITIES
// ==============================

function updateLineNumbers() {
  const ta = document.getElementById('newsText');
  const lines = ta.value.split('\n').length;
  const nums = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
  document.getElementById('lineNumbers').textContent = nums;
}

function updateCharCount() {
  const len = document.getElementById('newsText').value.length;
  document.getElementById('charCount').textContent = `${len} char${len !== 1 ? 's' : ''}`;
}

function updateTicker(msg) {
  document.getElementById('tickerContent').textContent = msg;
}

function startClock() {
  function tick() {
    const now = new Date();
    document.getElementById('footerTime').textContent =
      now.toUTCString().replace('GMT', 'UTC');
  }
  tick();
  setInterval(tick, 1000);
}

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function renderStats() {
  document.getElementById('stat-analyzed').querySelector('.stat-val').textContent = SESSION.analyzed;
  document.getElementById('stat-fake').textContent                                = SESSION.fake;
  document.getElementById('stat-real').textContent                                = SESSION.real;
}

function saveStats() {
  localStorage.setItem('ts_analyzed', SESSION.analyzed);
  localStorage.setItem('ts_fake',     SESSION.fake);
  localStorage.setItem('ts_real',     SESSION.real);
}


// ==============================
// HISTORY
// ==============================

function addHistory(text, cls) {
  const item = {
    text: text.trim().slice(0, 80),
    cls,
    time: Date.now(),
  };
  scanHistory.unshift(item);
  if (scanHistory.length > 12) scanHistory.pop();
  localStorage.setItem('ts_history', JSON.stringify(scanHistory));
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!scanHistory.length) {
    list.innerHTML = '<div class="history-empty">No scans yet</div>';
    return;
  }
  list.innerHTML = scanHistory.map((h, i) => `
    <div class="history-item" onclick="reloadHistory(${i})">
      <div class="history-dot ${h.cls}"></div>
      <span class="history-snippet">${h.text}</span>
      <span class="history-badge ${h.cls}">${h.cls.toUpperCase()}</span>
    </div>
  `).join('');
}

function reloadHistory(idx) {
  const item = scanHistory[idx];
  if (!item) return;
  document.getElementById('newsText').value = item.text;
  updateLineNumbers();
  updateCharCount();
  checkNews();
}

function clearHistory() {
  scanHistory = [];
  localStorage.removeItem('ts_history');
  renderHistory();
  showToast('HISTORY CLEARED');
}


// ==============================
// EXAMPLES
// ==============================

function pasteExample() {
  document.getElementById('newsText').value = EXAMPLES[exampleIdx % EXAMPLES.length];
  exampleIdx++;
  updateLineNumbers();
  updateCharCount();
}

function clearAll() {
  document.getElementById('newsText').value = '';
  updateLineNumbers();
  updateCharCount();
  resetScan();
}

function resetScan() {
  document.getElementById('idleState').style.display      = 'flex';
  document.getElementById('scanningState').style.display  = 'none';
  document.getElementById('resultState').style.display    = 'none';
  document.getElementById('scanBtn').disabled             = false;
}


// ==============================
// LAYER 1 — STRUCTURAL PATTERNS
// ==============================

function analyzeStructure(text) {
  const t       = text.toLowerCase().trim();
  const signals = [];
  let score     = 0;

  const addFake = (pts, msg) => { score += pts; signals.push({ type: 'fake', msg }); };
  const addReal = (pts, msg) => { score -= pts; signals.push({ type: 'real', msg }); };

  if (/^watch\s*:/.test(t))
    addFake(3, '"Watch:" prefix — common in sensational fake headlines (25%+ of fake dataset)');

  if (/^breaking\s*:/.test(t))
    addFake(2, '"Breaking:" prefix — often used for dramatic, unverified claims');

  if (/\((video|tweet|tweets|image|images|details|screenshots|graphic images|pics)\)/.test(t))
    addFake(2, 'Parenthetical media tag (video)/(images)/(details) — tabloid formatting');

  if (/\b\w+[*]+\w*\b/.test(t))
    addFake(3, 'Censored words with asterisks — sensationalist language pattern');

  if (/ just /.test(t))
    addFake(1.5, 'Word "just" for dramatic immediacy — outrage headline pattern');

  if (/\b(wrecked|destroyed|obliterated|demolished|eviscerated|nuked|torched|shredded|blistered|scorched|dragged|schooled|humiliated)\b/.test(t))
    addFake(2, 'Combat/destruction verb — opinion/tabloid editorial style');

  if (/\b(hilarious|epic|brilliant|stunning|amazing|perfect|incredible|unbelievable|insane|psychotic|disgusting|despicable|vile)\b/.test(t))
    addFake(2, 'Emotional superlative adjective — editorializing, not reporting');

  if (/[\u2018\u2019\u201C\u201D]/.test(text))
    addFake(1, 'Smart/curly quotes — often used to mock or misrepresent statements');

  if (/\b(busted|exposed|leaked|bombshell|explosive|scandal)\b/.test(t))
    addFake(2, 'Tabloid trigger word (busted/leaked/bombshell)');

  if (/\b(proves?|confirms?)\b.{0,30}\b(trump|obama|clinton|russia|cia|fbi)\b/.test(t))
    addFake(1.5, 'Claims to "prove" something about a major figure — unverified assertion');

  if (/\b(conspiracy|cover.?up|they don.?t want|what they.?re hiding)\b/.test(t))
    addFake(3, 'Conspiracy framing language');

  if (/\b(share before|deleted|censored|banned)\b/.test(t))
    addFake(4, 'Urgency/censorship appeal — manipulation tactic');

  if (/\b(miracle|guaranteed|100%|secret cure|one weird trick)\b/.test(t))
    addFake(3, 'Miracle/guarantee language — health misinformation pattern');

  // REAL signals
  if (/^factbox\s*:/.test(t))
    addReal(5, '"Factbox:" prefix — exclusive Reuters/AP structured reporting format');

  if (/^exclusive\s*:/.test(t))
    addReal(2, '"Exclusive:" prefix — attributed sourced reporting');

  if (/:\s*(nyt|cnn|ap|cnbc|bloomberg|sources?|reports?|filing|officials?|poll|statement|reuters|lawmakers?|aide|aides)\s*$/i.test(t))
    addReal(3, 'Source attribution tag at end — wire journalism attribution format');

  if (/\bu\.s\.\b/.test(t))
    addReal(2, 'Uses "u.s." abbreviation — formal wire journalism style');

  if (/\b(says|said|seeks|urges|calls for|warns|vows|pledges|announces|confirms|plans to)\b/.test(t))
    addReal(1.5, 'Neutral attribution verb (says/urges/warns) — journalistic style');

  if (/trump on twitter \(/.test(t))
    addReal(5, '"Trump on Twitter (date)" — Reuters factbox series format');

  if (/^(senator|congress|house|senate|u\.s\.|federal|white house|pentagon)/.test(t))
    addReal(1.5, 'Institutional noun at headline start — formal news structure');

  return { score, signals };
}


// ==============================
// LAYER 2 — VOCABULARY
// ==============================

const VOCAB = {
  // Fake indicators
  hilarious:3, wrecked:3, obliterate:3, clown:2, meltdown:3,
  tantrum:3, humiliated:2, embarrassing:2, disgusting:2, pathetic:3,
  idiot:3, moron:3, lunatic:3, psycho:3, unhinged:3, panics:3,
  panicking:3, seething:3, furious:2, outrage:2, shocking:2,
  horrifying:2, vile:2, scumbag:4, dumbass:4, coward:2, hypocrite:3,
  nazis:2, racist:2, sexist:2, molester:3, pedophile:4, pedo:4,
  conspiracy:3, leaked:2, bombshell:2, busted:2, exposed:2,
  epic:2, brilliant:2, amazing:1.5, stunning:1.5, incredible:1.5,
  destroys:2, obliterates:2, nukes:2, torches:2, blisters:2, shreds:2,
  // Real indicators (negative = real)
  'u.s.':-3, senate:-1, congress:-1, republican:-0.5, democrat:-0.5,
  legislation:-2, committee:-2, amendment:-2, subpoena:-2, testimony:-1,
  nomination:-2, bipartisan:-2, judiciary:-2, exclusive:-1, factbox:-3,
  reuters:-3, spokeswoman:-1, spokesman:-1, officials:-1, lawmakers:-1,
  regulators:-2, intelligence:-1, pentagon:-1, treasury:-1, department:-1,
  appropriations:-2, resolution:-1, confirms:-0.5,
};

function analyzeVocabulary(text) {
  const t       = text.toLowerCase().replace(/[^\w\s.]/g, ' ');
  const words   = t.split(/\s+/);
  let score     = 0;
  const found   = { fake: [], real: [] };

  words.forEach(word => {
    const s = VOCAB[word];
    if (s !== undefined) {
      score += s;
      if (s > 0) found.fake.push(word);
      else        found.real.push(word.replace('-',''));
    }
  });

  return { score: Math.max(-8, Math.min(score, 14)), found };
}


// ==============================
// LAYER 3 — TF-IDF DATASET
// ==============================

const STOP = new Set([
  'the','is','at','on','in','and','of','to','a','an','it','its',
  'was','are','be','for','that','this','with','as','by','from','or',
  'but','not','have','had','has','he','she','they','we','you','his',
  'her','their','our','been','were','will','would','could','should',
  'after','before','over','about','into','than','when','who','what',
  'how','all','also','just','more','some','such','then','there','so'
]);

function getWords(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ')
    .split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
}

function buildIDF() {
  if (idfCache) return;
  const allWords = new Set();
  dataset.forEach(d => getWords(d.text).forEach(w => allWords.add(w)));
  vocabCache = Array.from(allWords);
  idfCache   = {};
  const N    = dataset.length;
  vocabCache.forEach(word => {
    const df       = dataset.filter(d => getWords(d.text).includes(word)).length;
    idfCache[word] = Math.log((N + 1) / (df + 1)) + 1;
  });
}

function getTFIDF(text) {
  const words = getWords(text);
  const tf    = {};
  words.forEach(w => { tf[w] = (tf[w] || 0) + 1; });
  const vec   = {};
  for (const w in tf) vec[w] = tf[w] * (idfCache[w] || 0);
  return vec;
}

function cosine(v1, v2) {
  let dot = 0, m1 = 0, m2 = 0;
  const keys = new Set([...Object.keys(v1), ...Object.keys(v2)]);
  keys.forEach(w => {
    const a = v1[w]||0, b = v2[w]||0;
    dot += a*b; m1 += a*a; m2 += b*b;
  });
  return dot / (Math.sqrt(m1) * Math.sqrt(m2) || 1);
}

function analyzeDataset(text) {
  if (!isLoaded || !dataset.length) return { score: 0, topMatches: [] };

  buildIDF();
  const inputVec = getTFIDF(text);

  const scored = dataset
    .map(item => ({ item, sim: cosine(inputVec, getTFIDF(item.text)) }))
    .sort((a, b) => b.sim - a.sim);

  const topMatches = scored.slice(0, 5)
    .filter(s => s.sim > 0.06)
    .map(s => ({ text: s.item.text, label: s.item.label, sim: s.sim }));

  let fakeW = 0, realW = 0;
  topMatches.forEach(m => {
    if (m.label === 'fake') fakeW += m.sim;
    else                    realW += m.sim;
  });

  let score = 0;
  if (fakeW + realW > 0.06) {
    const ratio = fakeW / (fakeW + realW);
    score = (ratio - 0.5) * 8;
  }

  return { score, topMatches };
}


// ==============================
// VERDICT
// ==============================

function decideResult(score) {
  if (score >= 6)  return { text: 'LIKELY FAKE NEWS',         cls: 'fake', icon: '✕' };
  if (score >= 3)  return { text: 'SUSPICIOUS CONTENT',       cls: 'warn', icon: '!' };
  if (score >= 1)  return { text: 'SLIGHT FAKE INDICATORS',   cls: 'warn', icon: '?' };
  if (score <= -4) return { text: 'CREDIBLE NEWS',            cls: 'real', icon: '✓' };
  if (score <= -1) return { text: 'PROBABLY REAL NEWS',       cls: 'real', icon: '✓' };
  return                  { text: 'UNCERTAIN — VERIFY',       cls: 'warn', icon: '?' };
}

function calcConfidence(score) {
  const a = Math.abs(score);
  if (a >= 10) return 96;
  if (a >= 7)  return 90;
  if (a >= 5)  return 83;
  if (a >= 3)  return 74;
  if (a >= 1)  return 62;
  return 50;
}


// ==============================
// SCAN ANIMATION
// ==============================

function runScanAnimation(callback) {
  const steps = ['step1','step2','step3','step4'];
  const delays = [200, 550, 900, 1200];

  steps.forEach(id => {
    document.getElementById(id).className = 'scan-step';
  });

  steps.forEach((id, i) => {
    setTimeout(() => {
      // Done previous
      if (i > 0) {
        document.getElementById(steps[i-1]).className = 'scan-step done';
        document.getElementById(steps[i-1]).textContent =
          '✓ ' + document.getElementById(steps[i-1]).textContent.slice(2);
      }
      document.getElementById(id).className = 'scan-step active';
    }, delays[i]);
  });

  setTimeout(() => {
    document.getElementById(steps[steps.length-1]).className = 'scan-step done';
    callback();
  }, 1600);
}


// ==============================
// DISPLAY RESULT
// ==============================

function displayResult(analysis) {
  const { structural, vocabulary, datasetResult, total, text } = analysis;
  const result     = decideResult(total);
  const confidence = calcConfidence(total);

  // Update stats
  SESSION.analyzed++;
  if (result.cls === 'fake') SESSION.fake++;
  else if (result.cls === 'real') SESSION.real++;
  saveStats();
  renderStats();

  // Add to history
  addHistory(text, result.cls);

  // Store for copy/share
  lastResult = { result, confidence, analysis };

  // Show result panel
  document.getElementById('scanningState').style.display = 'none';
  document.getElementById('resultState').style.display   = 'block';

  // Verdict banner
  const banner = document.getElementById('verdictBanner');
  banner.className = `verdict-banner ${result.cls}-banner`;

  const icon = document.getElementById('verdictIcon');
  icon.textContent  = result.icon;
  icon.className    = `verdict-icon ${result.cls}`;

  document.getElementById('verdictPulse').className = `verdict-pulse ${result.cls}`;
  document.getElementById('verdictLabel').textContent = result.text;
  document.getElementById('verdictLabel').className   = `verdict-label ${result.cls}`;
  document.getElementById('verdictSub').textContent   = `Confidence: ${confidence}% | Score: ${total.toFixed(2)}`;
  document.getElementById('verdictScore').textContent = `${total >= 0 ? '+' : ''}${total.toFixed(1)}`;

  // Meters — animate after short delay
  const fakePct = Math.min(100, Math.max(0, Math.round(50 + total * 5)));
  const realPct = 100 - fakePct;
  setTimeout(() => {
    setMeter('fakeBar', 'fakePct', fakePct);
    setMeter('realBar', 'realPct', realPct);
    setMeter('confBar', 'confPct', confidence);
  }, 100);

  // Breakdown cells
  setBreakdown('bdStruct', 'bdStructVal', structural.score);
  setBreakdown('bdVocab',  'bdVocabVal',  vocabulary.score);
  setBreakdown('bdDataset','bdDatasetVal', datasetResult.score);
  setBreakdown('bdTotal',  'bdTotalVal',  total);

  // Signals
  const allSignals = [
    ...structural.signals,
    ...vocabulary.found.fake.slice(0, 4).map(w => ({ type: 'fake', msg: `Fake-signal word detected: "${w}"` })),
    ...vocabulary.found.real.slice(0, 3).map(w => ({ type: 'real', msg: `Credibility marker: "${w}"` })),
  ];
  const sigList = document.getElementById('signalsList');
  document.getElementById('signalCount').textContent = allSignals.length;
  if (!allSignals.length) {
    sigList.innerHTML = '<div class="signal-item neutral-sig"><div class="signal-dot"></div>No strong signals detected — result based on dataset similarity only</div>';
  } else {
    sigList.innerHTML = allSignals.map((s, i) => `
      <div class="signal-item ${s.type}-sig" style="animation-delay:${i * 0.05}s">
        <div class="signal-dot"></div>${s.msg}
      </div>`).join('');
  }

  // Dataset matches
  const matchList = document.getElementById('matchesList');
  const matches   = datasetResult.topMatches || [];
  if (!matches.length) {
    matchList.innerHTML = '<div class="match-item"><div class="match-text">No close matches in dataset — result based on structural/vocabulary analysis</div></div>';
  } else {
    matchList.innerHTML = matches.slice(0, 4).map((m, i) => `
      <div class="match-item" style="animation-delay:${i*0.08}s">
        <div class="match-meta">
          <span class="match-pct ${m.label}">${Math.round(m.sim * 100)}%</span>
          <span class="match-label ${m.label}">${m.label.toUpperCase()}</span>
        </div>
        <div class="match-text">${m.text.trim()}</div>
      </div>`).join('');
  }

  // Ticker update
  updateTicker(`SCAN COMPLETE — VERDICT: ${result.text} — CONFIDENCE: ${confidence}% — SCORE: ${total.toFixed(2)} — DATASET MATCHES: ${matches.length}`);
}

function setMeter(barId, valId, pct) {
  document.getElementById(barId).style.width         = pct + '%';
  document.getElementById(valId).textContent         = pct + '%';
}

function setBreakdown(cellId, valId, score) {
  const cell = document.getElementById(cellId);
  const val  = document.getElementById(valId);
  const rounded = Math.round(score * 10) / 10;
  val.textContent = (rounded >= 0 ? '+' : '') + rounded;
  val.className   = 'bd-val ' + (rounded > 0 ? 'pos' : rounded < 0 ? 'neg' : '');
  cell.className  = 'breakdown-cell ' + (rounded > 0 ? 'positive' : rounded < 0 ? 'negative' : '');
}


// ==============================
// MAIN CONTROLLER
// ==============================

function checkNews() {
  const text = document.getElementById('newsText').value.trim();

  if (!text) { showToast('ENTER TEXT FIRST'); return; }
  if (text.length < 8) { showToast('TEXT TOO SHORT'); return; }

  // Switch to scanning UI
  document.getElementById('idleState').style.display     = 'none';
  document.getElementById('scanningState').style.display = 'flex';
  document.getElementById('resultState').style.display   = 'none';
  document.getElementById('scanBtn').disabled            = true;

  // Run animation then compute
  runScanAnimation(() => {
    const structural    = analyzeStructure(text);
    const vocabulary    = analyzeVocabulary(text);
    const datasetResult = analyzeDataset(text);

    const total = structural.score * 1.0
                + vocabulary.score * 0.8
                + datasetResult.score * 0.6;

    displayResult({ structural, vocabulary, datasetResult, total, text });
    document.getElementById('scanBtn').disabled = false;
  });
}


// ==============================
// ACTIONS
// ==============================

function copyResult() {
  if (!lastResult) { showToast('NO RESULT TO COPY'); return; }
  const { result, confidence, analysis } = lastResult;
  const { structural, vocabulary, datasetResult, total, text } = analysis;

  const report = [
    '=== TRUTHSCAN REPORT ===',
    `VERDICT:    ${result.text}`,
    `CONFIDENCE: ${confidence}%`,
    `SCORE:      ${total.toFixed(2)}`,
    '',
    '--- SCORE BREAKDOWN ---',
    `Structural:  ${structural.score.toFixed(1)}`,
    `Vocabulary:  ${vocabulary.score.toFixed(1)}`,
    `Dataset:     ${datasetResult.score.toFixed(1)}`,
    '',
    '--- SIGNALS ---',
    ...structural.signals.map(s => `[${s.type.toUpperCase()}] ${s.msg}`),
    ...vocabulary.found.fake.map(w => `[FAKE] Word: "${w}"`),
    ...vocabulary.found.real.map(w => `[REAL] Word: "${w}"`),
    '',
    '--- DATASET MATCHES ---',
    ...(datasetResult.topMatches || []).map(m =>
      `${Math.round(m.sim*100)}% match [${m.label.toUpperCase()}]: ${m.text.trim()}`
    ),
    '',
    `INPUT: ${text}`,
    `SCANNED: ${new Date().toUTCString()}`,
    '=== END REPORT ==='
  ].join('\n');

  navigator.clipboard.writeText(report)
    .then(() => showToast('REPORT COPIED TO CLIPBOARD'))
    .catch(() => showToast('CLIPBOARD UNAVAILABLE'));
}

function shareResult() {
  if (!lastResult) { showToast('NO RESULT TO SHARE'); return; }
  const { result, confidence } = lastResult;
  const shareData = {
    title: 'TruthScan Result',
    text: `TruthScan verdict: ${result.text} (${confidence}% confidence)\nCheck news at: `,
    url: window.location.href,
  };
  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
  } else {
    navigator.clipboard.writeText(`TruthScan verdict: ${result.text} (${confidence}% confidence) — ${window.location.href}`)
      .then(() => showToast('LINK COPIED'))
      .catch(() => showToast('SHARE UNAVAILABLE'));
  }
}
