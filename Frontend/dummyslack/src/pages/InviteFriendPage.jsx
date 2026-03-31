import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function InviteFriendPage() {
  const [friendEmail, setFriendEmail] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleInvite = () => {
    if (!isValidEmail(friendEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    localStorage.setItem("friendEmail", friendEmail);
    navigate("/chat");
  };

  return (
    <div className="page-container">
      <div className="auth-card">
        <h2>Invite a Friend</h2>
        <div className="input-group">
          <input
            placeholder="Friend's Email"
            value={friendEmail}
            onChange={(e) => {
              setFriendEmail(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
          />
        </div>
        {error && <span className="error-text">{error}</span>}
        <button onClick={handleInvite}>
          Start Chatting
        </button>
      </div>
    </div>
  );
};

export default InviteFriendPage;
