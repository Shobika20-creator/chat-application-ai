import React, { useEffect, useState, useRef } from "react";
import socket from "../socket";

const ChatPage = () => {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [showAlert, setShowAlert] = useState(false);
  const chatEndRef = useRef(null);

  const email = localStorage.getItem("email");
  const friendEmail = localStorage.getItem("friendEmail");

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (email) {
      socket.emit("registerUser", email);
    }
  }, [email]);

  useEffect(() => {
    socket.on("receiveMessage", (data) => {
      setChat((prev) => [...prev, data]);
    });

    return () => {
      socket.off("receiveMessage");
    };
  }, []);

  useEffect(() => {
    socket.on("harassmentAlert", () => {
      setShowAlert(true);
    });

    return () => {
      socket.off("harassmentAlert");
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chat]);

  const handleYes = () => {
    socket.emit("victimResponse", {
      victim: email,
      predator: friendEmail,
      response: "YES",
      timestamp: new Date(),
    });

    setChat((prev) => [
      ...prev,
      {
        sender: "System",
        content: "You confirmed harassment. Monitoring paused. Admin notified.",
      },
    ]);

    setShowAlert(false);
  };

  const handleNo = () => {
    socket.emit("victimResponse", {
      victim: email,
      predator: friendEmail,
      response: "NO",
      timestamp: new Date(),
    });

    setChat((prev) => [
      ...prev,
      {
        sender: "System",
        content: "You reported NO harassment. Monitoring has been paused.",
      },
    ]);

    setShowAlert(false);
  };

  const handleResetMonitoring = () => {
    socket.emit("resetMonitoring", {
      victim: email,
      predator: friendEmail,
    });

    setChat((prev) => [
      ...prev,
      {
        sender: "System",
        content: "Monitoring has been resumed manually.",
      },
    ]);
  };

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
    <div className="chat-page">
      <div className="chat-header">
        <h2>
          Talking with <span className="friend">{friendEmail}</span>
        </h2>
      </div>

      <div className="chat-messages">
        {chat.map((msg, idx) => {
          const isMine = msg.sender === email;
          const isSystem = msg.sender === "System";
          const bubbleClass = isMine
            ? "message-mine"
            : isSystem
            ? "message-system"
            : "message-theirs";
          
          return (
            <div key={idx} className={`message-bubble ${bubbleClass}`}>
              {!isSystem && (
                <span className="message-sender">
                  {isMine ? "You" : msg.sender}
                </span>
              )}
              <div>{msg.content}</div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      <div className="chat-input-area">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type your message..."
          autoFocus
        />
        <button onClick={handleSend}>
          Send
        </button>
      </div>

      <div className="chat-actions">
        <button className="warning" onClick={handleResetMonitoring}>
          Reset Monitoring
        </button>
      </div>

      {showAlert && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>⚠ Potential Harassment Detected</h3>
            <p>
              Our systems have flagged a pattern of messages that could be perceived as harassment. Do you feel harassed or unsafe?
            </p>
            <div className="modal-actions">
              <button className="danger" onClick={handleYes}>
                Yes, I do
              </button>
              <button className="success" onClick={handleNo}>
                No, I'm okay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;