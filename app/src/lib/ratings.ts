// Rotten Tomatoes and Metacritic scores, keyless, from Wikidata's review-score records.
// Many films have them; TV shows often don't, in which case only IMDb is shown.
import { useEffect, useState } from 'react';
import { cached, DAY, peek } from './cache';

export type CriticScores = { rottenTomatoes: number | null; metacritic: number | null };

const SPARQL = 'https://query.wikidata.org/sparql';
const ROTTEN_TOMATOES = 'Q105584';
const METACRITIC = 'Q150248';

async function fetchScores(imdbId: string): Promise<CriticScores> {
    const query = `SELECT ?score ?by ?date ?methodLabel WHERE {
        ?film wdt:P345 "${imdbId}" .
        ?film p:P444 ?st . ?st ps:P444 ?score ; pq:P447 ?by .
        OPTIONAL { ?st pq:P585 ?date }
        OPTIONAL { ?st pq:P459 ?method }
        FILTER(?by IN (wd:${ROTTEN_TOMATOES}, wd:${METACRITIC}))
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`;
    const res = await fetch(`${SPARQL}?format=json&query=${encodeURIComponent(query)}`, { headers: { Accept: 'application/sparql-results+json' } });
    if (!res.ok) throw new Error(`Wikidata ${res.status}`);
    const rows = (await res.json()).results.bindings as Record<string, { value: string }>[];

    // Several records can exist over time; take the newest of each kind.
    const newest = (pick: (r: Record<string, { value: string }>) => number | null) =>
        rows
            .map((r) => ({ value: pick(r), date: r.date?.value ?? '' }))
            .filter((r): r is { value: number; date: string } => r.value !== null)
            .sort((a, b) => b.date.localeCompare(a.date))[0]?.value ?? null;

    return {
        // Tomatometer: a percentage (not the "8.6/10" average-rating records).
        rottenTomatoes: newest((r) => {
            if (!r.by.value.endsWith(ROTTEN_TOMATOES)) return null;
            if (r.methodLabel && !/tomatometer/i.test(r.methodLabel.value)) return null;
            const m = r.score.value.match(/^(\d{1,3})\s*%$/);
            return m ? Number(m[1]) : null;
        }),
        metacritic: newest((r) => {
            if (!r.by.value.endsWith(METACRITIC)) return null;
            const m = r.score.value.match(/^(\d{1,3})\s*\/\s*100$/);
            return m ? Number(m[1]) : null;
        }),
    };
}

export function useCriticScores(id: string | undefined): CriticScores | null {
    const key = id && /^tt\d+$/.test(id) ? `wd.scores.${id}` : null;
    const [scores, setScores] = useState<CriticScores | null>(() => (key ? peek<CriticScores>(key) ?? null : null));
    useEffect(() => {
        if (!key) {
            setScores(null);
            return;
        }
        let alive = true;
        setScores(peek<CriticScores>(key) ?? null);
        cached(key, 7 * DAY, () => fetchScores(id!))
            .then((s) => alive && setScores(s))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, [key, id]);
    return scores;
}
