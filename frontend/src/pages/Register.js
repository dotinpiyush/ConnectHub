import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await register(name, email, password);
      navigate("/social");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };

  const handleGoogleSuccess = async ({ credential }) => {
    setError("");
    try {
      await loginWithGoogle(credential);
      navigate("/social");
    } catch (err) {
      setError(err.response?.data?.message || "Google sign-up failed");
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Create your account</h2>
        {error && <p className="error">{error}</p>}
        <input type="text" placeholder="Full name" value={name}
               onChange={(e) => setName(e.target.value)} required />
        <input type="email" placeholder="Email" value={email}
               onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password (min 6 chars)" value={password}
               onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        <button type="submit">Register</button>
        <div className="auth-divider">or</div>
        {GOOGLE_CLIENT_ID ? (
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError("Google sign-up failed")}
          />
        ) : (
          <p className="auth-note">Add REACT_APP_GOOGLE_CLIENT_ID to enable Google sign-up.</p>
        )}
        <p>Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}
