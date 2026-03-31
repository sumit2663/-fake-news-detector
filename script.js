function checkNews() {
    let text = document.getElementById("newsText").value.toLowerCase();

    let score = 0;

    // 🟡 1. Keyword detection
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

    // 🔵 2. Dataset matching (NEW)
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

    // 🔴 3. Final decision
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
