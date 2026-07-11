import React, { createContext, useContext, useState } from "react";
import axios from "axios";

const AuthContext = createContext(null);
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("connecthub_user");
    return stored ? JSON.parse(stored) : null;
  });

  const persist = (userData) => {
    localStorage.setItem("connecthub_user", JSON.stringify(userData));
    setUser(userData);
  };

  const register = async (name, email, password) => {
    const { data } = await axios.post(`${API_URL}/auth/register`, { name, email, password });
    persist(data);
    return data;
  };

  const login = async (email, password) => {
    const { data } = await axios.post(`${API_URL}/auth/login`, { email, password });
    persist(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("connecthub_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
