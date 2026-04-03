/**************************************************
 * FAKE NEWS DETECTOR - ADVANCED SCRIPT (300+ STYLE)
 **************************************************/

// ==============================
// 🔹 GLOBAL VARIABLES
// ==============================

let dataset = [];
let isLoaded = false;


// ==============================
// 🔹 LOAD DATASET
// ==============================

function loadDataset() {
    fetch("data.json")
        .then(res => res.json())
        .then(data => {
            dataset = data;
            isLoaded = true;
            console.log("✅ Dataset loaded:", dataset.length);
        })
        .catch(err => {
            console.error("❌ Dataset error:", err);
        });
}

loadDataset();


// ==============================
// 🔹 UI HELPERS
// ==============================

function getTextInput() {
    return document.getElementById("newsText").value.toLowerCase();
}

function getResultBox() {
    return document.getElementById("resultBox");
}

function getProgressBar() {
    return document.getElementById("bar");
}


// ==============================
// 🔹 CLEAR FUNCTION
// ==============================

function clearText() {
    document.getElementById("newsText").value = "";

    let box = getResultBox();
    box.className = "";
    box.innerHTML = "<p>🧹 Cleared</p>";

    let bar = getProgressBar();
    bar.style.width = "0%";
    bar.style.background = "#22c55e"; // reset color
}

// ==============================
// 🔹 LOADING UI
// ==============================

function showLoading() {
    let box = getResultBox();
    let bar = getProgressBar();

    box.className = "";
    box.innerHTML = "<p>⏳ Analyzing news...</p>";

    bar.style.width = "10%";
}


// ==============================
// 🔹 VALIDATION
// ==============================

function validateInput(text) {
    if (!isLoaded) return "Dataset not loaded!";
    if (!text.trim()) return "Please enter some text!";
    return null;
}


// ==============================
// 🔹 KEYWORD ENGINE
// ==============================

function getKeywords() {
    return [
        "shocking",
        "fake",
        "rumor",
        "unverified",
        "conspiracy",
        "leak",
        "secret",
        "viral",
        "breaking",
        "urgent",
        "limited time",
        "click here"
    ];
}

function analyzeKeywords(text) {

    let keywords = {
        "shocking": 2,
        "fake": 3,
        "rumor": 3,
        "unverified": 3,
        "conspiracy": 3,
        "leak": 2,
        "secret": 2,
        "viral": 1,
        "breaking": 1,
        "urgent": 2,
        "limited time": 3,
        "click here": 3,
        "100% cure": 5,
        "guarantee": 4,
        "miracle": 4
    };

    let found = [];
    let score = 0;

    for (let word in keywords) {
        if (text.includes(word)) {
            found.push(word);
            score += keywords[word]; // ✅ weighted scoring
        }
    }

    return { score, found };
}

// ==============================
// 🔹 DATASET ENGINE
// ==============================
// 🔹 SIMPLE SIMILARITY CHECK
function calculateSimilarity(text1, text2) {

    let stopWords = ["the", "is", "at", "on", "in", "and", "of", "to"];

    let words1 = [...new Set(
        text1.split(" ")
        .filter(w => w.length > 2 && !stopWords.includes(w))
    )];

    let words2 = [...new Set(
        text2.split(" ")
        .filter(w => w.length > 2 && !stopWords.includes(w))
    )];

    let common = words1.filter(w => words2.includes(w));

    return common.length / Math.max(words1.length, words2.length);
}

// ==============================
// 🔹 TF-IDF ENGINE
// ==============================

function getAllWords(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(" ")
        .filter(w => w.length > 2);
}

// Build vocabulary
function buildVocabulary(dataset) {
    let vocab = new Set();

    dataset.forEach(item => {
        getAllWords(item.text).forEach(word => vocab.add(word));
    });

    return Array.from(vocab);
}

// Calculate IDF
function calculateIDF(dataset, vocab) {
    let idf = {};

    vocab.forEach(word => {
        let count = 0;

        dataset.forEach(item => {
            if (getAllWords(item.text).includes(word)) {
                count++;
            }
        });

        idf[word] = Math.log(dataset.length / (count + 1));
    });

    return idf;
}

// TF vector
function getTF(text) {
    let words = getAllWords(text);
    let tf = {};

    words.forEach(word => {
        tf[word] = (tf[word] || 0) + 1;
    });

    return tf;
}

// TF-IDF vector
function getTFIDF(tf, idf) {
    let tfidf = {};

    for (let word in tf) {
        tfidf[word] = tf[word] * (idf[word] || 0);
    }

    return tfidf;
}

// Cosine similarity
function cosineSimilarity(vec1, vec2) {
    let dot = 0;
    let mag1 = 0;
    let mag2 = 0;

    let words = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);

    words.forEach(word => {
        let v1 = vec1[word] || 0;
        let v2 = vec2[word] || 0;

        dot += v1 * v2;
        mag1 += v1 * v1;
        mag2 += v2 * v2;
    });

    return dot / (Math.sqrt(mag1) * Math.sqrt(mag2) || 1);
}


function analyzeDataset(text) {

    text = text.toLowerCase().replace(/[^\w\s]/g, "");

    let matchItem = null;
    let score = 0;
    let bestSimilarity = 0;

    dataset.forEach(item => {

        let cleanItemText = item.text.toLowerCase().replace(/[^\w\s]/g, "");

        let similarity = calculateSimilarity(text, cleanItemText);

        if (similarity > 0.4 && similarity > bestSimilarity) {
            bestSimilarity = similarity;
            matchItem = item;
        }
    });

    // 🔥 scoring based on similarity
    if (matchItem) {
        if (bestSimilarity > 0.6) {
            score += matchItem.label === "fake" ? 3 : -2;
        } else {
            score += matchItem.label === "fake" ? 2 : -1;
        }
    }

    return { matchItem, score };
}

