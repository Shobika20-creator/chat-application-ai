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

// ✅ Hugging Face Prediction Function
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

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("registerUser", (email) => {
    onlineUsers[email] = socket.id;
    console.log(`${email} registered with socket ${socket.id}`);
  });

  socket.on('sendMessage', async ({ sender, receiver, content }) => {
    console.log(`Message from ${sender} to ${receiver}: ${content}`);

    try {
      const newMessage = new Message({ sender, receiver, content });
      await newMessage.save();

      socket.broadcast.emit('receiveMessage', { sender, receiver, content });

      const VICTIM_EMAIL = "a@gmail.com";

      if (receiver === VICTIM_EMAIL) {

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

          console.log(
            `Harassment count for ${receiver}:`,
            harassmentCount[receiver]
          );

          if (harassmentCount[receiver] === 5) {

            console.log("🚨 5 Harassment messages detected");

            const victimSocket = onlineUsers[VICTIM_EMAIL];

            if (victimSocket) {
              io.to(victimSocket).emit("harassmentAlert", {
                message:
                  "⚠️ Repeated suspicious messages detected. Do you feel unsafe?",
                count: harassmentCount[receiver]
              });

              console.log("Alert sent to victim");
            } else {
              console.log("Victim not online");
            }
          }
        }
      }

    } catch (error) {
      console.error("Message Handling Error:", error.message);
    }
  });

  // ✅ HANDLE VICTIM RESPONSE (Resend Email API)
  socket.on("victimResponse", async (data) => {

    console.log("Victim Response Received:", data);

    try {

      if (data.response === "YES") {

        console.log("Sending email via Resend...");

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
              <p>The victim has confirmed harassment.</p>
            `,
          },
          {
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log("✅ Email successfully sent using Resend");

        harassmentCount[data.victim] = 0;

      } else {
        console.log("Victim clicked NO — no email sent");
      }

    } catch (error) {
      console.error("Resend Email Error:", error.response?.data || error.message);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);

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