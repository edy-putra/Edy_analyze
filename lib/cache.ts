// Cache & rate limit sederhana di memori.
// Di Vercel (serverless) sifatnya "best effort": hilang saat instance baru dibuat.
// Untuk produksi serius, ganti dengan Upstash Redis.

type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();
const hits = new Map<string, number[]>();

export function cacheGet<T>(key: string): T | null {
  const e = store.get(key);
  if (!e) return null;
  if (e.expires < Date.now()) {
    store.delete(key);
    return null;
  }
  return e.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs: number) {
  if (store.size > 200) {
    const first = store.keys().next().value;
    if (first) store.delete(first);
  }
  store.set(key, { value, expires: Date.now() + ttlMs });
}

/** true = boleh lanjut, false = kena batas. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
