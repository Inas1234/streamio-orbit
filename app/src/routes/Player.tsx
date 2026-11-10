import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StremioVideo from '@stremio/stremio-video';
import { core, ctxAction } from '../core/core';
import { useModel } from '../core/useModel';
import type { Ctx, Player as PlayerModel, Stream, StreamingServer, Video } from '../core/types';
import { shell } from '../shell/shell';
import { formatTime } from '../lib/meta';
import { detailHref } from '../lib/cards';
import { prefetchStreams } from '../lib/prefetch';
import { setPlayerEpisodeWatched, setPlayerSeasonWatched } from '../lib/actions';
import {
    BackIcon,
    CheckIcon,
    EpisodesIcon,
    FullscreenIcon,
    NextIcon,
    PauseIcon,
    PlayIcon,
    SkipBack,
    SkipFwd,
    SubtitlesIcon,
    VolumeIcon,
} from '../components/Icons';
import { Img } from '../components/Img';
import s from './Player.module.css';

type Track = { id: string; label?: string; lang?: string; origin?: string };

type VideoState = {
    paused: boolean | null;
    time: number | null;
    duration: number | null;
    buffering: boolean | null;
    buffered: number | null;
    volume: number | null;
    muted: boolean | null;
    playbackSpeed: number | null;
    subtitlesTracks: Track[];
    selectedSubtitlesTrackId: string | null;
    extraSubtitlesTracks: Track[];
    selectedExtraSubtitlesTrackId: string | null;
    audioTracks: Track[];
    selectedAudioTrackId: string | null;
};

