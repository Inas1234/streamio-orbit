import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { core } from '../core/core';
import { useModel } from '../core/useModel';
import type { Addon, Loadable, MetaPreview, ResourcePath } from '../core/types';
import { Card, CardSkeleton } from '../components/Card';
import { Dropdown, type Option } from '../components/Dropdown';
import { SearchIcon } from '../components/Icons';
import { previewCard } from '../lib/cards';
import s from './Browse.module.css';

const CINEMETA = 'https://v3-cinemeta.strem.io/manifest.json';

type Selectable = {
    catalogs: { id: string; name: string; type: string; selected: boolean; addon?: Addon; deepLinks: { discover: string } }[];
    extra: { name: string; isRequired: boolean; options: { value: string | null; selected: boolean; deepLinks: { discover: string } }[] }[];
    types: { type: string; selected: boolean; deepLinks: { discover: string } }[];
    nextPage: boolean;
};

type Discover = {
    catalog: { content: Loadable<MetaPreview[]> } | null;
    selectable: Selectable;
    selected: { request: { base: string; path: ResourcePath } } | null;
};

/** Turns the engine's "#/discover/<addon>/<type>/<catalog>?extra" links into this app's URLs. */
function toHref(deepLink: string) {
    const m = deepLink.match(/^#\/discover\/([^/]+)\/([^/]+)\/([^?]+)\??(.*)$/);
    if (!m) return null;
    const [, base, type, catalog, query] = m;
    const params = new URLSearchParams(query);
    params.set('src', decodeURIComponent(base));
    params.set('catalog', decodeURIComponent(catalog));
    return `/discover/${type}?${params.toString()}`;
}

const SORT_LABEL: Record<string, string> = { top: 'Popular', year: 'Newest', imdbRating: 'Top rated' };

export function Browse() {
    const { type = 'movie' } = useParams();
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');

    const src = params.get('src') ?? CINEMETA;
    const catalogId = params.get('catalog') ?? 'top';
    const extra = useMemo(() => [...params.entries()].filter(([k]) => k !== 'src' && k !== 'catalog') as [string, string][], [params]);

    const load = useMemo(
        () => ({
            action: 'Load',
            args: { model: 'CatalogWithFiltersSelection', args: { request: { base: src, path: { resource: 'catalog', type, id: catalogId, extra } } } },
        }),
        [src, type, catalogId, extra],
    );
    const discover = useModel<Discover>('discover', { load, unloadOnExit: true });
    const stale = discover?.selected?.request.path.type !== type || discover?.selected?.request.path.id !== catalogId;
    const content = !stale ? discover?.catalog?.content : undefined;
    const items = content?.type === 'Ready' ? content.content : null;

    // Endless scrolling: ask for the next page when the end of the grid comes near.
    const sentinel = useRef<HTMLDivElement>(null);
    const nextPage = !stale && !!discover?.selectable.nextPage;
    useEffect(() => {
        if (!nextPage || !sentinel.current) return;
        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) void core.dispatch({ action: 'CatalogWithFilters', args: { action: 'LoadNextPage' } }, 'discover');
            },
            { rootMargin: '900px 0px' },
        );
        io.observe(sentinel.current);
        return () => io.disconnect();
    }, [nextPage, items?.length]);

    const sel = discover?.selectable;
    const go = (deepLink: string) => {
        const href = toHref(deepLink);
        if (href) navigate(href, { replace: true });
    };

    const catalogOptions: Option[] = (sel?.catalogs ?? [])
        .filter((c) => c.type === type)
        .map((c) => ({
            key: `${c.addon?.transportUrl}:${c.id}`,
            label: c.addon?.transportUrl === CINEMETA ? SORT_LABEL[c.id] ?? c.name : c.name,
            selected: c.selected,
            group: c.addon?.manifest.name,
            onSelect: () => go(c.deepLinks.discover),
        }));
    const selectedCatalog = sel?.catalogs.find((c) => c.selected);

    const genreExtra = sel?.extra.find((e) => e.name === 'genre');
    const isYear = catalogId === 'year';
    const genreOptions: Option[] = (genreExtra?.options ?? []).map((o) => ({
        key: o.value ?? 'all',
        label: o.value ?? (isYear ? 'Any year' : 'All genres'),
        selected: o.selected,
        onSelect: () => go(o.deepLinks.discover),
    }));
    const selectedGenre = genreExtra?.options.find((o) => o.selected)?.value;

    const search = (e: FormEvent) => {
        e.preventDefault();
        if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    };

    const title = type === 'series' ? 'Series' : 'Movies';

    return (
        <main className={s.page}>
            <header className={s.header}>
                <h1 className={`${s.title} display`}>{selectedGenre ? `${selectedGenre} ${title.toLowerCase()}` : title}</h1>
                <form className={s.filters} onSubmit={search}>
                    <label className={s.search}>
                        <span className={s.label}>Search</span>
                        <span className={s.searchBox}>
                            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${title.toLowerCase()}`} aria-label={`Search ${title.toLowerCase()}`} />
                            <SearchIcon size={18} />
                        </span>
                    </label>
                    {catalogOptions.length > 1 && (
                        <Dropdown
                            label="Sort by"
                            value={selectedCatalog ? (selectedCatalog.addon?.transportUrl === CINEMETA ? SORT_LABEL[selectedCatalog.id] ?? selectedCatalog.name : selectedCatalog.name) : '…'}
                            options={catalogOptions}
                        />
                    )}
                    {genreOptions.length > 0 && (
                        <Dropdown
                            label={isYear ? 'Year' : 'Genre'}
                            value={selectedGenre ?? (isYear ? 'Any year' : 'All genres')}
                            options={genreOptions}
                            columns={genreOptions.length > 12 ? 3 : 1}
                        />
                    )}
                </form>
            </header>

            <div className={s.grid}>
                {items
                    ? items.map((m, i) => (
                          <div key={`${m.type}:${m.id}`} className={i === 0 ? s.feature : undefined}>
                              <Card data={previewCard(m)} />
                          </div>
                      ))
                    : Array.from({ length: 13 }, (_, i) => (
                          <div key={i} className={i === 0 ? s.feature : undefined}>
                              <CardSkeleton />
                          </div>
                      ))}
            </div>
            {content?.type === 'Err' && <p className="empty">This addon didn't return anything for these filters. Try another genre or sort.</p>}
            {nextPage && items && (
                <div ref={sentinel} className={s.more}>
                    <span className={s.spinner} /> Loading more
                </div>
            )}
        </main>
    );
}
