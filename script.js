// 🔹 LOAD DATASET
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


// 🔥 Highlight suspicious words
function highlightWords(text, words) {
    words.forEach(word => {
        let regex = new RegExp(`(${word})`, "gi");
        text = text.replace(regex, `<span style="color:red; font-weight:bold;">$1</span>`);
    });
    return text;
}


// 🔹 CLEAR BUTTON FUNCTION
function clearText() {
    document.getElementById("newsText").value = "";
    document.getElementById("resultBox").innerHTML = "<p>Result cleared</p>";
    document.getElementById("bar").style.width = "0%";
}


// 🔹 MAIN FUNCTION
function checkNews() {

    let resultBox = document.getElementById("resultBox");
    let bar = document.getElementById("bar");

    // ⏳ Loading effect
    resultBox.className = "";
    resultBox.innerHTML = "<p>⏳ Checking...</p>";
    bar.style.width = "15%";

    setTimeout(() => {

        // 🚨 Safety check
        if (dataset.length === 0) {
            resultBox.innerHTML = "<p>Dataset not loaded yet!</p>";
            return;
        }

        let text = document.getElementById("newsText").value.toLowerCase();

        if (text.trim() === "") {
            resultBox.innerHTML = "<p>Please enter some text!</p>";
            return;
        }

        let score = 0;

        // 🟡 KEYWORDS
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

        // 🔵 DATASET MATCHING
        let datasetMatch = null;

        dataset.forEach(item => {
            let words = item.text.toLowerCase().split(" ");
            let matchCount = words.filter(w => text.includes(w)).length;

            if (matchCount >= 3) {
                datasetMatch = item;
                score += item.label === "fake" ? 2 : -1;
            }
        });

        let result = "";
        let className = "";

        // 🔴 FINAL RESULT
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

        // 🟢 CONFIDENCE
        let confidence = Math.min(score * 25, 95);
        bar.style.width = confidence + "%";

        // 🔥 Highlight text
        let highlightedText = highlightWords(text, foundWords);

        // 📊 DISPLAY RESULT
        resultBox.className = className;
        resultBox.innerHTML = `
            <h3>${result}</h3>
            <p><strong>Confidence:</strong> ${confidence}%</p>
            <p><strong>Trigger Words:</strong> ${foundWords.join(", ") || "None"}</p>
            <hr>
            <p><strong>Analyzed Text:</strong></p>
            <p>${highlightedText}</p>
        `;

    }, 800);
}
