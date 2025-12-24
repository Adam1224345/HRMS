import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
// 1. CONFIGURATION
// ------------------------------------------------------------------
const isDevelopment = import.meta.env.MODE === 'development';

const API_URL = isDevelopment 
  ? (import.meta.env.VITE_API_URL || 'http://localhost:5000/api') 
  : (import.meta.env.VITE_API_URL || '/api');

axios.defaults.baseURL = API_URL;
axios.defaults.withCredentials = true;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('refresh_token'));
  
  const navigate = useNavigate();

  // ------------------------------------------------------------------
  // 2. HELPER: REFRESH TOKEN FUNCTION (Reusable)
  // ------------------------------------------------------------------
  const refreshAccessToken = useCallback(async () => {
    const currentRefreshToken = localStorage.getItem('refresh_token');
    if (!currentRefreshToken) return null;

    try {
      // console.log("🔄 Attempting to refresh token...");
      const response = await axios.post('/auth/token/refresh', {}, {
        headers: { Authorization: `Bearer ${currentRefreshToken}` },
      });

      const { access_token, refresh_token: new_refresh_token } = response.data;

      // Update Storage & State
      localStorage.setItem('token', access_token);
      setToken(access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      if (new_refresh_token) {
        localStorage.setItem('refresh_token', new_refresh_token);
        setRefreshToken(new_refresh_token);
      }
      
      return access_token;

    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
      return null;
    }
  }, []);

  // ------------------------------------------------------------------
  // 3. AXIOS INTERCEPTOR (For requests AFTER app loads)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (!originalRequest || originalRequest._retry) return Promise.reject(error);

        // If 401 Unauthorized AND not a login attempt
        if (error.response?.status === 401 && !originalRequest.url.includes('/auth/login')) {
          originalRequest._retry = true;

          try {
            const newToken = await refreshAccessToken();
            if (newToken) {
              originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
              return axios(originalRequest);
            }
          } catch (refreshError) {
             return Promise.reject(refreshError);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptorId);
  }, [token, refreshAccessToken]);

  // ------------------------------------------------------------------
  // 4. ✅ FIXED INITIAL AUTH CHECK (The Logic Fix)
  // ------------------------------------------------------------------
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedRefreshToken = localStorage.getItem('refresh_token');

      // 1. If no tokens at all, stop loading (User is Guest)
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        // 2. Try to fetch profile with current token
        const response = await axios.get('/auth/profile');
        setUser(response.data.user);
      } catch (error) {
        console.log("⚠️ Initial check failed. Attempting rescue...");

        // 3. If failed (401) AND we have a Refresh Token, try to rescue!
        if (error.response?.status === 401 && storedRefreshToken) {
            const newToken = await refreshAccessToken();
            
            if (newToken) {
                // 4. Retry Profile Fetch with NEW token
                try {
                    const retryResponse = await axios.get('/auth/profile', {
                        headers: { Authorization: `Bearer ${newToken}` }
                    });
                    setUser(retryResponse.data.user);
                    console.log("✅ Session rescued! User logged in.");
                } catch (retryError) {
                    // Rescue failed (Refresh token might be dead too)
                    handleLogout(); 
                }
            } else {
                handleLogout();
            }
        } else {
            // Not a 401, or no refresh token -> Logout
            handleLogout(); 
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []); // Run once on mount

  // ------------------------------------------------------------------
  // 5. LOGIN / LOGOUT
  // ------------------------------------------------------------------
  const login = async (credentials) => {
    try {
      const response = await axios.post('/auth/login', credentials);
      const { access_token, refresh_token, user: userData } = response.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      
      setToken(access_token);
      setRefreshToken(refresh_token);
      setUser(userData);
      
      navigate('/dashboard', { replace: true });
      return { success: true, user: userData };
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed';
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      if (token) await axios.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      handleLogout();
    }
  };

  const handleLogout = () => {
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    delete axios.defaults.headers.common['Authorization'];
    // Only redirect if not already on public page? 
    // Usually fine to just redirect to login.
    // navigate('/login'); // Optional: can cause loops if not careful, better to let ProtectedRoute handle it
  };

  // --- KEEPING OTHER FUNCTIONS ---
  const register = async (d) => { try { const r = await axios.post('/auth/register', d); return { success: true, data: r.data }; } catch (e) { return { success: false, error: e.response?.data?.error }; } };
  const forgotPassword = async (e) => { try { const r = await axios.post('/auth/forgot-password', { email: e }); return { success: true, data: r.data }; } catch (err) { return { success: false, error: err.response?.data?.error }; } };
  const resetPassword = async (t, p) => { try { const r = await axios.post('/auth/reset-password', { token: t, new_password: p }); return { success: true, data: r.data }; } catch (e) { return { success: false, error: e.response?.data?.error }; } };
  const updateProfile = async (d) => { try { const r = await axios.put('/auth/profile', d); setUser(r.data.user); return { success: true, data: r.data }; } catch (e) { return { success: false, error: e.response?.data?.error }; } };
  const changePassword = async (c, n) => { try { const r = await axios.post('/auth/change-password', { current_password: c, new_password: n }); return { success: true, data: r.data }; } catch (e) { return { success: false, error: e.response?.data?.error }; } };
  const hasPermission = (p) => user?.permissions?.includes(p) || false;
  const hasRole = (r) => user?.roles?.some(role => role.name === r) || false;

  const value = {
    user, loading, login, logout, 
    register, forgotPassword, resetPassword, updateProfile, changePassword, 
    hasPermission, hasRole, isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
