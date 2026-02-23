import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import Message from './models/message.model.js';
import axios from "axios";
import nodemailer from "nodemailer";

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URL;

// ✅ ADMIN EMAIL CONFIG
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

const harassmentCount = {};
const onlineUsers = {};

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


// ✅ NEW: Hugging Face Space API Call
async function predictHarassment(text) {
  try {
    const response = await axios.post(
      "https://shobika04-harassment-api.hf.space/predict",
      { text: text }
    );

    console.log("HF Prediction:", response.data);
    return response.data;

  } catch (error) {
    console.error("HF API Error:", error.message);
    return null;
  }
}


io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("registerUser", (email) => {
    onlineUsers[email] = socket.id;
  });

  socket.on('sendMessage', async ({ sender, receiver, content }) => {
    console.log(`Message from ${sender} to ${receiver}: ${content}`);

    try {
      const newMessage = new Message({ sender, receiver, content });
      await newMessage.save();

      socket.broadcast.emit('receiveMessage', { sender, receiver, content });

      const VICTIM_EMAIL = "a@gmail.com";

      if (receiver === VICTIM_EMAIL) {

        // ✅ Call FastAPI Space
        const predictionResult = await predictHarassment(content);

        if (!predictionResult) return;

        // Our FastAPI returns:
        // { prediction: 0 or 1, confidence: 0.xx }

        const prediction = predictionResult.prediction;

        // ⚠️ Adjust this if your label mapping differs
        // Assuming: 1 = Harassment / Predator
        if (prediction === 1) {

          harassmentCount[receiver] = (harassmentCount[receiver] || 0) + 1;

          console.log(`Harassment count for ${receiver}:`, harassmentCount[receiver]);

          if (harassmentCount[receiver] === 5) {

            const victimSocket = onlineUsers[VICTIM_EMAIL];

            if (victimSocket) {
              io.to(victimSocket).emit("harassmentAlert", {
                message: "⚠️ Repeated suspicious messages detected. Do you feel unsafe?",
                count: harassmentCount[receiver]
              });
            }
          }
        }
      }

    } catch (error) {
      console.error("Error:", error.message);
    }
  });

  socket.on("victimResponse", async (data) => {

    try {
      if (data.response === "YES") {

        await transporter.sendMail({
          from: EMAIL_USER,
          to: ADMIN_EMAIL,
          subject: "🚨 Harassment Confirmed by Victim",
          text: `
Victim: ${data.victim}
Predator: ${data.predator}
Time: ${data.timestamp}

The victim has confirmed harassment.
Please take immediate action.
          `,
        });

        harassmentCount[data.victim] = 0;
      }

    } catch (error) {
      console.error("Email sending error:", error.message);
    }
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