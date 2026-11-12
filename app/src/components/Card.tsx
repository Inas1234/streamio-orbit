import { memo, useRef, type ReactNode } from 'react';
import { Link, useNavigate, useViewTransitionState } from 'react-router-dom';
import type { MetaPreview } from '../core/types';
import { Img } from './Img';
import { cancelPreview, schedulePreview } from './preview';
import { openMenu, type MenuAction, type MenuEvent } from './menu';
import { longPress } from './longPress';
import s from './Card.module.css';

export type CardData = {
    key: string;
    href: string;
    title: string;
    image: string | null;
    fallback?: string | null;
    meta?: ReactNode;
    progress?: number;
    /** Small marker in the top-right corner (e.g. a watched-progress ring). */
    badge?: ReactNode;
    /** Full catalog entry, used for the hover preview. */
    preview?: MetaPreview;
    /** Right-click actions. `go` navigates within the app. */
    menu?: (go: (href: string) => void) => MenuAction[];
};

type Props = { data: CardData; shape?: 'wide' | 'poster'; rank?: number };

export const Card = memo(function Card({ data, shape = 'wide', rank }: Props) {
    const ref = useRef<HTMLAnchorElement>(null);
    const navigate = useNavigate();
    // While navigating to this card's page, its artwork becomes the shared element.
    // Only the card you clicked takes part, in case the same title sits in two rows.
    const clicked = useRef(false);
    const morphing = useViewTransitionState(data.href) && clicked.current;

    const showMenu = data.menu ? (e: MenuEvent) => openMenu(e, data.menu!((href) => navigate(href, { viewTransition: true })), data.title) : undefined;
    const hold = longPress(showMenu);

    const onEnter = () => {
        if (data.preview && ref.current) schedulePreview(ref.current, data);
    };

    const card = (
        <Link
            ref={ref}
            to={data.href}
            viewTransition
            className={`${s.card} ${shape === 'poster' ? s.poster : ''}`}
            draggable={false}
            onMouseEnter={onEnter}
            onMouseLeave={cancelPreview}
            onFocus={onEnter}
            onBlur={() => {
                cancelPreview();
                clicked.current = false;
            }}
            onClick={() => {
                clicked.current = true;
            }}
            onContextMenu={(e) => showMenu?.(e)}
            {...hold}
        >
            <div className={s.art} style={morphing ? { viewTransitionName: 'art' } : undefined}>
                <Img
                    src={data.image}
                    srcSet={srcSetFor(data.image)}
                    sizes="(min-width: 1500px) 340px, 300px"
                    fallback={data.fallback}
                    alt=""
                    draggable={false}
                />
                {!data.image && <span className={s.placeholder}>{data.title}</span>}
            </div>
            <div className={s.shade} />
            <div className={s.body}>
                <div className={`${s.title} display`}>{data.title}</div>
                {data.meta && <div className={s.meta}>{data.meta}</div>}
            </div>
            {data.badge && <div className={s.badge}>{data.badge}</div>}
            {typeof data.progress === 'number' && data.progress > 0 && (
                <div className={s.track}>
                    <div className={s.bar} style={{ width: `${Math.min(100, data.progress * 100)}%` }} />
                </div>
            )}
        </Link>
    );

    if (rank === undefined) return card;
    return (
        <div className={s.ranked}>
            <span className={`${s.rank} display`} aria-hidden>
                {rank}
            </span>
            {card}
        </div>
    );
});

/** Metahub backdrops come in 480px (small) and 1920px (medium): let the browser pick by screen density. */
export function srcSetFor(url: string | null) {
    if (!url || !url.includes('images.metahub.space/background/')) return undefined;
    const small = url.replace(/\/background\/\w+\//, '/background/small/');
    const medium = url.replace(/\/background\/\w+\//, '/background/medium/');
    return `${small} 480w, ${medium} 1920w`;
}

export function CardSkeleton({ shape = 'wide' }: { shape?: 'wide' | 'poster' }) {
    return <div className={`${s.card} ${shape === 'poster' ? s.poster : ''} skeleton`} />;
}
