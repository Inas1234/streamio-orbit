// A cache for addon answers, shared by the engine's worker and the page (Cache Storage).
//
// The Stremio engine asks every addon again on each visit. Here:
//   - sources (streams) are reused for 20 minutes, so reopening a title or episode is instant;
//   - catalogs and title info are returned from cache immediately and refreshed in the
//     background ("stale while revalidate"), so the home screen paints at once on startup;
//   - the page can warm this cache ahead of time (next episode, hovered titles).

type Rule = { match: RegExp; fresh: number; stale: number };

const MIN = 60_000;
const RULES: Rule[] = [
    { match: /\/stream\/[^/]+\/[^/]+\.json$/, fresh: 20 * MIN, stale: 0 },
    { match: /\/subtitles\/[^/]+\/.+\.json$/, fresh: 60 * MIN, stale: 0 },
    { match: /\/catalog\/[^/]+\/.+\.json$/, fresh: 15 * MIN, stale: 24 * 60 * MIN },
    { match: /\/meta\/[^/]+\/[^/]+\.json$/, fresh: 6 * 60 * MIN, stale: 7 * 24 * 60 * MIN },
];
const LONGEST = Math.max(...RULES.map((r) => r.fresh + r.stale));
const CACHE_NAME = 'watch-addons-v1';
const STAMP = 'x-watch-cached-at';

// Addons and the engine may encode the same id differently (":" vs "%3A"); key on the decoded URL.
const keyFor = (url: string) => {
    let decoded = url;
    try {
        decoded = decodeURIComponent(url);
    } catch {
        /* keep as is */
    }
    return `https://watch.cache/${encodeURIComponent(decoded)}`;
};

const ruleFor = (url: string) => {
    if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) return null; // streaming server: never cache
    const path = url.split('?')[0];
    return RULES.find((r) => r.match.test(path)) ?? null;
};

let cachePromise: Promise<Cache> | null = null;
const openCache = () => (cachePromise ??= caches.open(CACHE_NAME));

const inflight = new Map<string, Promise<Response>>();

async function fetchAndStore(doFetch: () => Promise<Response>, key: string): Promise<Response> {
    const running = inflight.get(key);
    if (running) return (await running).clone();
    const p = (async () => {
        const res = await doFetch();
        if (res.ok) {
            const body = await res.clone().arrayBuffer();
            const headers = new Headers(res.headers);
            headers.set(STAMP, String(Date.now()));
            const cache = await openCache();
            await cache.put(key, new Response(body, { status: res.status, statusText: res.statusText, headers }));
        }
        return res;
    })().finally(() => inflight.delete(key));
    inflight.set(key, p);
    return (await p).clone();
}

/** Wraps `fetch` so addon GET requests go through the cache. Everything else passes straight through. */
export function withAddonCache(realFetch: typeof fetch): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit) => {
        // Read method and URL without building a new Request: copying a Request that has a body
        // (sign-in, library sync) marks the original as used, and the real fetch then fails.
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        const url = input instanceof Request ? input.url : String(input);
        const rule = method === 'GET' ? ruleFor(url) : null;
        if (!rule) return realFetch(input, init);
        const request = new Request(input, init);

        const key = keyFor(request.url);
        try {
            const cache = await openCache();
            const hit = await cache.match(key);
            if (hit) {
                const age = Date.now() - Number(hit.headers.get(STAMP) ?? 0);
                if (age < rule.fresh) return hit;
                if (age < rule.fresh + rule.stale) {
                    // Serve the saved copy now; refresh quietly for next time.
                    void fetchAndStore(() => realFetch(request.clone()), key).catch(() => {});
                    return hit;
                }
            }
        } catch {
            // Cache Storage unavailable: fall through to the network.
        }
        return fetchAndStore(() => realFetch(request), key);
    };
}

/** Warms the cache for a URL (ignored if it's already fresh). */
export async function prefetchAddon(url: string) {
    const rule = ruleFor(url);
    if (!rule) return;
    const key = keyFor(url);
    const cache = await openCache();
    const hit = await cache.match(key);
    if (hit && Date.now() - Number(hit.headers.get(STAMP) ?? 0) < rule.fresh) return;
    await fetchAndStore(() => fetch(url), key).catch(() => {});
}

/** Drops entries older than any rule allows. Runs once at startup. */
export async function pruneAddonCache() {
    try {
        const cache = await openCache();
        const now = Date.now();
        for (const req of await cache.keys()) {
            const res = await cache.match(req);
            if (!res || now - Number(res.headers.get(STAMP) ?? 0) > LONGEST) await cache.delete(req);
        }
    } catch {
        /* ignore */
    }
}
