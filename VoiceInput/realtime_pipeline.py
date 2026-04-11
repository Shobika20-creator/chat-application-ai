import serial
import wave
from faster_whisper import WhisperModel
import requests
import time
import numpy as np
import threading
import queue
import os

# --- CONFIGURATION ---
PORT = "COM11"
BAUD = 921600   # 🔥 INCREASED FOR 8X FASTER DATA TRANSFER
BACKEND_URL = "https://chat-application-ai-mh0x.onrender.com/voice-input"
TEMP_FILENAME = "temp_voice.wav"

# --- INITIALIZATION ---
print("🚀 Initializing Acccurate Real-time Voice Pipeline...")
print("📦 Loading Whisper Model (small)...")

# Keep the 'small' model for high accuracy, but use 'faster-whisper' optimized for CPU
model = WhisperModel(
    "small", 
    device="cpu", 
    compute_type="int8",
    cpu_threads=4, # Adjust based on user's core count
    num_workers=2
)

print("✅ Faster-Whisper Loaded (small)!")

# Queue for background processing (Non-blocking)
audio_queue = queue.Queue()

try:
    ser = serial.Serial(PORT, BAUD, timeout=1)
    ser.flushInput() # 🔥 Clear any old garbage data
    print(f"📡 Connected to ESP32 on {PORT}")
except Exception as e:
    print(f"❌ Error connecting to Serial Port: {e}")
    exit()

# --- ACCURATE BACKGROUND WORKER ---
def transcription_worker():
    while True:
        wav_data = audio_queue.get()
        if wav_data is None: break
        
        try:
            # 1. Decode bytes directly from RAM (Skips Disk I/O)
            raw_audio = np.frombuffer(wav_data[44:], dtype=np.int16).astype(np.float32) / 32768.0
            
            # 🔥 RESAMPLE from 8kHz (Arduino) to 16kHz (AI)
            # This is critical for accuracy!
            audio_np = np.interp(
                np.linspace(0, len(raw_audio), len(raw_audio) * 2),
                np.arange(len(raw_audio)),
                raw_audio
            )
            
            # (DEBUG) Save the last clip to a file at 8kHz so you can listen to it
            with wave.open("debug_last.wav", "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(8000) # 🔥 Matches Arduino Rate
                wf.writeframes(wav_data[44:])

            # Simple Energy Check
            energy = np.mean(np.abs(audio_np))
            if energy < 0.001: # 🚀 Lowered threshold for better sensitivity
                print(f"⚠️ Silence/Noise detected (Energy: {energy:.4f}), skipping...")
                audio_queue.task_done()
                continue

            # 2. Transcribe using High Accuracy 'small' model (RAM-only)
            print("📝 Transcribing in background (RAM-only)...")
            start_time = time.time()

            segments, info = model.transcribe(
                audio_np, # 🚀 Direct from RAM!
                language="en",
                beam_size=1,
                best_of=1,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500)
            )

            text = " ".join([seg.text for seg in segments]).strip()
            end_time = time.time()

            # 3. Process transcription results
            if not text or len(text) < 2:
                print("⚠️ No clear speech recognized.")
            else:
                print(f"🗣️ Detected: {text} (Took {end_time - start_time:.2f}s)")
                
                # 4. Send to Backend (Non-blocking)
                def post_to_backend(msg_text):
                    try:
                        requests.post(
                            BACKEND_URL,
                            json={
                                "text": msg_text,
                                "victim": "shobikasaravanan2004@gmail.com",
                                "intruder": "b@gmail.com"
                            },
                            timeout=5
                        )
                    except Exception as e:
                        print(f"❌ Backend Error (Async): {e}")

                threading.Thread(target=post_to_backend, args=(text,), daemon=True).start()

        except Exception as e:
            print(f"❌ Worker Error: {e}")
        
        audio_queue.task_done()

# Start the background thread
worker_thread = threading.Thread(target=transcription_worker, daemon=True)
worker_thread.start()

# --- MAIN LOOP (Always Responsive) ---
print("\n🟢 Listening for voice trigger from ESP32...")

recording = False
audio_buffer = bytearray()

while True:
    try:
        if ser.in_waiting > 0:
            data = ser.read(ser.in_waiting)
        else:
            time.sleep(0.01)
            continue

        if b"-----WAV START-----" in data:
            recording = True
            audio_buffer = bytearray()
            print("\n🎤 Recording detected! Collecting...")
            
            parts = data.split(b"-----WAV START-----")
            if len(parts) > 1:
                audio_buffer.extend(parts[1])

        elif b"-----WAV END-----" in data:
            if recording:
                recording = False
                parts = data.split(b"-----WAV END-----")
                audio_buffer.extend(parts[0])
                
                # Hand off data to the background worker
                audio_queue.put(bytearray(audio_buffer))
                
                print(f"🛑 Done! received {len(audio_buffer)} bytes.")
                print("🟢 Ready for next input immediately!")
                audio_buffer = bytearray()
                continue

        elif recording:
            audio_buffer.extend(data)

    except KeyboardInterrupt:
        print("\n👋 Exiting...")
        audio_queue.put(None)
        break
    except Exception as e:
        print(f"⚠️ Loop Error: {e}")
        time.sleep(1)