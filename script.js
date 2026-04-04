/**************************************************
 * FAKE NEWS DETECTOR — DATASET-TUNED SCRIPT
 *
 * Detection logic rebuilt from Kaggle dataset analysis.
 *
 * Key insight from the data:
 *   FAKE headlines use: "watch:", "breaking:", (video), (tweet),
 *   (image/images), (details), censored * words, "just", dramatic
 *   verbs (wrecked, destroyed, obliterated), emotional adjectives
 *   (hilarious, epic, brilliant), curly/smart quotes for mockery,
 *   and tabloid-style sentence structure.
 *
 *   REAL headlines use: "factbox:", "exclusive:", "u.s.", ": nyt",
 *   ": cnn", ": sources", institutional nouns (senator, secretary,
 *   congress, committee), neutral verbs (says, said, seeks, urges),
 *   and dry factual structure with no parenthetical media tags.
 *
 * Logic layers (all additive):
 *   1. Structural patterns  (format giveaways)
 *   2. Vocabulary scoring   (word-level fake/real signals)
 *   3. Dataset similarity   (cosine TF-IDF against loaded entries)
 *   4. Naive Bayes prior    (base rate: dataset is ~50/50)
 **************************************************/


// ==============================
// GLOBAL STATE
// ==============================

let dataset = [];
let isLoaded = false;
let idfCache = null;
let vocabCache = null;


// ==============================
// LOAD DATASET
// ==============================

function loadDataset() {
    fetch("data.json")
        .then(res => {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
        })
        .then(data => {
            dataset = data;
            isLoaded = true;
            console.log(`✅ Dataset loaded: ${dataset.length} items`);
        })
        .catch(err => {
            console.warn("⚠️ data.json not found — running keyword-only mode:", err.message);
        });
}

loadDataset();


// ==============================
// UI HELPERS
// ==============================

function getTextInput() {
    return document.getElementById("newsText").value;
}

function getResultBox() {
    return document.getElementById("resultBox");
}

function getProgressBar() {
    return document.getElementById("bar");
}

function clearText() {
    document.getElementById("newsText").value = "";
    const box = getResultBox();
    box.className = "";
    box.style.opacity = "1";
    box.innerHTML = "<p style='opacity:0.6;'>Result will appear here...</p>";
    const bar = getProgressBar();
    bar.style.width = "0%";
    bar.style.background = "#22c55e";
    bar.style.boxShadow = "0 0 10px #22c55e";
}

function showLoading() {
    const box = getResultBox();
    box.className = "";
    box.style.opacity = "1";
    box.innerHTML = "<p>⏳ Analyzing...</p>";
    getProgressBar().style.width = "12%";
}

function validateInput(text) {
    if (!text.trim()) return "⚠️ Please enter some text first!";
    if (text.trim().length < 8) return "⚠️ Text is too short to analyze reliably.";
    return null;
}

