function checkNews() {
    let text = document.getElementById("newsText").value.toLowerCase();

    let score = 0;

    // keyword list
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

    let resultBox = document.getElementById("resultBox");

    let result = "";
    let className = "";

    if (score >= 2) {
        result = "❌ Likely Fake News";
        className = "fake";
    } else if (score === 1) {
        result = "⚠️ Suspicious Content";
        className = "warn";
    } else {
        result = "✅ Looks Real";
        className = "real";
    }

    // confidence calculation
    let confidence = Math.min(score * 30, 90);

    resultBox.className = className;
    resultBox.innerHTML = `
        ${result} <br><br>
        Confidence: ${confidence}% <br>
        Trigger Words: ${foundWords.join(", ") || "None"}
    `;
}
