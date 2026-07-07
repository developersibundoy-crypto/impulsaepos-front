const CACHE_KEY = "pos_productos_cache";
const CACHE_META_KEY = "pos_productos_cache_meta";
const CACHE_DURATION_MS = 10 * 60 * 1000;

export interface ProductCacheMeta {
  timestamp: number;
  page: number;
  search: string;
  totalPages: number;
  totalRecords: number;
}

export function getCachedProducts(): { data: any[]; meta: ProductCacheMeta | null } {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const metaRaw = localStorage.getItem(CACHE_META_KEY);
    if (!raw) return { data: [], meta: null };
    return {
      data: JSON.parse(raw),
      meta: metaRaw ? JSON.parse(metaRaw) : null
    };
  } catch {
    return { data: [], meta: null };
  }
}

export function setCachedProducts(data: any[], page: number, search: string, totalPages: number, totalRecords: number): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_META_KEY, JSON.stringify({
      timestamp: Date.now(),
      page,
      search,
      totalPages,
      totalRecords
    }));
  } catch {
    /* localStorage may be full */
  }
}

export function isCacheValid(): boolean {
  try {
    const metaRaw = localStorage.getItem(CACHE_META_KEY);
    if (!metaRaw) return false;
    const meta: ProductCacheMeta = JSON.parse(metaRaw);
    return Date.now() - meta.timestamp < CACHE_DURATION_MS;
  } catch {
    return false;
  }
}

export function clearProductCache(): void {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_META_KEY);
}