function detectInputType(text) {
    if (text.length < 40)           return "Short headline";
    if (/https?:\/\//.test(text))   return "URL / link";
    if (text.split(' ').length > 60) return "Full article";
    return "News headline";
}


// ==============================
// LAYER 1 — STRUCTURAL PATTERNS
// Derived from dataset: patterns that appear in 30%+ of fake
// headlines but rarely in real ones, and vice versa.
// ==============================

function analyzeStructure(text) {
    const t   = text.toLowerCase().trim();
    const signals = [];
    let score = 0;

    // --- FAKE structural signals ---

    // "watch:" prefix — 25%+ of fake headlines
    if (/^watch\s*:/.test(t)) {
        score += 3;
        signals.push("Starts with 'Watch:' — common in sensational fake headlines");
    }

    // "breaking:" prefix
    if (/^breaking\s*:/.test(t)) {
        score += 2;
        signals.push("Starts with 'Breaking:' — often used for dramatic unverified claims");
    }

    // Parenthetical media tags: (video), (tweet), (tweets), (image), (images), (details), (screenshots)
    if (/\((video|tweet|tweets|image|images|details|screenshots|graphic images|pics)\)/.test(t)) {
        score += 2;
        signals.push("Has parenthetical media tag like (video) or (images) — tabloid style");
    }

    // Censored words with asterisks: f*ck, sh*t, a**, b*tch etc.
    if (/\b\w+[*]+\w*\b/.test(t)) {
        score += 3;
        signals.push("Contains censored words (*) — sensationalist language pattern");
    }

    // The word "just" used for dramatic effect ("just wrecked", "just admitted")
    if (/ just /.test(t)) {
        score += 1.5;
        signals.push("Uses 'just' for dramatic immediacy — common in outrage headlines");
    }

    // Dramatic destruction verbs
    if (/\b(wrecked|destroyed|obliterated|demolished|eviscerated|nuked|torched|shredded|blistered|scorched|ripped|dragged|clowned|slammed|dunked on|took down|schooled)\b/.test(t)) {
        score += 2;
        signals.push("Uses dramatic combat verb (wrecked, destroyed, shredded…) — opinion/tabloid style");
    }

    // Emotional superlatives
    if (/\b(hilarious|epic|brilliant|stunning|amazing|perfect|incredible|unbelievable|insane|psychotic|disgusting|despicable|vile|awful)\b/.test(t)) {
        score += 2;
        signals.push("Contains emotional superlative adjective — editorializing language");
    }

    // Curly/smart quotes used to mock someone's words
    if (/[\u2018\u2019\u201C\u201D]/.test(text)) {
        score += 1;
        signals.push("Uses curly quotes — often used in fake headlines to mock or misrepresent statements");
    }

    // "busted", "exposed", "caught"
    if (/\b(busted|exposed|caught|leaked|bombshell|explosive|scandal)\b/.test(t)) {
        score += 2;
        signals.push("Uses tabloid trigger word (busted/exposed/leaked/bombshell)");
    }

    // "proves" / "confirms" used for unverified claims
    if (/\b(proves?|confirms?|admits?)\b.{0,30}\b(trump|obama|clinton|russia|cia|fbi)\b/.test(t)) {
        score += 1.5;
        signals.push("Claims to 'prove' or 'confirm' something about a major figure — unverified assertion pattern");
    }

    // --- REAL structural signals (subtract score) ---

    // "factbox:" — exclusively Reuters/AP real news format
    if (/^factbox\s*:/.test(t)) {
        score -= 5;
        signals.push("Starts with 'Factbox:' — Reuters/AP structured news format");
    }

    // "exclusive:" — attributed news exclusive
    if (/^exclusive\s*:/.test(t)) {
        score -= 2;
        signals.push("Starts with 'Exclusive:' — attributed sourced reporting");
    }

    // Source attribution tags at end: ": nyt", ": cnn", ": sources", ": report"
    if (/:\s*(nyt|cnn|ap|cnbc|bloomberg|sources?|reports?|filing|officials?|poll|statement|reuters|lawmakers?|aide|aides)\s*$/.test(t)) {
        score -= 3;
        signals.push("Ends with source attribution tag — wire/institutional journalism format");
    }

    // "u.s." abbreviation — very strong real news signal in this dataset
    if (/\bu\.s\.\b/.test(t)) {
        score -= 2;
        signals.push("Uses 'u.s.' abbreviation — formal wire journalism style");
    }

    // Institutional verbs: says, said, seeks, urges, calls, warns
    if (/\b(says|said|seeks|urges|calls for|warns|vows|pledges|announces|confirms|plans to)\b/.test(t)) {
        score -= 1.5;
        signals.push("Uses neutral attribution verb (says/said/urges) — journalistic reporting style");
    }

    // "trump on twitter (date)" format — factbox series
    if (/trump on twitter \(/.test(t)) {
        score -= 5;
        signals.push("'Trump on Twitter (date)' format — Reuters factbox series");
    }

    return { score, signals };
}


// ==============================
// LAYER 2 — VOCABULARY SCORING
// Words statistically over-represented in fake vs real headlines
// from this Kaggle dataset.
// ==============================

// Each word maps to [fakeScore, realScore]
// Positive = fake signal, Negative = real signal
const VOCAB_SCORES = {
    // Strong fake words (appeared 10x+ more in fake than real)
    "hilarious":    3,  "wrecked":      3,  "obliterate":   3,
    "clown":        2,  "meltdown":     3,  "tantrum":      3,
    "humiliated":   2,  "embarrassing": 2,  "disgusting":   2,
    "pathetic":     3,  "idiot":        3,  "moron":        3,
    "lunatic":      3,  "psycho":       3,  "unhinged":     3,
    "panics":       3,  "panicking":    3,  "seething":     3,
    "furious":      2,  "outrage":      2,  "shocking":     2,
    "horrifying":   2,  "vile":         2,  "scumbag":      4,
    "dumbass":      4,  "coward":       2,  "hypocrite":    3,
    "nazis":        2,  "racist":       2,  "sexist":       2,
    "molester":     3,  "pedophile":    4,  "pedo":         4,
    "conspiracy":   3,  "leaked":       2,  "bombshell":    2,
    "busted":       2,  "exposed":      2,  "caught":       1.5,
    "epic":         2,  "brilliant":    2,  "perfect":      1.5,
    "amazing":      1.5,"stunning":     1.5,"incredible":   1.5,
    "destroys":     2,  "obliterates":  2,  "nukes":        2,
    "torches":      2,  "blisters":     2,  "shreds":       2,

    // Strong real words (appeared in mostly real headlines)
    "u.s.":        -3,  "senate":      -1,  "congress":    -1,
    "republican":  -0.5,"democrat":    -0.5,"legislation": -2,
    "committee":   -2,  "amendment":   -2,  "appropriat":  -2,
    "subpoena":    -2,  "testimony":   -1,  "nomination":  -2,
    "confirmed":   -1,  "bipartisan":  -2,  "judiciary":   -2,
    "exclusive":   -1,  "factbox":     -3,  "reuters":     -3,
    "spokeswoman": -1,  "spokesman":   -1,  "officials":   -1,
    "lawmakers":   -1,  "regulators":  -2,  "intelligence":-1,
    "pentagon":    -1,  "treasury":    -1,  "department":  -1,
};

function analyzeVocabulary(text) {
    const t = text.toLowerCase().replace(/[^\w\s.]/g, " ");
    const words = t.split(/\s+/);
    let score = 0;
    const found = { fake: [], real: [] };

    words.forEach(word => {
        if (VOCAB_SCORES[word] !== undefined) {
            score += VOCAB_SCORES[word];
            if (VOCAB_SCORES[word] > 0) found.fake.push(word);
            else found.real.push(word);
        }
        // Partial match for stems
        for (const key of Object.keys(VOCAB_SCORES)) {
            if (key.length > 5 && word.startsWith(key) && key !== word) {
                score += VOCAB_SCORES[key] * 0.5;
            }
        }
    });

    return { score: Math.max(-6, Math.min(score, 12)), found };
}


// ==============================
// LAYER 3 — DATASET SIMILARITY
// TF-IDF cosine similarity against loaded dataset entries.
// ==============================

const STOP_WORDS = new Set([
    "the","is","at","on","in","and","of","to","a","an","it","its",
    "was","are","be","for","that","this","with","as","by","from","or",
    "but","not","have","had","has","he","she","they","we","you","his",
    "her","their","our","been","were","will","would","could","should",
    "after","before","over","about","into","than","when","who","what",
    "how","all","also","just","more","some","such","then","there","so"
]);

function getWords(text) {
    return text.toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function buildIDF() {
    if (idfCache) return;
    vocabCache = new Set();
    dataset.forEach(item => getWords(item.text).forEach(w => vocabCache.add(w)));
    vocabCache = Array.from(vocabCache);
    idfCache = {};
    const N = dataset.length;
    vocabCache.forEach(word => {
        const df = dataset.filter(item => getWords(item.text).includes(word)).length;
        idfCache[word] = Math.log((N + 1) / (df + 1)) + 1;
    });
}

function getTFIDF(text) {
    const words = getWords(text);
    const tf = {};
    words.forEach(w => { tf[w] = (tf[w] || 0) + 1; });
    const tfidf = {};
    for (const w in tf) {
        tfidf[w] = tf[w] * (idfCache ? (idfCache[w] || 0) : 1);
    }
    return tfidf;
}

function cosine(v1, v2) {
    let dot = 0, m1 = 0, m2 = 0;
    const keys = new Set([...Object.keys(v1), ...Object.keys(v2)]);
    keys.forEach(w => {
        const a = v1[w] || 0, b = v2[w] || 0;
        dot += a * b; m1 += a * a; m2 += b * b;
    });
    return dot / (Math.sqrt(m1) * Math.sqrt(m2) || 1);
}

function analyzeDataset(text) {
    if (!isLoaded || dataset.length === 0) {
        return { score: 0, topMatches: [], matchItem: null };
    }

    buildIDF();
    const inputVec = getTFIDF(text);

    const scored = dataset.map(item => ({
        item,
        sim: cosine(inputVec, getTFIDF(item.text))
    })).sort((a, b) => b.sim - a.sim);

    const topMatches = scored
        .slice(0, 5)
        .filter(s => s.sim > 0.08)
        .map(s => ({ text: s.item.text, label: s.item.label, similarity: s.sim }));

    // Weighted vote from top-5 matches
    let fakeWeight = 0, realWeight = 0;
    topMatches.forEach(m => {
        if (m.label === "fake") fakeWeight += m.similarity;
        else                    realWeight += m.similarity;
    });

    let score = 0;
    let matchItem = null;

    if (fakeWeight + realWeight > 0.1) {
        const fakeRatio = fakeWeight / (fakeWeight + realWeight);
        // fakeRatio > 0.6 → fake signal, < 0.4 → real signal
        score = (fakeRatio - 0.5) * 8;  // range roughly -4 to +4
        matchItem = topMatches[0]?.label ? topMatches[0] : null;
    }

    return { score, topMatches, matchItem };
}


// ==============================
// COMBINED ANALYSIS
// ==============================

function analyzeAll(rawText) {
    const text = rawText.trim();

    const structural  = analyzeStructure(text);
    const vocabulary  = analyzeVocabulary(text);
    const datasetData = analyzeDataset(text);

    // Weighted total: structure is most reliable, then vocab, then dataset
    const totalScore =
        structural.score  * 1.0 +
        vocabulary.score  * 0.8 +
        datasetData.score * 0.6;

    return { structural, vocabulary, datasetData, totalScore };
}


// ==============================
// DECISION ENGINE
// ==============================

function decideResult(score) {
    if (score >= 5)  return { text: "❌ Likely Fake News",          className: "fake" };
    if (score >= 2)  return { text: "⚠️ Suspicious — Verify This",  className: "warn" };
    if (score <= -3) return { text: "✅ Looks Credible",             className: "real" };
    if (score <= -1) return { text: "✅ Probably Real News",         className: "real" };
    return               { text: "⚠️ Uncertain — Needs More Context", className: "warn" };
}

function calculateConfidence(score) {
    const abs = Math.abs(score);
    if (abs >= 8)  return 95;
    if (abs >= 5)  return 88;
    if (abs >= 3)  return 78;
    if (abs >= 2)  return 68;
    return 55;
}


// ==============================
// PROGRESS BAR
// ==============================

function updateProgress(confidence, cls) {
    const bar = getProgressBar();
    bar.style.width = confidence + "%";
    const colors = {
        fake: ["linear-gradient(90deg,#dc2626,#f87171)", "0 0 10px #dc2626"],
        warn: ["linear-gradient(90deg,#ca8a04,#fbbf24)", "0 0 10px #ca8a04"],
        real: ["linear-gradient(90deg,#16a34a,#4ade80)", "0 0 10px #22c55e"],
    };
    bar.style.background  = colors[cls][0];
    bar.style.boxShadow   = colors[cls][1];
}


// ==============================
// TEXT HIGHLIGHTER
// ==============================

function highlightWords(text, fakeWords) {
    let result = text;
    fakeWords.forEach(word => {
        const safe  = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(${safe})`, "gi");
        result = result.replace(regex, '<span style="color:#fde047;font-weight:bold;">$1</span>');
    });
    return result;
}


// ==============================
// DISPLAY RESULT
// ==============================

function displayResult(result, confidence, analysis, rawText) {
    const box = getResultBox();

    const meterColor = { fake:"#dc2626", warn:"#ca8a04", real:"#16a34a" }[result.className];

    const message = {
        fake: "This content shows multiple signals commonly found in fake or sensationalist news.",
        warn: "Mixed signals detected. Some elements suggest fabrication — verify with a trusted source.",
        real: "This headline follows patterns typical of credible, institutional journalism.",
    }[result.className];

    // Combine all signals for display
    const allSignals = [
        ...analysis.structural.signals,
        ...analysis.vocabulary.found.fake.slice(0, 3).map(w => `Fake-signal word detected: "${w}"`),
        ...analysis.vocabulary.found.real.slice(0, 2).map(w => `Credibility word detected: "${w}"`),
    ];

    const signalsHtml = allSignals.length
        ? allSignals.map(s => `<li>${s}</li>`).join("")
        : "<li>No strong structural signals detected</li>";

    // Dataset matches
    const topMatchesHtml = analysis.datasetData.topMatches?.length
        ? analysis.datasetData.topMatches.slice(0, 3).map(m => `
            <li>
              <span style="font-size:12px;opacity:0.55;">${Math.round(m.similarity * 100)}% match</span>
              — <em style="opacity:0.8;">${m.label === "fake" ? "❌ fake" : "✅ real"}</em>:
              ${m.text.trim().slice(0, 85)}${m.text.length > 85 ? "…" : ""}
            </li>`).join("")
        : "<li style='opacity:0.5;'>No close dataset matches found</li>";

    const highlighted = highlightWords(rawText.trim(), analysis.vocabulary.found.fake);

    box.className = "";
    if (result.className === "fake") {
        box.classList.add("fake");
    } else if (result.className === "warn" || confidence < 60) {
        box.classList.add("warn");
    } else if (confidence < 80) {
        box.classList.add("real-light");
    } else {
        box.classList.add("real");
    }
    box.style.opacity = "0";
    const structural = analysis?.structural?.score || 0;
    const vocab = analysis?.vocabulary?.score || 0;
    const datasetScore = analysis?.datasetData?.score || 0;
    box.innerHTML = `
      <h3 class="result-title">${result.text}</h3>
      <p><strong>Confidence:</strong> ${confidence}%</p>
      <p style="margin-top:4px;font-size:14px;opacity:0.7;">
        🧱 Structural: ${structural.toFixed(1)} &nbsp;|&nbsp;
        🧠 Vocab: ${vocab.toFixed(1)} &nbsp;|&nbsp;
        📦 Dataset: ${datasetScore.toFixed(1)}
      </p>

      <div class="meter">
        <div class="fake-meter" style="width:${confidence}%;background:${meterColor};"></div>
      </div>

      <p style="margin-top:14px;"><strong>Why this result:</strong></p>
      <ul>${signalsHtml}</ul>

      <div class="match-box">
        <p class="match-title">📦 Closest dataset matches</p>
        <ul>${topMatchesHtml}</ul>
      </div>

      <p style="margin-top:14px;font-style:italic;opacity:0.85;">${message}</p>

      <hr>
      <p style="font-size:13px;opacity:0.65;margin-top:8px;">
        <strong>Input (flagged words highlighted):</strong><br>${highlighted}
      </p>
    `;

    requestAnimationFrame(() => requestAnimationFrame(() => {
        box.style.opacity = "1";
    }));
}


// ==============================
// MAIN CONTROLLER
// ==============================

function checkNews() {
    showLoading();

    setTimeout(() => {
        const rawText = getTextInput();
        const error   = validateInput(rawText);

        if (error) {
            const box = getResultBox();
            box.className = "warn";
            box.style.opacity = "1";
            box.innerHTML = `<p>${error}</p>`;
            return;
        }

        const analysis   = analyzeAll(rawText);
        const result     = decideResult(analysis.totalScore);
        const confidence = calculateConfidence(analysis.totalScore);

        updateProgress(confidence, result.className);
        displayResult(result, confidence, analysis, rawText);

    }, 600);
}


// ==============================
// INIT
// ==============================

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("newsText").addEventListener("keydown", e => {
        if (e.key === "Enter" && e.ctrlKey) checkNews();
    });

    const particlesContainer = document.querySelector(".particles");
    if (particlesContainer) {
        for (let i = 0; i < 40; i++) {
            const span = document.createElement("span");
            span.style.left              = Math.random() * 100 + "vw";
            span.style.animationDuration = (6 + Math.random() * 10) + "s";
            span.style.animationDelay    = (Math.random() * 8) + "s";
            span.style.width = span.style.height = (4 + Math.random() * 6) + "px";
            particlesContainer.appendChild(span);
        }
    }
});
