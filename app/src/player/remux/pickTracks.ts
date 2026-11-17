export type TrackInfo = {
    id: number;
    codec: string | null;
    /** The codec as browsers name it, e.g. "avc1.640028" or "ec-3". */
    codecString: string | null;
    /** ISO 639-2 code, "und" when unknown. */
    language: string;
    isDefault: boolean;
};

export type TrackChoice = { video: TrackInfo; audio: TrackInfo | null } | { unplayable: 'video' | 'audio' };

/**
 * Picks the video and audio track to play, among the ones this browser can decode.
 * Audio: your preferred language first, then the file's default track, then the first one that plays.
 */
export function pickTracks(video: TrackInfo[], audio: TrackInfo[], canPlay: (mime: string) => boolean, preferredLang?: string | null): TrackChoice {
    const plays = (kind: 'video' | 'audio') => (track: TrackInfo) => !!track.codecString && canPlay(`${kind}/mp4; codecs="${track.codecString}"`);
    const v = video.find(plays('video'));
    if (!v) return { unplayable: 'video' };
    if (!audio.length) return { video: v, audio: null };
    const playable = audio.filter(plays('audio'));
    if (!playable.length) return { unplayable: 'audio' };
    const a = (preferredLang && playable.find((x) => x.language === preferredLang)) || playable.find((x) => x.isDefault) || playable[0];
    return { video: v, audio: a };
}
