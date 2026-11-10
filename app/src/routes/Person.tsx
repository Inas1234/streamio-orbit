import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Img } from '../components/Img';
import { detailHref } from '../lib/cards';
import { resolveImdbId, usePerson, type Person as PersonData } from '../lib/tmdb';
import { useSettings } from '../lib/settings';
import cardStyles from '../components/Card.module.css';
import s from './Person.module.css';

export function Person() {
    const { personId } = useParams();
    const { tmdbKey } = useSettings();
    const person = usePerson(personId);

    if (!tmdbKey) return <main className="page page-pad"><p className="empty">Add a TMDB key in Settings to see actor pages.</p></main>;
    if (person === null) return <main className="page page-pad"><p className="empty">Couldn't load this person.</p></main>;
    if (!person) return <main className="page page-pad"><div className="skeleton" style={{ width: 180, height: 180, borderRadius: '50%', margin: '40px auto' }} /></main>;

    const movies = person.credits.filter((c) => c.type === 'movie');
    const shows = person.credits.filter((c) => c.type === 'series');

    return (
        <main className={s.page}>
            <div className={s.bg}>{person.photo && <img src={person.photo} alt="" />}</div>
            <header className={s.header}>
                <div className={s.photo}>{person.photo ? <Img src={person.photo} alt="" eager /> : null}</div>
                <h1 className={s.name}>{person.name}</h1>
                <div className={s.stats}>
                    <div>
                        <b>{movies.length}</b>
                        <span>Movies</span>
                    </div>
                    <div>
                        <b>{shows.length}</b>
                        <span>Series</span>
                    </div>
                    {person.knownFor && (
                        <div>
                            <b>{person.knownFor}</b>
                            <span>Known for</span>
                        </div>
                    )}
                </div>
                {person.biography && <Bio text={person.biography} />}
            </header>
            <Credits title="Movies" items={movies} />
            <Credits title="Series" items={shows} />
        </main>
    );
}

function Bio({ text }: { text: string }) {
    const [open, setOpen] = useState(false);
    return (
        <p className={`${s.bio} ${open ? s.open : ''}`} onClick={() => setOpen(true)}>
            {text}
        </p>
    );
}

function Credits({ title, items }: { title: string; items: PersonData['credits'] }) {
    const navigate = useNavigate();
    const [busy, setBusy] = useState<number | null>(null);
    if (!items.length) return null;
    const open = async (c: PersonData['credits'][number]) => {
        setBusy(c.tmdbId);
        try {
            const imdb = await resolveImdbId(c.tmdbId, c.type);
            if (imdb) navigate(detailHref(c.type, imdb));
            else navigate(`/search?q=${encodeURIComponent(c.title)}`);
        } finally {
            setBusy(null);
        }
    };
    return (
        <section className={s.section}>
            <h2 className={s.h2}>{title}</h2>
            <div className={s.grid}>
                {items.map((c) => (
                    <button key={c.tmdbId} className={cardStyles.card} style={{ width: '100%', opacity: busy === c.tmdbId ? 0.6 : 1 }} onClick={() => void open(c)}>
                        <div className={cardStyles.art}>
                            <Img src={c.backdrop} fallback={c.poster} alt="" />
                        </div>
                        <div className={cardStyles.shade} />
                        <div className={cardStyles.body} style={{ textAlign: 'left' }}>
                            <div className={cardStyles.title}>{c.title}</div>
                            <div className={cardStyles.meta}>
                                {c.rating > 0 && <span>★ {c.rating}</span>}
                                {c.year && <span>{c.year}</span>}
                                {c.character && <span>as {c.character}</span>}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </section>
    );
}