const initialState: VideoState = {
    paused: null,
    time: null,
    duration: null,
    buffering: null,
    buffered: null,
    volume: null,
    muted: null,
    playbackSpeed: null,
    subtitlesTracks: [],
    selectedSubtitlesTrackId: null,
    extraSubtitlesTracks: [],
    selectedExtraSubtitlesTrackId: null,
    audioTracks: [],
    selectedAudioTrackId: null,
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
/** Same steps as Stremio. */
const SUB_SIZES = [75, 100, 125, 150, 175, 200, 250];

type SubtitleSettings = {
    subtitlesSize?: number;
    subtitlesOffset?: number;
    subtitlesTextColor?: string;
    subtitlesBackgroundColor?: string;
    subtitlesOutlineColor?: string;
};

export function Player() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const type = params.get('type') ?? '';
    const id = params.get('id') ?? '';
    const videoId = params.get('videoId') ?? '';
    const encoded = params.get('stream') ?? '';
    const streamTransportUrl = params.get('streamTransportUrl');
    const metaTransportUrl = params.get('metaTransportUrl');

    const [stream, setStream] = useState<Stream | null | undefined>(undefined);
    useEffect(() => {
        let alive = true;
        core.decodeStream<Stream>(encoded).then((st) => alive && setStream(st));
        return () => {
            alive = false;
        };
    }, [encoded]);

    const load = useMemo(() => {
        if (!stream) return null;
        return {
            action: 'Load',
            args: {
                model: 'Player',
                args: {
                    stream,
                    streamRequest: streamTransportUrl ? { base: streamTransportUrl, path: { resource: 'stream', type, id: videoId, extra: [] } } : null,
                    metaRequest: metaTransportUrl ? { base: metaTransportUrl, path: { resource: 'meta', type, id, extra: [] } } : null,
                    subtitlesPath: { resource: 'subtitles', type, id: videoId, extra: [] },
                },
            },
        };
    }, [stream, streamTransportUrl, metaTransportUrl, type, id, videoId]);

    const player = useModel<PlayerModel>('player', { load, unloadOnExit: true });
    const server = useModel<StreamingServer>('streaming_server');
    const ctx = useModel<Ctx>('ctx');
    const settings = ctx?.profile.settings;

    // ---- video engine ----
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<any>(null);
    const [state, setState] = useState<VideoState>(initialState);
    const [error, setError] = useState<string | null>(null);

    const dispatchVideo = useCallback((action: object) => {
        if (videoRef.current && containerRef.current) {
            try {
                videoRef.current.dispatch(action, { containerElement: containerRef.current, shellTransport: shell.active ? shell : null, chromecastTransport: null });
            } catch (e) {
                console.error('video', e);
            }
        }
    }, []);
    const setProp = useCallback((propName: string, propValue: unknown) => dispatchVideo({ type: 'setProp', propName, propValue }), [dispatchVideo]);

    // ---- subtitle look (size, position, colors), shared with Stremio's own settings ----
    // Built-in tracks are drawn by the player engine, addon tracks by the page: each has its own props.
    const subStyle = settings as SubtitleSettings | undefined;
    const [subSize, setSubSize] = useState<number | null>(null);
    const [subOffset, setSubOffset] = useState<number | null>(null);
    const [subDelay, setSubDelay] = useState(0);
    const size = subSize ?? subStyle?.subtitlesSize ?? 100;
    const offset = subOffset ?? subStyle?.subtitlesOffset ?? 5;
    const applySubtitleStyleRef = useRef(() => {});
    applySubtitleStyleRef.current = () => {
        const both = (name: string, value: unknown) => {
            if (value === undefined || value === null) return;
            setProp(name, value);
            setProp(`extra${name[0].toUpperCase()}${name.slice(1)}`, value);
        };
        both('subtitlesSize', size);
        both('subtitlesOffset', offset);
        both('subtitlesTextColor', subStyle?.subtitlesTextColor);
        both('subtitlesBackgroundColor', subStyle?.subtitlesBackgroundColor);
        both('subtitlesOutlineColor', subStyle?.subtitlesOutlineColor);
    };
    // Size and position are remembered in your Stremio settings (once you stop clicking).
    const settingsRef = useRef(settings);
    settingsRef.current = settings;
    const saveTimer = useRef(0);
    const pendingSave = useRef<Partial<Record<'subtitlesSize' | 'subtitlesOffset', number>>>({});
    const saveSubtitleSetting = useCallback((name: 'subtitlesSize' | 'subtitlesOffset', value: number) => {
        pendingSave.current[name] = value;
        window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
            const current = settingsRef.current;
            const changes = pendingSave.current;
            pendingSave.current = {};
            if (current) void core.dispatch(ctxAction('UpdateSettings', { ...current, ...changes }));
        }, 700);
    }, []);
    const changeSubSize = (next: number) => {
        setSubSize(next);
        setProp('subtitlesSize', next);
        setProp('extraSubtitlesSize', next);
        saveSubtitleSetting('subtitlesSize', next);
    };
    const changeSubOffset = (next: number) => {
        setSubOffset(next);
        setProp('subtitlesOffset', next);
        setProp('extraSubtitlesOffset', next);
        saveSubtitleSetting('subtitlesOffset', next);
    };
    const changeSubDelay = (ms: number) => {
        setSubDelay(ms);
        setProp('subtitlesDelay', ms / 1000); // the desktop player takes seconds
        setProp('extraSubtitlesDelay', ms);
    };

    useEffect(() => {
        const video = new StremioVideo();
        videoRef.current = video;
        const onProp = (name: string, value: unknown) => setState((st) => (st[name as keyof VideoState] === value ? st : { ...st, [name]: value }));
        video.on('propChanged', onProp);
        video.on('propValue', onProp);
        video.on('error', (e: { message?: string; critical?: boolean }) => {
            // Only errors that stop playback get the full-screen message (side issues like a failed
            // subtitle lookup are reported as non-critical or without the flag).
            if (e?.critical) setError(e?.message ?? 'Playback failed');
            else console.warn('video', e);
        });
        video.on('implementationChanged', (manifest: { props: string[] }) => {
            manifest.props.forEach((propName) => dispatchVideo({ type: 'observeProp', propName }));
            applySubtitleStyleRef.current();
        });
        video.on('ended', () => endedRef.current());
        if (shell.active) document.body.classList.add('playing');
        return () => {
            document.body.classList.remove('playing');
            try {
                video.destroy();
            } catch {
                /* ignore */
            }
            videoRef.current = null;
        };
    }, []);

    // Load the stream once the core has resolved it and the streaming server is known.
    const loadedFor = useRef<string | null>(null);
    useEffect(() => {
        if (!player?.selected || player.stream?.type !== 'Ready') return;
        if (server?.settings?.type === 'Loading') return;
        // Torrents go through the streaming server: wait until it's reachable.
        if (player.stream.content.infoHash && !server?.baseUrl) return;
        const key = encoded;
        if (loadedFor.current === key) return;
        loadedFor.current = key;
        setError(null);
        const lib = player.libraryItem;
        const startAt = lib?.state && lib.state.video_id === videoId ? lib.state.timeOffset : 0;
        dispatchVideo({
            type: 'command',
            commandName: 'load',
            commandArgs: {
                stream: { ...player.stream.content, subtitles: [] },
                autoplay: true,
                time: startAt,
                forceTranscoding: false,
                maxAudioChannels: settings?.surroundSound ? 32 : 2,
                hardwareDecoding: settings?.hardwareDecoding ?? true,
                assSubtitlesStyling: settings?.assSubtitlesStyling ?? false,
                // Must be lowercase: the desktop engine only picks a visible video output for 'windows'
                // (anything else selects 'libmpv', which plays sound with no picture in this shell).
                platform: 'windows',
                videoMode: (settings as { videoMode?: string | null } | undefined)?.videoMode ?? null,
                streamingServerURL: server?.baseUrl ? server.selected?.transportUrl ?? server.baseUrl : null,
                seriesInfo: player.seriesInfo,
            },
        });
    }, [player, server, settings, encoded, videoId, dispatchVideo]);

    // Addon subtitles (OpenSubtitles etc.) arrive after the stream starts.
    const subsKey = player?.subtitles.map((t) => t.id).join(',');
    useEffect(() => {
        if (!player?.subtitles.length || !state.duration) return;
        dispatchVideo({
            type: 'command',
            commandName: 'addExtraSubtitlesTracks',
            commandArgs: { tracks: player.subtitles.map((t) => ({ ...t, label: t.label ?? t.lang, origin: 'Addons', exclusive: false, embedded: false })) },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subsKey, !!state.duration, dispatchVideo]);

    // ---- report progress to the core (throttled to once a second) ----
    const lastReport = useRef(0);
    useEffect(() => {
        if (state.time === null || state.duration === null) return;
        const now = performance.now();
        if (now - lastReport.current < 1000) return;
        lastReport.current = now;
        void core.dispatch(
            { action: 'Player', args: { action: 'TimeChanged', args: { time: Math.round(state.time), duration: Math.round(state.duration), device: shell.active ? 'shell' : 'web' } } },
            'player',
        );
    }, [state.time, state.duration]);

    useEffect(() => {
        if (state.paused === null) return;
        void core.dispatch({ action: 'Player', args: { action: 'PausedChanged', args: { paused: state.paused } } }, 'player');
    }, [state.paused]);

    const next = player?.nextVideo ?? null;

    // A little way into the episode, fetch the next one's sources so "next" starts fast.
    const warmNext = (state.time ?? 0) > 20_000;
    useEffect(() => {
        if (warmNext && next) prefetchStreams(type, next.id);
    }, [warmNext, next, type]);
    const goNext = useCallback(
        (v: Video | null = next) => {
            if (!v) return;
            void core.dispatch({ action: 'Player', args: { action: 'NextVideo' } }, 'player');
            const binge = streamTransportUrl ?? '';
            navigate(`${detailHref(type, id, v.id)}?autoplay=${encodeURIComponent(binge)}`, { replace: true });
        },
        [next, navigate, type, id, streamTransportUrl],
    );

    const endedRef = useRef<() => void>(() => {});
    endedRef.current = () => {
        void core.dispatch({ action: 'Player', args: { action: 'Ended' } }, 'player');
        if (next && settings?.bingeWatching !== false) goNext(next);
    };

    // ---- controls ----
    const [visible, setVisible] = useState(true);
    const [panel, setPanel] = useState<null | 'episodes' | 'subs' | 'speed'>(null);
    const hideTimer = useRef(0);
    const poke = useCallback(() => {
        setVisible(true);
        window.clearTimeout(hideTimer.current);
        hideTimer.current = window.setTimeout(() => setVisible(false), 3000);
    }, []);
    useEffect(() => {
        poke();
        return () => window.clearTimeout(hideTimer.current);
    }, [poke]);
    const showControls = visible || panel !== null || state.paused === true;

    const togglePause = useCallback(() => setProp('paused', !state.paused), [setProp, state.paused]);
    const seekBy = useCallback(
        (ms: number) => {
            if (state.time === null) return;
            const to = Math.max(0, Math.min(state.duration ?? Infinity, state.time + ms));
            setProp('time', to);
            void core.dispatch({ action: 'Player', args: { action: 'Seek', args: { time: Math.round(to), duration: Math.round(state.duration ?? 0), device: shell.active ? 'shell' : 'web' } } }, 'player');
        },
        [state.time, state.duration, setProp],
    );
    const toggleFullscreen = useCallback(() => {
        if (document.fullscreenElement) {
            void document.exitFullscreen();
            shell.send('win-set-visibility', { fullscreen: false });
        } else {
            shell.send('win-set-visibility', { fullscreen: true });
            void document.documentElement.requestFullscreen().catch(() => {});
        }
    }, []);
    const leave = useCallback(() => {
        if (document.fullscreenElement) void document.exitFullscreen();
        navigate(detailHref(type, id, type === 'series' ? videoId : null));
    }, [navigate, type, id, videoId]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement) return;
            poke();
            switch (e.key) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    togglePause();
                    break;
                case 'ArrowRight':
                    seekBy(e.shiftKey ? 30000 : 10000);
                    break;
                case 'ArrowLeft':
                    seekBy(e.shiftKey ? -30000 : -10000);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setProp('volume', Math.min(100, (state.volume ?? 50) + 5));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setProp('volume', Math.max(0, (state.volume ?? 50) - 5));
                    break;
                case 'm':
                    setProp('muted', !state.muted);
                    break;
                case 'f':
                    toggleFullscreen();
                    break;
                case 'n':
                    goNext();
                    break;
                case 'Escape':
                    if (panel) setPanel(null);
                    else if (document.fullscreenElement) toggleFullscreen();
                    else leave();
                    break;
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [poke, togglePause, seekBy, setProp, state.volume, state.muted, toggleFullscreen, goNext, panel, leave]);

    const meta = player?.metaItem?.type === 'Ready' ? player.metaItem.content : null;
    const series = player?.seriesInfo;
    const title = meta?.name ?? player?.title ?? '';
    const current = meta?.videos.find((v) => v.id === videoId);
    const subtitle = series ? `Season ${series.season} · Episode ${series.episode}${current?.title ? ` · ${current.title}` : ''}` : null;
    // Torrents need Stremio's streaming server. If it can't be reached, say so instead of spinning forever.
    const needsServer = !!(stream?.infoHash);
    const [patienceOver, setPatienceOver] = useState(false);
    useEffect(() => {
        const t = window.setTimeout(() => setPatienceOver(true), 15_000);
        return () => window.clearTimeout(t);
    }, [encoded]);
    // The server may still be starting up; the app re-checks it in the background.
    const serverDown = needsServer && server?.settings?.type === 'Err' && patienceOver;
    const shownError = error ?? (serverDown ? "Torrent sources need Stremio's streaming server, and it isn't reachable from this app." : null);
    const loading = !shownError && (state.buffering !== false || state.duration === null);
    const torrent = useTorrentStats(loading && stream?.infoHash ? stream.infoHash : null, server?.selected?.transportUrl ?? null);

    return (
        <div className={`${s.player} ${showControls ? '' : s.hideCursor}`} onMouseMove={poke} onClick={() => panel && setPanel(null)}>
            {/* The video engine overwrites its container's position, so it gets a full-size wrapper. */}
            <div className={s.videoWrap} onClick={(e) => (e.stopPropagation(), panel ? setPanel(null) : togglePause())} onDoubleClick={toggleFullscreen}>
                <div ref={containerRef} className={s.video} />
            </div>

            {loading && (
                <div className={s.center}>
                    <div className={s.spinner} />
                    {torrent && <div className={s.torrent}>{torrentStatus(torrent)}</div>}
                    {meta?.background && <Img className={s.loadingBg} src={meta.background} alt="" />}
                </div>
            )}
            {shownError && (
                <div className={s.center}>
                    <div className={s.error}>
                        <h2>Can't play this source</h2>
                        <p>{shownError}</p>
                        <button className="btn btn-primary" onClick={leave}>
                            Pick another source
                        </button>
                    </div>
                </div>
            )}

            <div className={`${s.top} ${showControls ? '' : s.hidden}`}>
                <button className={s.iconBtn} onClick={leave} aria-label="Back">
                    <BackIcon size={26} />
                </button>
                <div className={s.titles}>
                    <div className={s.title}>{title}</div>
                    {subtitle && <div className={s.sub}>{subtitle}</div>}
                </div>
                <span style={{ width: 44 }} />
            </div>

            <div className={`${s.bottom} ${showControls ? '' : s.hidden}`} onClick={(e) => e.stopPropagation()}>
                <Seekbar time={state.time} duration={state.duration} buffered={state.buffered} onSeek={(t) => seekBy(t - (state.time ?? 0))} />
                <div className={s.controls}>
                    <button className={s.iconBtn} onClick={togglePause} aria-label={state.paused ? 'Play' : 'Pause'}>
                        {state.paused ? <PlayIcon size={28} /> : <PauseIcon size={28} />}
                    </button>
                    <button className={s.iconBtn} onClick={() => seekBy(-10000)} aria-label="Back 10 seconds">
                        <SkipBack size={26} />
                    </button>
                    <button className={s.iconBtn} onClick={() => seekBy(10000)} aria-label="Forward 10 seconds">
                        <SkipFwd size={26} />
                    </button>
                    <div className={s.volume}>
                        <button className={s.iconBtn} onClick={() => setProp('muted', !state.muted)} aria-label={state.muted ? 'Unmute' : 'Mute'}>
                            <VolumeIcon size={24} muted={!!state.muted || state.volume === 0} />
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={state.muted ? 0 : state.volume ?? 100}
                            onChange={(e) => {
                                setProp('muted', false);
                                setProp('volume', Number(e.target.value));
                            }}
                            aria-label="Volume"
                        />
                    </div>
                    <div className={s.time}>
                        {formatTime((state.time ?? 0) / 1000)} / {formatTime((state.duration ?? 0) / 1000)}
                    </div>
                    <div className={s.spacer} />
                    {next && (
                        <button className={s.iconBtn} onClick={() => goNext()} aria-label="Next episode" title="Next episode">
                            <NextIcon size={22} />
                        </button>
                    )}
                    {meta && type === 'series' && (
                        <button className={`${s.iconBtn} ${panel === 'episodes' ? s.on : ''}`} onClick={() => setPanel(panel === 'episodes' ? null : 'episodes')} aria-label="Episodes">
                            <EpisodesIcon size={24} />
                        </button>
                    )}
                    <button className={`${s.textBtn} ${panel === 'speed' ? s.on : ''}`} onClick={() => setPanel(panel === 'speed' ? null : 'speed')} aria-label="Playback speed">
                        {state.playbackSpeed ?? 1}x
                    </button>
                    <button className={`${s.iconBtn} ${panel === 'subs' ? s.on : ''}`} onClick={() => setPanel(panel === 'subs' ? null : 'subs')} aria-label="Subtitles and audio">
                        <SubtitlesIcon size={24} />
                    </button>
                    <button className={s.iconBtn} onClick={toggleFullscreen} aria-label="Fullscreen">
                        <FullscreenIcon size={24} />
                    </button>
                </div>
            </div>

            {panel === 'speed' && (
                <div className={`${s.panel} ${s.small}`} onClick={(e) => e.stopPropagation()}>
                    <div className={s.panelHead}>Speed</div>
                    {SPEEDS.map((sp) => (
                        <button key={sp} className={`${s.option} ${(state.playbackSpeed ?? 1) === sp ? s.optionOn : ''}`} onClick={() => setProp('playbackSpeed', sp)}>
                            {sp}x
                        </button>
                    ))}
                </div>
            )}

            {panel === 'subs' && (
                <div className={s.panel} onClick={(e) => e.stopPropagation()}>
                    <div className={s.panelHead}>Subtitles</div>
                    <button
                        className={`${s.option} ${!state.selectedSubtitlesTrackId && !state.selectedExtraSubtitlesTrackId ? s.optionOn : ''}`}
                        onClick={() => {
                            setProp('selectedSubtitlesTrackId', null);
                            setProp('selectedExtraSubtitlesTrackId', null);
                        }}
                    >
                        Off
                    </button>
                    <div className={s.scroll}>
                        {state.subtitlesTracks.map((t) => (
                            <button
                                key={`e${t.id}`}
                                className={`${s.option} ${state.selectedSubtitlesTrackId === t.id ? s.optionOn : ''}`}
                                onClick={() => {
                                    setProp('selectedExtraSubtitlesTrackId', null);
                                    setProp('selectedSubtitlesTrackId', t.id);
                                }}
                            >
                                {t.label || t.lang || 'Track'} <span className={s.origin}>Embedded</span>
                            </button>
                        ))}
                        {state.extraSubtitlesTracks.map((t) => (
                            <button
                                key={`x${t.id}`}
                                className={`${s.option} ${state.selectedExtraSubtitlesTrackId === t.id ? s.optionOn : ''}`}
                                onClick={() => {
                                    setProp('selectedSubtitlesTrackId', null);
                                    setProp('selectedExtraSubtitlesTrackId', t.id);
                                }}
                            >
                                {t.label || t.lang} <span className={s.origin}>{t.origin ?? 'Addon'}</span>
                            </button>
                        ))}
                    </div>
                    {state.audioTracks.length > 1 && (
                        <>
                            <div className={s.panelHead}>Audio</div>
                            {state.audioTracks.map((t) => (
                                <button key={`a${t.id}`} className={`${s.option} ${state.selectedAudioTrackId === t.id ? s.optionOn : ''}`} onClick={() => setProp('selectedAudioTrackId', t.id)}>
                                    {t.label || t.lang || `Track ${t.id}`}
                                </button>
                            ))}
                        </>
                    )}
                    <div className={s.subStyle}>
                        <Stepper
                            label="Size"
                            value={`${size}%`}
                            onDown={() => changeSubSize(stepSize(size, -1))}
                            onUp={() => changeSubSize(stepSize(size, 1))}
                            canDown={size > SUB_SIZES[0]}
                            canUp={size < SUB_SIZES[SUB_SIZES.length - 1]}
                        />
                        <Stepper
                            label="Position"
                            value={offset === 0 ? 'Bottom' : `+${offset}`}
                            downLabel="Move subtitles down"
                            upLabel="Move subtitles up"
                            onDown={() => changeSubOffset(Math.max(0, offset - 5))}
                            onUp={() => changeSubOffset(Math.min(50, offset + 5))}
                            canDown={offset > 0}
                            canUp={offset < 50}
                        />
                        <Stepper
                            label="Delay"
                            value={`${subDelay > 0 ? '+' : ''}${(subDelay / 1000).toFixed(1)}s`}
                            downLabel="Show subtitles earlier"
                            upLabel="Show subtitles later"
                            onDown={() => changeSubDelay(subDelay - 100)}
                            onUp={() => changeSubDelay(subDelay + 100)}
                            onReset={subDelay !== 0 ? () => changeSubDelay(0) : undefined}
                        />
                    </div>
                </div>
            )}

            {panel === 'episodes' && meta && (
                <EpisodesPanel videos={meta.videos} currentId={videoId} season={series?.season ?? current?.season} onPick={(v) => goNext(v)} />
            )}
        </div>
    );
}

