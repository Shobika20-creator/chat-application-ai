from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import os

# Initialize FastAPI
app = FastAPI()

# 🔴 CHANGE THIS to your Hugging Face repo
model_path = "shobika04/harassment-nlp-model"

# Get token from Render environment variable
hf_token = os.getenv("HF_TOKEN")

print("🔄 Loading model from Hugging Face...")

# Load tokenizer & model
tokenizer = AutoTokenizer.from_pretrained(
    model_path,
    token=hf_token
)

model = AutoModelForSequenceClassification.from_pretrained(
    model_path,
    token=hf_token
)

model.eval()

print("✅ Model loaded successfully!")

# Request schema
class MessageRequest(BaseModel):
    text: str

# Prediction function
def predict_message(message: str):
    inputs = tokenizer(
        message,
        return_tensors="pt",
        truncation=True,
        padding=True
    )

    with torch.no_grad():
        outputs = model(**inputs)
        probabilities = torch.softmax(outputs.logits, dim=1)
        predicted_class = torch.argmax(probabilities, dim=1).item()
        confidence = probabilities[0][predicted_class].item()

    label = "NonPredator" if predicted_class == 0 else "Predator"

    return label, round(confidence, 4)

# Health check route
@app.get("/")
def health():
    return {"status": "NLP service running"}

# Prediction endpoint
@app.post("/predict")
def predict(req: MessageRequest):
    prediction, confidence = predict_message(req.text)

    return {
        "prediction": prediction,
        "confidence": confidence
    }
