from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

# Initialize FastAPI
app = FastAPI()

# Load model and tokenizer
model_path = "Harassmentmodel"
tokenizer = AutoTokenizer.from_pretrained(model_path)
model = AutoModelForSequenceClassification.from_pretrained(model_path)

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
        predicted_class = torch.argmax(outputs.logits, dim=1).item()

    return "NonPredator" if predicted_class == 0 else "Predator"

# API endpoint
@app.post("/predict")
def predict(req: MessageRequest):
    prediction = predict_message(req.text)
    return {
        "prediction": prediction
    }