/** Next size step up or down (sizes saved by other apps may fall between steps). */
function stepSize(current: number, dir: 1 | -1) {
    const next = dir > 0 ? SUB_SIZES.find((x) => x > current) : [...SUB_SIZES].reverse().find((x) => x < current);
    return next ?? current;
}

function Stepper(props: {
    label: string;
    value: string;
    onDown: () => void;
    onUp: () => void;
    canDown?: boolean;
    canUp?: boolean;
    downLabel?: string;
    upLabel?: string;
    onReset?: () => void;
}) {
    const { label, value, onDown, onUp, canDown = true, canUp = true, downLabel, upLabel, onReset } = props;
    return (
        <div className={s.stepper}>
            <span className={s.stepLabel}>{label}</span>
            <button className={s.stepBtn} onClick={onDown} disabled={!canDown} aria-label={downLabel ?? `Smaller ${label.toLowerCase()}`}>
                −
            </button>
            {onReset ? (
                <button className={s.stepValue} onClick={onReset} title="Reset" aria-label={`${label} ${value}, reset`}>
                    {value}
                </button>
            ) : (
                <span className={s.stepValue} aria-live="polite">
                    {value}
                </span>
            )}
            <button className={s.stepBtn} onClick={onUp} disabled={!canUp} aria-label={upLabel ?? `Bigger ${label.toLowerCase()}`}>
                +
            </button>
        </div>
    );
}

