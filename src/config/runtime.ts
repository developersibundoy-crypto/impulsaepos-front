const DEFAULT_API_URL = import.meta.env.VITE_API_URL;

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export const API_BASE_URL = normalizeBaseUrl(configuredApiUrl || DEFAULT_API_URL);
