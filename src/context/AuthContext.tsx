import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import api from "../utils/api";

interface User {
  id: string;
  name: string;
  email: string;
  githubId?: string;
  githubUsername?: string;
  skillExtractionStatus: string;
  createdAt?: string;
  updatedAt?: string;
  repositoryCount?: number;
  lastSkillSync?: string | null;
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
  refreshUser: () => Promise<void>;
  connectGitHub: () => Promise<void>;
  disconnectGitHub: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const getReadableAuthError = (error: any, fallback: string) => {
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }

  // Axios network errors have no response object.
  if (error?.code === "ECONNABORTED" || error?.message === "Network Error") {
    return "Cannot reach backend API. Start backend and set EXPO_PUBLIC_API_URL to your LAN URL (example: http://192.168.1.10:5000/api).";
  }

  return fallback;
};

const OAUTH_REDIRECT_TIMEOUT_MS = 3 * 60 * 1000;

const extractCodeFromCallbackUrl = (callbackUrl: string) => {
  const parsed = Linking.parse(callbackUrl);
  const code = typeof parsed.queryParams?.code === "string" ? parsed.queryParams.code : null;
  const oauthError =
    typeof parsed.queryParams?.error === "string" ? parsed.queryParams.error : null;

  if (oauthError) {
    throw new Error(`GitHub OAuth failed: ${oauthError}`);
  }

  if (!code) {
    throw new Error("GitHub authorization code not found");
  }

  return code;
};

const waitForOAuthRedirect = (redirectUri: string, timeoutMs = OAUTH_REDIRECT_TIMEOUT_MS) => {
  return new Promise<string>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      subscription.remove();
      reject(new Error("GitHub authorization timed out. Please try again."));
    }, timeoutMs);

    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (!url || !url.startsWith(redirectUri)) {
        return;
      }

      clearTimeout(timeoutId);
      subscription.remove();
      resolve(url);
    });
  });
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const response = await api.get("/auth/me");
      setUser(response.data);
    } catch (error) {
      console.error("Error refreshing user:", error);
      throw error;
    }
  };

  // Restore token on app launch
  const restoreToken = async () => {
    try {
      setLoading(true);
      const storedToken = await SecureStore.getItemAsync("authToken");
      if (storedToken) {
        setToken(storedToken);
        // Verify token by fetching user data
        try {
          const response = await api.get("/auth/me", {
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
      const response = await api.post("/auth/register", {
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
      const errorMessage = getReadableAuthError(error, "Registration failed");
      throw new Error(errorMessage);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post("/auth/login", {
        email,
        password
      });

      const { token: newToken, user: userData } = response.data;
      await SecureStore.setItemAsync("authToken", newToken);
      setToken(newToken);
      setUser(userData);
    } catch (error: any) {
      const errorMessage = getReadableAuthError(error, "Login failed");
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await api.post(
          "/auth/logout",
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

  const connectGitHub = async () => {
    try {
      const response = await api.get("/auth/github/url");
      const { authUrl, redirectUri } = response.data;

      let callbackUrl: string | null = null;

      const authSessionResult = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      if (authSessionResult.type === "success" && authSessionResult.url) {
        callbackUrl = authSessionResult.url;
      } else {
        // Fallback keeps OAuth usable when Android cancels auth session during 2FA app switching.
        const redirectPromise = waitForOAuthRedirect(redirectUri);
        await WebBrowser.openBrowserAsync(authUrl);
        callbackUrl = await redirectPromise;
      }

      const code = extractCodeFromCallbackUrl(callbackUrl);

      const callbackResponse = await api.post("/auth/github/callback", { code });
      setUser(callbackResponse.data.user);
    } catch (error: any) {
      const message =
        error.response?.data?.error || error.message || "Failed to connect GitHub";
      throw new Error(message);
    }
  };

  const disconnectGitHub = async () => {
    try {
      await api.post("/auth/github/disconnect");
      await refreshUser();
    } catch (error: any) {
      const message =
        error.response?.data?.error || error.message || "Failed to disconnect GitHub";
      throw new Error(message);
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
    restoreToken,
    refreshUser,
    connectGitHub,
    disconnectGitHub
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
