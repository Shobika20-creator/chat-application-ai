import dotenv from "dotenv";
dotenv.config();

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import Message from './models/message.model.js';
import axios from "axios";

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URL;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

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

app.get("/", (req, res) => {
  res.status(200).send("Backend is live on Render 🚀");
});

// ✅ Hugging Face Prediction
async function predictHarassment(text) {
  try {
    const response = await axios.post(
      "https://shobika04-harassment-api.hf.space/predict",
      { text: text }
    );
    console.log("HF Prediction:", response.data);
    return response.data;
  } catch (error) {
    console.error("HF API Error:", error.response?.data || error.message);
    return null;
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

    await newMessage.save();

    // 🔥 Pass source = "voice"
    await handleHarassmentLogic(intruder, victim, text, "voice");

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
    await newMessage.save();

    io.emit("receiveMessage", { sender, receiver, content });

    await handleHarassmentLogic(sender, receiver, content, "chat");

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

  const VICTIM_EMAIL = "a@gmail.com";

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

    if (harassmentCount[receiver] === 5) {

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
   📲 SMS FUNCTION (VOICE ONLY)
   =========================================================== */

async function sendSMS(victim, intruder, text) {
  console.log(`
📲 SMS SENT TO ${victim}

⚠️ Possible harassment detected:
"${text}"

Reply YES or NO
  `);
}

/* ===========================================================
   🔌 SOCKET.IO (UNCHANGED)
   =========================================================== */

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("registerUser", (email) => {
    onlineUsers[email] = socket.id;
  });

  socket.on('sendMessage', async ({ sender, receiver, content }) => {

    try {
      const newMessage = new Message({ sender, receiver, content });
      await newMessage.save();

      socket.broadcast.emit('receiveMessage', { sender, receiver, content });

      await handleHarassmentLogic(sender, receiver, content, "chat");

    } catch (error) {
      console.error("Message Handling Error:", error.message);
    }
  });

  socket.on("victimResponse", async (data) => {

    if (!monitoringState[data.victim]) {
      monitoringState[data.victim] = {};
    }

    monitoringState[data.victim][data.predator] = {
      active: false,
      stoppedAt: Date.now()
    };

    harassmentCount[data.victim] = 0;

    if (data.response === "YES") {
      try {
        await axios.post(
          "https://api.resend.com/emails",
          {
            from: "onboarding@resend.dev",
            to: ADMIN_EMAIL,
            subject: "🚨 Harassment Confirmed by Victim",
            html: `
              <h2>Harassment Alert</h2>
              <p><strong>Victim:</strong> ${data.victim}</p>
              <p><strong>Predator:</strong> ${data.predator}</p>
              <p><strong>Time:</strong> ${data.timestamp}</p>
            `,
          },
          {
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );
      } catch (error) {
        console.error("Resend Email Error:", error.response?.data || error.message);
      }
    }
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