const DEFAULT_API_PORT = "8000";

function buildLocalApiBaseUrl() {
  return `http://localhost:${DEFAULT_API_PORT}/api`;
}

function resolveApiBaseUrl() {
  // Explicit override (recommended for Vercel) — must include protocol and optional /api
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // In browser: prefer the dedicated api subdomain when not developing locally
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;

    // Local development (localhost/127.0.0.1) -> use local backend port
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return buildLocalApiBaseUrl();
    }

    // Production / preview -> use api.metzscore.me on same protocol
    return `${protocol}//api.metzscore.me/api`;
  }

  // Fallback for non-browser environments
  return buildLocalApiBaseUrl();
}

export const API_BASE_URL = resolveApiBaseUrl().replace(/\/$/, "");