type TorrentStats ={ peers: number; unique: number; downloadSpeed: number; downloaded: number; name: string | null };

/** While a torrent is starting, poll the streaming server for peers and speed (once a second). */
function useTorrentStats(infoHash: string | null, serverUrl: string | null) {
    const [stats, setStats] = useState<TorrentStats | null>(null);
    useEffect(() => {
        setStats(null);
        if (!infoHash || !serverUrl) return;
        let alive = true;
        const tick = async () => {
            try {
                const res = await fetch(new URL(`${infoHash}/stats.json`, serverUrl), { cache: 'no-store' });
                if (res.ok && alive) setStats(await res.json());
            } catch {
                /* server busy; try again next tick */
            }
        };
        void tick();
        const id = window.setInterval(tick, 1000);
        return () => {
            alive = false;
            window.clearInterval(id);
        };
    }, [infoHash, serverUrl]);
    return stats;
}

function torrentStatus(t: TorrentStats) {
    const speed = t.downloadSpeed > 0 ? ` · ${(t.downloadSpeed / 1_048_576).toFixed(1)} MB/s` : '';
    if (t.peers > 0) return `Downloading from ${t.peers} peer${t.peers === 1 ? '' : 's'}${speed}`;
    if (t.unique > 0) return `Connecting to peers · ${t.unique} found`;
    return 'Looking for peers…';
}

