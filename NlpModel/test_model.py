import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# -------------------------------------------------
# Device Setup
# -------------------------------------------------
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Using device:", device)

# -------------------------------------------------
# Load Saved Model
# -------------------------------------------------
MODEL_PATH = "Harassmentmodel"   # make sure this folder exists

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)

model.to(device)
model.eval()

# -------------------------------------------------
# Prediction Function
# -------------------------------------------------
def predict_message(text):
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=256
    )

    inputs = {key: value.to(device) for key, value in inputs.items()}

    with torch.no_grad():
        outputs = model(**inputs)

    probabilities = torch.softmax(outputs.logits, dim=1)
    predicted_class = torch.argmax(probabilities, dim=1).item()

    # ---- Manual Label Mapping ----
    # 0 = NonPredator
    # 1 = Predator
    if predicted_class == 0:
        return "NonPredator"
    else:
        return "Predator"


# -------------------------------------------------
# Manual Testing Loop
# -------------------------------------------------
print("\nType a message (type 'exit' to stop)\n")

while True:
    message = input("User: ")

    if message.lower() == "exit":
        print("Exiting...")
        break

    result = predict_message(message)
    print("Model:", result)
    print()