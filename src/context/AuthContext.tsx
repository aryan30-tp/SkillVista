import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import axios from "axios";

interface User {
  id: string;
  name: string;
  email: string;
  githubId?: string;
  githubUsername?: string;
  skillExtractionStatus: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isSignedIn: boolean;
  register: (name: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore token on app launch
  const restoreToken = async () => {
    try {
      setLoading(true);
      const storedToken = await SecureStore.getItemAsync("authToken");
      if (storedToken) {
        setToken(storedToken);
        // Verify token by fetching user data
        try {
          const response = await axios.get(`${API_BASE_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          setUser(response.data);
        } catch (error) {
          // Token invalid or expired
          await SecureStore.deleteItemAsync("authToken");
          setToken(null);
          setUser(null);
        }
      }
    } catch (error) {
      console.error("Error restoring token:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    restoreToken();
  }, []);

  const register = async (
    name: string,
    email: string,
    password: string,
    confirmPassword: string
  ) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, {
        name,
        email,
        password,
        confirmPassword
      });

      const { token: newToken, user: userData } = response.data;
      await SecureStore.setItemAsync("authToken", newToken);
      setToken(newToken);
      setUser(userData);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || "Registration failed";
      throw new Error(errorMessage);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password
      });

      const { token: newToken, user: userData } = response.data;
      await SecureStore.setItemAsync("authToken", newToken);
      setToken(newToken);
      setUser(userData);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || "Login failed";
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await axios.post(
          `${API_BASE_URL}/auth/logout`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
      }
    } catch (error) {
      console.error("Error during logout API call:", error);
    } finally {
      await SecureStore.deleteItemAsync("authToken");
      setToken(null);
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    isSignedIn: !!token,
    register,
    login,
    logout,
    restoreToken
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
