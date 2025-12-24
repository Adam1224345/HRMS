import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ------------------------------------------------------------------
// 1. CONFIGURATION (FIXED FOR BUILD & DEPLOYMENT)
// ------------------------------------------------------------------
const isDevelopment = import.meta.env.MODE === 'development';

// Logic:
// - Development: Use 'http://localhost:5000/api' (so you can code on localhost).
// - Production (Build): Use '/api'. This is a "Relative Path".
//   It allows the React App to automatically find the Flask Backend on the 
//   same domain (whether it's on Vercel, Render, or just a static file in Flask).
const API_URL = isDevelopment 
  ? (import.meta.env.VITE_API_URL || 'http://localhost:5000/api') 
  : (import.meta.env.VITE_API_URL || '/api');

axios.defaults.baseURL = API_URL;
axios.defaults.withCredentials = true; // Ensures cookies are handled correctly if used

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Started true to prevent flicker

  // ✅ TRACK BOTH TOKENS
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('refresh_token'));
  
  const navigate = useNavigate();

  // 2. REQUEST INTERCEPTOR (Attach Access Token)
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
    }
    
    // Also sync refresh token to storage
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    } else {
      localStorage.removeItem('refresh_token');
    }
  }, [token, refreshToken]);

  // ✅ 3. RESPONSE INTERCEPTOR (The "Silent Refresh" Magic)
  // This replaces the old logic that forced logout on 401.
  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If error is 401 (Unauthorized) AND it's NOT a login attempt AND we haven't retried yet
        const isLoginRequest = originalRequest.url.includes('/auth/login');
        
        if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest) {
          originalRequest._retry = true; // Mark as retried

          try {
            const storedRefreshToken = localStorage.getItem('refresh_token');
            if (!storedRefreshToken) {
                // If no refresh token, we must logout
                throw new Error("No refresh token available");
            }

            console.log("🔄 Access Token expired. Attempting Silent Refresh...");

            // Call the Refresh Endpoint
            const response = await axios.post('/auth/token/refresh', {}, {
                headers: { Authorization: `Bearer ${storedRefreshToken}` }
            });

            // Backend sends back NEW tokens
            const { access_token, refresh_token: new_refresh_token } = response.data;

            // Save new tokens
            setToken(access_token);
            // Some backends rotate refresh tokens too, some don't. 
            // If your backend sends a new one, save it.
            if (new_refresh_token) {
                setRefreshToken(new_refresh_token);
            }

            // Update the header for the retry
            originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
            axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

            // Retry the original request
            console.log("✅ Refresh Success! Retrying original request...");
            return axios(originalRequest);

          } catch (refreshError) {
            console.error("❌ Session totally expired. Logging out.");
            handleLogout();
            return Promise.reject(refreshError);
          }
        }
        
        // Return any other error as usual
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptorId);
  }, []);

  // 4. INITIAL AUTH CHECK
  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await axios.get('/auth/profile', { timeout: 5000 });
        setUser(response.data.user);
      } catch (error) {
        console.error('Initial auth check failed:', error);
        // The interceptor handles the 401/Refresh logic. 
        // We only logout if that fails completely.
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []); // Run once on mount

  // ✅ 5. UPDATED LOGIN (Saves Both Tokens)
  const login = async (credentials) => {
    try {
      const response = await axios.post('/auth/login', credentials);
      // Backend must return both tokens
      const { access_token, refresh_token, user } = response.data;
      
      setToken(access_token);
      setRefreshToken(refresh_token);
      setUser(user);
      
      navigate('/dashboard', { replace: true });
      return { success: true, user };
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed';
      return { success: false, error: message };
    }
  };

  // 6. UPDATED LOGOUT (Clears Both Tokens)
  const logout = async () => {
    try {
      if (token) {
        await axios.post('/auth/logout');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      handleLogout();
    }
  };

  // Shared Logout Helper
  const handleLogout = () => {
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/login';
  };

  // --- KEEPING ALL OTHER FEATURES EXACTLY THE SAME ---

  const register = async (userData) => {
    try {
      const response = await axios.post('/auth/register', userData);
      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.error || 'Registration failed';
      return { success: false, error: message };
    }
  };

  const forgotPassword = async (email) => {
    try {
      const response = await axios.post('/auth/forgot-password', { email });
      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to send reset email';
      return { success: false, error: message };
    }
  };

  const resetPassword = async (token, newPassword) => {
    try {
      const response = await axios.post('/auth/reset-password', {
        token,
        new_password: newPassword
      });
      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.error || 'Password reset failed';
      return { success: false, error: message };
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await axios.put('/auth/profile', profileData);
      setUser(response.data.user);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.error };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await axios.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.error };
    }
  };

  const hasPermission = (permission) => user?.permissions?.includes(permission) || false;
  const hasRole = (roleName) => user?.roles?.some(role => role.name === roleName) || false;

  const value = {
    user, loading, login, register, logout, 
    forgotPassword, resetPassword, 
    updateProfile, changePassword, 
    hasPermission, hasRole, 
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};