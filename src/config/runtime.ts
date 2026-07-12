const configuredApiUrl = import.meta.env.VITE_API_URL;

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");

export const API_BASE_URL = configuredApiUrl
    ? normalizeBaseUrl(configuredApiUrl)
    : "";