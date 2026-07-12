import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
const OAuthShell = googleClientId
  ? ({ children }) => (
      <GoogleOAuthProvider clientId={googleClientId}>{children}</GoogleOAuthProvider>
    )
  : React.Fragment;

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <OAuthShell>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </OAuthShell>
  </React.StrictMode>
);
