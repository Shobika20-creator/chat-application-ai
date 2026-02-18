import { useNavigate } from "react-router-dom";
import { useState } from "react";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const isValidEmail = (email) => {
    // Simple regex for basic email format
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleLogin = () => {
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    localStorage.setItem("email", email);
    navigate("/invite");
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
        <h2 style={styles.title}>Login</h2>
        <input
          type="email"
          placeholder="Your Email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          style={styles.input}
        />
        {error && <div style={styles.error}>{error}</div>}
        <button style={styles.button} onClick={handleLogin}>
          Login
        </button>
      </div>
    </div>
  );
};

export default LoginPage;


