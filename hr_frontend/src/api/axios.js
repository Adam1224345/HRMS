// src/api/axios.js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  withCredentials: true,
});

// 🔁 Auto-refresh access token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) return Promise.reject(error);

      try {
        const res = await axios.post("http://localhost:5000/api/auth/refresh", {
          refresh_token: refreshToken,
        });

        const newAccess = res.data.access_token;
        localStorage.setItem("access_token", newAccess);

        originalRequest.headers["Authorization"] = "Bearer " + newAccess;

        return api(originalRequest); // Retry original API request
      } catch (e) {
        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
