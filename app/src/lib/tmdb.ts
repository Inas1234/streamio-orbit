// Cast photos and extra details from TMDB. Needs a free key (Settings → TMDB key).
// Results are cached for a week, so each title costs at most two requests.
import { useEffect, useState } from 'react';
import { cached, DAY, peek } from './cache';
import { getSettings, useSettings } from './settings';

const API = 'https://api.themoviedb.org/3';
export const tmdbImage = (path: string | null | undefined, size: 'w92' | 'w185' | 'h632' | 'w300' | 'w780' = 'w185') =>
    path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

export type CastMember = { id: number; name: string; character: string; photo: string | null };
export type TmdbDetails = {
    tmdbId: number;
    mediaType: 'movie' | 'tv';
    cast: CastMember[];
    certification: string | null;
    tagline: string | null;
};

async function get<T>(path: string): Promise<T> {
    const key = getSettings().tmdbKey.trim();
    const bearer = key.startsWith('eyJ');
    const url = `${API}${path}${path.includes('?') ? '&' : '?'}${bearer ? '' : `api_key=${encodeURIComponent(key)}`}`;
    const res = await fetch(url, bearer ? { headers: { Authorization: `Bearer ${key}` } } : undefined);
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    return res.json() as Promise<T>;
}

async function fetchDetails(imdbId: string, type: string): Promise<TmdbDetails | null> {
    const found = await get<{ movie_results: { id: number }[]; tv_results: { id: number }[] }>(
        `/find/${imdbId}?external_source=imdb_id`,
    );
    const isTv = type === 'series' || (!found.movie_results.length && found.tv_results.length > 0);
    const hit = isTv ? found.tv_results[0] : found.movie_results[0];
    if (!hit) return null;

    if (isTv) {
        const d = await get<any>(`/tv/${hit.id}?append_to_response=aggregate_credits,content_ratings`);
        const cert = d.content_ratings?.results?.find((r: any) => r.iso_3166_1 === 'US')?.rating || null;
        return {
            tmdbId: hit.id,
            mediaType: 'tv',
            certification: cert,
            tagline: d.tagline || null,
            cast: (d.aggregate_credits?.cast ?? []).slice(0, 20).map((c: any) => ({
                id: c.id,
                name: c.name,
                character: c.roles?.[0]?.character ?? '',
                photo: tmdbImage(c.profile_path),
            })),
        };
    }

    const d = await get<any>(`/movie/${hit.id}?append_to_response=credits,release_dates`);
    const us = d.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'US');
    const cert = us?.release_dates?.find((x: any) => x.certification)?.certification || null;
    return {
        tmdbId: hit.id,
        mediaType: 'movie',
        certification: cert,
        tagline: d.tagline || null,
        cast: (d.credits?.cast ?? []).slice(0, 20).map((c: any) => ({
            id: c.id,
            name: c.name,
            character: c.character ?? '',
            photo: tmdbImage(c.profile_path),
        })),
    };
}

export function useTmdbDetails(id: string | undefined, type: string | undefined) {
    const { tmdbKey } = useSettings();
    const key = id && /^tt\d+$/.test(id) ? `tmdb.${type}.${id}` : null;
    const [data, setData] = useState<TmdbDetails | null | undefined>(() => (key ? peek(key) : undefined));

    useEffect(() => {
        if (!key || !tmdbKey) {
            setData(undefined);
            return;
        }
        let alive = true;
        setData(peek(key));
        cached(key, 7 * DAY, () => fetchDetails(id!, type!))
            .then((d) => alive && setData(d))
            .catch(() => alive && setData(null));
        return () => {
            alive = false;
        };
    }, [key, tmdbKey, id, type]);

    return data;
}

export type Person = {
    id: number;
    name: string;
    biography: string;
    photo: string | null;
    knownFor: string;
    birthday: string | null;
    credits: { imdbId: string | null; tmdbId: number; type: 'movie' | 'series'; title: string; year: string; backdrop: string | null; poster: string | null; rating: number; character: string }[];
};

export function usePerson(personId: string | undefined) {
    const { tmdbKey } = useSettings();
    const [data, setData] = useState<Person | null | undefined>(undefined);
    useEffect(() => {
        if (!personId || !tmdbKey) return;
        let alive = true;
        cached(`tmdb.person.${personId}`, 7 * DAY, async () => {
            const p = await get<any>(`/person/${personId}?append_to_response=combined_credits`);
            const seen = new Set<number>();
            const credits = (p.combined_credits?.cast ?? [])
                .filter((c: any) => (c.media_type === 'movie' || c.media_type === 'tv') && !seen.has(c.id) && seen.add(c.id))
                .sort((a: any, b: any) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
                .slice(0, 40)
                .map((c: any) => ({
                    imdbId: null,
                    tmdbId: c.id,
                    type: c.media_type === 'tv' ? 'series' : 'movie',
                    title: c.title ?? c.name,
                    year: (c.release_date ?? c.first_air_date ?? '').slice(0, 4),
                    backdrop: tmdbImage(c.backdrop_path, 'w780'),
                    poster: tmdbImage(c.poster_path, 'w300'),
                    rating: Math.round((c.vote_average ?? 0) * 10) / 10,
                    character: c.character ?? '',
                }));
            return {
                id: p.id,
                name: p.name,
                biography: p.biography ?? '',
                photo: tmdbImage(p.profile_path, 'h632'),
                knownFor: p.known_for_department ?? '',
                birthday: p.birthday ?? null,
                credits,
            } satisfies Person;
        })
            .then((d) => alive && setData(d))
            .catch(() => alive && setData(null));
        return () => {
            alive = false;
        };
    }, [personId, tmdbKey]);
    return data;
}

/** TMDB credits don't carry IMDb ids; resolve one on click so we can open it with Stremio addons. */
export function resolveImdbId(tmdbId: number, type: 'movie' | 'series') {
    return cached(`tmdb.ext.${type}.${tmdbId}`, 30 * DAY, async () => {
        const r = await get<{ imdb_id: string | null }>(`/${type === 'series' ? 'tv' : 'movie'}/${tmdbId}/external_ids`);
        return r.imdb_id;
    });
}
