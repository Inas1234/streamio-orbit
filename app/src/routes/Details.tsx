import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { core, ctxAction } from '../core/core';
import { useModel } from '../core/useModel';
import type { Addon, MetaDetails, MetaItem, Stream, Video } from '../core/types';
import { Img } from '../components/Img';
import { CheckIcon, EyeIcon, PlayIcon, PlusIcon, TrailerIcon } from '../components/Icons';
import { openMenu } from '../components/menu';
import { setEpisodeWatched, setSeasonWatched, setTitleWatched } from '../lib/actions';
import { backdrop, castNames, directors, genres, logo, seasons, streamInfo, writers } from '../lib/meta';
import { detailHref } from '../lib/cards';
import { useTmdbDetails, type CastMember } from '../lib/tmdb';
import { useAmbient } from '../lib/ambient';
import { useCast } from '../lib/people';
import { prefetchStreams } from '../lib/prefetch';
import { opensExternally, playerHref } from './playerLink';
import s from './Details.module.css';
import { Ratings } from '../components/Ratings';

export function Details() {
    const { type = '', id = '', videoId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const streamId = videoId ?? (type !== 'series' ? id : null);

    const load = useMemo(
        () => ({
            action: 'Load',
            args: {
                model: 'MetaDetails',
                args: {
                    metaPath: { resource: 'meta', type, id, extra: [] },
                    streamPath: streamId ? { resource: 'stream', type, id: streamId, extra: [] } : null,
                    guessStream: true,
                },
            },
        }),
        [type, id, streamId],
    );
    const details = useModel<MetaDetails>('meta_details', { load, unloadOnExit: true });

    // Ignore state left over from the previous title while the new one loads.
    const current = details?.selected?.metaPath.id === id ? details : null;
    const metaLoadable = current?.metaItem?.content;
    const meta = metaLoadable?.type === 'Ready' ? metaLoadable.content : null;
    const tmdb = useTmdbDetails(id, type);

    // The artwork URL is known from the id alone, so the backdrop (and its colors) start loading
    // before the addon answers, and the card you clicked can grow straight into it.
    const art = meta ? backdrop(meta, 'large') : /^tt\d+$/.test(id) ? backdrop({ id, background: null, poster: null }, 'large') : null;
    useAmbient(art?.replace('/background/large/', '/background/small/') ?? null);

    // Series opened without an episode: jump to the one you were watching, or the first one.
    useEffect(() => {
        if (type !== 'series' || videoId || !meta) return;
        const resume = current?.libraryItem?.state?.video_id;
        const first = meta.videos.find((v) => (v.season ?? 0) > 0) ?? meta.videos[0];
        const target = resume && meta.videos.some((v) => v.id === resume) ? resume : first?.id;
        if (target) navigate(detailHref(type, id, target), { replace: true });
    }, [type, id, videoId, meta, current?.libraryItem, navigate]);

    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, [id]);

    // Once this episode's sources have arrived, quietly fetch the next episode's too.
    const sourcesSettled = !!current && current.streams.length > 0 && current.streams.every((g) => g.content.type !== 'Loading');
    useEffect(() => {
        if (!sourcesSettled || type !== 'series' || !meta || !streamId) return;
        const ordered = meta.videos.filter((v) => (v.season ?? 0) > 0).sort((a, b) => (a.season! - b.season!) || (a.episode ?? 0) - (b.episode ?? 0));
        const i = ordered.findIndex((v) => v.id === streamId);
        const next = i >= 0 ? ordered[i + 1] : null;
        if (next && !next.upcoming) prefetchStreams(type, next.id);
    }, [sourcesSettled, type, meta, streamId]);

    // Coming from "next episode" in the player: play as soon as the same addon answers.
    const autoplay = searchParams.get('autoplay');
    useEffect(() => {
        if (autoplay === null || !current || !meta || !streamId || current.selected?.streamPath?.id !== streamId) return;
        const groups = current.streams;
        const preferred = groups.find((g) => g.addon.transportUrl === autoplay);
        const pick = preferred?.content.type === 'Ready' && preferred.content.content.length ? preferred : preferred?.content.type === 'Loading' ? null : groups.find((g) => g.content.type === 'Ready' && g.content.content.length);
        if (!pick || pick.content.type !== 'Ready') {
            if (groups.length && groups.every((g) => g.content.type !== 'Loading')) setSearchParams({}, { replace: true });
            return;
        }
        void playerHref({ stream: pick.content.content[0], streamAddon: pick.addon, metaAddon: current.metaItem?.addon, type, id, videoId: streamId }).then((href) =>
            navigate(href, { replace: true }),
        );
    }, [autoplay, current, meta, streamId, type, id, navigate, setSearchParams]);

    if (metaLoadable?.type === 'Err') {
        return (
            <main className="page page-pad">
                <p className="empty">Couldn't load this title. Check your addons and try again.</p>
            </main>
        );
    }

    if (!meta || !current) return <DetailsSkeleton art={art} />;

    const selectedVideo = meta.videos.find((v) => v.id === streamId) ?? null;
    const metaAddon = current.metaItem!.addon;

    return (
        <main className={s.page}>
            <Backdrop src={art} fallback={meta.background || meta.poster} />
            <div className={s.layout}>
                <div className={s.main}>
                    <Header meta={meta} certification={tmdb?.certification ?? null} tagline={tmdb?.tagline ?? null} inLibrary={!!current.libraryItem && !current.libraryItem.removed} streamsAvailable={current.streams} selectedVideo={selectedVideo} metaAddon={metaAddon} />
                    <Cast meta={meta} tmdbCast={tmdb?.cast ?? null} />
                    {type === 'series' && meta.videos.length > 0 && <Episodes meta={meta} selectedId={streamId} />}
                </div>
                <Sources
                    title={selectedVideo && type === 'series' ? episodeLabel(selectedVideo) : meta.name}
                    groups={current.streams}
                    waiting={!streamId}
                    onPlay={(stream, addon) =>
                        !opensExternally(stream) &&
                        void playerHref({ stream, streamAddon: addon, metaAddon, type, id, videoId: streamId ?? id }).then((href) => navigate(href))
                    }
                />
            </div>
        </main>
    );
}

