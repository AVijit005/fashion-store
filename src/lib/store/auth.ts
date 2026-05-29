import { create } from "zustand";
import { apiClient } from "../api/client";
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
  setTokens: (accessToken: string, refreshToken: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: typeof window !== "undefined" ? localStorage.getItem("ink_access_token") : null,
  isAuthenticated: false,
  isLoading: true,
  authModalOpen: false,
  authModalView: "login",

  setAuthModalOpen: (open) => set({ authModalOpen: open }),
  setAuthModalView: (view) => set({ authModalView: view }),

  setTokens: (accessToken, refreshToken) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ink_access_token", accessToken);
      localStorage.setItem("ink_refresh_token", refreshToken);
    }
    set({ accessToken, isAuthenticated: true });
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post<{ accessToken: string; refreshToken: string }>(
        "/auth/login",
        { email, password },
      );
      get().setTokens(res.accessToken, res.refreshToken);

      // Fetch profile
      const user = await apiClient.get<UserProfile>("/auth/me");
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
    // Clear local state FIRST so the UI reflects logged-out state immediately,
    // even if the network request to revoke the session is slow or fails.
    const refreshToken =
      typeof window !== "undefined" ? localStorage.getItem("ink_refresh_token") : null;

    if (typeof window !== "undefined") {
      localStorage.removeItem("ink_access_token");
      localStorage.removeItem("ink_refresh_token");
    }
    set({ user: null, accessToken: null, isAuthenticated: false });

    // Revoke server session in the background (best-effort)
    if (refreshToken) {
      apiClient
        .post("/auth/logout", { refreshToken })
        .catch((err) => console.error("[auth] Logout request failed:", err));
    }
  },

  initialize: async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("ink_access_token") : null;
    if (!token) {
      set({ isLoading: false, isAuthenticated: false, user: null });
      return;
    }
    try {
      const user = await apiClient.get<UserProfile>("/auth/me");
      set({ user, isAuthenticated: true });
    } catch (error) {
      console.error("Failed to restore auth session:", error);
      // If token is invalid/expired, try rotating
      const refresh =
        typeof window !== "undefined" ? localStorage.getItem("ink_refresh_token") : null;
      if (refresh) {
        try {
          const res = await apiClient.post<{ accessToken: string; refreshToken: string }>(
            "/auth/refresh",
            { refreshToken: refresh },
          );
          get().setTokens(res.accessToken, res.refreshToken);
          const user = await apiClient.get<UserProfile>("/auth/me");
          set({ user, isAuthenticated: true });
        } catch {
          await get().logout();
        }
      } else {
        await get().logout();
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));
