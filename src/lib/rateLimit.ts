// Failed-login rate limiting behind a small store interface. The in-memory store is a per-process
// baseline; for multi-instance/serverless production, implement RateLimitStore over Redis and
// select it via RATE_LIMIT_DRIVER — call sites (auth.ts) stay unchanged.

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILURES = 5;

export interface RateLimitStore {
  isBlocked(key: string): boolean;
  recordFailure(key: string): void;
  clear(key: string): void;
}

type Bucket = { count: number; firstAt: number };

class InMemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, Bucket>();

  private prune(now: number) {
    for (const [key, b] of this.buckets) if (now - b.firstAt > WINDOW_MS) this.buckets.delete(key);
  }

  isBlocked(key: string): boolean {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b) return false;
    if (now - b.firstAt > WINDOW_MS) {
      this.buckets.delete(key);
      return false;
    }
    return b.count >= MAX_FAILURES;
  }

  recordFailure(key: string): void {
    const now = Date.now();
    if (this.buckets.size > 5000) this.prune(now);
    const b = this.buckets.get(key);
    if (!b || now - b.firstAt > WINDOW_MS) this.buckets.set(key, { count: 1, firstAt: now });
    else b.count++;
  }

  clear(key: string): void {
    this.buckets.delete(key);
  }
}

// Keep the store on globalThis so it survives Next dev route-bundle isolation.
const g = globalThis as unknown as { __cyberstarRateLimit?: RateLimitStore };
const store: RateLimitStore = (g.__cyberstarRateLimit ??= new InMemoryRateLimitStore());

export function isLoginBlocked(key: string): boolean {
  return store.isBlocked(key);
}
export function recordLoginFailure(key: string): void {
  store.recordFailure(key);
}
export function clearLoginFailures(key: string): void {
  store.clear(key);
}