const episodeLabel = (v: Video) => (v.season !== undefined && v.episode !== undefined ? `S${v.season} · E${v.episode}` : v.title);

// ---------------- header ----------------

type HeaderProps = {
    meta: MetaItem;
    certification: string | null;
    tagline: string | null;
    inLibrary: boolean;
    streamsAvailable: MetaDetails['streams'];
    selectedVideo: Video | null;
    metaAddon: Addon;
};

function Header({ meta, certification, tagline, inLibrary, streamsAvailable, selectedVideo, metaAddon }: HeaderProps) {
    const navigate = useNavigate();
    const g = genres(meta.links);
    const d = directors(meta.links);
    const w = writers(meta.links);
    const logoUrl = logo(meta);
    const trailer = meta.trailerStreams[0];

    // "Play" uses the first stream of the first addon that answered, the source list is right there for anything else.
    // Prefers streams that play in the app over links to other services.
    const best = useMemo(() => {
        let external: { stream: Stream; addon: Addon } | null = null;
        for (const group of streamsAvailable) {
            if (group.content.type !== 'Ready') continue;
            const playable = group.content.content.find((st) => !st.externalUrl);
            if (playable) return { stream: playable, addon: group.addon };
            external ??= group.content.content[0] ? { stream: group.content.content[0], addon: group.addon } : null;
        }
        return external;
    }, [streamsAvailable]);

    const toggleLibrary = () => {
        if (inLibrary) void core.dispatch(ctxAction('RemoveFromLibrary', meta.id));
        else void core.dispatch(ctxAction('AddToLibrary', meta));
    };

    const playLabel =
        selectedVideo && meta.type === 'series'
            ? `${selectedVideo.progress > 0 ? 'Resume' : 'Play'} ${episodeLabel(selectedVideo)}`
            : 'Play';

    return (
        <header className={s.header}>
            {logoUrl ? (
                <h1 className={`${s.step} ${s.logoWrap}`}>
                    <Img src={logoUrl} alt={meta.name} className={s.logo} eager />
                    <span className="sr-only">{meta.name}</span>
                </h1>
            ) : (
                <h1 className={`${s.step} ${s.title} display`}>{meta.name}</h1>
            )}
            {tagline && <p className={`${s.step} ${s.tagline}`}>{tagline}</p>}
            <div className={`${s.step} dot-list`}>
                <Ratings id={meta.id} links={meta.links} />
                {meta.releaseInfo && <span>{meta.releaseInfo}</span>}
                {meta.runtime && <span>{meta.runtime}</span>}
                {certification && (
                    <span>
                        <span className="pill">{certification}</span>
                    </span>
                )}
                {g.length > 0 && <span>{g.slice(0, 3).join(', ')}</span>}
            </div>
            {meta.description && <p className={`${s.step} ${s.desc}`}>{meta.description}</p>}
            <div className={`${s.step} ${s.actions}`}>
                <button
                    className={`btn btn-accent ${s.playBtn}`}
                    disabled={!best}
                    onClick={() =>
                        best &&
                        !opensExternally(best.stream) &&
                        void playerHref({
                            stream: best.stream,
                            streamAddon: best.addon,
                            metaAddon,
                            type: meta.type,
                            id: meta.id,
                            videoId: selectedVideo?.id ?? meta.id,
                        }).then((href) => navigate(href))
                    }
                >
                    <PlayIcon size={18} /> {best ? playLabel : 'Finding sources…'}
                </button>
                <button className={`icon-btn ${inLibrary ? 'on' : ''}`} onClick={toggleLibrary} aria-label={inLibrary ? 'Remove from My List' : 'Add to My List'} title={inLibrary ? 'In My List' : 'Add to My List'}>
                    {inLibrary ? <CheckIcon /> : <PlusIcon />}
                </button>
                <button
                    className={`icon-btn ${meta.watched ? 'on' : ''}`}
                    onClick={() => void setTitleWatched(!meta.watched)}
                    aria-label={meta.watched ? 'Mark as unwatched' : 'Mark as watched'}
                    title={meta.watched ? 'Watched' : 'Mark as watched'}
                >
                    <EyeIcon />
                </button>
                {trailer && (
                    <button
                        className="icon-btn"
                        title="Trailer"
                        aria-label="Play trailer"
                        onClick={() =>
                            void playerHref({ stream: { ytId: trailer.ytId, name: 'Trailer' }, type: meta.type, id: meta.id, videoId: meta.id }).then((href) =>
                                navigate(href),
                            )
                        }
                    >
                        <TrailerIcon />
                    </button>
                )}
            </div>
            {(d.length > 0 || w.length > 0) && (
                <dl className={`${s.step} ${s.credits}`}>
                    {d.length > 0 && (
                        <>
                            <dt>{d.length > 1 ? 'Directors' : 'Director'}</dt>
                            <dd>{d.slice(0, 3).join(', ')}</dd>
                        </>
                    )}
                    {w.length > 0 && (
                        <>
                            <dt>{w.length > 1 ? 'Writers' : 'Writer'}</dt>
                            <dd>{w.slice(0, 3).join(', ')}</dd>
                        </>
                    )}
                </dl>
            )}
        </header>
    );
}

