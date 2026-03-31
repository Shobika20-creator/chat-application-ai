import serial
import wave

PORT = "COM11"
BAUD = 115200

ser = serial.Serial(PORT, BAUD, timeout=1)

recording = False
wav_data = bytearray()

print("Waiting for ESP32 audio...")

while True:
    data = ser.read(1024)

    if not data:
        continue

    if b"-----WAV START-----" in data:
        recording = True
        wav_data = bytearray()
        print("Recording started")
        data = data.split(b"-----WAV START-----")[-1]

    if b"-----WAV END-----" in data:
        recording = False
        data = data.split(b"-----WAV END-----")[0]
        wav_data.extend(data)
        print("Recording finished")
        break

    if recording:
        wav_data.extend(data)

with wave.open("output.wav", "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(8000)
    w.writeframes(wav_data)

print("✅ Saved output.wav")