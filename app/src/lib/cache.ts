// Tiny persistent cache: memory first, then localStorage, each entry with an expiry.
type Entry<T> = { v: T; e: number };

const PREFIX = 'watch.cache.';
const memory = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function read<T>(key: string): T | undefined {
    const now = Date.now();
    const hit = memory.get(key) as Entry<T> | undefined;
    if (hit) return hit.e > now ? hit.v : undefined;
    try {
        const raw = localStorage.getItem(PREFIX + key);
        if (!raw) return undefined;
        const entry = JSON.parse(raw) as Entry<T>;
        if (entry.e <= now) {
            localStorage.removeItem(PREFIX + key);
            return undefined;
        }
        memory.set(key, entry);
        return entry.v;
    } catch {
        return undefined;
    }
}

function write<T>(key: string, value: T, ttlMs: number) {
    const entry = { v: value, e: Date.now() + ttlMs };
    memory.set(key, entry);
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch {
        // Storage full or blocked: keep the in-memory copy only.
    }
}

/** Returns the cached value or runs `load` once, sharing the promise between concurrent callers. */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const hit = read<T>(key);
    if (hit !== undefined) return hit;
    const running = inflight.get(key) as Promise<T> | undefined;
    if (running) return running;
    const p = load()
        .then((value) => {
            write(key, value, ttlMs);
            return value;
        })
        .finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
}

export function peek<T>(key: string): T | undefined {
    return read<T>(key);
}

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
