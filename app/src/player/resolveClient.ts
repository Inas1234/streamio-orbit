/** Links whose redirects only a server may follow (see src/lib/resolveLink.ts). */
const LOOKUP_HOSTS = ['torrentio.strem.fun', 'api.torbox.app'];

export function needsLookup(url: string) {
    try {
        return LOOKUP_HOSTS.includes(new URL(url).hostname);
    } catch {
        return false;
    }
}

/** Asks this site's /api/resolve for the file server's address. Null when that doesn't work out. */
export async function lookupFileUrl(url: string): Promise<string | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
        const res = await fetch('/api/resolve', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url }),
            signal: ctrl.signal,
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { url?: unknown };
        return typeof body.url === 'string' ? body.url : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}
