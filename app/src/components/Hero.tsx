import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { core, ctxAction } from '../core/core';
import type { MetaPreview } from '../core/types';
import { detailHref } from '../lib/cards';
import { backdrop, genres, logo } from '../lib/meta';
import { Img } from './Img';
import { CheckIcon, PlayIcon, PlusIcon } from './Icons';
import s from './Hero.module.css';
import { Ratings } from './Ratings';

const ROTATE_MS = 9000;

export function Hero({ items }: { items: MetaPreview[] }) {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [added, setAdded] = useState<Set<string>>(() => new Set());
    const navigate = useNavigate();
    const item = items[index % Math.max(1, items.length)];

    useEffect(() => {
        if (paused || items.length < 2) return;
        const t = window.setTimeout(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS);
        return () => window.clearTimeout(t);
    }, [index, paused, items.length]);

    // Warm the next backdrop so the crossfade never shows a blank frame.
    useEffect(() => {
        const next = items[(index + 1) % Math.max(1, items.length)];
        const url = next && backdrop(next, 'large');
        if (url) new Image().src = url;
    }, [index, items]);

    if (!item) return <div className={s.hero} />;
    const g = genres(item.links).slice(0, 3);
    const href = detailHref(item.type, item.id);
    const logoUrl = logo(item);
    const inList = added.has(item.id);

    const toggleList = () => {
        void core.dispatch(inList ? ctxAction('RemoveFromLibrary', item.id) : ctxAction('AddToLibrary', item));
        setAdded((prev) => {
            const next = new Set(prev);
            if (inList) next.delete(item.id);
            else next.add(item.id);
            return next;
        });
    };

    return (
        <section className={s.hero} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carousel">
            {items.map((it, i) => {
                // Mount only the current, previous and next backdrops.
                const d = (i - index + items.length) % items.length;
                if (d !== 0 && d !== 1 && d !== items.length - 1) return null;
                return (
                    <div key={it.id} className={`${s.bg} ${i === index ? s.show : ''}`} aria-hidden>
                        <Img src={backdrop(it, 'large')} fallback={it.background || it.poster} eager={i === 0} alt="" />
                    </div>
                );
            })}

            <div className={s.content} key={item.id}>
                {logoUrl ? (
                    <h1 className={`${s.step} ${s.logoWrap}`}>
                        <Img src={logoUrl} alt={item.name} className={s.logo} eager />
                    </h1>
                ) : (
                    <h1 className={`${s.step} ${s.title} display`}>{item.name}</h1>
                )}
                <div className={`${s.step} dot-list`}>
                    <Ratings id={item.id} links={item.links} />
                    {item.releaseInfo && <span>{item.releaseInfo}</span>}
                    {item.runtime && <span>{item.runtime}</span>}
                    {g.length > 0 && <span className={s.genres}>{g.join(', ')}</span>}
                </div>
                {item.description && <p className={`${s.step} ${s.desc}`}>{item.description}</p>}
                <div className={`${s.step} ${s.actions}`}>
                    <button className="btn btn-primary" onClick={() => navigate(href, { viewTransition: true })}>
                        <PlayIcon size={18} /> Watch now
                    </button>
                    <Link to={href} viewTransition className="btn btn-ghost">
                        More info
                    </Link>
                    <button className={`icon-btn ${inList ? 'on' : ''}`} onClick={toggleList} aria-label={inList ? 'Remove from My List' : 'Add to My List'}>
                        {inList ? <CheckIcon /> : <PlusIcon />}
                    </button>
                </div>
            </div>

            {items.length > 1 && (
                <div className={s.timeline} role="tablist" aria-label="Featured titles">
                    {items.map((it, i) => (
                        <button
                            key={it.id}
                            role="tab"
                            aria-selected={i === index}
                            className={i === index ? s.current : i < index ? s.done : undefined}
                            onClick={() => setIndex(i)}
                            aria-label={it.name}
                        >
                            <span className={s.fill} style={{ animationDuration: `${ROTATE_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }} />
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
}
