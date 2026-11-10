import type { CardData } from '../components/Card';
import type { LibraryItem, MetaPreview } from '../core/types';
import { addToList, dismissContinueWatching, isLibraryItemWatched, markPreviewWatched, removeFromList, setLibraryWatched } from './actions';
import { backdrop, imdbRating, poster, timeLeft } from './meta';

export const detailHref = (type: string, id: string, videoId?: string | null) =>
    `/detail/${encodeURIComponent(type)}/${encodeURIComponent(id)}${videoId ? `/${encodeURIComponent(videoId)}` : ''}`;

export function previewCard(item: MetaPreview, shape: 'wide' | 'poster' = 'wide'): CardData {
    const rating = imdbRating(item.links);
    return {
        key: `${item.type}:${item.id}`,
        href: detailHref(item.type, item.id),
        title: item.name,
        image: shape === 'wide' ? backdrop(item) : poster(item),
        fallback: item.poster,
        preview: item,
        menu: (go) => {
            // Search and Discover lists say whether a title is in My List; home rows don't.
            const inList = (item as MetaPreview & { inLibrary?: boolean }).inLibrary;
            return [
                { label: 'Open', onSelect: () => go(detailHref(item.type, item.id)) },
                inList
                    ? { label: 'Remove from My List', onSelect: () => void removeFromList(item.id), separated: true }
                    : { label: 'Add to My List', onSelect: () => void addToList(item), separated: true },
                { label: 'Mark as watched', onSelect: () => void markPreviewWatched(item) },
            ];
        },
        meta: (
            <>
                {rating && (
                    <span className="rating">
                        <span className="imdb">IMDb</span>
                        {rating}
                    </span>
                )}
                {item.releaseInfo && <span>{item.releaseInfo}</span>}
            </>
        ),
    };
}

export function libraryCard(item: LibraryItem, opts: { continueWatching?: boolean } = {}): CardData {
    const { timeOffset = 0, duration = 0, video_id = null } = item.state ?? {};
    const progress = duration > 0 ? timeOffset / duration : 0;
    const ep = video_id?.match(/:(\d+):(\d+)$/);
    return {
        key: `lib:${item._id}`,
        href: detailHref(item.type, item._id, item.type === 'series' ? video_id : null),
        title: item.name,
        image: backdrop({ id: item._id, background: null, poster: item.poster }),
        fallback: item.poster,
        progress,
        menu: (go) => {
            const watched = isLibraryItemWatched(item);
            const resumeHref = detailHref(item.type, item._id, item.type === 'series' ? video_id : null);
            return [
                { label: progress > 0 ? 'Resume' : 'Open', onSelect: () => go(resumeHref) },
                { label: 'Open details', onSelect: () => go(detailHref(item.type, item._id)) },
                { label: watched ? 'Mark as unwatched' : 'Mark as watched', onSelect: () => void setLibraryWatched(item._id, !watched), separated: true },
                ...(opts.continueWatching || progress > 0 ? [{ label: 'Remove from Continue watching', onSelect: () => void dismissContinueWatching(item._id) }] : []),
                item.removed
                    ? {
                          label: 'Add to My List',
                          onSelect: () => void addToList({ id: item._id, type: item.type, name: item.name, poster: item.poster, posterShape: item.posterShape } as MetaPreview),
                          separated: true,
                      }
                    : { label: 'Remove from My List', onSelect: () => void removeFromList(item._id), danger: true, separated: true },
            ];
        },
        meta: (
            <>
                {ep && <span>S{ep[1]} · E{ep[2]}</span>}
                {duration > 0 && <span>{timeLeft(timeOffset, duration)}</span>}
            </>
        ),
    };
}
