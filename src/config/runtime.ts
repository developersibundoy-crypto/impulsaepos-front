const DEFAULT_API_URL = "http://localhost:4000";

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");

const configuredApiUrl = import.meta.env.VITE_API_URL;

function resolveApiUrl(): string {
  if (typeof window !== "undefined") {
    const { hostname } = window.location;

    // Si se accede desde Cloudflare Tunnel, Dev Tunnels o red externa,
    // SIEMPRE usar ruta relativa "" para que el Reverse Proxy de Vite
    // enrute las peticiones al backend en este equipo, sin importar que .env diga localhost:4000
    if (
      hostname.includes(".trycloudflare.com") ||
      hostname.includes(".devtunnels.ms") ||
      hostname.includes(".loca.lt") ||
      (hostname !== "localhost" && hostname !== "127.0.0.1")
    ) {
      return "";
    }
  }

  if (configuredApiUrl) {
    return normalizeBaseUrl(configuredApiUrl);
  }

  return DEFAULT_API_URL;
}

export const API_BASE_URL = resolveApiUrl();
