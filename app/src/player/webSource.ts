/**
 * Web version only: decides how a direct (debrid) link plays in the browser.
 * - MP4 and anything we can't inspect: the browser plays the link itself, as before.
 * - MKV/WebM: repackaged on the device and fed to the player (see remux/).
 * - Nothing in the file this device can decode: say so (the player offers VLC / Infuse).
 */
import { lookupFileUrl, needsLookup } from './resolveClient';
import { pickTracks } from './remux/pickTracks';
import { mediaSourceClass, RemuxSession } from './remux/RemuxSession';
import { openFile, toTrackInfo, type OpenedFile } from './remux/remux';

export type WebStreamPlan = { kind: 'direct'; url: string } | { kind: 'remux'; session: RemuxSession } | { kind: 'unplayable'; reason: 'video' | 'audio' };

const OPEN_TIMEOUT = 15_000;

/** Opens the file, giving up after a while (the reader otherwise keeps retrying a dead link). */
function openWithTimeout(url: string) {
    return new Promise<OpenedFile>((resolve, reject) => {
        let late = false;
        const timer = setTimeout(() => {
            late = true;
            reject(new Error('Timed out reading the file'));
        }, OPEN_TIMEOUT);
        openFile(url).then(
            (file) => {
                clearTimeout(timer);
                if (late) file.input.dispose();
                else resolve(file);
            },
            (e) => {
                clearTimeout(timer);
                reject(e);
            },
        );
    });
}

export async function prepareWebStream(url: string, opts: { start: number; preferredLang: string | null }): Promise<WebStreamPlan> {
    const direct: WebStreamPlan = { kind: 'direct', url };
    const MS = mediaSourceClass();
    if (!MS) return direct;

    let fileUrl = url;
    if (needsLookup(url)) {
        const found = await lookupFileUrl(url);
        if (!found) return direct;
        fileUrl = found;
    }

    let file: OpenedFile;
    try {
        file = await openWithTimeout(fileUrl);
    } catch (e) {
        console.warn('web stream: could not read the file, playing the link directly', e);
        return direct;
    }
    if (file.format !== 'matroska') {
        file.input.dispose();
        return direct;
    }

    const [video, audio] = await Promise.all([Promise.all(file.video.map(toTrackInfo)), Promise.all(file.audio.map(toTrackInfo))]);
    const choice = pickTracks(video, audio, (mime) => MS.isTypeSupported(mime), opts.preferredLang);
    if ('unplayable' in choice) {
        file.input.dispose();
        return { kind: 'unplayable', reason: choice.unplayable };
    }
    const tracks = {
        video: file.video.find((t) => t.id === choice.video.id)!,
        audio: choice.audio ? file.audio.find((t) => t.id === choice.audio!.id)! : null,
    };
    return { kind: 'remux', session: new RemuxSession(file, tracks, opts.start) };
}
