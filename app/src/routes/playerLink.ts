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
