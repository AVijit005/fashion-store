// Typed HTTP API Client wrapper around native fetch.
// Communicates with NestJS API running on http://localhost:3000.

const BASE_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export class APIError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.data = data;
  }
}

export const apiClient = {
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);

    if (options.params) {
      Object.entries(options.params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          url.searchParams.append(key, String(val));
        }
      });
    }

    const headers = new Headers(options.headers);

    // Auto set content-type for JSON payloads
    if (options.body && !headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    // Attach JWT Access Token if user is logged in
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("ink_access_token");
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      // Attach Guest Session ID for Cart identification
      const guestSessionId = localStorage.getItem("ink_cart_session_id");
      if (guestSessionId) {
        headers.set("x-cart-session-id", guestSessionId);
      }
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    let response: Response;
    try {
      response = await fetch(url.toString(), config);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network connection failure";
      throw new APIError(msg, 500, err);
    }

    if (!response.ok) {
      if (response.status === 401 && path !== "/auth/refresh" && path !== "/auth/login") {
        if (typeof window !== "undefined") {
          const refreshToken = localStorage.getItem("ink_refresh_token");
          if (refreshToken) {
            try {
              const refreshUrl = new URL(`${BASE_URL}/auth/refresh`);
              const refreshRes = await fetch(refreshUrl.toString(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken }),
              });

              if (refreshRes.ok) {
                const tokens = await refreshRes.json();
                localStorage.setItem("ink_access_token", tokens.accessToken);
                localStorage.setItem("ink_refresh_token", tokens.refreshToken);

                headers.set("Authorization", `Bearer ${tokens.accessToken}`);
                const retryResponse = await fetch(url.toString(), { ...config, headers });
                if (retryResponse.ok) {
                  if (retryResponse.status === 204) {
                    return null as unknown as T;
                  }
                  return (await retryResponse.json()) as T;
                }
              }
            } catch (err) {
              console.error("Token rotation failed inside interceptor:", err);
            }
          }
        }
      }

      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch {
        try {
          errorData = await response.text();
        } catch {
          errorData = null;
        }
      }
      let errorMessage = `API request failed with status ${response.status}`;
      if (errorData && typeof errorData === "object" && "message" in errorData) {
        errorMessage = String((errorData as Record<string, unknown>).message);
      }
      throw new APIError(errorMessage, response.status, errorData);
    }

    if (response.status === 204) {
      return null as unknown as T;
    }

    try {
      return (await response.json()) as T;
    } catch {
      return null as unknown as T;
    }
  },

  get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET", params });
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  },
};
