import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import Message from './models/message.model.js';
import axios from "axios";
import nodemailer from "nodemailer"; // ✅ NEW

const MONGO_URI = 'mongodb+srv://shobikasaravanan2004:avcSd5pxJFmEledZ@cluster.tpzr8dr.mongodb.net/cHAT_DB?retryWrites=true&w=majority&appName=Cluster';

// ✅ ADMIN EMAIL CONFIG
const ADMIN_EMAIL = "shobiatwork@gmail.com"; // 🔁 Change this
const EMAIL_USER = "shobikasaravanan2004@gmail.com"; // 🔁 Change this
const EMAIL_PASS = "auzcsmqfuxgsxapy";   // 🔁 Use Gmail App Password

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

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://chat-application-ai-1-ibw1.onrender.com'
  ],
  credentials: true,
}));

const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'https://chat-application-ai-1-ibw1.onrender.com'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
});

app.use(express.json());

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("registerUser", (email) => {
    onlineUsers[email] = socket.id;
    console.log(`${email} registered with socket ${socket.id}`);
  });

  socket.on('sendMessage', async ({ sender, receiver, content }) => {
    console.log(`Message from ${sender} to ${receiver}: ${content}`);

    try {
      // 1️⃣ Save message (UNCHANGED)
      const newMessage = new Message({ sender, receiver, content });
      await newMessage.save();

      // 2️⃣ Emit message (UNCHANGED)
      socket.broadcast.emit('receiveMessage', { sender, receiver, content });

      // 3️⃣ Harassment Detection (UNCHANGED)
      const VICTIM_EMAIL = "a@gmail.com";

      if (receiver === VICTIM_EMAIL) {

        const response = await axios.post("https://shobika04-harassment-api.hf.space/predict", {
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

  // ✅ NEW: HANDLE VICTIM RESPONSE
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

The victim has confirmed that she is being harassed.
Please take immediate action.
          `,
        });

        console.log("✅ Notification sent to admin");

        // Optional: reset harassment count after confirmation
        harassmentCount[data.victim] = 0;

      }

      // If response is NO → Do nothing (as requested)

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

server.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});