function Seekbar({ time, duration, buffered, onSeek }: { time: number | null; duration: number | null; buffered: number | null; onSeek: (ms: number) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const [hover, setHover] = useState<number | null>(null);
    const [drag, setDrag] = useState<number | null>(null);
    const d = duration ?? 0;
    const pos = (clientX: number) => {
        const r = ref.current!.getBoundingClientRect();
        return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * d;
    };
    const shown = drag ?? time ?? 0;
    return (
        <div
            ref={ref}
            className={s.seek}
            onPointerMove={(e) => {
                setHover(pos(e.clientX));
                if (drag !== null) setDrag(pos(e.clientX));
            }}
            onPointerLeave={() => setHover(null)}
            onPointerDown={(e) => {
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                setDrag(pos(e.clientX));
            }}
            onPointerUp={(e) => {
                if (drag !== null) onSeek(pos(e.clientX));
                setDrag(null);
            }}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(d / 1000)}
            aria-valuenow={Math.round(shown / 1000)}
        >
            <div className={s.seekTrack}>
                {buffered !== null && d > 0 && <div className={s.seekBuffered} style={{ width: `${(buffered / d) * 100}%` }} />}
                <div className={s.seekFill} style={{ width: d ? `${(shown / d) * 100}%` : 0 }} />
                <div className={s.seekThumb} style={{ left: d ? `${(shown / d) * 100}%` : 0 }} />
            </div>
            {hover !== null && d > 0 && (
                <div className={s.seekTip} style={{ left: `${(hover / d) * 100}%` }}>
                    {formatTime(hover / 1000)}
                </div>
            )}
        </div>
    );
}

