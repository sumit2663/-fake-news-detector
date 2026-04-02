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
    getResultBox().innerHTML = "<p>🧹 Cleared</p>";
    getProgressBar().style.width = "0%";
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

function analyzeDataset(text) {
    let matchItem = null;
    let score = 0;

    dataset.forEach(item => {
        let words = item.text.toLowerCase().split(" ");
        let matches = words.filter(w => text.includes(w)).length;

        if (matches >= 3) {

            let ratio = matches / words.length;

            if (ratio > 0.5) {
                matchItem = item;
                score += item.label === "fake" ? 2 : -1;
            }
        }
    });

    return { matchItem, score };
}


// ==============================
// 🔹 CONFIDENCE CALCULATOR
// ==============================

function calculateConfidence(score) {
    return Math.min(score * 25, 95);
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
        let regex = new RegExp(`(${word})`, "gi");
        text = text.replace(regex, `<span style="color:red; font-weight:bold;">$1</span>`);
    });
    return text;
}


// ==============================
// 🔹 PROGRESS BAR UPDATE
// ==============================

function updateProgress(confidence) {
    let bar = getProgressBar();
    bar.style.width = confidence + "%";
}


// ==============================
// 🔹 DISPLAY RESULT
// ==============================

function displayResult(result, confidence, words, text) {
    let box = getResultBox();

    let highlighted = highlightWords(text, words);

    box.className = result.className;
    box.innerHTML = `
        <h3>${result.text}</h3>
        <p><strong>Confidence:</strong> ${confidence}%</p>
        <p><strong>Trigger Words:</strong> ${words.join(", ") || "None"}</p>
        <hr>
        <p>${highlighted}</p>
    `;
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

        updateProgress(confidence);

        displayResult(
            result,
            confidence,
            keywordData.found,
            text
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
});