// ---------------- cast ----------------

const Cast = memo(function Cast({ meta, tmdbCast }: { meta: MetaItem; tmdbCast: CastMember[] | null }) {
    const names = castNames(meta.links);
    const useTmdb = !!tmdbCast && tmdbCast.length > 0;
    // No TMDB key (or no match): Wikidata's cast list, with Wikipedia photos as a fallback.
    const free = useCast(/^tt\d+$/.test(meta.id) ? meta.id : null, names, !useTmdb);
    const people = useTmdb
        ? tmdbCast!.map((c) => ({ key: String(c.id), href: `/person/${c.id}`, name: c.name, character: c.character, photo: c.photo as string | null | undefined }))
        : free
              .map((p) => ({ key: p.name, href: `/search?q=${encodeURIComponent(p.name)}`, name: p.name, character: p.character, photo: p.photo }))
              // People with no photo at all go to the end, so the row doesn't open with an empty circle.
              .sort((a, b) => Number(a.photo === null) - Number(b.photo === null));
    if (!people.length) return null;
    return (
        <section className={s.section}>
            <h2 className={s.h2}>Cast</h2>
            <div className={s.cast}>
                {people.map((p) => (
                    <Link key={p.key} to={p.href} className={s.castItem}>
                        <div className={`${s.face} ${p.photo === undefined ? 'skeleton' : ''}`}>
                            {p.photo ? <Img src={p.photo} alt="" /> : p.photo === null ? <Silhouette /> : null}
                        </div>
                        <div className={s.person}>{p.name}</div>
                        {p.character && <div className={s.role}>{p.character}</div>}
                    </Link>
                ))}
            </div>
        </section>
    );
});

