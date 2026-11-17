import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupFileUrl, needsLookup } from './resolveClient';

afterEach(() => vi.unstubAllGlobals());

describe('needsLookup', () => {
    it('is true for Torrentio and TorBox api links only', () => {
        expect(needsLookup('https://torrentio.strem.fun/resolve/torbox/k/h/null/0/a.mkv')).toBe(true);
        expect(needsLookup('https://api.torbox.app/v1/api/torrents/requestdl?x=1')).toBe(true);
        expect(needsLookup('https://nexus-1.weur.tb-cdn.st/x')).toBe(false);
        expect(needsLookup('https://example.com/a.mp4')).toBe(false);
        expect(needsLookup('not a url')).toBe(false);
    });
});

describe('lookupFileUrl', () => {
    it('posts the link in the body and returns the file url', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({ url: 'https://n.tb-cdn.st/x' }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        await expect(lookupFileUrl('https://torrentio.strem.fun/a')).resolves.toBe('https://n.tb-cdn.st/x');
        const [path, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(path).toBe('/api/resolve');
        expect(init.method).toBe('POST');
        expect(JSON.parse(String(init.body))).toEqual({ url: 'https://torrentio.strem.fun/a' });
    });

    it('returns null when the lookup fails', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 502 })));
        await expect(lookupFileUrl('https://torrentio.strem.fun/a')).resolves.toBeNull();
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
        await expect(lookupFileUrl('https://torrentio.strem.fun/a')).resolves.toBeNull();
    });
});
