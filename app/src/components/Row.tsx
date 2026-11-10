import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardSkeleton, type CardData } from './Card';
import { ChevronLeft, ChevronRight } from './Icons';
import s from './Row.module.css';

type Props = {
    title: ReactNode;
    items: CardData[] | null;
    shape?: 'wide' | 'poster';
    seeAll?: string;
    error?: boolean;
    /** Fires once when the row first comes near the viewport. */
    onNearViewport?: () => void;
    /** Show big rank numerals (Top 10). */
    ranked?: boolean;
};

export const Row = memo(function Row({ title, items, shape = 'wide', seeAll, error, onNearViewport, ranked }: Props) {
    const rootRef = useRef<HTMLElement>(null);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const [edges, setEdges] = useState({ start: true, end: false });

    useEffect(() => {
        if (!onNearViewport || !rootRef.current) return;
        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    onNearViewport();
                    io.disconnect();
                }
            },
            { rootMargin: '600px 0px' },
        );
        io.observe(rootRef.current);
        return () => io.disconnect();
    }, [onNearViewport]);

    const updateEdges = () => {
        const el = scrollerRef.current;
        if (!el) return;
        const start = el.scrollLeft < 8;
        const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
        setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };

    useEffect(() => {
        updateEdges();
    }, [items]);

    const page = (dir: 1 | -1) => {
        const el = scrollerRef.current;
        if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
    };

    if (error || (items && items.length === 0)) return null;

    return (
        <section ref={rootRef} className={s.row}>
            <div className={s.head}>
                <h2 className={`${s.title} display`}>{title}</h2>
                {seeAll && (
                    <Link to={seeAll} className={s.more}>
                        See all <ChevronRight size={16} />
                    </Link>
                )}
            </div>
            <div className={s.wrap}>
                <div ref={scrollerRef} className={`${s.scroller} ${shape === 'poster' ? s.posters : ''} ${ranked ? s.rankedRow : ''}`} onScroll={updateEdges}>
                    {items
                        ? items.map((item, i) => <Card key={item.key} data={item} shape={shape} rank={ranked ? i + 1 : undefined} />)
                        : Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} shape={shape} />)}
                </div>
                {!edges.start && (
                    <button className={`${s.arrow} ${s.left}`} onClick={() => page(-1)} aria-label="Scroll left">
                        <ChevronLeft size={28} />
                    </button>
                )}
                {!edges.end && items && (
                    <button className={`${s.arrow} ${s.right}`} onClick={() => page(1)} aria-label="Scroll right">
                        <ChevronRight size={28} />
                    </button>
                )}
            </div>
        </section>
    );
});
