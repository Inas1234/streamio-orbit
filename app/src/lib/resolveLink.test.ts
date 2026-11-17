import { describe, expect, it } from 'vitest';
import { handleResolve, isAllowedHost, resolveLink, ResolveError } from './resolveLink';

const CDN = 'https://nexus-1.weur.tb-cdn.st/x';

/** A fake fetch that answers each URL from a script and records what was requested. */
function scripted(answers: Record<string, { status: number; location?: string }>) {
    const calls: string[] = [];
    const fn = (async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        const a = answers[url];
        if (!a) throw new Error(`unexpected fetch ${url}`);
        return new Response(null, { status: a.status, headers: a.location ? { location: a.location } : {} });
    }) as typeof fetch;
    return { fn, calls };
}

describe('resolveLink', () => {
    it('follows torrentio → torbox api → tb-cdn and returns the cdn url', async () => {
        const { fn, calls } = scripted({
            'https://torrentio.strem.fun/resolve/torbox/k/h/null/0/a.mkv': { status: 302, location: 'https://api.torbox.app/v1/api/torrents/requestdl?token=k&redirect=true' },
            'https://api.torbox.app/v1/api/torrents/requestdl?token=k&redirect=true': { status: 307, location: CDN },
        });
        await expect(resolveLink('https://torrentio.strem.fun/resolve/torbox/k/h/null/0/a.mkv', fn)).resolves.toBe(CDN);
        expect(calls).not.toContain(CDN);
    });

    it('resolves a relative redirect against the current url', async () => {
        const { fn } = scripted({
            'https://torrentio.strem.fun/a': { status: 302, location: '/b' },
            'https://torrentio.strem.fun/b': { status: 302, location: CDN },
        });
        await expect(resolveLink('https://torrentio.strem.fun/a', fn)).resolves.toBe(CDN);
    });

    it('rejects a start url outside the allowlist', async () => {
        const { fn, calls } = scripted({});
        await expect(resolveLink('https://evil.example/x', fn)).rejects.toMatchObject({ status: 400 });
        expect(calls).toHaveLength(0);
    });

    it('rejects a redirect to a host outside the allowlist', async () => {
        const { fn } = scripted({ 'https://torrentio.strem.fun/a': { status: 302, location: 'http://169.254.169.254/latest' } });
        await expect(resolveLink('https://torrentio.strem.fun/a', fn)).rejects.toMatchObject({ status: 400 });
    });

    it('gives up after 5 hops', async () => {
        const answers: Record<string, { status: number; location: string }> = {};
        for (let i = 0; i < 10; i++) answers[`https://torrentio.strem.fun/${i}`] = { status: 302, location: `https://torrentio.strem.fun/${i + 1}` };
        const { fn } = scripted(answers);
        await expect(resolveLink('https://torrentio.strem.fun/0', fn)).rejects.toMatchObject({ status: 502 });
    });

    it('a non-redirect answer before the file server is a 502', async () => {
        const { fn } = scripted({ 'https://torrentio.strem.fun/a': { status: 200 } });
        const err = await resolveLink('https://torrentio.strem.fun/a', fn).catch((e) => e);
        expect(err).toBeInstanceOf(ResolveError);
        expect(err.status).toBe(502);
    });

    it('returns a file-server url without fetching it', async () => {
        const { fn, calls } = scripted({});
        await expect(resolveLink(CDN, fn)).resolves.toBe(CDN);
        expect(calls).toHaveLength(0);
    });
});

describe('isAllowedHost', () => {
    it('allows TorBox file servers and rejects look-alikes', () => {
        expect(isAllowedHost('a.b.tb-cdn.io')).toBe(true);
        expect(isAllowedHost('nexus-419.weur.tb-cdn.st')).toBe(true);
        expect(isAllowedHost('tb-cdn.st.evil.com')).toBe(false);
        expect(isAllowedHost('eviltb-cdn.st')).toBe(false);
        expect(isAllowedHost('torrentio.strem.fun')).toBe(true);
    });
});

describe('handleResolve', () => {
    it('only accepts POST', async () => {
        const res = await handleResolve(new Request('https://x.test/api/resolve'));
        expect(res.status).toBe(405);
    });

    it('rejects a body without a url', async () => {
        const res = await handleResolve(new Request('https://x.test/api/resolve', { method: 'POST', body: '{"nope":1}' }));
        expect(res.status).toBe(400);
    });

    it('answers with the file url and no caching', async () => {
        const res = await handleResolve(new Request('https://x.test/api/resolve', { method: 'POST', body: JSON.stringify({ url: CDN }) }));
        expect(res.status).toBe(200);
        expect(res.headers.get('cache-control')).toBe('no-store');
        await expect(res.json()).resolves.toEqual({ url: CDN });
    });
});
