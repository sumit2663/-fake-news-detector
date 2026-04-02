/**************************************************
 * FAKE NEWS DETECTOR - FINAL TF-IDF VERSION
 **************************************************/

// ==============================
// 🔹 GLOBAL VARIABLES
// ==============================

let dataset = [];
let isLoaded = false;

let vocabulary = [];
let idfValues = {};
let datasetVectors = [];


// ==============================
// 🔹 LOAD DATASET
// ==============================

function loadDataset() {
    fetch("data.json")
        .then(res => res.json())
        .then(data => {
            dataset = data;
            isLoaded = true;

            prepareTFIDF(); // 🔥 IMPORTANT

            console.log("✅ Dataset loaded:", dataset.length);
        })
        .catch(err => {
            console.error("❌ Dataset error:", err);
        });
}

loadDataset();


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

function buildVocabulary(dataset) {
    let vocab = new Set();

    dataset.forEach(item => {
        getAllWords(item.text).forEach(word => vocab.add(word));
    });

    return Array.from(vocab);
}

function calculateIDF(dataset, vocab) {
    let idf = {};

    vocab.forEach(word => {
        let count = 0;

        dataset.forEach(item => {
            if (getAllWords(item.text).includes(word)) count++;
        });

        idf[word] = Math.log(dataset.length / (count + 1));
    });

    return idf;
}

function getTF(text) {
    let words = getAllWords(text);
    let tf = {};

    words.forEach(word => {
        tf[word] = (tf[word] || 0) + 1;
    });

    return tf;
}

function getTFIDF(tf, idf) {
    let tfidf = {};

    for (let word in tf) {
        tfidf[word] = tf[word] * (idf[word] || 0);
    }

    return tfidf;
}

function cosineSimilarity(vec1, vec2) {
    let dot = 0, mag1 = 0, mag2 = 0;

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


// ==============================
// 🔹 PREPARE TF-IDF
// ==============================

function prepareTFIDF() {
    vocabulary = buildVocabulary(dataset);
    idfValues = calculateIDF(dataset, vocabulary);

    datasetVectors = dataset.map(item => {
        let tf = getTF(item.text);
        return getTFIDF(tf, idfValues);
    });

    console.log("✅ TF-IDF Ready");
}


// ==============================
// 🔹 KEYWORD ENGINE
// ==============================

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
            score += keywords[word];
        }
    }

    return { score, found };
}


// ==============================
// 🔹 DATASET (TF-IDF)
// ==============================

function analyzeDataset(text) {

    let inputTF = getTF(text);
    let inputVector = getTFIDF(inputTF, idfValues);

    let bestSimilarity = 0;
    let matchItem = null;
    let score = 0;

    datasetVectors.forEach((vec, index) => {

        let similarity = cosineSimilarity(inputVector, vec);

        if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            matchItem = dataset[index];
        }
    });

    if (matchItem) {
        if (bestSimilarity > 0.5) {
            score += matchItem.label === "fake" ? 3 : -2;
        } else if (bestSimilarity > 0.3) {
            score += matchItem.label === "fake" ? 2 : -1;
        }
    }

    return { matchItem, score };
}


// ==============================
// 🔹 CONFIDENCE
// ==============================

function calculateConfidence(score) {
    if (score <= 0) return 60;
    if (score >= 6) return 95;

    return Math.min(60 + score * 10, 95);
}


// ==============================
// 🔹 DECISION ENGINE
// ==============================

function decideResult(score, datasetMatch) {

    if (datasetMatch) {

        if (datasetMatch.label === "fake") {
            return { text: "❌ Fake (Dataset Match)", className: "fake" };
        }

        if (score >= 3) {
            return { text: "⚠️ Suspicious (Conflicting Data)", className: "warn" };
        }

        return { text: "✅ Looks Real (Dataset Match)", className: "real" };
    }

    if (score >= 6) return { text: "❌ Highly Likely Fake", className: "fake" };
    if (score >= 3) return { text: "⚠️ Suspicious Content", className: "warn" };

    return { text: "✅ Looks Real", className: "real" };
}


// ==============================
// 🔹 UI HELPERS
// ==============================

function getTextInput() {
    return document.getElementById("newsText").value.toLowerCase();
}

function getResultBox() {
    return document.getElementById("resultBox");
}


// ==============================
// 🔹 MAIN FUNCTION
// ==============================

function checkNews() {

    let box = getResultBox();
    box.innerHTML = "⏳ Analyzing...";

    setTimeout(() => {

        let text = getTextInput();

        if (!isLoaded) {
            box.innerHTML = "Dataset not loaded!";
            return;
        }

        if (!text.trim()) {
            box.innerHTML = "Enter text!";
            return;
        }

        let keywordData = analyzeKeywords(text);
        let datasetData = analyzeDataset(text);

        let totalScore = keywordData.score + datasetData.score;

        let confidence = calculateConfidence(totalScore);
        let result = decideResult(totalScore, datasetData.matchItem);

        box.className = result.className;
        box.innerHTML = `
            <h3>${result.text}</h3>
            <p>Confidence: ${confidence}%</p>
            <p>Trigger Words: ${keywordData.found.join(", ") || "None"}</p>
        `;

    }, 500);
}
