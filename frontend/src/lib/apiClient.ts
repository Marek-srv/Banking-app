import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import { useAuthStore } from "@/stores/auth.store";

type BackendErrorEnvelope = {
  success?: false;
  error?: {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
};

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15_000,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<BackendErrorEnvelope>) => {
    const status = error.response?.status;
    const requestHadBearerToken = Boolean(error.config?.headers?.Authorization);
    const backendError = error.response?.data?.error;
    const code = typeof backendError?.code === "string"
      ? backendError.code
      : status === 429
        ? "RATE_LIMITED"
        : status === 503
          ? "SERVICE_UNAVAILABLE"
          : "REQUEST_FAILED";

    let message = typeof backendError?.message === "string"
      ? backendError.message
      : "We could not complete your request. Please try again.";

    if (!error.response) {
      message = "Unable to reach π Bank. Check your connection and try again.";
    } else if (status && status >= 500 && !backendError?.message) {
      message = "π Bank is temporarily unavailable. Please try again shortly.";
    }

    if (status === 401 && requestHadBearerToken) {
      useAuthStore.getState().clearSession();
    }

    return Promise.reject(
      new ApiClientError(code, message, status, backendError?.details),
    );
  },
);

export function getApiErrorMessage(error: unknown) {
  if (!(error instanceof ApiClientError)) {
    return "We could not complete your request. Please try again.";
  }

  if (error.code === "INVALID_REQUEST" && Array.isArray(error.details)) {
    const issue = error.details.find((detail): detail is { path?: unknown; message: string } =>
      typeof detail === "object" && detail !== null && "message" in detail &&
      typeof (detail as { message?: unknown }).message === "string"
    );
    if (issue) {
      const field = Array.isArray(issue.path) ? issue.path.join(".") : "request";
      return `${field}: ${issue.message}`;
    }
  }

  return error.message;
}
