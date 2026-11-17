/**
 * Finds the real file address behind a debrid stream link.
 *
 * TorBox links go Torrentio → api.torbox.app → a TorBox file server. Web pages may read the first and the
 * last, but api.torbox.app only lets torbox.app itself follow it. So the web version asks its own small
 * server function to follow those redirects. The movie itself never passes through that function: it stops
 * as soon as the next address is a file server.
 *
 * Shared by the Vercel function (api/resolve.ts) and the dev server (vite.config.ts).
 */

const LOOKUP_HOSTS = ['torrentio.strem.fun', 'api.torbox.app'];
const FILE_SERVER_DOMAINS = ['tb-cdn.st', 'tb-cdn.io'];
const MAX_HOPS = 5;

export class ResolveError extends Error {
    constructor(
        readonly status: 400 | 502,
        message: string,
    ) {
        super(message);
    }
}

const endsWithDomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

export function isFileServer(host: string) {
    return FILE_SERVER_DOMAINS.some((d) => endsWithDomain(host, d));
}

export function isAllowedHost(host: string) {
    return LOOKUP_HOSTS.includes(host) || isFileServer(host);
}

function parseAllowed(url: string, base?: string) {
    let parsed: URL;
    try {
        parsed = new URL(url, base);
    } catch {
        throw new ResolveError(400, 'Not a link');
    }
    if (parsed.protocol !== 'https:' || !isAllowedHost(parsed.hostname)) throw new ResolveError(400, 'Link not supported');
    return parsed;
}

export async function resolveLink(url: string, fetchFn: typeof fetch = fetch): Promise<string> {
    let current = parseAllowed(url);
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
        if (isFileServer(current.hostname)) return current.href;
        if (hop === MAX_HOPS) break;
        let res: Response;
        try {
            res = await fetchFn(current.href, { method: 'GET', redirect: 'manual' });
        } catch {
            throw new ResolveError(502, 'Source did not answer');
        }
        void res.body?.cancel().catch(() => {});
        const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
        if (!location) throw new ResolveError(502, 'Source did not give a file');
        current = parseAllowed(location, current.href);
    }
    throw new ResolveError(502, 'Too many redirects');
}

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** POST { url } → { url } with the file server's address. The link goes in the body so it stays out of request logs. */
export async function handleResolve(req: Request, fetchFn: typeof fetch = fetch): Promise<Response> {
    if (req.method !== 'POST') return json(405, { error: 'Use POST' });
    let url: unknown;
    try {
        url = ((await req.json()) as { url?: unknown })?.url;
    } catch {
        url = undefined;
    }
    if (typeof url !== 'string') return json(400, { error: 'Missing url' });
    try {
        return json(200, { url: await resolveLink(url, fetchFn) });
    } catch (e) {
        if (e instanceof ResolveError) return json(e.status, { error: e.message });
        return json(502, { error: 'Lookup failed' });
    }
}
