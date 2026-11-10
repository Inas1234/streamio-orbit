import { useCallback, useEffect, useMemo, useRef } from 'react';
import { core } from '../core/core';
import { useModel } from '../core/useModel';
import type { Board, ContinueWatchingPreview, MetaPreview } from '../core/types';
import { Hero } from '../components/Hero';
import { Row } from '../components/Row';
import { libraryCard, previewCard } from '../lib/cards';

const BOARD_LOAD = { action: 'Load', args: { model: 'CatalogsWithExtra', args: { extra: [] } } };

export function catalogTitle(c: Board['catalogs'] extends (infer C)[] | null ? C : never) {
    const name = c.name ?? c.addon?.manifest.name ?? 'Catalog';
    const type = c.type === 'movie' ? 'Movies' : c.type === 'series' ? 'Series' : c.type ?? '';
    return name.toLowerCase().includes(type.toLowerCase()) ? name : `${name} ${type}`.trim();
}

/** Home and the Movies / Series pages share the board model, so switching between them is instant. */
export function useBoardRows(filterType?: string) {
    const board = useModel<Board>('board', { load: BOARD_LOAD });
    const maxRequested = useRef(-1);

    const requestUpTo = useCallback((index: number) => {
        if (index <= maxRequested.current) return;
        maxRequested.current = index;
        void core.dispatch({ action: 'CatalogsWithExtra', args: { action: 'LoadRange', args: { start: 0, end: index + 2 } } }, 'board');
    }, []);

    // Load the rows above the fold right away; the rest load as you scroll toward them.
    const hasCatalogs = (board?.catalogs?.length ?? 0) > 0;
    useEffect(() => {
        if (hasCatalogs) requestUpTo(3);
    }, [hasCatalogs, requestUpTo]);

    const rows = useMemo(() => {
        const catalogs = board?.catalogs ?? [];
        return catalogs
            .map((catalog, index) => ({ catalog, index }))
            .filter(({ catalog }) => !filterType || catalog.type === filterType)
            .filter(({ catalog }) => catalog.content?.type !== 'Err');
    }, [board, filterType]);

    return { board, rows, requestUpTo };
}

export function Home() {
    const { rows, requestUpTo } = useBoardRows();
    const cw = useModel<ContinueWatchingPreview>('continue_watching_preview');

    const featured = useMemo<MetaPreview[]>(() => {
        const first = rows.find(({ catalog }) => catalog.content?.type === 'Ready');
        const items = first?.catalog.content?.type === 'Ready' ? first.catalog.content.content : [];
        return items.filter((i) => /^tt\d+$/.test(i.id)).slice(0, 6);
    }, [rows]);

    const cwCards = useMemo(
        () =>
            (cw?.items ?? [])
                .map((i) => ('libraryItem' in i ? i.libraryItem : i))
                .filter((i) => i && i.state)
                .map((i) => libraryCard(i, { continueWatching: true })),
        [cw],
    );

    // Top 10 comes from the first popular series row, so it differs from the featured films.
    const top10 = useMemo(() => {
        const series = rows.find(({ catalog }) => catalog.type === 'series' && catalog.content?.type === 'Ready');
        const items = series?.catalog.content?.type === 'Ready' ? series.catalog.content.content : [];
        return items.slice(0, 10).map((m) => previewCard(m, 'poster'));
    }, [rows]);

    return (
        <main className="page">
            <Hero items={featured} />
            {cwCards.length > 0 && <Row title="Continue watching" items={cwCards} seeAll="/library" />}
            {top10.length === 10 && <Row title="Top 10 series right now" items={top10} shape="poster" ranked />}
            {rows.map(({ catalog, index }) => (
                <CatalogRow key={`${catalog.addon?.transportUrl}:${catalog.type}:${catalog.name}:${index}`} catalog={catalog} index={index} requestUpTo={requestUpTo} />
            ))}
        </main>
    );
}

type CatalogRowProps = {
    catalog: NonNullable<Board['catalogs']>[number];
    index: number;
    requestUpTo: (i: number) => void;
};

export function CatalogRow({ catalog, index, requestUpTo }: CatalogRowProps) {
    const content = catalog.content;
    const items = useMemo(() => (content?.type === 'Ready' ? content.content.slice(0, 30).map((m) => previewCard(m)) : null), [content]);
    const onNear = useCallback(() => requestUpTo(index), [requestUpTo, index]);
    return <Row title={catalogTitle(catalog)} items={items} error={content?.type === 'Err'} onNearViewport={content ? undefined : onNear} />;
}
