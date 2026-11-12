import { core } from '../core/core';
import type { Addon, Stream } from '../core/types';
import { shell } from '../shell/shell';

type Args = {
    stream: Stream;
    streamAddon?: Addon | null;
    metaAddon?: Addon | null;
    type: string;
    id: string;
    videoId: string;
};

/** Streams that point at another app or website (e.g. a Netflix link) open outside the player. */
export function opensExternally(stream: Stream) {
    if (!stream.externalUrl) return false;
    shell.openExternal(stream.externalUrl);
    return true;
}

export async function playerHref({ stream, streamAddon, metaAddon, type, id, videoId }: Args) {
    const encoded = await core.encodeStream(stream);
    const params = new URLSearchParams({ stream: encoded, type, id, videoId });
    if (streamAddon) params.set('streamTransportUrl', streamAddon.transportUrl);
    if (metaAddon) params.set('metaTransportUrl', metaAddon.transportUrl);
    return `/player?${params.toString()}`;
}

/**
 * Turns the engine's player link ("#/player/<stream>/<stream addon>/<meta addon>/<type>/<id>/<video>")
 * into this app's player URL. The engine only has one for titles you've played on this device.
 */
export function playerHrefFromDeepLink(deepLink: string | null | undefined) {
    // The engine may add "?position=<seconds>"; the player resumes from your library progress anyway.
    const m = deepLink?.match(/\/player\/([^/]+)\/([^/]*)\/([^/]*)\/([^/]+)\/([^/]+)\/([^/?]+)(?:\?.*)?$/);
    if (!m) return null;
    const [stream, streamTransportUrl, metaTransportUrl, type, id, videoId] = m.slice(1).map(decodeURIComponent);
    const params = new URLSearchParams({ stream, type, id, videoId });
    if (streamTransportUrl) params.set('streamTransportUrl', streamTransportUrl);
    if (metaTransportUrl) params.set('metaTransportUrl', metaTransportUrl);
    return `/player?${params.toString()}`;
}
