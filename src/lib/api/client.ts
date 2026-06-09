// Typed HTTP API Client wrapper around native fetch.
// Communicates with NestJS API running on http://localhost:3000.

const isVercelPreview = typeof window !== "undefined" && window.location.hostname.includes("vercel.app") && !window.location.hostname.startsWith("fashion-store");
const BASE_URL = (import.meta.env.VITE_API_URL as string) || (import.meta.env.PROD && !isVercelPreview ? "https://fashion-store-duva.onrender.com" : "http://localhost:3000");

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  validate?: (data: unknown) => boolean;
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

let refreshPromise: Promise<void> | null = null;

function unwrapApiData<T>(parsed: unknown, validate?: (data: unknown) => boolean): T {
  let data = parsed;
  if (parsed && typeof parsed === "object" && "success" in parsed && "data" in parsed) {
    data = (parsed as Record<string, unknown>).data;
  }
  if (validate && !validate(data)) {
    throw new TypeError("API response payload failed runtime type validation");
  }
  return data as T;
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

    // Backend now relies on HttpOnly cookies, so we don't need to manually attach a Bearer token.
    if (typeof window !== "undefined") {
      // Attach Guest Session ID for Cart identification
      const guestSessionId = localStorage.getItem("ink_cart_session_id");
      if (guestSessionId) {
        headers.set("x-cart-session-id", guestSessionId);
      }
    }

    const config: RequestInit = {
      ...options,
      headers,
      credentials: "include",
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
        if (typeof window !== "undefined" && localStorage.getItem("ink_logged_in") === "true") {
          if (!refreshPromise) {
            refreshPromise = (async () => {
                const refreshUrl = new URL(`${BASE_URL}/auth/refresh`);
                const refreshRes = await fetch(refreshUrl.toString(), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                });

                if (refreshRes.ok) {
                  const tokens = unwrapApiData<{ accessToken: string }>(
                    await refreshRes.json(),
                    (d) => !!d && typeof d === "object" && "accessToken" in d && typeof (d as any).accessToken === "string"
                  );
                  setMemoryAccessToken(tokens.accessToken);
                } else {
                  // If refresh fails, clear tokens to force login
                  setMemoryAccessToken(null);
                  if (typeof window !== "undefined") {
                    localStorage.removeItem("ink_logged_in");
                  }
                  throw new Error("Refresh failed");
                }
              })()
                .catch((err) => {
                  console.error("Background token rotation failed:", err);
                })
                .finally(() => {
                  refreshPromise = null;
                });
            }

            try {
              await refreshPromise;
              if (memoryAccessToken) {
                headers.set("Authorization", `Bearer ${memoryAccessToken}`);
                const retryResponse = await fetch(url.toString(), { ...config, headers });
                if (retryResponse.ok) {
                  if (retryResponse.status === 204) {
                    return null as unknown as T;
                  }
                  return unwrapApiData<T>(await retryResponse.json(), options.validate);
                }
              }
            } catch (err) {
              console.error("Token rotation failed inside interceptor:", err);
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
      return unwrapApiData<T>(await response.json(), options.validate);
    } catch (err) {
      if (err instanceof TypeError || err instanceof APIError) {
        throw err;
      }
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
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: "PATCH",
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  },
};
