/**
 * Plays a repackaged file in a <video> element through Media Source Extensions.
 *
 * Reads ahead about a minute, drops what's well behind (phones have little memory for this), and when
 * you seek somewhere not loaded yet, restarts reading from the key frame before that point.
 * On iPhone this uses ManagedMediaSource (iOS 17.1+), which also tells us when to pause downloading.
 */
import type { InputAudioTrack, InputVideoTrack } from 'mediabunny';
import { remuxFrom, type OpenedFile } from './remux';

const AHEAD = 60;
const BEHIND = 30;

type Tracks = { video: InputVideoTrack; audio: InputAudioTrack | null };

const ManagedMS = (globalThis as { ManagedMediaSource?: typeof MediaSource }).ManagedMediaSource;

export function mediaSourceClass(): typeof MediaSource | null {
    return ManagedMS ?? (typeof MediaSource === 'function' ? MediaSource : null);
}

export class RemuxSession {
    readonly url: string;
    onError: ((e: unknown) => void) | null = null;

    private readonly ms: MediaSource;
    private sb: SourceBuffer | null = null;
    private video: HTMLVideoElement | null = null;
    private ctrl: AbortController | null = null;
    private reading: Promise<void> = Promise.resolve();
    /** Where the current read started (seconds) and how far it has got. */
    private readFrom = 0;
    private readTo = 0;
    private streaming = true;
    private wakers: Array<() => void> = [];
    private destroyed = false;
    private readonly cleanups: Array<() => void> = [];

    constructor(
        private readonly file: OpenedFile,
        private readonly tracks: Tracks,
        private readonly start: number,
    ) {
        const MS = mediaSourceClass();
        if (!MS) throw new Error('No MediaSource in this browser');
        this.ms = new MS();
        this.url = URL.createObjectURL(this.ms);
        this.listen(this.ms, 'sourceopen', () => void this.open());
        // ManagedMediaSource says when the system wants us to download (e.g. not on low battery / bad network).
        this.listen(this.ms, 'startstreaming', () => {
            this.streaming = true;
            this.wake();
        });
        this.listen(this.ms, 'endstreaming', () => {
            this.streaming = false;
        });
    }

    /** Call once the player has made its <video> element, before it gets `url` as its source. */
    bind(video: HTMLVideoElement) {
        if (this.video === video) return;
        this.video = video;
        // Required for ManagedMediaSource on iPhone (otherwise the source never opens).
        video.disableRemotePlayback = true;
        this.listen(video, 'seeking', () => this.onSeeking());
        for (const ev of ['timeupdate', 'progress', 'playing', 'seeked']) this.listen(video, ev, () => this.wake());
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.ctrl?.abort();
        this.wake();
        this.cleanups.forEach((f) => f());
        this.file.input.dispose();
        URL.revokeObjectURL(this.url);
    }

    // ---- setup ----

    private async open() {
        if (this.destroyed || this.sb) return;
        try {
            const [v, a] = await Promise.all([this.tracks.video.getCodecParameterString(), this.tracks.audio?.getCodecParameterString() ?? null]);
            const codecs = [v, a].filter(Boolean).join(',');
            this.sb = this.ms.addSourceBuffer(`video/mp4; codecs="${codecs}"`);
            this.sb.mode = 'segments';
            if (Number.isFinite(this.file.duration) && this.file.duration > 0) this.ms.duration = this.file.duration;
            const managed = (this.ms as MediaSource & { streaming?: boolean }).streaming;
            if (typeof managed === 'boolean') this.streaming = managed;
            this.startReading(this.start);
        } catch (e) {
            this.fail(e);
        }
    }

    // ---- reading ----

    private startReading(at: number) {
        const previous = this.reading;
        this.ctrl?.abort();
        const ctrl = new AbortController();
        this.ctrl = ctrl;
        this.wake();
        this.readFrom = at;
        this.readTo = at;
        this.reading = (async () => {
            await previous;
            if (ctrl.signal.aborted || this.destroyed) return;
            await this.idle();
            // A fresh init segment follows: reset the parser so a half-appended fragment can't linger.
            if (this.ms.readyState === 'open') this.sb!.abort();
            await remuxFrom({
                video: this.tracks.video,
                audio: this.tracks.audio,
                start: at,
                signal: ctrl.signal,
                write: (bytes) => this.append(bytes, ctrl.signal),
            });
            if (ctrl.signal.aborted || this.destroyed) return;
            await this.idle();
            if (this.ms.readyState === 'open') this.ms.endOfStream();
        })().catch((e) => {
            if (!ctrl.signal.aborted && !this.destroyed) this.fail(e);
        });
    }

