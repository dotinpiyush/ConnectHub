import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/social");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

  const handleGoogleSuccess = async ({ credential }) => {
    setError("");
    try {
      await loginWithGoogle(credential);
      navigate("/social");
    } catch (err) {
      setError(err.response?.data?.message || "Google sign-in failed");
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Welcome back</h2>
        {error && <p className="error">{error}</p>}
        <input type="email" placeholder="Email" value={email}
               onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password}
               onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit">Log In</button>
        <div className="auth-divider">or</div>
        {GOOGLE_CLIENT_ID ? (
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError("Google sign-in failed")}
            useOneTap
          />
        ) : (
          <p className="auth-note">Add REACT_APP_GOOGLE_CLIENT_ID to enable Google sign-in.</p>
        )}
        <p>No account? <Link to="/register">Register</Link></p>
      </form>
    </div>
  );
}
