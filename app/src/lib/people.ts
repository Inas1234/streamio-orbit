// Cast photos without any API key: the lead image of each actor's Wikipedia article.
// TMDB (if you add a key in Settings) is still used first because its data is richer.
import { useEffect, useState } from 'react';
import { cached, DAY } from './cache';

const API = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
// Words that show the article is about a performer, not someone else with the same name.
// Kept to screen work only: "singer" or "musician" alone matched rock stars who share an actor's name.
const PERFORMER = /\b(actor|actress|comedian|filmmaker|film director|screenwriter|television presenter|voice actor|stunt)/i;
const MAX_PARALLEL = 4;

type Summary = { type?: string; description?: string; extract?: string; thumbnail?: { source: string } };

async function summary(title: string): Promise<Summary | null> {
    const res = await fetch(API + encodeURIComponent(title.replace(/ /g, '_')) + '?redirect=true');
    if (!res.ok) return null;
    return res.json();
}

// Only the short description and first sentence: later sentences mention other people's jobs.
const isPerformer = (s: Summary | null) =>
    !!s && s.type !== 'disambiguation' && PERFORMER.test(`${s.description ?? ''} ${(s.extract ?? '').split('. ')[0]}`);

async function lookup(name: string): Promise<string | null> {
    const first = await summary(name).catch(() => null);
    if (isPerformer(first)) return first!.thumbnail?.source ?? null;
    // No article at all: the "(actor)" pages won't exist either.
    if (!first) return null;
    // An article about someone else with the same name: try the usual disambiguated titles.
    for (const title of [`${name} (actor)`, `${name} (actress)`]) {
        const s = await summary(title).catch(() => null);
        if (isPerformer(s)) return s!.thumbnail?.source ?? null;
    }
    return null;
}

// A small queue so a 15-person cast doesn't fire 15 requests at once.
let running = 0;
const waiting: (() => void)[] = [];
async function limited<T>(task: () => Promise<T>): Promise<T> {
    if (running >= MAX_PARALLEL) await new Promise<void>((r) => waiting.push(r));
    running++;
    try {
        return await task();
    } finally {
        running--;
        waiting.shift()?.();
    }
}

export function personPhoto(name: string) {
    return cached(`wiki.photo2.${name}`, 30 * DAY, () => limited(() => lookup(name)));
}

// ---- full cast lists from Wikidata (one query per title, keyless) ----

export type CastPerson = { name: string; character: string; photo: string | null | undefined };

const SPARQL = 'https://query.wikidata.org/sparql';
const MAX_CAST = 16;

async function wikidataCast(imdbId: string): Promise<{ name: string; character: string; photo: string | null }[]> {
    const query = `SELECT ?actor ?actorLabel ?image ?charLabel WHERE {
        ?film wdt:P345 "${imdbId}" .
        ?film p:P161 ?st . ?st ps:P161 ?actor .
        OPTIONAL { ?st pq:P453 ?char }
        OPTIONAL { ?actor wdt:P18 ?image }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 80`;
    const res = await fetch(`${SPARQL}?format=json&query=${encodeURIComponent(query)}`, { headers: { Accept: 'application/sparql-results+json' } });
    if (!res.ok) throw new Error(`Wikidata ${res.status}`);
    const json = await res.json();
    const seen = new Map<string, { name: string; character: string; photo: string | null }>();
    for (const b of json.results.bindings as Record<string, { value: string }>[]) {
        const id = b.actor.value;
        const name = b.actorLabel?.value ?? '';
        // Unlabelled items come back as their Q-number; skip those.
        if (!name || /^Q\d+$/.test(name)) continue;
        const prev = seen.get(id);
        // Commons can resize on the fly: ask for a small square-ish thumbnail.
        const photo = b.image ? `${b.image.value.replace(/^http:/, 'https:')}?width=180` : null;
        seen.set(id, {
            name,
            character: prev?.character || b.charLabel?.value || '',
            photo: prev?.photo ?? photo,
        });
    }
    return [...seen.values()];
}

/**
 * The fullest cast we can get without a key: Wikidata's list, with the stars Stremio
 * names placed first. Missing photos are filled in from Wikipedia, one by one.
 */
export function useCast(imdbId: string | null, starNames: string[], enabled: boolean): CastPerson[] {
    const starsKey = starNames.join('|');
    const [list, setList] = useState<CastPerson[]>([]);

    useEffect(() => {
        if (!enabled) {
            setList([]);
            return;
        }
        let alive = true;
        const stars = starsKey ? starsKey.split('|') : [];
        // Show the star names right away; the fuller list replaces them when it arrives.
        setList(stars.map((name) => ({ name, character: '', photo: undefined })));

        const fillMissing = (people: CastPerson[]) => {
            people.forEach((p, i) => {
                if (p.photo !== undefined) return;
                personPhoto(p.name)
                    .then((url) => alive && setList((cur) => cur.map((c, j) => (j === i && c.name === p.name ? { ...c, photo: url } : c))))
                    .catch(() => alive && setList((cur) => cur.map((c, j) => (j === i && c.name === p.name ? { ...c, photo: null } : c))));
            });
        };

        const load = imdbId ? cached(`wd.cast.${imdbId}`, 7 * DAY, () => wikidataCast(imdbId)) : Promise.resolve([]);
        load
            .catch(() => [])
            .then((wd) => {
                if (!alive) return;
                const byName = new Map(wd.map((p) => [p.name.toLowerCase(), p]));
                const merged: CastPerson[] = stars.map((name) => {
                    const hit = byName.get(name.toLowerCase());
                    byName.delete(name.toLowerCase());
                    return { name, character: hit?.character ?? '', photo: hit?.photo ?? undefined };
                });
                for (const p of byName.values()) merged.push({ ...p, photo: p.photo ?? undefined });
                const top = merged.slice(0, MAX_CAST);
                setList(top);
                fillMissing(top);
            });

        return () => {
            alive = false;
        };
    }, [imdbId, starsKey, enabled]);

    return list;
}
