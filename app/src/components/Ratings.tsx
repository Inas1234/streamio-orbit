import type { Link } from '../core/types';
import { imdbRating } from '../lib/meta';
import { useCriticScores } from '../lib/ratings';
import s from './Ratings.module.css';

/** IMDb plus Rotten Tomatoes and Metacritic when they're known. Critic scores fade in when they arrive. */
export function Ratings({ id, links }: { id: string; links?: Link[] }) {
    const imdb = imdbRating(links);
    const critics = useCriticScores(id);
    const rt = critics?.rottenTomatoes ?? null;
    const mc = critics?.metacritic ?? null;

    if (!imdb && rt === null && mc === null) return null;

    return (
        <span className={s.ratings}>
            {imdb && (
                <span className={s.item} title="IMDb rating">
                    <span className="imdb">IMDb</span>
                    {imdb}
                </span>
            )}
            {rt !== null && (
                <span className={`${s.item} ${s.in}`} title={`Rotten Tomatoes: ${rt}% of critics gave a positive review`}>
                    {rt >= 60 ? <Tomato /> : <Splat />}
                    {rt}%
                </span>
            )}
            {mc !== null && (
                <span className={`${s.item} ${s.in}`} title={`Metacritic score: ${mc} out of 100`}>
                    <span className={`${s.mc} ${mc >= 61 ? s.good : mc >= 40 ? s.mixed : s.bad}`}>{mc}</span>
                </span>
            )}
        </span>
    );
}

// Generic marks (not the services' logos): a ripe tomato for 60% and up, a splat below.
const Tomato = () => (
    <svg className={s.icon} viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="13.5" r="8.5" fill="#fa320a" />
        <path d="M12 5.5c-1.2-1.6-3-2.2-4.6-1.8 1.1.6 1.9 1.4 2.3 2.4-1.4-.3-2.8 0-3.9.9 1.6.2 3 .9 3.8 2 .8-1 1.6-1.6 2.4-1.9.8.3 1.6.9 2.4 1.9.8-1.1 2.2-1.8 3.8-2-1.1-.9-2.5-1.2-3.9-.9.4-1 1.2-1.8 2.3-2.4-1.6-.4-3.4.2-4.6 1.8z" fill="#00912d" />
    </svg>
);
const Splat = () => (
    <svg className={s.icon} viewBox="0 0 24 24" aria-hidden>
        <path d="M12 3l1.6 4.2 4.1-2.2-1.6 4.4 4.6.6-3.9 2.6 3.4 3.2-4.6-.2.6 4.6-3.8-2.8-2.4 4-1.2-4.5-4.4 1.6 2.4-4-4.4-1.4 4.2-2.1-2.8-3.7 4.6.8z" fill="#0fc65c" />
    </svg>
);
