import React, { useEffect, useState } from "react";
import socket from "../socket";

const ChatPage = () => {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [showAlert, setShowAlert] = useState(false);

  const email = localStorage.getItem("email");
  const friendEmail = localStorage.getItem("friendEmail");

  // ✅ 1️⃣ REGISTER USER WITH BACKEND
  useEffect(() => {
    if (email) {
      socket.emit("registerUser", email);
      console.log("User registered with socket:", email);
    }
  }, [email]);

  // ✅ 2️⃣ RECEIVE MESSAGES
  useEffect(() => {
    socket.on("receiveMessage", (data) => {
      setChat((prev) => [...prev, data]);
    });

    return () => {
      socket.off("receiveMessage");
    };
  }, []);

  // ✅ 3️⃣ HARASSMENT ALERT LISTENER
  useEffect(() => {
    socket.on("harassmentAlert", (data) => {
      console.log("🚨 Harassment Alert:", data);
      setShowAlert(true);
    });

    return () => {
      socket.off("harassmentAlert");
    };
  }, []);

  // ✅ HANDLE YES RESPONSE
  const handleYes = () => {
    socket.emit("victimResponse", {
      victim: email,
      predator: friendEmail,
      response: "YES",
      timestamp: new Date(),
    });

    // Optional: show system message in chat
    setChat((prev) => [
      ...prev,
      {
        sender: "System",
        content: "You confirmed that you are being harassed. Admin will be notified.",
      },
    ]);

    setShowAlert(false);
  };

  // ✅ HANDLE NO RESPONSE
  const handleNo = () => {
    socket.emit("victimResponse", {
      victim: email,
      predator: friendEmail,
      response: "NO",
      timestamp: new Date(),
    });

    // Optional: show system message in chat
    setChat((prev) => [
      ...prev,
      {
        sender: "System",
        content: "You reported that you are NOT being harassed. Monitoring will continue.",
      },
    ]);

    setShowAlert(false);
  };

  // ✅ SEND MESSAGE
  const handleSend = () => {
    if (!message.trim()) return;

    const newMsg = {
      sender: email,
      receiver: friendEmail,
      content: message,
    };

    socket.emit("sendMessage", newMsg);
    setChat((prev) => [...prev, newMsg]);
    setMessage("");
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          Chat with <span style={styles.friend}>{friendEmail}</span>
        </h2>
      </div>

      <div style={styles.chatBox}>
        {chat.map((msg, idx) => (
          <div
            key={idx}
            style={{
              ...styles.message,
              alignSelf:
                msg.sender === email
                  ? "flex-end"
                  : msg.sender === "System"
                  ? "center"
                  : "flex-start",
              backgroundColor:
                msg.sender === email
                  ? "#DCF8C6"
                  : msg.sender === "System"
                  ? "#ffeeba"
                  : "#FFF",
              border:
                msg.sender === email
                  ? "1px solid #b2f2bb"
                  : msg.sender === "System"
                  ? "1px solid #ffca2c"
                  : "1px solid #ccc",
            }}
          >
            <span style={styles.sender}>
              {msg.sender === email
                ? "You"
                : msg.sender === "System"
                ? "System"
                : msg.sender}
            </span>
            <div>{msg.content}</div>
          </div>
        ))}
      </div>

      <div style={styles.inputArea}>
        <input
          style={styles.input}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type your message..."
        />
        <button style={styles.button} onClick={handleSend}>
          Send
        </button>
      </div>

      {/* ✅ ALERT MODAL */}
      {showAlert && (
        <div style={styles.overlay}>
          <div style={styles.popup}>
            <h3 style={{ marginBottom: "15px", color: "#f44336" }}>
              ⚠ Are you being harassed?
            </h3>
            <p style={{ marginBottom: "20px" }}>
              I have detected continuous suspicious messages.
            </p>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button
                style={{ ...styles.button, backgroundColor: "#f44336" }}
                onClick={handleYes}
              >
                YES
              </button>
              <button
                style={{ ...styles.button, backgroundColor: "#4caf50" }}
                onClick={handleNo}
              >
                NO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: "1000px",
    margin: "40px auto",
    display: "flex",
    flexDirection: "column",
    border: "1px solid #ddd",
    borderRadius: "8px",
    overflow: "hidden",
    fontFamily: "Segoe UI, sans-serif",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    backgroundColor: "#f9f9f9",
  },
  header: {
    padding: "16px",
    borderBottom: "1px solid #eee",
    backgroundColor: "#00bcd4",
    color: "#fff",
  },
  title: {
    margin: 0,
    fontSize: "20px",
  },
  friend: {
    fontWeight: "normal",
    color: "#ffd700",
  },
  chatBox: {
    display: "flex",
    flexDirection: "column",
    padding: "10px",
    height: "460px",
    overflowY: "auto",
    backgroundColor: "#ffffff98",
  },
  message: {
    maxWidth: "70%",
    padding: "10px 14px",
    margin: "6px 0",
    borderRadius: "12px",
    wordWrap: "break-word",
  },
  sender: {
    fontSize: "12px",
    color: "#555",
    display: "block",
    marginBottom: "4px",
  },
  inputArea: {
    display: "flex",
    borderTop: "1px solid #eee",
    padding: "12px",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    padding: "10px",
    border: "1px solid #ccc",
    borderRadius: "6px",
    fontSize: "14px",
    marginRight: "8px",
  },
  button: {
    padding: "10px 16px",
    backgroundColor: "#00bcd4",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  popup: {
    backgroundColor: "#fff",
    padding: "30px",
    borderRadius: "10px",
    width: "350px",
    textAlign: "center",
  },
};

export default ChatPage;
