import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useModel } from '../core/useModel';
import type { Ctx, LibraryItem } from '../core/types';
import { Card } from '../components/Card';
import { Dropdown } from '../components/Dropdown';
import { ProgressRing } from '../components/ProgressRing';
import { libraryCard } from '../lib/cards';
import { poster } from '../lib/meta';
import {
    addedAt,
    isSaved,
    lastWatchedAt,
    showsInContinue,
    useFullLibrary,
    useSeriesProgress,
    wasPlayed,
    watchStatus,
    type SeriesProgress,
    type WatchStatus,
} from '../lib/history';
import s from './Library.module.css';

type View = 'list' | 'progress' | 'watched' | 'history';
type Sort = 'recent' | 'added' | 'name';

const VIEWS: { id: View; label: string; empty: string }[] = [
    { id: 'list', label: 'My List', empty: 'Nothing on your list yet. Add titles with the + button on any title page.' },
    { id: 'progress', label: 'In progress', empty: 'Nothing in progress right now.' },
    { id: 'watched', label: 'Watched', empty: "You haven't finished anything yet." },
    { id: 'history', label: 'History', empty: "You haven't watched anything yet." },
];
const TYPES = [
    { id: 'all', label: 'All' },
    { id: 'movie', label: 'Movies' },
    { id: 'series', label: 'Series' },
];
const SORTS: { id: Sort; label: string }[] = [
    { id: 'recent', label: 'Recently watched' },
    { id: 'added', label: 'Recently added' },
    { id: 'name', label: 'A–Z' },
];

type Row = { item: LibraryItem; series: SeriesProgress | null | undefined; status: WatchStatus };

function inView(view: View, r: Row) {
    switch (view) {
        case 'list':
            return isSaved(r.item);
        case 'progress':
            return r.status.state === 'progress' && showsInContinue(r.item) && wasPlayed(r.item, r.series);
        case 'watched':
            return r.status.state === 'done';
        case 'history':
            return wasPlayed(r.item, r.series);
    }
}

export function Library() {
    const [params, setParams] = useSearchParams();
    const view = (VIEWS.some((v) => v.id === params.get('view')) ? params.get('view') : 'list') as View;
    const type = TYPES.some((t) => t.id === params.get('type')) ? params.get('type')! : 'all';
    const sort = (SORTS.some((o) => o.id === params.get('sort')) ? params.get('sort') : 'recent') as Sort;
    const set = (key: string, value: string, fallback: string) =>
        setParams(
            (p) => {
                const next = new URLSearchParams(p);
                if (value === fallback) next.delete(key);
                else next.set(key, value);
                return next;
            },
            { replace: true },
        );

    const ctx = useModel<Ctx>('ctx');
    const library = useFullLibrary();
    const ofType = useMemo(() => library.filter((i) => type === 'all' || i.type === type), [library, type]);
    const seriesOf = useSeriesProgress(ofType);

    const rows: Row[] = ofType.map((item) => {
        const series = seriesOf(item);
        return { item, series, status: watchStatus(item, series) };
    });
    const counts = Object.fromEntries(VIEWS.map((v) => [v.id, rows.filter((r) => inView(v.id, r)).length])) as Record<View, number>;

    const shown = rows.filter((r) => inView(view, r));
    const by = view === 'history' && sort === 'added' ? 'recent' : sort;
    shown.sort((a, b) =>
        by === 'name' ? a.item.name.localeCompare(b.item.name) : by === 'added' ? addedAt(b.item) - addedAt(a.item) : lastWatchedAt(b.item) - lastWatchedAt(a.item),
    );

    const current = VIEWS.find((v) => v.id === view)!;

    return (
        <main className="page page-pad">
            <h1 className={`page-title ${s.title}`}>My List</h1>
            {ctx && !ctx.profile.auth && (
                <p className={s.note}>
                    <Link to="/login">Sign in</Link> to keep your list and history in sync with Stremio on your other devices.
                </p>
            )}

            <div className={s.toolbar}>
                <div className={s.views} role="tablist" aria-label="Show">
                    {VIEWS.map((v) => (
                        <button key={v.id} role="tab" aria-selected={v.id === view} className={v.id === view ? s.viewOn : undefined} onClick={() => set('view', v.id, 'list')}>
                            {v.label}
                            <span className={s.count}>{counts[v.id]}</span>
                        </button>
                    ))}
                </div>
                <div className={s.filters}>
                    <Dropdown
                        label="Type"
                        value={TYPES.find((t) => t.id === type)!.label}
                        options={TYPES.map((t) => ({ key: t.id, label: t.label, selected: t.id === type, onSelect: () => set('type', t.id, 'all') }))}
                    />
                    <Dropdown
                        label="Sort"
                        value={SORTS.find((o) => o.id === by)!.label}
                        options={SORTS.map((o) => ({ key: o.id, label: o.label, selected: o.id === by, onSelect: () => set('sort', o.id, 'recent') }))}
                    />
                </div>
            </div>

            {shown.length === 0 ? (
                <p className="empty">{current.empty}</p>
            ) : (
                <div className={s.grid}>
                    {shown.map((r) => (
                        <Tile key={r.item._id} row={r} showWhen={view === 'history'} />
                    ))}
                </div>
            )}
        </main>
    );
}

function Tile({ row: { item, status }, showWhen }: { row: Row; showWhen: boolean }) {
    const card = libraryCard(item);
    const ringLabel = status.state === 'done' ? 'Watched' : status.label ?? `${Math.round(status.fraction * 100)}% watched`;
    const data = {
        ...card,
        image: poster({ id: item._id, poster: item.poster }, 'medium'),
        meta: undefined,
        progress: undefined,
        badge: status.state === 'new' ? undefined : <ProgressRing fraction={status.fraction} done={status.state === 'done'} label={ringLabel} />,
    };
    const when = showWhen ? ago(lastWatchedAt(item)) : null;
    const line = [status.label, when].filter(Boolean).join(' · ');
    return (
        <div className={s.tile}>
            <Card data={data} shape="poster" />
            <div className={s.caption}>
                <div className={s.name}>{item.name}</div>
                {line && <div className={`${s.sub} ${status.state === 'done' ? s.subDone : ''}`}>{line}</div>}
            </div>
        </div>
    );
}

function ago(t: number) {
    if (!t) return null;
    const days = Math.floor((Date.now() - t) / 86_400_000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 60) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
    return new Date(t).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}
