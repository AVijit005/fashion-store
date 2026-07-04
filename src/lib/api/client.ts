// Typed HTTP API Client wrapper around native fetch.
// Communicates with NestJS API running on http://localhost:3000.

const isVercelPreview =
  typeof window !== "undefined" &&
  window.location.hostname.includes("vercel.app") &&
  !window.location.hostname.startsWith("fashion-store");
const BASE_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";
const API_PREFIX = "/api/v1";

import { toast } from "sonner";

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  validate?: (data: unknown) => boolean | unknown;
  silent?: boolean;
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
let csrfPromise: Promise<void> | null = null;

function buildApiUrl(path: string): URL {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = BASE_URL.replace(/\/$/, "");
  const basePath = new URL(base).pathname.replace(/\/$/, "");
  const prefix = basePath.endsWith(API_PREFIX) ? "" : API_PREFIX;
  return new URL(`${base}${prefix}${normalizedPath}`);
}

let memoryXsrfToken: string | undefined;

function getXsrfToken(): string | undefined {
  if (memoryXsrfToken) return memoryXsrfToken;
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

function unwrapApiData<T>(parsed: unknown, validate?: (data: unknown) => boolean | unknown): T {
  let data = parsed;
  if (parsed && typeof parsed === "object" && "success" in parsed && "data" in parsed) {
    data = (parsed as Record<string, unknown>).data;
  }
  if (validate) {
    const res = validate(data);
    if (res === false) {
      throw new TypeError("API response payload failed runtime type validation");
    }
    if (res !== true && res !== undefined) {
      return res as T;
    }
  }
  return data as T;
}

async function ensureCsrfToken(): Promise<void> {
  if (typeof window === "undefined" || getXsrfToken()) return;
  if (!csrfPromise) {
    csrfPromise = fetch(buildApiUrl("/auth/csrf").toString(), {
      method: "GET",
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new APIError("Unable to initialize CSRF token", response.status, null);
        }
        try {
          const data = await response.json();
          if (data && typeof data === "object" && "csrfToken" in data) {
            memoryXsrfToken = data.csrfToken as string;
          } else if (data && data.data && typeof data.data === "object" && "csrfToken" in data.data) {
            memoryXsrfToken = data.data.csrfToken as string;
          }
        } catch (e) {
          // ignore parsing error
        }
      })
      .finally(() => {
        csrfPromise = null;
      });
  }
  await csrfPromise;
}

function isMutatingMethod(method?: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes((method || "GET").toUpperCase());
}

function isCsrfEndpoint(path: string): boolean {
  return path === "/auth/csrf" || path === "auth/csrf";
}
// isVercelPreview reserved for future deployment-aware routing
void isVercelPreview;

export const apiClient = {
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (isMutatingMethod(options.method) && !isCsrfEndpoint(path)) {
      await ensureCsrfToken();
    }

    const url = buildApiUrl(path);

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

    if (typeof window !== "undefined") {
      // Attach Guest Session ID for Cart identification
      const guestSessionId = localStorage.getItem("ink_cart_session_id");
      if (guestSessionId) {
        headers.set("x-cart-session-id", guestSessionId);
      }
    }

    const xsrfToken = getXsrfToken();
    if (xsrfToken) {
      headers.set("X-XSRF-TOKEN", xsrfToken);
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
      if (
        response.status === 401 &&
        path !== "/auth/refresh" &&
        path !== "/auth/login" &&
        !(options.body instanceof FormData)
      ) {
        if (typeof window !== "undefined" && localStorage.getItem("ink_logged_in") === "true") {
          if (!refreshPromise) {
            refreshPromise = (async () => {
              await ensureCsrfToken();
              const refreshUrl = buildApiUrl("/auth/refresh");
              const refreshXsrf = getXsrfToken();
              const refreshHeaders: Record<string, string> = {
                "Content-Type": "application/json",
              };
              if (refreshXsrf) {
                refreshHeaders["X-XSRF-TOKEN"] = refreshXsrf;
              }
              const refreshRes = await fetch(refreshUrl.toString(), {
                method: "POST",
                headers: refreshHeaders,
                credentials: "include",
              });

              if (!refreshRes.ok) {
                if (typeof window !== "undefined") {
                  localStorage.removeItem("ink_logged_in");
                }
                throw new Error("Refresh failed");
              }
              // The backend rotates the httpOnly access_token cookie; no token
              // is returned in the response body and none is stored in memory.
            })().finally(() => {
              refreshPromise = null;
            });
          }

          try {
            await refreshPromise;
          } catch (err) {
            console.error("Token rotation failed inside interceptor:", err);
            // Let it fall through to returning 401
          }

          try {
            const retryConfig: RequestInit = { ...options, headers, credentials: "include" };
            const retryResponse = await fetch(url.toString(), retryConfig);
            if (retryResponse.ok) {
              if (retryResponse.status === 204) {
                return null as T;
              }
              const parsed = await retryResponse.json();
              if (parsed && typeof parsed === "object" && "csrfToken" in parsed) {
                memoryXsrfToken = parsed.csrfToken as string;
              } else if (parsed && parsed.data && typeof parsed.data === "object" && "csrfToken" in parsed.data) {
                memoryXsrfToken = parsed.data.csrfToken as string;
              }
              return unwrapApiData<T>(parsed, options.validate);
            }
          } catch (err) {
            console.error("Token rotation retry failed:", err);
          }
        }
      }

      let errorData: unknown;
      let textBody = "";
      try {
        textBody = await response.text();
        errorData = JSON.parse(textBody);
      } catch (err) {
        console.error("Failed to parse error JSON:", err);
        errorData = textBody || null;
      }

      let errorMessage = `API request failed with status ${response.status}`;
      if (errorData && typeof errorData === "object") {
        const payload = errorData as Record<string, unknown>;
        const rawMessage = payload.message;

        if (payload.success === false && Array.isArray(rawMessage)) {
          errorMessage = rawMessage.join("; ");
          const details = payload.details;
          if (details && typeof details === "object") {
            const detailMessages = (details as Record<string, unknown>).message;
            if (Array.isArray(detailMessages)) {
              errorMessage = [...rawMessage, ...(detailMessages as string[])].join("; ");
            }
          }
        } else if (typeof rawMessage === "string") {
          errorMessage = rawMessage;
        } else if (Array.isArray(rawMessage)) {
          errorMessage = rawMessage.join("; ");
        }
      }

      if (typeof window !== "undefined" && !options.silent) {
        if (response.status === 403) {
          toast.error("Access denied. You do not have permission.");
        } else if (response.status >= 400 && response.status < 500) {
          toast.error(errorMessage);
        } else if (response.status >= 500) {
          toast.error("Server error: " + errorMessage);
        }
      }

      throw new APIError(errorMessage, response.status, errorData);
    }

    if (response.status === 204) {
      return null as T;
    }

    try {
      const parsed = await response.json();
      if (parsed && typeof parsed === "object" && "csrfToken" in parsed) {
        memoryXsrfToken = parsed.csrfToken as string;
      } else if (parsed && parsed.data && typeof parsed.data === "object" && "csrfToken" in parsed.data) {
        memoryXsrfToken = parsed.data.csrfToken as string;
      }
      return unwrapApiData<T>(parsed, options.validate);
    } catch (err) {
      if (err instanceof TypeError || err instanceof APIError) {
        throw err;
      }
      if (err instanceof SyntaxError) {
        throw new APIError("Invalid JSON response from server", response.status, null);
      }
      throw err;
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

  delete<T = void>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  },
};
