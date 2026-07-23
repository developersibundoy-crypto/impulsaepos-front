const DEFAULT_API_URL = "http://localhost:4000";

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");

const configuredApiUrl = import.meta.env.VITE_API_URL;

export const API_BASE_URL = normalizeBaseUrl(configuredApiUrl || DEFAULT_API_URL);
