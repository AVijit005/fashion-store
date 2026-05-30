import { create } from "zustand";
import { apiClient, setMemoryAccessToken } from "../api/client";
import { cartApi, getOrCreateCartSessionId } from "../api/cart";

export interface UserProfile {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authModalOpen: boolean;
  authModalView: "login" | "signup" | "forgot-password";

  setAuthModalOpen: (open: boolean) => void;
  setAuthModalView: (view: "login" | "signup" | "forgot-password") => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  setTokens: (accessToken: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  authModalOpen: false,
  authModalView: "login",

  setAuthModalOpen: (open) => set({ authModalOpen: open }),
  setAuthModalView: (view) => set({ authModalView: view }),

  setTokens: (accessToken) => {
    setMemoryAccessToken(accessToken);
    set({ accessToken, isAuthenticated: true });
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post<{ accessToken: string }>("/auth/login", { email, password });
      get().setTokens(res.accessToken);

      // Fetch profile
      const user = await apiClient.get<UserProfile>("/auth/me");
      if (typeof window !== "undefined") {
        localStorage.setItem("ink_logged_in", "true");
      }
      set({ user, isAuthenticated: true, authModalOpen: false });

      // Merge guest cart into authenticated user cart after login
      const guestSessionId = getOrCreateCartSessionId();
      if (guestSessionId) {
        cartApi
          .mergeCart(guestSessionId)
          .catch((err) => console.error("[auth] Cart merge after login failed:", err));
      }
    } catch (error) {
      get().logout();
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  signup: async (email, password) => {
    set({ isLoading: true });
    try {
      await apiClient.post("/auth/signup", { email, password });
      await get().login(email, password);
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch (err) {
      console.error("[auth] Logout request failed:", err);
      // Let the error bubble up if network fails so UI can show it,
      // but if we wanted to force local logout we could ignore it.
      // We will throw to ensure user knows it failed.
      throw err;
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("ink_logged_in");
      }
      setMemoryAccessToken(null);
      set({ user: null, accessToken: null, isAuthenticated: false });
    }
  },

  initialize: async () => {
    const isLoggedIn = typeof window !== "undefined" ? localStorage.getItem("ink_logged_in") === "true" : false;
    if (!isLoggedIn) {
      set({ isLoading: false, isAuthenticated: false, user: null });
      return;
    }
    try {
      const user = await apiClient.get<UserProfile>("/auth/me");
      set({ user, isAuthenticated: true });
    } catch (error) {
      console.error("Failed to restore auth session:", error);
      // If token is invalid/expired, try rotating
      try {
        const res = await apiClient.post<{ accessToken: string }>("/auth/refresh");
        get().setTokens(res.accessToken);
        const user = await apiClient.get<UserProfile>("/auth/me");
        set({ user, isAuthenticated: true });
      } catch {
        await get().logout();
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));
