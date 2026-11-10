// Library and watched-state actions, using the same engine calls as Stremio's own interface.
import { core, ctxAction } from '../core/core';
import type { LibraryItem, MetaPreview, Video } from '../core/types';

export const addToList = (meta: MetaPreview) => core.dispatch(ctxAction('AddToLibrary', meta));
export const removeFromList = (id: string) => core.dispatch(ctxAction('RemoveFromLibrary', id));

/** Works on titles already in the library. */
export const setLibraryWatched = (id: string, watched: boolean) =>
    core.dispatch(ctxAction('LibraryItemMarkAsWatched', { id, is_watched: watched }));

/** From a catalog card: the title joins My List (that's where watched state lives), then gets marked. */
export async function markPreviewWatched(meta: MetaPreview) {
    await addToList(meta);
    await setLibraryWatched(meta.id, true);
}

/** Removes a title from Continue watching without deleting it from My List. */
export async function dismissContinueWatching(id: string) {
    await core.dispatch(ctxAction('RewindLibraryItem', id));
    await core.dispatch(ctxAction('DismissNotificationItem', id));
}

export const isLibraryItemWatched = (item: LibraryItem) => (item.state?.timesWatched ?? 0) > 0 || (item.state?.flaggedWatched ?? 0) > 0;

// These act on the title page that's currently open (the meta_details model).
const metaDetails = (action: string, args: unknown) => core.dispatch({ action: 'MetaDetails', args: { action, args } }, 'meta_details');
export const setTitleWatched = (watched: boolean) => metaDetails('MarkAsWatched', watched);
export const setEpisodeWatched = (video: Video, watched: boolean) => metaDetails('MarkVideoAsWatched', [video, watched]);
export const setSeasonWatched = (season: number, watched: boolean) => metaDetails('MarkSeasonAsWatched', [season, watched]);

// The same, from inside the player (the player model).
const playerAction = (action: string, args: unknown) => core.dispatch({ action: 'Player', args: { action, args } }, 'player');
export const setPlayerEpisodeWatched = (video: Video, watched: boolean) => playerAction('MarkVideoAsWatched', [video, watched]);
export const setPlayerSeasonWatched = (season: number, watched: boolean) => playerAction('MarkSeasonAsWatched', [season, watched]);