const Silhouette = () => (
    <svg className={s.silhouette} viewBox="0 0 64 80" aria-hidden>
        <circle cx="32" cy="28" r="13" />
        <path d="M8 80c0-15 11-25 24-25s24 10 24 25z" />
    </svg>
);

// ---------------- episodes ----------------

const Episodes = memo(function Episodes({ meta, selectedId }: { meta: MetaItem; selectedId: string | null }) {
    const navigate = useNavigate();
    const hoverTimer = useRef(0);
    const all = useMemo(() => seasons(meta.videos), [meta.videos]);
    const selectedSeason = meta.videos.find((v) => v.id === selectedId)?.season;
    const [season, setSeason] = useState<number | undefined>(selectedSeason ?? all[0]);
    useEffect(() => {
        if (selectedSeason !== undefined) setSeason(selectedSeason);
    }, [selectedSeason]);

    const list = useMemo(
        () => meta.videos.filter((v) => v.season === season).sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0)),
        [meta.videos, season],
    );

    return (
        <section className={s.section}>
            <div className={s.tabs} role="tablist">
                {all.map((n) => (
                    <button key={n} role="tab" aria-selected={n === season} className={n === season ? s.tabOn : undefined} onClick={() => setSeason(n)}>
                        {n === 0 ? 'Specials' : `Season ${n}`}
                    </button>
                ))}
            </div>
            <ol className={s.episodes}>
                {list.map((v) => (
                    <li key={v.id}>
                        <button
                            className={`${s.episode} ${v.id === selectedId ? s.episodeOn : ''}`}
                            onContextMenu={(e) => {
                                const seasonWatched = list.length > 0 && list.every((x) => x.watched);
                                openMenu(
                                    e,
                                    [
                                        { label: 'Show sources', onSelect: () => navigate(detailHref(meta.type, meta.id, v.id), { replace: true }) },
                                        { label: v.watched ? 'Mark episode as unwatched' : 'Mark episode as watched', onSelect: () => void setEpisodeWatched(v, !v.watched), separated: true },
                                        ...(season !== undefined
                                            ? [{ label: seasonWatched ? 'Mark season as unwatched' : 'Mark season as watched', onSelect: () => void setSeasonWatched(season, !seasonWatched) }]
                                            : []),
                                    ],
                                    `${v.season !== undefined ? `S${v.season} · E${v.episode} · ` : ''}${v.title || ''}`,
                                );
                            }}
                            onClick={() => navigate(detailHref(meta.type, meta.id, v.id), { replace: true })}
                            onMouseEnter={() => {
                                window.clearTimeout(hoverTimer.current);
                                hoverTimer.current = window.setTimeout(() => prefetchStreams(meta.type, v.id), 300);
                            }}
                            onMouseLeave={() => window.clearTimeout(hoverTimer.current)}
                        >
                            <div className={s.thumb}>
                                <Img src={v.thumbnail} alt="" />
                                {v.progress > 0 && (
                                    <div className={s.track}>
                                        <div style={{ width: `${Math.min(100, v.progress)}%` }} />
                                    </div>
                                )}
                                {v.watched && <span className={s.watched}>Watched</span>}
                            </div>
                            <div className={s.epText}>
                                <div className={s.epTitle}>
                                    <span className={s.epNum}>{v.episode}.</span> {v.title || `Episode ${v.episode}`}
                                </div>
                                {v.overview && <p className={s.epDesc}>{v.overview}</p>}
                                {v.released && <div className={s.epDate}>{formatDate(v.released, v.upcoming)}</div>}
                            </div>
                        </button>
                    </li>
                ))}
            </ol>
        </section>
    );
});