function EpisodesPanel({ videos, currentId, season, onPick }: { videos: Video[]; currentId: string; season?: number; onPick: (v: Video) => void }) {
    const list = videos.filter((v) => v.season === season).sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0));
    const seasonWatched = list.length > 0 && list.every((v) => v.watched);
    const currentRef = useRef<HTMLButtonElement>(null);
    // Block body on purpose: newer Chromium returns a Promise from scrollIntoView, and an effect
    // must not return anything but a cleanup function.
    useEffect(() => {
        currentRef.current?.scrollIntoView({ block: 'center' });
    }, []);
    return (
        <div className={`${s.panel} ${s.episodes}`} onClick={(e) => e.stopPropagation()}>
            <div className={s.epHead}>
                <div className={s.panelHead}>Season {season}</div>
                {season !== undefined && list.length > 0 && (
                    <button className={s.seasonBtn} onClick={() => void setPlayerSeasonWatched(season, !seasonWatched)}>
                        {seasonWatched ? 'Mark season unwatched' : 'Mark season watched'}
                    </button>
                )}
            </div>
            <div className={s.scroll}>
                {list.map((v) => (
                    <div key={v.id} className={s.epRow}>
                        <button ref={v.id === currentId ? currentRef : undefined} className={`${s.ep} ${v.id === currentId ? s.optionOn : ''}`} onClick={() => v.id !== currentId && onPick(v)}>
                            <div className={s.epThumb}>
                                <Img src={v.thumbnail} alt="" />
                                {v.watched && <span className={s.watched}>Watched</span>}
                            </div>
                            <div className={s.epBody}>
                                <div className={s.epNum}>Episode {v.episode}</div>
                                <div className={s.epTitle}>{v.title}</div>
                                {v.overview && <div className={s.epDesc}>{v.overview}</div>}
                            </div>
                        </button>
                        <button
                            className={`${s.epCheck} ${v.watched ? s.epCheckOn : ''}`}
                            onClick={() => void setPlayerEpisodeWatched(v, !v.watched)}
                            aria-label={v.watched ? `Mark episode ${v.episode} as unwatched` : `Mark episode ${v.episode} as watched`}
                            aria-pressed={v.watched}
                            title={v.watched ? 'Mark as unwatched' : 'Mark as watched'}
                        >
                            <CheckIcon size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
