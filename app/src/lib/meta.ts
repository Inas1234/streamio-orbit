import type { Link, MetaPreview, Stream, Video } from '../core/types';

const METAHUB = 'https://images.metahub.space';
const isImdb = (id: string) => /^tt\d+$/.test(id);

type Size = 'small' | 'medium' | 'large';

/** Wide artwork for landscape cards and the hero. Falls back to the poster. */
export function backdrop(item: Pick<MetaPreview, 'id' | 'background' | 'poster'>, size: Size = 'medium') {
    if (isImdb(item.id)) return `${METAHUB}/background/${size}/${item.id}/img`;
    return item.background || item.poster || null;
}

export function poster(item: Pick<MetaPreview, 'id' | 'poster'>, size: Size = 'medium') {
    if (item.poster && item.poster.startsWith(METAHUB)) {
        return item.poster.replace(/\/poster\/(small|medium|large)\//, `/poster/${size}/`);
    }
    return item.poster;
}

export function logo(item: Pick<MetaPreview, 'id' | 'logo'>) {
    if (item.logo) return item.logo;
    return isImdb(item.id) ? `${METAHUB}/logo/medium/${item.id}/img` : null;
}

const byCategory = (links: Link[] | undefined, ...cats: string[]) =>
    (links ?? []).filter((l) => cats.includes(l.category.toLowerCase()));

export function imdbRating(links?: Link[]) {
    const r = byCategory(links, 'imdb')[0]?.name;
    return r && /^\d/.test(r) ? r : null;
}

export const genres = (links?: Link[]) => byCategory(links, 'genres', 'genre').map((l) => l.name);
export const castNames = (links?: Link[]) => byCategory(links, 'cast').map((l) => l.name);
export const directors = (links?: Link[]) => byCategory(links, 'directors', 'director').map((l) => l.name);
export const writers = (links?: Link[]) => byCategory(links, 'writers', 'writer').map((l) => l.name);

export function seasons(videos: Video[]) {
    const set = new Set<number>();
    for (const v of videos) if (typeof v.season === 'number') set.add(v.season);
    // Specials (season 0) go last.
    return [...set].sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : a - b));
}

// ---- streams ----

export type StreamInfo = {
    quality: string | null;
    rank: number;
    size: string | null;
    seeds: number | null;
    title: string;
};

const QUALITY: [RegExp, string, number][] = [
    [/2160p|\b4k\b|uhd/i, '4K', 4],
    [/1080p|fhd/i, '1080p', 3],
    [/720p/i, '720p', 2],
    [/480p|\bsd\b/i, '480p', 1],
];

export function streamInfo(stream: Stream): StreamInfo {
    const text = `${stream.name ?? ''}\n${stream.title ?? ''}\n${stream.description ?? ''}`;
    const q = QUALITY.find(([re]) => re.test(text));
    const size = text.match(/(\d+(?:\.\d+)?\s?(?:GB|MB))/i)?.[1] ?? null;
    const seeds = text.match(/👤\s?(\d+)/)?.[1] ?? text.match(/seed(?:er)?s?:?\s?(\d+)/i)?.[1];
    const title = (stream.title ?? stream.description ?? stream.name ?? '').split('\n')[0];
    return {
        quality: q?.[1] ?? null,
        rank: q?.[2] ?? 0,
        size,
        seeds: seeds ? Number(seeds) : null,
        title,
    };
}

export function formatTime(seconds: number) {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const mm = h ? String(m).padStart(2, '0') : String(m);
    return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

export function timeLeft(offsetMs: number, durationMs: number) {
    const min = Math.round((durationMs - offsetMs) / 60000);
    if (min <= 0) return null;
    return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m left` : `${min}m left`;
}
