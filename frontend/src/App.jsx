import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Home from './components/Home';
import Login from './components/Login';
import Users from './components/Users';
import Layout from './components/Layout';

// Setup global axios request interceptor for JWT
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
  };

  // Setup global axios response interceptor for 401 Unauthorized
  useEffect(() => {
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          handleLogout();
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(responseInterceptor);
  }, []);

  // Auto-logout after 1 hour of inactivity
  useEffect(() => {
    if (!user) return;

    let logoutTimer;
    const timeoutDuration = 60 * 60 * 1000; // 1 hour

    const resetTimer = () => {
      if (logoutTimer) clearTimeout(logoutTimer);
      logoutTimer = setTimeout(() => {
        handleLogout();
      }, timeoutDuration);
    };

    // Track user activity
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Initialize timer
    resetTimer();

    return () => {
      if (logoutTimer) clearTimeout(logoutTimer);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user]);

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login onLogin={setUser} />} />
      </Routes>
    );
  }

  return (
    <Layout user={user} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Navigate to="/portfolio-cuts" replace />} />
        <Route path="/portfolio-cuts" element={<Home user={user} onLogout={handleLogout} />} />
        {user.role === 'admin' && (
          <Route path="/users" element={<Users user={user} onLogout={handleLogout} />} />
        )}
        <Route path="*" element={<Navigate to="/portfolio-cuts" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
