import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { core, ctxAction } from '../core/core';
import { backdrop, genres, logo } from '../lib/meta';
import { srcSetFor } from './Card';
import { CheckIcon, ChevronDown, PlayIcon, PlusIcon } from './Icons';
import { Img } from './Img';
import { closePreview, usePreview } from './preview';
import { prefetchStreams } from '../lib/prefetch';
import { useFullMeta } from '../lib/fullMeta';
import s from './PreviewLayer.module.css';
import { Ratings } from './Ratings';

const MIN_WIDTH = 380;
const MARGIN = 16;

/** The expanded card that opens when you rest the pointer on a title. */
export function PreviewLayer() {
    const preview = usePreview();
    const navigate = useNavigate();
    const ref = useRef<HTMLDivElement>(null);
    const [added, setAdded] = useState(false);

    // Search results and some addons send bare entries; fill them in from the full title info.
    const { meta: item, loading } = useFullMeta(preview?.data.preview);
    // Always wide artwork, even when the card itself is a poster.
    const image = item ? backdrop(item) : null;

    useEffect(() => {
        setAdded(false);
    }, [image]);

    // Resting on a movie is a strong hint: get its sources ready.
    useEffect(() => {
        if (item?.type === 'movie') prefetchStreams('movie', item.id);
    }, [item?.type, item?.id]);

    // Close on scroll or when the window loses focus.
    useEffect(() => {
        if (!preview) return;
        const close = () => closePreview();
        window.addEventListener('scroll', close, { passive: true, capture: true });
        window.addEventListener('blur', close);
        return () => {
            window.removeEventListener('scroll', close, { capture: true });
            window.removeEventListener('blur', close);
        };
    }, [preview]);

    // Grow out of the card: start at the card's size and spring to full size.
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el || !preview) return;
        const r = preview.rect;
        const box = el.getBoundingClientRect();
        const sx = r.width / box.width;
        const dx = r.left + r.width / 2 - (box.left + box.width / 2);
        const dy = r.top - box.top;
        el.animate(
            [
                { transform: `translate(${dx}px, ${dy}px) scale(${sx})`, opacity: 0.6 },
                { transform: 'none', opacity: 1 },
            ],
            { duration: 320, easing: 'cubic-bezier(0.34, 1.3, 0.64, 1)' },
        );
    }, [preview]);

    if (!preview || !item) return null;

    const width = Math.max(MIN_WIDTH, preview.rect.width * 1.45);
    const centerX = preview.rect.left + preview.rect.width / 2;
    const left = Math.min(window.innerWidth - width - MARGIN, Math.max(MARGIN, centerX - width / 2));
    const top = Math.max(MARGIN, preview.rect.top - preview.rect.height * 0.28);
    const g = genres(item.links).slice(0, 3);
    const logoUrl = logo(item);
    const go = () => {
        closePreview();
        navigate(preview.data.href, { viewTransition: true });
    };
    const toggleList = () => {
        void core.dispatch(added ? ctxAction('RemoveFromLibrary', item.id) : ctxAction('AddToLibrary', item));
        setAdded(!added);
    };

    return createPortal(
        <div
            ref={ref}
            className={s.preview}
            style={{ left, top, width }}
            onMouseLeave={closePreview}
            role="dialog"
            aria-label={item.name}
        >
            <button className={s.art} onClick={go} tabIndex={-1} aria-hidden>
                <Img src={image} srcSet={srcSetFor(image)} sizes={`${Math.round(width)}px`} fallback={preview.data.fallback} alt="" eager />
                <div className={s.artShade} />
                {logoUrl ? <Img className={s.logo} src={logoUrl} alt="" eager /> : <div className={`${s.name} display`}>{item.name}</div>}
            </button>
            <div className={s.body}>
                <div className={s.actions}>
                    <button className={s.play} onClick={go} aria-label={`Play ${item.name}`}>
                        <PlayIcon size={18} />
                    </button>
                    <button className={`${s.round} ${added ? s.on : ''}`} onClick={toggleList} aria-label={added ? 'Remove from My List' : 'Add to My List'}>
                        {added ? <CheckIcon size={18} /> : <PlusIcon size={18} />}
                    </button>
                    <button className={`${s.round} ${s.more}`} onClick={go} aria-label="More info">
                        <ChevronDown size={18} />
                    </button>
                </div>
                <div className={s.meta}>
                    <Ratings id={item.id} links={item.links} />
                    {item.releaseInfo && <span>{item.releaseInfo}</span>}
                    {item.runtime && <span>{item.runtime}</span>}
                </div>
                {item.description ? (
                    <p className={s.desc}>{item.description}</p>
                ) : (
                    loading && (
                        <div className={s.descLoading} aria-hidden>
                            <span className="skeleton" />
                            <span className="skeleton" />
                            <span className="skeleton" />
                        </div>
                    )
                )}
                {g.length > 0 && (
                    <div className={s.genres}>
                        {g.map((x) => (
                            <span key={x}>{x}</span>
                        ))}
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}