// ==============================
// 🔹 CONFIDENCE CALCULATOR
// ==============================

function calculateConfidence(score) {

    if (score <= 0) return 60;   // real but not 0%
    if (score >= 6) return 95;

    return Math.min(60 + score * 10, 95);
}


// ==============================
// 🔹 RESULT DECISION ENGINE
// ==============================

function decideResult(score, datasetMatch) {

    // 🔥 dataset should NOT blindly decide
    if (datasetMatch) {

        if (datasetMatch.label === "fake") {
            return { text: "❌ Fake (Dataset Match)", className: "fake" };
        }

        // ⚠️ if dataset says real, still check score
        if (score >= 3) {
            return { text: "⚠️ Suspicious (Conflicting Data)", className: "warn" };
        }

        return { text: "✅ Looks Real (Dataset Match)", className: "real" };
    }

    // 🔥 normal scoring
    if (score >= 6) {
        return { text: "❌ Highly Likely Fake", className: "fake" };
    }

    if (score >= 3) {
        return { text: "⚠️ Suspicious Content", className: "warn" };
    }

    return { text: "✅ Looks Real", className: "real" };
}


// ==============================
// 🔹 TEXT HIGHLIGHTER
// ==============================

function highlightWords(text, words) {
    words.forEach(word => {

        // ✅ make word safe for regex
        let safeWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        let regex = new RegExp(`(${safeWord})`, "gi");

        text = text.replace(regex, `<span style="color:red; font-weight:bold;">$1</span>`);
    });

    return text;
}


// ==============================
// 🔹 PROGRESS BAR UPDATE
// ==============================

function updateProgress(confidence, resultClass) {
    let bar = getProgressBar();
    bar.style.width = confidence + "%";

    if (resultClass === "fake") {
        bar.style.background = "#dc2626";
    } else if (resultClass === "warn") {
        bar.style.background = "#ca8a04";
    } else {
        bar.style.background = "#22c55e";
    }
}


// ==============================
// 🔹 DISPLAY RESULT
// ==============================

function displayResult(result, confidence, words, text, datasetData) {
    let box = getResultBox();
    let matchedText = datasetData?.matchItem?.text || "No close match found";

    let highlighted = highlightWords(text, words);

    // ✅ ADD HERE
    let message = "";

    if (result.className === "fake") {
        message = "This content shows strong signs of misinformation.";
    } else if (result.className === "warn") {
        message = "This content may be misleading. Verify before trusting.";
    } else {
        message = "No major issues detected. Looks reliable.";
    }

    box.className = result.className;
    box.style.opacity = "0";
    box.innerHTML = `
    <h3 class="result-title">${result.text}</h3>
    <p><strong>Confidence:</strong> ${confidence}%</p>

    <p><strong>Trigger Words:</strong> ${
      words.length 
        ? words.map(w => `<span class="tag">${w}</span>`).join(" ") 
        : "None"
    }</p>

    <hr>

    <div class="match-box">
      <p class="match-title">Closest Match</p>
      <p class="match-text">${matchedText}</p>
    </div>

    <!-- ✅ ADD HERE -->
    <p style="margin-top:10px; opacity:0.85">${message}</p>

    <hr>

    <p>${highlighted}</p>
`;
    
// ✅ AND THIS RIGHT AFTER innerHTML
    setTimeout(() => {
        box.style.opacity = "1";
    }, 50);
}

// ==============================
// 🔹 MAIN CONTROLLER
// ==============================

function checkNews() {

    showLoading();

    setTimeout(() => {

        let text = getTextInput();

        let error = validateInput(text);
        if (error) {
            getResultBox().innerHTML = `<p>${error}</p>`;
            return;
        }

        // 🔍 Analyze
        let keywordData = analyzeKeywords(text);
        let datasetData = analyzeDataset(text);

        let totalScore = keywordData.score + datasetData.score;

        let confidence = calculateConfidence(totalScore);

        let result = decideResult(totalScore, datasetData.matchItem);

        updateProgress(confidence, result.className);

        displayResult(
            result,
            confidence,
            keywordData.found,
            text,
            datasetData   // MUST be passed
            );

    }, 800);
}


// ==============================
// 🔹 OPTIONAL: AUTO CLEAR TIMER
// ==============================

function autoClear() {
    setTimeout(() => {
        clearText();
    }, 10000);
}


// ==============================
// 🔹 OPTIONAL: ENTER KEY SUPPORT
// ==============================

document.addEventListener("DOMContentLoaded", () => {

    let textarea = document.getElementById("newsText");

    textarea.addEventListener("keypress", function (e) {
        if (e.key === "Enter" && e.ctrlKey) {
            checkNews();
        }
    });

    // ✅ MOVE PARTICLES HERE
    const particlesContainer = document.querySelector(".particles");

    if (particlesContainer) {
        for (let i = 0; i < 40; i++) {
            let span = document.createElement("span");

            span.style.left = Math.random() * 100 + "vw";
            span.style.animationDuration = (5 + Math.random() * 10) + "s";

            particlesContainer.appendChild(span);
        }
    }

});
