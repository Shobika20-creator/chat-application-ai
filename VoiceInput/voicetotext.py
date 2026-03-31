import whisper
import requests

model = whisper.load_model("base")

result = model.transcribe(
    "output.wav",
    language="en",
    temperature=0,
    beam_size=1,
    best_of=1,
    fp16=False
)

text = result["text"].strip()

print("\n🗣️ Recognized Text:")
print(text)

# 🔥 Send to backend
response = requests.post(
    "http://localhost:5000/voice-input",
    json={
        "text": text,
        "victim": "a@gmail.com",
        "intruder": "unknown@intruder.com"
    }
)

print("\n📡 Backend Response:")
print(response.json())