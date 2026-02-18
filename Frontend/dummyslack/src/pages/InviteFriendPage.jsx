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

  const styles = {
    container: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'linear-gradient(to right, #89f7fe, #66a6ff)',
    },
    box: {
      backgroundColor: '#fff',
      padding: '40px',
      borderRadius: '16px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
      width: '350px',
      textAlign: 'center',
    },
    title: {
      marginBottom: '20px',
      fontSize: '24px',
      color: '#333',
    },
    input: {
      width: '100%',
      padding: '12px 3px',
      marginBottom: '16px',
      border: '1px solid #ccc',
      borderRadius: '8px',
      fontSize: '16px',
      outline: 'none',
    },
    button: {
      width: '100%',
      padding: '12px 16px',
      backgroundColor: '#00bcd4',
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      fontSize: '16px',
      cursor: 'pointer',
    },
    error: {
      color: 'red',
      fontSize: '14px',
      marginBottom: '10px',
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.box}>
        <h2 style={styles.title}>Invite a Friend</h2>
        <input
          placeholder="Friend's Email"
          value={friendEmail}
          onChange={(e) => {
            setFriendEmail(e.target.value);
            setError("");
          }}
          style={styles.input}
        />
        {error && <div style={styles.error}>{error}</div>}
        <button style={styles.button} onClick={handleInvite}>
          Start Chat
        </button>
      </div>
    </div>
  );
};

export default InviteFriendPage;
