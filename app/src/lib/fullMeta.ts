// Some lists (search results especially) arrive bare: no description, rating or genres.
// For hover previews we fill the gaps from the full title info, through the addon cache.
import { useEffect, useState } from 'react';
import { withAddonCache } from '../core/addonCache';
import type { MetaPreview } from '../core/types';

const CINEMETA = 'https://v3-cinemeta.strem.io';
const cachedFetch = withAddonCache(fetch.bind(window));
const memory = new Map<string, Partial<MetaPreview> | null>();

const isSparse = (m: MetaPreview) => !m.description || !m.links?.length || !m.runtime;

async function fetchMeta(type: string, id: string): Promise<Partial<MetaPreview> | null> {
    const res = await cachedFetch(`${CINEMETA}/meta/${type}/${encodeURIComponent(id)}.json`);
    if (!res.ok) return null;
    const { meta } = await res.json();
    if (!meta) return null;
    return {
        description: meta.description ?? null,
        runtime: meta.runtime ?? null,
        releaseInfo: meta.releaseInfo ?? meta.year ?? null,
        logo: meta.logo ?? null,
        background: meta.background ?? null,
        links: Array.isArray(meta.links) ? meta.links : [],
    };
}

/** The item as given, upgraded with full details once they arrive. `loading` is true while fetching. */
export function useFullMeta(item: MetaPreview | undefined) {
    const key = item ? `${item.type}:${item.id}` : '';
    const needs = !!item && /^tt\d+$/.test(item.id) && isSparse(item);
    const [extra, setExtra] = useState<Partial<MetaPreview> | null | undefined>(() => (key ? memory.get(key) : undefined));

    useEffect(() => {
        if (!needs || !item) return;
        if (memory.has(key)) {
            setExtra(memory.get(key));
            return;
        }
        setExtra(undefined);
        let alive = true;
        fetchMeta(item.type, item.id)
            .catch(() => null)
            .then((m) => {
                memory.set(key, m);
                if (alive) setExtra(m);
            });
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, needs]);

    if (!item || !needs) return { meta: item, loading: false };
    if (!extra) return { meta: item, loading: extra === undefined };
    // Keep anything the list already had; take the rest from the full info.
    const merged: MetaPreview = {
        ...item,
        description: item.description || extra.description || null,
        runtime: item.runtime || extra.runtime || null,
        releaseInfo: item.releaseInfo || extra.releaseInfo || null,
        logo: item.logo || extra.logo || null,
        links: item.links?.length ? item.links : extra.links ?? [],
    };
    return { meta: merged, loading: false };
}
