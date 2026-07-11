const DEFAULT_API_PORT = "8000";

function buildLocalApiBaseUrl() {
  return `http://localhost:${DEFAULT_API_PORT}/api`;
}

function resolveApiBaseUrl() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${DEFAULT_API_PORT}/api`;
  }

  return buildLocalApiBaseUrl();
}

export const API_BASE_URL = resolveApiBaseUrl().replace(/\/$/, "");
