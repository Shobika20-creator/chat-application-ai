import dotenv from "dotenv";
dotenv.config();

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import Message from './models/message.model.js';
import axios from "axios";
import twilio from "twilio";

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URL;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const BASE_URL = process.env.BASE_URL;

// ✅ TWILIO INITIALIZATION
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const harassmentCount = {};
const onlineUsers = {};
const monitoringState = {};

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

// ✅ CONNECT MONGODB
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://chat-application-ai-1-ibw1.onrender.com"
  ],
  credentials: true,
}));

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://chat-application-ai-1-ibw1.onrender.com"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.status(200).send("Backend is live on Render 🚀");
});

// ✅ Simple Fallback Keywords (If AI fails)
const FALLBACK_BAD_WORDS = ["idiot", "stupid", "hate", "kill", "harass", "predator", "shut up", "ugly", "useless", "fat", "loser"];

function simpleHarassmentFilter(text) {
  const lowerText = text.toLowerCase();
  return FALLBACK_BAD_WORDS.some(word => lowerText.includes(word));
}

// ✅ Hugging Face Prediction
async function predictHarassment(text) {
  if (!text || text.trim().length < 3) {
    console.log("⏩ Skipping prediction for short/empty message.");
    return null;
  }

  try {
    const HF_URL = "https://router.huggingface.co/hf-inference/models/shobika04/harassment-nlp-model";
    const response = await axios.post(
      HF_URL,
      { inputs: text },
      {
        headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` },
        timeout: 5000
      }
    );

    // 🔥 Robust parsing for Inference API results (often returns [[{label, score}, ...]])
    const results = Array.isArray(response.data[0]) ? response.data[0] : response.data;
    const topResult = results[0]; 

    console.log("HF Inference API Result:", topResult);
    return { prediction: topResult.label };

  } catch (error) {
    console.error("HF API Error:", error.response?.data || error.message);
    
    // 🔥 FALLBACK: If API is down, use simple keyword check
    console.log("⚠️ Hugging Face API is down! Falling back to Keyword Filter...");
    const isBad = simpleHarassmentFilter(text);
    return { prediction: isBad ? "Predator" : "NonPredator" };
  }
}

/* ===========================================================
   🎤 NEW VOICE INPUT ROUTE (SEPARATE FLOW)
   =========================================================== */

app.post("/voice-input", async (req, res) => {
  const { text, victim, intruder } = req.body;

  if (!text || !victim || !intruder) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    console.log("🎤 Voice Input:", text);

    const newMessage = new Message({
      sender: intruder,
      receiver: victim,
      content: text
    });

    // Save asynchronously
    newMessage.save().catch(err => console.error("DB Save Error:", err.message));

    // 🔥 Non-blocking harassment check
    handleHarassmentLogic(intruder, victim, text, "voice").catch(err => console.error("Harassment Logic Error:", err.message));

    res.json({ success: true });

  } catch (error) {
    console.error("Voice Input Error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
});

/* ===========================================================
   📡 HARDWARE MESSAGE (UNCHANGED)
   =========================================================== */

app.post("/hardware-message", async (req, res) => {
  const { sender, receiver, content } = req.body;

  if (!sender || !receiver || !content) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    console.log(`📡 Hardware message from ${sender} to ${receiver}`);

    const newMessage = new Message({ sender, receiver, content });
    newMessage.save().catch(err => console.error("DB Save Error:", err.message));

    io.emit("receiveMessage", { sender, receiver, content });

    // 🔥 Non-blocking harassment check
    handleHarassmentLogic(sender, receiver, content, "chat").catch(err => console.error(err));

    res.json({ success: true });

  } catch (error) {
    console.error("Hardware Message Error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
});

/* ===========================================================
   🧠 SHARED HARASSMENT LOGIC
   =========================================================== */

async function handleHarassmentLogic(sender, receiver, content, source = "chat") {

  const VICTIM_EMAIL = "shobikasaravanan2004@gmail.com";

  if (receiver !== VICTIM_EMAIL) return;

  if (
    monitoringState[receiver] &&
    monitoringState[receiver][sender] &&
    monitoringState[receiver][sender].active === false
  ) {
    const stoppedAt = monitoringState[receiver][sender].stoppedAt;
    const now = Date.now();

    if (now - stoppedAt >= TWENTY_FOUR_HOURS) {
      monitoringState[receiver][sender].active = true;
      monitoringState[receiver][sender].stoppedAt = null;
    } else {
      return;
    }
  }

  const predictionResult = await predictHarassment(content);
  if (!predictionResult) return;

  const prediction = predictionResult.prediction;

  const isHarassment =
    prediction === 1 ||
    prediction === "1" ||
    prediction === "Predator";

  if (isHarassment) {

    harassmentCount[receiver] =
      (harassmentCount[receiver] || 0) + 1;

    if (harassmentCount[receiver] === 3) {

      // 💬 CHAT FLOW → SOCKET
      if (source === "chat") {
        const victimSocket = onlineUsers[VICTIM_EMAIL];

        if (victimSocket) {
          io.to(victimSocket).emit("harassmentAlert", {
            message: "⚠️ Repeated suspicious messages detected. Do you feel unsafe?",
            count: harassmentCount[receiver]
          });
        }
      }

      // 🎤 VOICE FLOW → SMS
      if (source === "voice") {
        await sendSMS(receiver, sender, content);
      }
    }
  }
}

/* ===========================================================
   📲 REAL SMS FUNCTION (TWILIO)
   =========================================================== */

async function sendSMS(victim, intruder, text) {
  try {
    const shortLink = process.env.BASE_URL.replace("https://", "");
    const verifyLink = `${shortLink}/verify-page?v=${victim}&p=${intruder}`;

    const message = await client.messages.create({
      body: `🚨 Harassment Alert! Open your safety panel to verify: ${verifyLink}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.VICTIM_PHONE_NUMBER
    });

    console.log(`
📲 REAL SMS SENT TO ${process.env.VICTIM_PHONE_NUMBER}
✅ Twilio Message SID: ${message.sid}

⚠️ Possible harassment detected:
"${text}"

(Simulation: Send POST request to http://localhost:5000/voice-verify)
    `);

  } catch (error) {
    console.error("❌ Twilio SMS Error:", error.message);
  }
}

