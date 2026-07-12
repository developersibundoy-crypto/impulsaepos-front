const DEFAULT_API_URL = "https://api.impulsaepos.com";

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");

const configuredApiUrl = "https://api.impulsaepos.com"

export const API_BASE_URL = normalizeBaseUrl(configuredApiUrl || DEFAULT_API_URL);
