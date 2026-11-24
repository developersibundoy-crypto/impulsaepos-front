const DEFAULT_API_URL = "http://localhost:4000";

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

function resolveApiUrl(): string {
  if (configuredApiUrl) {
    return normalizeBaseUrl(configuredApiUrl);
  }
  // Sin URL explícita, un proxy externo puede servir la API en el mismo origen.
  if (typeof window !== "undefined" && !["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) return "";
  return DEFAULT_API_URL;
}

export const API_BASE_URL = resolveApiUrl();