/* ===========================================================
   🧠 HARASSMENT CONFIRMATION LOGIC (SHARED)
   =========================================================== */

async function handleHarassmentConfirmation(victim, predator, response) {
  try {
    if (!monitoringState[victim]) {
      monitoringState[victim] = {};
    }

    monitoringState[victim][predator] = {
      active: false,
      stoppedAt: Date.now()
    };

    harassmentCount[victim] = 0;

    console.log(`✅ ${victim} responded ${response} for ${predator}`);

    if (response === "YES") {
      console.log(`📧 Attempting to send email to ${ADMIN_EMAIL}...`);
      try {
        const emailResponse = await axios.post(
          "https://api.resend.com/emails",
          {
            from: "onboarding@resend.dev",
            to: ADMIN_EMAIL,
            subject: "🚨 Harassment Confirmed by Victim",
            html: `
              <h2>Harassment Alert</h2>
              <p><strong>Victim:</strong> ${victim}</p>
              <p><strong>Predator:</strong> ${predator}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            `,
          },
          {
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );
        console.log("📨 Alert email sent successfully! ID:", emailResponse.data.id);
      } catch (err) {
        console.error("❌ Resend API Detailed Error:", err.response?.data || err.message);
        throw new Error("Resend failed: " + (err.response?.data?.message || err.message));
      }
    }
  } catch (error) {
    console.error("❌ Confirmation Logic Error:", error.message);
  }
}

app.post("/voice-verify", async (req, res) => {
  const { victim, predator, response } = req.body;

  if (!victim || !predator || !response) {
    return res.status(400).json({ error: "Missing fields" });
  }

  await handleHarassmentConfirmation(victim, predator, response);
  res.json({ success: true, message: `Response ${response} processed.` });
});

/* ===========================================================
   📲 REAL SMS REPLY WEBHOOK (TWILIO CALLBACK)
   =========================================================== */

app.post("/sms-reply", async (req, res) => {
  const { Body, From } = req.body;

  console.log(`📩 Incoming SMS from ${From}: "${Body}"`);

  // To confirm, the user should text "YES" or "NO"
  const response = Body.trim().toUpperCase();
  const victimPhone = From;

  // Since we are in testing, we map the configured victim phone to the victim email
  const VICTIM_EMAIL = "shobikasaravanan2004@gmail.com";
  const PREDATOR_EMAIL = "b@gmail.com"; // Hardcoded for this testing flow

  if (response === "YES" || response === "NO") {
    await handleHarassmentConfirmation(VICTIM_EMAIL, PREDATOR_EMAIL, response);

    // Send a TwiML response back to the phone
    res.type('text/xml');
    res.send(`
      <Response>
        <Message>Thank you. Your response "${response}" has been processed.</Message>
      </Response>
    `);
  } else {
    res.type('text/xml');
    res.send(`
      <Response>
        <Message>Please reply with YES or NO to confirm.</Message>
      </Response>
    `);
  }
});

/* ===========================================================
   🌐 MOBILE VERIFICATION WEB PAGE (NO SMS REPLAY NEEDED)
   =========================================================== */

app.get("/verify-page", (req, res) => {
  const { v: victim, p: predator } = req.query;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Safety Verification</title>
        <style>
            body { font-family: -apple-system, system-ui, sans-serif; background: #f8f9fa; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: white; padding: 2rem; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 90%; }
            h1 { color: #dc3545; font-size: 24px; margin-bottom: 20px; }
            p { color: #495057; line-height: 1.5; margin-bottom: 30px; }
            .btn { display: block; width: 100%; padding: 15px; margin: 10px 0; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; border: none; cursor: pointer; transition: 0.2s; }
            .btn-safe { background: #28a745; color: white; }
            .btn-alert { background: #dc3545; color: white; }
            .btn:active { transform: scale(0.98); opacity: 0.9; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>🚨 Safety Alert</h1>
            <p>Our AI detected 3 suspicious messages from <strong>${predator}</strong>. Do you feel unsafe?</p>
            
            <a href="/verify-action?v=${victim}&p=${predator}&r=NO" class="btn btn-safe">I AM SAFE (No Action)</a>
            <a href="/verify-action?v=${victim}&p=${predator}&r=YES" class="btn btn-alert">I AM UNSAFE (Alert Admin)</a>
            
            <small style="display:block; margin-top: 20px; color: #adb5bd;">Your response will reset the monitoring.</small>
        </div>
    </body>
    </html>
  `;
  res.send(html);
});

app.get("/verify-action", async (req, res) => {
  const { v: victim, p: predator, r: response } = req.query;

  await handleHarassmentConfirmation(victim, predator, response);

  const message = response === "YES"
    ? "🚨 Action Confirmed. An alert has been sent to the administrator."
    : "✅ Verified. Monitoring has been reset.";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: sans-serif; background: #f8f9fa; display: flex; padding: 20px; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .card { background: white; padding: 2rem; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
            h2 { color: #212529; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>Thank You</h2>
            <p>${message}</p>
            <p style="color: #6c757d;">You can close this window now.</p>
        </div>
    </body>
    </html>
  `;
  res.send(html);
});

/* ===========================================================
   🔌 SOCKET.IO (UNCHANGED)
   =========================================================== */

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("registerUser", (email) => {
    onlineUsers[email] = socket.id;
  });

  socket.on('sendMessage', async ({ sender, receiver, content }) => {
    console.log(`💬 Chat Message: ${sender} -> ${receiver}: "${content}"`);
    try {
      const newMessage = new Message({ sender, receiver, content });
      newMessage.save().catch(err => console.error("DB Save Error:", err.message));

      socket.broadcast.emit('receiveMessage', { sender, receiver, content });

      // 🔥 Non-blocking harassment check
      handleHarassmentLogic(sender, receiver, content, "chat").catch(err => console.error(err));

    } catch (error) {
      console.error("Message Handling Error:", error.message);
    }
  });

  socket.on("victimResponse", async (data) => {
    await handleHarassmentConfirmation(data.victim, data.predator, data.response);
  });

  socket.on("resetMonitoring", (data) => {
    if (
      monitoringState[data.victim] &&
      monitoringState[data.victim][data.predator]
    ) {
      monitoringState[data.victim][data.predator].active = true;
      monitoringState[data.victim][data.predator].stoppedAt = null;
    }

    harassmentCount[data.victim] = 0;
  });

  socket.on('disconnect', () => {
    for (const email in onlineUsers) {
      if (onlineUsers[email] === socket.id) {
        delete onlineUsers[email];
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});