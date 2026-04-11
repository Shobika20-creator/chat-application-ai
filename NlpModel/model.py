import threading
import os
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Global variables
tokenizer = None
model = None
is_ready = False
model_error = None

def load_model():
    global tokenizer, model, is_ready, model_error
    try:
        # 🔥 Move heavy imports inside the thread to prevent blocking startup
        print("🔄 Loading heavy AI libraries in background...")
        import torch
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        
        print("🔄 Downloading model from Hugging Face...")
        model_path = "shobika04/harassment-nlp-model"
        hf_token = os.getenv("HF_TOKEN")
        
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
    thread = threading.Thread(target=load_model)
    thread.start()
    yield

app = FastAPI(lifespan=lifespan)

class MessageRequest(BaseModel):
    text: str

@app.get("/")
def health():
    if is_ready:
        return {"status": "NLP service running", "ready": True}
    return {"status": "Loading model in background...", "ready": False}

@app.post("/predict")
def predict(req: MessageRequest):
    if not is_ready:
        raise HTTPException(status_code=503, detail="Model is still loading...")

    import torch # Local import for speed
    inputs = tokenizer(req.text, return_tensors="pt", truncation=True, padding=True)
    with torch.no_grad():
        outputs = model(**inputs)
        probabilities = torch.softmax(outputs.logits, dim=1)
        predicted_class = torch.argmax(probabilities, dim=1).item()
        confidence = probabilities[0][predicted_class].item()

    prediction = "NonPredator" if predicted_class == 0 else "Predator"
    return {"prediction": prediction, "confidence": round(confidence, 4)}

if __name__ == "__main__":
    import uvicorn
    # 🔥 REMOVED reload=True for stable production deployment
    uvicorn.run("model:app", host="0.0.0.0", port=7860)