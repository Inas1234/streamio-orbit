// Everything you've saved or played, read straight from the engine's saved library.
// The engine's own library list hides titles you played without adding them ("temp" items),
// so My List reads the storage itself to show watch history too.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { core } from '../core/core';
import { withAddonCache } from '../core/addonCache';
import type { LibraryItem } from '../core/types';
import { timeLeft } from './meta';

// ---- the saved library ----

type Bucket = { items?: Record<string, LibraryItem> };

function readLibrary(): LibraryItem[] {
    const byId = new Map<string, LibraryItem>();
    // The engine splits the library in two: recently changed titles and the rest.
    for (const key of ['library', 'library_recent']) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const bucket = JSON.parse(raw) as Bucket;
            for (const item of Object.values(bucket.items ?? {})) {
                const prev = byId.get(item._id);
                if (!prev || (item._mtime ?? '') > (prev._mtime ?? '')) byId.set(item._id, item);
            }
        } catch {
            // Unreadable bucket: show what we can.
        }
    }
    return [...byId.values()];
}

let snapshot: LibraryItem[] | null = null;
const listeners = new Set<() => void>();
let refreshTimer = 0;
core.onLibraryStored(() => {
    // Both buckets are usually written back to back: re-read once.
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
        snapshot = null;
        listeners.forEach((l) => l());
    }, 150);
});

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => void listeners.delete(l);
};
const getSnapshot = () => (snapshot ??= readLibrary());

/** Every library entry, including titles that were only played. */
export const useFullLibrary = () => useSyncExternalStore(subscribe, getSnapshot);

// ---- simple facts ----

/** On My List (added with +). */
export const isSaved = (item: LibraryItem) => !item.removed;

/** Was ever actually played or marked watched (opening the player alone doesn't count). */
export function wasPlayed(item: LibraryItem, series?: SeriesProgress | null) {
    const st = item.state;
    if (!st) return false;
    return (st.overallTimeWatched ?? 0) > 0 || st.timesWatched > 0 || (st.flaggedWatched ?? 0) > 0 || st.timeOffset > 0 || (series?.watched ?? 0) > 0;
}

/** Titles you removed from My List on purpose stay out of Continue watching, like in Stremio. */
export const showsInContinue = (item: LibraryItem) => !item.removed || !!item.temp;

export const lastWatchedAt = (item: LibraryItem) => Date.parse(item.state?.lastWatched ?? '') || Date.parse(item._mtime ?? '') || 0;
export const addedAt = (item: LibraryItem) => Date.parse(item._ctime ?? '') || Date.parse(item._mtime ?? '') || 0;

// ---- how much of a show is watched ----

export type SeriesProgress = { watched: number; total: number };

const CINEMETA = 'https://v3-cinemeta.strem.io';
const cachedFetch = withAddonCache(fetch.bind(window));

type Ep = { id: string; regular: boolean; out: boolean };

const episodeLists = new Map<string, Promise<Ep[] | null>>();
/** The show's episodes in the order the engine numbers them. */
function episodes(id: string): Promise<Ep[] | null> {
    let p = episodeLists.get(id);
    if (!p) {
        p = limit(async () => {
            const res = await cachedFetch(`${CINEMETA}/meta/series/${encodeURIComponent(id)}.json`);
            if (!res.ok) return null;
            const { meta } = await res.json();
            if (!Array.isArray(meta?.videos)) return null;
            const now = Date.now();
            type V = { id: string; season?: number; episode?: number; released?: string };
            // The engine numbers episodes sorted by season then episode (specials, season 0, first);
            // the addon's own list can be slightly out of order.
            return [...(meta.videos as V[])]
                .sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0))
                .map((v) => ({ id: v.id, regular: v.season !== 0, out: !v.released || Date.parse(v.released) <= now }));
        }).catch(() => null);
        episodeLists.set(id, p);
    }
    return p;
}

/** Unpacks the engine's watched-episodes field into a list of flags. */
async function unpackWatched(packed: string): Promise<{ anchor: string; anchorLength: number; bits: Uint8Array } | null> {
    const last = packed.lastIndexOf(':');
    const prev = packed.lastIndexOf(':', last - 1);
    if (last < 0 || prev < 0) return null;
    const anchor = packed.slice(0, prev);
    const anchorLength = Number(packed.slice(prev + 1, last));
    const raw = Uint8Array.from(atob(packed.slice(last + 1)), (c) => c.charCodeAt(0));
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate'));
    const bits = new Uint8Array(await new Response(stream).arrayBuffer());
    return { anchor, anchorLength, bits };
}

