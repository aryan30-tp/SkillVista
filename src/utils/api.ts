import axios, { AxiosInstance } from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  "https://skillvista-if50.onrender.com/api";

if (!process.env.EXPO_PUBLIC_API_URL && !Constants.expoConfig?.extra?.apiUrl) {
  console.warn("EXPO_PUBLIC_API_URL is not set. Falling back to deployed Render API.");
}

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000
});

// Add JWT token to request headers
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Error retrieving token:", error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 responses (expired token)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      try {
        await SecureStore.deleteItemAsync("authToken");
      } catch (e) {
        console.error("Error clearing token:", e);
      }
      // Could trigger logout here if needed
    }
    return Promise.reject(error);
  }
);

export default api;
