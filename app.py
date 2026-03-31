from flask import Flask, request, jsonify, send_file

app = Flask(__name__)

@app.route('/')
def home():
    return send_file("index.html")

@app.route('/check', methods=['POST'])
def check_news():
    text = request.json['text']

    if "shocking" in text.lower():
        result = "⚠️ Suspicious"
    else:
        result = "✅ Looks Real"

    return jsonify({"result": result})

app.run(host='0.0.0.0', port=81)
