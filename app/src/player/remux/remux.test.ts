// Fixture: __fixtures__/tiny.mkv, 6 s 160x90 H.264 (key frame every 2 s) + AAC, made with:
// ffmpeg -f lavfi -i testsrc=size=160x90:rate=25:duration=6 -f lavfi -i sine=frequency=440:duration=6
//   -c:v libx264 -preset veryfast -g 50 -keyint_min 50 -sc_threshold 0 -pix_fmt yuv420p -c:a aac -b:a 32k -shortest tiny.mkv
import { readFileSync } from 'node:fs';
import { ALL_FORMATS, BufferSource, EncodedPacketSink, Input } from 'mediabunny';
import { describe, expect, it } from 'vitest';
import { openFile, remuxFrom, toTrackInfo } from './remux';

const fixture = () => new Blob([readFileSync(new URL('./__fixtures__/tiny.mkv', import.meta.url))]);

async function remuxToBytes(start: number, withAudio = true) {
    const file = await openFile(fixture());
    const parts: Uint8Array[] = [];
    await remuxFrom({
        video: file.video[0],
        audio: withAudio ? file.audio[0] : null,
        start,
        write: async (b) => void parts.push(b.slice()),
        signal: new AbortController().signal,
    });
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) (out.set(p, o), (o += p.length));
    return { out, parts };
}

const reopen = (bytes: Uint8Array) => new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });

describe('openFile', () => {
    it('reads tracks, duration and container of an MKV', async () => {
        const file = await openFile(fixture());
        expect(file.format).toBe('matroska');
        expect(file.video).toHaveLength(1);
        expect(file.audio).toHaveLength(1);
        expect(file.duration).toBeCloseTo(6, 0);
        const info = await toTrackInfo(file.video[0]);
        expect(info.codecString).toMatch(/^avc1\./);
        expect((await toTrackInfo(file.audio[0])).codecString).toMatch(/^mp4a\./);
    });
});

describe('remuxFrom', () => {
    it('full remux keeps both tracks and the duration', async () => {
        const { out } = await remuxToBytes(0);
        const input = reopen(out);
        expect(await input.getMimeType()).toMatch(/^video\/mp4/);
        expect(await input.getVideoTracks()).toHaveLength(1);
        expect(await input.getAudioTracks()).toHaveLength(1);
        expect(await input.computeDuration()).toBeGreaterThan(5.9);
        expect(await input.computeDuration()).toBeLessThan(6.2);
    });

    it('remux from 3.1 s starts at the 2 s key frame, keeping source times', async () => {
        const { out } = await remuxToBytes(3.1);
        const input = reopen(out);
        const first = await new EncodedPacketSink((await input.getPrimaryVideoTrack())!).getFirstPacket();
        expect(first!.timestamp).toBeCloseTo(2, 1);
        expect(first!.type).toBe('key');
        const firstAudio = await new EncodedPacketSink((await input.getPrimaryAudioTrack())!).getFirstPacket();
        // Within one audio packet (~23 ms) of the key frame, so there's sound from the first picture.
        expect(Math.abs(firstAudio!.timestamp - first!.timestamp)).toBeLessThan(0.05);
    });

    it('aborting stops writing', async () => {
        const file = await openFile(fixture());
        const ctrl = new AbortController();
        let writes = 0;
        await remuxFrom({
            video: file.video[0],
            audio: file.audio[0],
            start: 0,
            write: async () => {
                writes++;
                ctrl.abort();
            },
            signal: ctrl.signal,
        });
        expect(writes).toBeLessThanOrEqual(2);
    });

    it('video-only when audio is null', async () => {
        const { out } = await remuxToBytes(0, false);
        const input = reopen(out);
        expect(await input.getAudioTracks()).toHaveLength(0);
        expect(await input.getVideoTracks()).toHaveLength(1);
    });

    it('writes the start of the file (init segment) first', async () => {
        const { parts } = await remuxToBytes(0);
        const head = new TextDecoder().decode(parts[0].slice(4, 8));
        expect(head).toBe('ftyp');
    });
});