async function computeSeries(item: LibraryItem): Promise<SeriesProgress | null> {
    const eps = await episodes(item._id);
    if (!eps) return null;
    const released = eps.filter((e) => e.regular && e.out).length;
    let watched = 0;
    if (item.state?.watched) {
        const w = await unpackWatched(item.state.watched).catch(() => null);
        if (w) {
            // The flags are numbered from when they were saved; if episodes were added since,
            // the last-watched episode ("anchor") tells us how far to shift them.
            const anchorIdx = eps.findIndex((e) => e.id === w.anchor);
            const shift = anchorIdx >= 0 ? w.anchorLength - 1 - anchorIdx : 0;
            eps.forEach((e, i) => {
                const j = i + shift;
                if (e.regular && e.out && j >= 0 && (w.bits[j >> 3] ?? 0) & (1 << (j & 7))) watched++;
            });
        }
    }
    return { watched: Math.min(watched, released), total: released };
}

const seriesResults = new Map<string, SeriesProgress | null>();
const seriesPending = new Set<string>();
const seriesListeners = new Set<() => void>();
const seriesKey = (item: LibraryItem) => `${item._id}|${item.state?.watched ?? ''}`;

/** Episode counts for the shows in `items`, filled in as they load. */
export function useSeriesProgress(items: LibraryItem[]) {
    const [, bump] = useState(0);
    useEffect(() => {
        let timer = 0;
        // Many shows finish together: redraw at most a few times a second.
        const onResult = () => {
            if (!timer) timer = window.setTimeout(() => ((timer = 0), bump((n) => n + 1)), 120);
        };
        seriesListeners.add(onResult);
        return () => {
            seriesListeners.delete(onResult);
            window.clearTimeout(timer);
        };
    }, []);
    useEffect(() => {
        for (const item of items) {
            if (item.type !== 'series' || !/^tt\d+$/.test(item._id)) continue;
            const key = seriesKey(item);
            if (seriesResults.has(key) || seriesPending.has(key)) continue;
            seriesPending.add(key);
            void computeSeries(item)
                .catch(() => null)
                .then((r) => {
                    seriesResults.set(key, r);
                    seriesPending.delete(key);
                    seriesListeners.forEach((l) => l());
                });
        }
    }, [items]);
    return (item: LibraryItem) => seriesResults.get(seriesKey(item));
}

// Show lists are fetched a few at a time so a big library doesn't flood the network.
let running = 0;
const waiting: (() => void)[] = [];
async function limit<T>(task: () => Promise<T>): Promise<T> {
    if (running >= 4) await new Promise<void>((r) => waiting.push(r));
    running++;
    try {
        return await task();
    } finally {
        running--;
        waiting.shift()?.();
    }
}

// ---- one status per title ----

export type WatchStatus = {
    state: 'new' | 'progress' | 'done';
    /** 0–1, how much of the movie or show is behind you. */
    fraction: number;
    /** Short line for under the poster, e.g. "38m left" or "12 episodes left". */
    label: string | null;
};

export function watchStatus(item: LibraryItem, series: SeriesProgress | null | undefined): WatchStatus {
    const st = item.state;
    const offset = st?.timeOffset ?? 0;
    const duration = st?.duration ?? 0;
    const flagged = (st?.flaggedWatched ?? 0) > 0;

    if (item.type === 'series') {
        if (series && series.total > 0) {
            const left = series.total - series.watched;
            if (left <= 0) return { state: 'done', fraction: 1, label: 'Watched' };
            if (series.watched > 0 || offset > 0) {
                return { state: 'progress', fraction: series.watched / series.total, label: `${left} episode${left === 1 ? '' : 's'} left` };
            }
            if (flagged) return { state: 'done', fraction: 1, label: 'Watched' };
            return { state: 'new', fraction: 0, label: `${series.total} episodes` };
        }
        // Episode count not known (still loading, or not a Cinemeta show).
        if (flagged) return { state: 'done', fraction: 1, label: 'Watched' };
        const ep = st?.video_id?.match(/:(\d+):(\d+)$/);
        if (offset > 0 || ep) return { state: 'progress', fraction: duration > 0 ? offset / duration : 0, label: ep ? `S${ep[1]} · E${ep[2]}` : null };
        return { state: 'new', fraction: 0, label: null };
    }

    if (offset > 0 && duration > 0) return { state: 'progress', fraction: offset / duration, label: timeLeft(offset, duration) };
    if ((st?.timesWatched ?? 0) > 0 || flagged) return { state: 'done', fraction: 1, label: 'Watched' };
    return { state: 'new', fraction: 0, label: null };
}
