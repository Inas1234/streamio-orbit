import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { core } from '../core/core';
import { useModel } from '../core/useModel';
import type { Search as SearchModel } from '../core/types';
import { SearchIcon } from '../components/Icons';
import { Card } from '../components/Card';
import { previewCard } from '../lib/cards';
import s from './Search.module.css';

export function Search() {
    const [params, setParams] = useSearchParams();
    const query = params.get('q') ?? '';
    const [text, setText] = useState(query);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Debounce typing so we only query addons once you pause.
    useEffect(() => {
        if (text === query) return;
        const t = window.setTimeout(() => setParams(text ? { q: text } : {}, { replace: true }), 350);
        return () => window.clearTimeout(t);
    }, [text, query, setParams]);

    const load = useMemo(
        () => (query.trim() ? { action: 'Load', args: { model: 'CatalogsWithExtra', args: { extra: [['search', query.trim()]] } } } : { action: 'Unload' }),
        [query],
    );
    const search = useModel<SearchModel>('search', { load, unloadOnExit: true });

    useEffect(() => {
        if (query.trim()) void core.dispatch({ action: 'CatalogsWithExtra', args: { action: 'LoadRange', args: { start: 0, end: 50 } } }, 'search');
    }, [query]);

    const results = useMemo(() => {
        if (!search?.selected) return null;
        const seen = new Set<string>();
        const groups: { type: string; items: ReturnType<typeof previewCard>[] }[] = [];
        for (const c of search.catalogs) {
            if (c.content?.type !== 'Ready') continue;
            for (const m of c.content.content) {
                const key = `${m.type}:${m.id}`;
                if (seen.has(key)) continue;
                seen.add(key);
                let g = groups.find((x) => x.type === m.type);
                if (!g) groups.push((g = { type: m.type, items: [] }));
                g.items.push(previewCard(m, 'poster'));
            }
        }
        return groups;
    }, [search]);

    const stillLoading = search?.catalogs.some((c) => !c.content || c.content.type === 'Loading');

    return (
        <main className="page page-pad">
            <label className={s.box}>
                <SearchIcon size={22} />
                <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Movies, shows, actors…" aria-label="Search" />
                {stillLoading && query && <span className={s.spinner} aria-label="Searching" />}
            </label>

            {!query && <p className="empty">Search across every addon you have installed.</p>}

            {results?.map((g) => (
                <section key={g.type} className={s.group}>
                    <h2 className={s.h2}>{g.type === 'movie' ? 'Movies' : g.type === 'series' ? 'Series' : g.type}</h2>
                    <div className={s.grid}>
                        {g.items.map((c) => (
                            <Card key={c.key} data={c} shape="poster" />
                        ))}
                    </div>
                </section>
            ))}
            {query && results && results.length === 0 && !stillLoading && <p className="empty">Nothing found for "{query}".</p>}
        </main>
    );
}
