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

// ✅ ADMIN EMAIL CONFIG (from Render environment variables)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// ✅ CREATE EMAIL TRANSPORTER
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

// ✅ CORS (allow frontend + localhost)
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://chat-application-ai-mh0x.onrender.com"
  ],
  credentials: true,
}));

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://chat-application-ai-mh0x.onrender.com",
      "*"
    ],
    methods: ['GET', 'POST'],
  },
});

app.use(express.json());

// ✅ Health Check Route (Fixes "Cannot GET /")
app.get("/", (req, res) => {
  res.status(200).send("Backend is live on Render 🚀");
});

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

        // ⚠️ CHANGE THIS LATER to your NLP Render URL
        const response = await axios.post("http://localhost:8000/predict", {
          text: content
        });

        const prediction = response.data.prediction;
        console.log("Harassment Prediction:", prediction);

        if (prediction === "Predator") {

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
    console.log("Victim Response Received:", data);

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

        console.log("✅ Notification sent to admin");

        harassmentCount[data.victim] = 0;
      }

    } catch (error) {
      console.error("Email sending error:", error.message);
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