    private async append(bytes: Uint8Array, signal: AbortSignal) {
        // The init segment always goes in; media waits while enough is loaded or the system says pause.
        while (!signal.aborted && this.readTo > this.readFrom && (!this.streaming || this.ahead() >= AHEAD)) await this.sleep();
        if (signal.aborted) return;
        await this.trimBehind(BEHIND);
        try {
            await this.appendRaw(bytes);
        } catch (e) {
            if ((e as DOMException)?.name !== 'QuotaExceededError') throw e;
            await this.trimBehind(5);
            await this.appendRaw(bytes);
        }
        const now = this.video?.currentTime ?? this.readFrom;
        this.readTo = Math.max(this.readTo, this.rangeEnd(Math.max(now, this.readFrom)) ?? this.readTo, this.readFrom + 0.001);
    }

    private async appendRaw(bytes: Uint8Array) {
        await this.idle();
        if (this.destroyed || !this.sb) return;
        // After endOfStream (readyState 'ended'), appending reopens the source, e.g. after a seek back.
        await this.run(() => this.sb!.appendBuffer(bytes as BufferSource));
    }

    private async trimBehind(keep: number) {
        const t = this.video?.currentTime;
        const sb = this.sb;
        if (t === undefined || !sb || !sb.buffered.length) return;
        const cut = t - keep;
        if (cut > sb.buffered.start(0) + 1) await this.run(() => sb.remove(0, cut));
    }

    /** Runs an operation on the SourceBuffer and waits for it to finish. */
    private run(op: () => void) {
        const sb = this.sb!;
        return new Promise<void>((resolve, reject) => {
            const done = () => {
                sb.removeEventListener('updateend', done);
                sb.removeEventListener('error', failed);
                resolve();
            };
            const failed = () => {
                sb.removeEventListener('updateend', done);
                sb.removeEventListener('error', failed);
                reject(new Error('Could not add video data'));
            };
            sb.addEventListener('updateend', done);
            sb.addEventListener('error', failed);
            try {
                op();
            } catch (e) {
                sb.removeEventListener('updateend', done);
                sb.removeEventListener('error', failed);
                reject(e);
            }
        });
    }

    private async idle() {
        while (this.sb?.updating && !this.destroyed) await new Promise((r) => this.sb!.addEventListener('updateend', r, { once: true }));
    }

    // ---- seeking ----

    private onSeeking() {
        const t = this.video?.currentTime;
        if (t === undefined || this.destroyed || !this.sb) return;
        if (this.rangeEnd(t) !== null) return; // already loaded
        // Just ahead of what the current read is about to deliver: let it catch up instead of restarting.
        if (t >= this.readFrom - 0.5 && t <= this.readTo + 5) return;
        this.startReading(t);
    }

    // ---- helpers ----

    /** End of the loaded range containing `t`, or null. */
    private rangeEnd(t: number): number | null {
        const b = this.sb?.buffered;
        if (!b) return null;
        for (let i = 0; i < b.length; i++) if (b.start(i) - 0.3 <= t && t <= b.end(i)) return b.end(i);
        return null;
    }

    private ahead() {
        const t = this.video?.currentTime ?? this.readFrom;
        const end = this.rangeEnd(t);
        return end === null ? 0 : end - t;
    }

    private sleep() {
        return new Promise<void>((resolve) => {
            const timer = setTimeout(go, 1000);
            function go() {
                clearTimeout(timer);
                resolve();
            }
            this.wakers.push(go);
        });
    }

    private wake() {
        const w = this.wakers;
        this.wakers = [];
        w.forEach((f) => f());
    }

    private fail(e: unknown) {
        console.warn('remux', e);
        this.onError?.(e);
    }

    private listen(target: EventTarget, type: string, fn: () => void) {
        target.addEventListener(type, fn);
        this.cleanups.push(() => target.removeEventListener(type, fn));
    }
}
