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

  return (
    <div className="page-container">
      <div className="auth-card">
        <h2>Welcome Back</h2>
        <div className="input-group">
          <input
            type="email"
            placeholder="Your Email Address"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>
        {error && <span className="error-text">{error}</span>}
        <button onClick={handleLogin}>
          Continue to Chat
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