const formatDate = (iso: string, upcoming: boolean) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const text = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    return upcoming ? `Coming ${text}` : text;
};

// ---------------- sources ----------------

type SourcesProps = {
    title: string;
    groups: MetaDetails['streams'];
    waiting: boolean;
    onPlay: (stream: Stream, addon: Addon) => void;
};

const Sources = memo(function Sources({ title, groups, waiting, onPlay }: SourcesProps) {
    const [filter, setFilter] = useState<string>('All');
    const loading = groups.filter((g) => g.content.type === 'Loading').length;
    const ready = groups.flatMap((g) => (g.content.type === 'Ready' ? g.content.content.map((stream) => ({ stream, addon: g.addon, info: streamInfo(stream) })) : []));
    const qualities = ['All', ...['4K', '1080p', '720p', '480p'].filter((q) => ready.some((r) => r.info.quality === q))];
    const shown = filter === 'All' ? ready : ready.filter((r) => r.info.quality === filter);

    return (
        <aside className={s.sources}>
            <div className={s.sourcesHead}>
                <div>
                    <div className={s.sourcesTitle}>Sources</div>
                    <div className={s.sourcesSub}>{title}</div>
                </div>
                <div className={s.count}>{ready.length}</div>
            </div>
            {qualities.length > 2 && (
                <div className={s.chips}>
                    {qualities.map((q) => (
                        <button key={q} className={q === filter ? s.chipOn : undefined} onClick={() => setFilter(q)}>
                            {q}
                        </button>
                    ))}
                </div>
            )}
            <div className={s.sourceList}>
                {waiting && <p className={s.note}>Pick an episode to see sources.</p>}
                {!waiting && groups.length === 0 && <p className={s.note}>No addons that provide streams for this title are installed.</p>}
                {shown.map(({ stream, addon, info }, i) => (
                    <button key={`${addon.transportUrl}:${i}`} className={s.source} onClick={() => onPlay(stream, addon)}>
                        <div className={s.sourceTop}>
                            {info.quality && <span className={s.q}>{info.quality}</span>}
                            <span className={s.addon}>{addon.manifest.name}</span>
                        </div>
                        <div className={s.sourceName}>{info.title}</div>
                        <div className={s.sourceMeta}>
                            {info.size && <span>{info.size}</span>}
                            {info.seeds !== null && <span>{info.seeds.toLocaleString()} seeds</span>}
                        </div>
                    </button>
                ))}
                {loading > 0 && (
                    <div className={s.loading}>
                        <span className={s.spinner} /> Asking {loading} more addon{loading > 1 ? 's' : ''}…
                    </div>
                )}
                {!waiting && loading === 0 && groups.length > 0 && ready.length === 0 && <p className={s.note}>No sources found.</p>}
            </div>
        </aside>
    );
});

function Backdrop({ src, fallback }: { src: string | null; fallback?: string | null }) {
    return (
        <div className={s.backdrop} style={{ viewTransitionName: 'art' }}>
            <Img src={src} fallback={fallback} eager alt="" />
        </div>
    );
}

function DetailsSkeleton({ art }: { art: string | null }) {
    return (
        <main className={s.page}>
            <Backdrop src={art} />
            <div className={s.layout}>
                <div className={s.main}>
                    <div className={s.header}>
                        <div className="skeleton" style={{ height: 72, width: 360, borderRadius: 8 }} />
                        <div className="skeleton" style={{ height: 16, width: 280, borderRadius: 6, marginTop: 20 }} />
                        <div className="skeleton" style={{ height: 64, width: 520, maxWidth: '100%', borderRadius: 6, marginTop: 16 }} />
                    </div>
                </div>
                <aside className={s.sources}>
                    {Array.from({ length: 5 }, (_, i) => (
                        <div key={i} className="skeleton" style={{ height: 68, borderRadius: 8, marginBottom: 8 }} />
                    ))}
                </aside>
            </div>
        </main>
    );
}
