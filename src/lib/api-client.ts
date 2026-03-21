/**
 * Centralized API client with error handling and type safety
 */

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "APIError";
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
  timeout?: number;
  token?: string;
}

async function request<T>(
  endpoint: string,
  { params, timeout = 30000, token, ...options }: RequestOptions = {}
): Promise<T> {
  const url = new URL(endpoint, window.location.origin);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url.toString(), {
      ...options,
      signal: controller.signal,
      headers,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new APIError(
        error.message || `Request failed with status ${response.status}`,
        response.status,
        error.code,
        error.details
      );
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof APIError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new APIError("Request timeout", 408);
    }
    throw new APIError("Network error", 0);
  }
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "GET" }),
  
  post: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "POST", body: JSON.stringify(data) }),
  
  put: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "PUT", body: JSON.stringify(data) }),
  
  patch: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "PATCH", body: JSON.stringify(data) }),
  
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),
};
