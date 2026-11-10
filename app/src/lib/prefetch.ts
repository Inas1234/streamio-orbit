// Asks addons for sources before you click, so the list is already there when you do.
// Results land in the shared addon cache that the engine reads from.
import { core } from '../core/core';
import { prefetchAddon } from '../core/addonCache';
import type { Ctx } from '../core/types';

type Resource = string | { name: string; types?: string[]; idPrefixes?: string[] };
type Manifest = { types?: string[]; idPrefixes?: string[]; resources?: Resource[] };

let addons: { transportUrl: string; manifest: Manifest }[] | null = null;
core.onState((models) => {
    if (models.includes('ctx')) addons = null;
});

async function installedAddons() {
    if (!addons) {
        const ctx = await core.getState<Ctx>('ctx');
        addons = ctx.profile.addons as unknown as { transportUrl: string; manifest: Manifest }[];
    }
    return addons;
}

function servesStreams(m: Manifest, type: string, id: string) {
    for (const r of m.resources ?? []) {
        const name = typeof r === 'string' ? r : r.name;
        if (name !== 'stream') continue;
        const types = (typeof r === 'object' && r.types) || m.types || [];
        const prefixes = (typeof r === 'object' && r.idPrefixes) || m.idPrefixes;
        if (!types.includes(type)) continue;
        if (prefixes && !prefixes.some((p) => id.startsWith(p))) continue;
        return true;
    }
    return false;
}

const done = new Set<string>();
const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 200));

/** Warm sources for one movie or episode, from every addon that can provide them. */
export function prefetchStreams(type: string, id: string) {
    const key = `${type}:${id}`;
    if (done.has(key)) return;
    done.add(key);
    // Forget after 15 minutes so a later visit can warm it again.
    setTimeout(() => done.delete(key), 15 * 60_000);
    idle(async () => {
        try {
            for (const a of await installedAddons()) {
                if (!servesStreams(a.manifest, type, id)) continue;
                const base = a.transportUrl.replace(/\/manifest\.json$/, '');
                void prefetchAddon(`${base}/stream/${type}/${encodeURIComponent(id)}.json`);
            }
        } catch {
            /* best effort */
        }
    });
}
