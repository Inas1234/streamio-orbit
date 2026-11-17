import { describe, expect, it } from 'vitest';
import { pickTracks, type TrackInfo } from './pickTracks';

const t = (id: number, codecString: string, language = 'und', isDefault = false): TrackInfo => ({ id, codec: codecString.split('.')[0], codecString, language, isDefault });
const H264 = t(1, 'avc1.640028');
/** What an iPhone says yes to: no DTS or TrueHD. */
const iphone = (mime: string) => !/dtsc|dtsh|dtsl|mlpa/.test(mime);

describe('pickTracks', () => {
    it('picks the preferred-language playable audio over the default one', () => {
        const r = pickTracks([H264], [t(2, 'mp4a.40.2', 'ger', true), t(3, 'ec-3', 'eng')], iphone, 'eng');
        expect(r).toEqual({ video: H264, audio: expect.objectContaining({ id: 3 }) });
    });

    it('falls back to the default-flagged playable audio, then the first playable', () => {
        expect(pickTracks([H264], [t(2, 'mp4a.40.2', 'ger'), t(3, 'ac-3', 'fre', true)], iphone, 'eng')).toMatchObject({ audio: { id: 3 } });
        expect(pickTracks([H264], [t(2, 'dtsc', 'eng', true), t(3, 'ac-3', 'fre')], iphone, null)).toMatchObject({ audio: { id: 3 } });
    });

    it('skips DTS and picks the AC3 track', () => {
        expect(pickTracks([H264], [t(2, 'dtsc', 'eng', true), t(3, 'ac-3', 'eng')], iphone, 'eng')).toMatchObject({ audio: { id: 3 } });
    });

    it('only DTS audio → unplayable audio', () => {
        expect(pickTracks([H264], [t(2, 'dtsc', 'eng'), t(3, 'mlpa', 'eng')], iphone, 'eng')).toEqual({ unplayable: 'audio' });
    });

    it('no audio tracks at all → plays without sound', () => {
        expect(pickTracks([H264], [], iphone, 'eng')).toEqual({ video: H264, audio: null });
    });

    it('video codec not playable → unplayable video', () => {
        expect(pickTracks([t(1, 'vp08')], [t(2, 'mp4a.40.2')], (m) => !m.includes('vp08'), null)).toEqual({ unplayable: 'video' });
        expect(pickTracks([], [t(2, 'mp4a.40.2')], iphone, null)).toEqual({ unplayable: 'video' });
    });

    it('asks with the mp4 mime types', () => {
        const asked: string[] = [];
        pickTracks([H264], [t(2, 'mp4a.40.2')], (m) => (asked.push(m), true), null);
        expect(asked).toContain('video/mp4; codecs="avc1.640028"');
        expect(asked).toContain('audio/mp4; codecs="mp4a.40.2"');
    });

    it('a track with no codec string is not playable', () => {
        expect(pickTracks([{ ...H264, codecString: null }], [], iphone, null)).toEqual({ unplayable: 'video' });
    });
});
