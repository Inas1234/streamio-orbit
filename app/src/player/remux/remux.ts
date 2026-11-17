/**
 * Rewraps a video file (MKV and friends) into fragmented MP4, which Safari's media pipeline accepts.
 * The video and audio data are copied as they are: nothing is decoded or re-encoded, so the phone's
 * hardware decoder does the real work during playback.
 */
import {
    ALL_FORMATS,
    BlobSource,
    EncodedAudioPacketSource,
    EncodedPacketSink,
    EncodedVideoPacketSource,
    Input,
    Mp4OutputFormat,
    Output,
    StreamTarget,
    UrlSource,
    type EncodedPacket,
    type InputAudioTrack,
    type InputTrack,
    type InputVideoTrack,
} from 'mediabunny';
import type { TrackInfo } from './pickTracks';

export type OpenedFile = {
    input: Input;
    video: InputVideoTrack[];
    audio: InputAudioTrack[];
    /** Seconds. */
    duration: number;
    format: 'mp4' | 'matroska' | 'other';
};

function formatOf(mime: string): OpenedFile['format'] {
    if (/x-matroska|webm/.test(mime)) return 'matroska';
    if (/mp4|quicktime/.test(mime)) return 'mp4';
    return 'other';
}

/**
 * Seconds to wait before retrying a failed read, or null to give up: 1, 2, 4, 8, 8, 8.
 * Mediabunny's own rule never retries what looks like a browser block, and Safari reports a dropped
 * connection (Wi-Fi to mobile, screen lock) the same way, so a short blip would end playback.
 */
export function retryDelay(previousAttempts: number): number | null {
    if (previousAttempts > 6) return null;
    return Math.min(2 ** (previousAttempts - 1), 8);
}

/** Opens a file by link (read in pieces with byte ranges) or from memory. Only the header is read here. */
export async function openFile(src: string | Blob): Promise<OpenedFile> {
    const source =
        typeof src === 'string' ? new UrlSource(src, { maxCacheSize: 32 * 1024 * 1024, getRetryDelay: retryDelay }) : new BlobSource(src);
    const input = new Input({ source, formats: ALL_FORMATS });
    try {
        const [mime, video, audio] = await Promise.all([input.getMimeType(), input.getVideoTracks(), input.getAudioTracks()]);
        const duration = (await input.getDurationFromMetadata().catch(() => null)) ?? (await input.computeDuration());
        return { input, video, audio, duration, format: formatOf(mime) };
    } catch (e) {
        input.dispose();
        throw e;
    }
}

export async function toTrackInfo(track: InputTrack): Promise<TrackInfo> {
    const [codecString, language] = await Promise.all([track.getCodecParameterString().catch(() => null), track.getLanguageCode()]);
    return { id: track.id, codec: track.codec, codecString, language, isDefault: !!track.disposition?.default };
}

type RemuxOptions = {
    video: InputVideoTrack;
    audio: InputAudioTrack | null;
    /** Seconds; output starts at the key frame at or before this time. */
    start: number;
    /** Receives the output in order: the init segment first, then fragments. Awaiting it slows reading down. */
    write: (bytes: Uint8Array) => Promise<void>;
    signal: AbortSignal;
};

/**
 * Writes the chosen tracks from `start` to the end of the file as fragmented MP4.
 * Timestamps stay those of the source file, so output from a later call (after a seek) lines up with earlier output.
 * Resolves at the end of the file, or soon after `signal` aborts.
 */
export async function remuxFrom({ video, audio, start, write, signal }: RemuxOptions): Promise<void> {
    if (signal.aborted) return;
    const output = new Output({
        format: new Mp4OutputFormat({ fastStart: 'fragmented', minimumFragmentDuration: 1 }),
        target: new StreamTarget(new WritableStream({ write: (chunk) => (signal.aborted ? undefined : write(chunk.data)) })),
    });

    const videoCodec = video.codec;
    if (!videoCodec) throw new Error('Unknown video codec');
    const videoSource = new EncodedVideoPacketSource(videoCodec);
    output.addVideoTrack(videoSource, { languageCode: video.languageCode, rotation: video.rotation });
    let audioSource: EncodedAudioPacketSource | null = null;
    if (audio) {
        if (!audio.codec) throw new Error('Unknown audio codec');
        audioSource = new EncodedAudioPacketSource(audio.codec);
        output.addAudioTrack(audioSource, { languageCode: audio.languageCode });
    }

    const videoSink = new EncodedPacketSink(video);
    const firstVideo = (await videoSink.getKeyPacket(start)) ?? (await videoSink.getFirstKeyPacket());
    if (!firstVideo) return;
    const videoPackets = videoSink.packets(firstVideo);
    let audioPackets: AsyncGenerator<EncodedPacket> | null = null;
    if (audio) {
        const audioSink = new EncodedPacketSink(audio);
        const firstAudio = (await audioSink.getPacket(firstVideo.timestamp)) ?? (await audioSink.getFirstPacket());
        if (firstAudio) audioPackets = audioSink.packets(firstAudio);
    }

    const [videoConfig, audioConfig] = await Promise.all([video.getDecoderConfig(), audio?.getDecoderConfig() ?? null]);
    await output.start();

    let v = (await videoPackets.next()).value ?? null;
    let a = audioPackets ? ((await audioPackets.next()).value ?? null) : null;
    let videoMeta: { decoderConfig: VideoDecoderConfig } | undefined = videoConfig ? { decoderConfig: videoConfig } : undefined;
    let audioMeta: { decoderConfig: AudioDecoderConfig } | undefined = audioConfig ? { decoderConfig: audioConfig } : undefined;

    try {
        // Interleave both tracks by time so neither runs far ahead of the other in the output.
        while ((v || a) && !signal.aborted) {
            if (v && (!a || v.timestamp <= a.timestamp)) {
                await videoSource.add(v, videoMeta);
                videoMeta = undefined;
                v = (await videoPackets.next()).value ?? null;
            } else if (a && audioSource) {
                await audioSource.add(a, audioMeta);
                audioMeta = undefined;
                a = (await audioPackets!.next()).value ?? null;
            }
        }
        if (signal.aborted) await output.cancel();
        else await output.finalize();
    } catch (e) {
        await output.cancel().catch(() => {});
        if (!signal.aborted) throw e;
    } finally {
        void videoPackets.return(undefined);
        void audioPackets?.return(undefined);
    }
}
