import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useModel } from '../core/useModel';
import type { Ctx } from '../core/types';
import { SearchIcon } from './Icons';
import { Logo } from './Logo';
import s from './NavBar.module.css';

const LINKS = [
    { to: '/', label: 'Home', end: true },
    { to: '/discover/movie', label: 'Movies' },
    { to: '/discover/series', label: 'Series' },
    { to: '/library', label: 'My List' },
    { to: '/addons', label: 'Addons' },
];

export function NavBar() {
    const [solid, setSolid] = useState(false);
    const navigate = useNavigate();
    const ctx = useModel<Ctx>('ctx');
    const user = ctx?.profile.auth?.user;

    useEffect(() => {
        const onScroll = () => setSolid(window.scrollY > 24);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <header className={`${s.nav} ${solid ? s.solid : ''}`}>
            <Link to="/" viewTransition className={s.logo} aria-label="Home">
                <Logo />
            </Link>
            <nav className={s.links}>
                {LINKS.map((l) => (
                    <NavLink key={l.to} to={l.to} end={l.end} viewTransition className={({ isActive }) => (isActive ? s.active : undefined)}>
                        {l.label}
                    </NavLink>
                ))}
            </nav>
            <div className={s.right}>
                <button className={s.round} onClick={() => navigate('/search')} aria-label="Search">
                    <SearchIcon size={18} />
                </button>
                <Link to={user ? '/settings' : '/login'} className={s.avatar} aria-label={user ? 'Account and settings' : 'Sign in'}>
                    {user?.avatar ? <img src={user.avatar} alt="" /> : <span>{user?.email?.[0]?.toUpperCase() ?? '?'}</span>}
                </Link>
            </div>
        </header>
    );
}
