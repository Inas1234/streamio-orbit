// Shapes of the Stremio core models this app reads. Only the fields we use.

export type Loadable<T> =
    | { type: 'Loading' }
    | { type: 'Ready'; content: T }
    | { type: 'Err'; content: unknown };

export type PosterShape = 'square' | 'landscape' | 'poster' | null;

export type Link = { name: string; category: string; url: string };

export type ResourcePath = { resource: string; type: string; id: string; extra: [string, string][] };

export type Addon = {
    transportUrl: string;
    manifest: { id: string; name: string; version: string; description?: string; logo?: string | null; types?: string[] };
    flags?: { official?: boolean; protected?: boolean };
};

export type MetaPreview = {
    id: string;
    type: string;
    name: string;
    description: string | null;
    logo: string | null;
    background: string | null;
    poster: string | null;
    posterShape: PosterShape;
    releaseInfo: string | null;
    runtime: string | null;
    links: Link[];
    trailerStreams: { ytId: string; description: string }[];
    deepLinks?: { metaDetailsVideos: string | null; metaDetailsStreams: string | null; player: string | null };
};

export type Stream = {
    name?: string;
    description?: string;
    title?: string;
    infoHash?: string;
    fileIdx?: number;
    url?: string;
    ytId?: string;
    externalUrl?: string;
    behaviorHints?: { bingeGroup?: string; filename?: string; videoSize?: number; notWebReady?: boolean };
    deepLinks?: { player: string | null };
};

export type Video = {
    id: string;
    title: string;
    overview: string | null;
    released: string | null;
    thumbnail: string | null;
    season?: number;
    episode?: number;
    watched: boolean;
    progress: number;
    upcoming: boolean;
    streams: Stream[];
};

export type MetaItem = MetaPreview & {
    videos: Video[];
    inLibrary: boolean;
    watched: boolean;
};

export type LibraryItem = {
    _id: string;
    name: string;
    type: string;
    poster: string | null;
    posterShape: PosterShape;
    removed: boolean;
    /** Played but never added: kept for Continue watching and history, hidden from My List. */
    temp?: boolean;
    _ctime?: string | null;
    _mtime?: string;
    state: {
        timeOffset: number;
        duration: number;
        video_id: string | null;
        lastWatched: string | null;
        timesWatched: number;
        flaggedWatched?: number;
        overallTimeWatched?: number;
        /** Which episodes are watched, packed: "<anchor video id>:<anchor length>:<zlib+base64 bits>". */
        watched?: string | null;
    };
    progress?: number;
    deepLinks?: { metaDetailsVideos: string | null; metaDetailsStreams: string | null; player: string | null };
};

export type Catalog<T> = {
    name?: string;
    type?: string;
    addon?: Addon;
    request?: { base: string; path: ResourcePath };
    content: T | null;
};

export type Board = {
    catalogs: Catalog<Loadable<MetaPreview[]>>[] | null;
};

// Each entry is the library item itself (older engine builds wrapped it as { libraryItem }).
export type ContinueWatchingPreview = {
    items: (LibraryItem | { libraryItem: LibraryItem })[];
};

export type MetaDetails = {
    metaItem: { addon: Addon; content: Loadable<MetaItem> } | null;
    libraryItem: LibraryItem | null;
    selected: { metaPath: ResourcePath; streamPath: ResourcePath | null } | null;
    streams: { addon: Addon; content: Loadable<Stream[]> }[];
    title: string | null;
};

export type Ctx = {
    profile: {
        auth: { key: string; user: { _id: string; email: string; avatar: string | null } } | null;
        addons: Addon[];
        settings: {
            streamingServerUrl: string;
            hardwareDecoding: boolean;
            surroundSound: boolean;
            assSubtitlesStyling: boolean;
            subtitlesLanguage: string | null;
            audioLanguage: string;
            bingeWatching: boolean;
            seekTimeDuration: number;
            [key: string]: unknown;
        };
    };
};

export type Search = {
    selected: { extra: [string, string][] } | null;
    catalogs: Catalog<Loadable<MetaPreview[]>>[];
};

export type Library = {
    selected: unknown;
    catalog: LibraryItem[];
};

export type StreamingServer = {
    selected: { transportUrl: string } | null;
    baseUrl: string | null;
    settings: Loadable<unknown> | null;
};

export type Player = {
    selected: {
        stream: Stream;
        metaRequest: { base: string; path: ResourcePath } | null;
        streamRequest: { base: string; path: ResourcePath } | null;
    } | null;
    metaItem: Loadable<MetaItem> | null;
    libraryItem: { _id: string; state: { timeOffset: number; video_id: string | null } } | null;
    nextVideo: Video | null;
    stream: Loadable<Stream> | null;
    seriesInfo: { season: number; episode: number } | null;
    subtitles: { id: string; lang: string; url?: string | null; label?: string | null }[];
    title: string | null;
};

export type ModelName =
    | 'ctx'
    | 'board'
    | 'continue_watching_preview'
    | 'meta_details'
    | 'search'
    | 'library'
    | 'player'
    | 'streaming_server'
    | 'discover';

export type CoreEvent =
    | { name: 'NewState'; args: ModelName[] }
    | { name: 'CoreEvent'; args: { event: string; args: any } };
