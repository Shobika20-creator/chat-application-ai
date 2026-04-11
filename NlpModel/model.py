import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import os
from functools import lru_cache

# Global variables to hold the loaded model and tokenizer
tokenizer = None
model = None
is_ready = False
model_error = None

def load_model():
    global tokenizer, model, is_ready, model_error
    try:
        print("🔄 Loading model from Hugging Face in background...")
        model_path = "shobika04/harassment-nlp-model"
        hf_token = os.getenv("HF_TOKEN")
        
        # Load tokenizer & model
        tokenizer = AutoTokenizer.from_pretrained(model_path, token=hf_token)
        model = AutoModelForSequenceClassification.from_pretrained(model_path, token=hf_token)
        model.eval()
        
        is_ready = True
        print("✅ Model loaded successfully!")
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        model_error = str(e)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background thread to load model on startup
    thread = threading.Thread(target=load_model)
    thread.start()
    yield
    # No teardown needed

# Initialize FastAPI with lifespan
app = FastAPI(lifespan=lifespan)

# Request schema
class MessageRequest(BaseModel):
    text: str

# Prediction function (cached)
@lru_cache(maxsize=1000)
def predict_message(message: str):
    if not is_ready:
        raise Exception("Model is not loaded yet")

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
    if is_ready:
        return {"status": "NLP service running", "ready": True}
    elif model_error:
        return {"status": "Model failed to load", "error": model_error, "ready": False}
    else:
        return {"status": "Loading model, please wait...", "ready": False}

# Prediction endpoint
@app.post("/predict")
def predict(req: MessageRequest):
    if not is_ready:
        if model_error:
            raise HTTPException(status_code=500, detail=f"Model loading failed: {model_error}")
        raise HTTPException(status_code=503, detail="Model is still loading, please try again in a few seconds")

    try:
        # Normalize text to improve cache hit rate
        clean_text = req.text.strip().lower()
        prediction, confidence = predict_message(clean_text)
        return {
            "prediction": prediction,
            "confidence": confidence
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # When running locally, it's helpful to start uvicorn directly
    uvicorn.run("model:app", host="0.0.0.0", port=7860, reload=True)
