// 🔹 LOAD DATASET (VERY IMPORTANT)
let dataset = [];

fetch("data.json")
  .then(res => res.json())
  .then(data => {
      dataset = data;
      console.log("Dataset loaded:", dataset);
  })
  .catch(err => {
      console.error("Error loading dataset:", err);
  });


// 🔹 MAIN FUNCTION
function checkNews() {
  let resultBox = document.getElementById("resultBox");
  
  resultBox.className = "";
  resultBox.innerHTML = "⏳ Checking...";

    // 🚨 Safety check
    if (dataset.length === 0) {
        alert("Dataset not loaded yet!");
        return;
    }

    let text = document.getElementById("newsText").value.toLowerCase();

    let score = 0;

    // 🟡 Keyword detection
    let keywords = [
        "shocking",
        "100% cure",
        "guarantee",
        "secret",
        "breaking",
        "click here",
        "viral",
        "urgent",
        "limited time"
    ];

    let foundWords = [];

    keywords.forEach(word => {
        if (text.includes(word)) {
            score++;
            foundWords.push(word);
        }
    });

    // 🔵 Dataset matching
    let datasetMatch = null;

    dataset.forEach(item => {
        let words = item.text.toLowerCase().split(" ");
        let matchCount = 0;

        words.forEach(word => {
            if (text.includes(word)) matchCount++;
        });

        if (matchCount >= 3) {
            datasetMatch = item;
            score += item.label === "fake" ? 2 : -1;
        }
    });

    let resultBox = document.getElementById("resultBox");

    let result = "";
    let className = "";

    // 🔴 Final decision
    if (datasetMatch) {
        result = datasetMatch.label === "fake"
            ? "❌ Fake (Matched Dataset)"
            : "✅ Real (Matched Dataset)";
    } else if (score >= 2) {
        result = "❌ Likely Fake News";
        className = "fake";
    } else if (score === 1) {
        result = "⚠️ Suspicious Content";
        className = "warn";
    } else {
        result = "✅ Looks Real";
        className = "real";
    }

    // 🟢 Confidence
    let confidence = Math.min(score * 25, 95);

    resultBox.className = className;
    resultBox.innerHTML = `
        ${result} <br><br>
        Confidence: ${confidence}% <br>
        Trigger Words: ${foundWords.join(", ") || "None"}
    `;
}
