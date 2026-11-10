import { useState } from 'react';
import { Link } from 'react-router-dom';
import { core, ctxAction } from '../core/core';
import { useModel } from '../core/useModel';
import type { Ctx } from '../core/types';
import { updateSettings, useSettings } from '../lib/settings';
import { shell } from '../shell/shell';
import s from './Forms.module.css';

export function Settings() {
    const ctx = useModel<Ctx>('ctx');
    const app = useSettings();
    const [key, setKey] = useState(app.tmdbKey);
    const user = ctx?.profile.auth?.user;
    const settings = ctx?.profile.settings;

    const setCoreSetting = (name: string, value: unknown) => {
        if (!settings) return;
        void core.dispatch(ctxAction('UpdateSettings', { ...settings, [name]: value }));
    };

    return (
        <main className="page page-pad" style={{ maxWidth: 820 }}>
            <h1 className="page-title">Settings</h1>

            <section className={s.section}>
                <h2 className={s.h2}>Account</h2>
                {user ? (
                    <div className={s.row}>
                        <div>
                            <div>{user.email}</div>
                            <div className={s.hint}>Library, progress and addons sync with Stremio.</div>
                        </div>
                        <button className="btn btn-ghost" onClick={() => void core.dispatch(ctxAction('Logout'))}>
                            Sign out
                        </button>
                    </div>
                ) : (
                    <div className={s.row}>
                        <div className={s.hint}>Not signed in.</div>
                        <Link to="/login" className="btn btn-accent">
                            Sign in
                        </Link>
                    </div>
                )}
            </section>

            <section className={s.section}>
                <h2 className={s.h2}>Cast photos</h2>
                <p className={s.hint}>
                    Cast photos and actor pages come from TMDB. Paste a free API key (v3 key or read access token) from{' '}
                    <a href="https://www.themoviedb.org/settings/api" onClick={(e) => (e.preventDefault(), shell.openExternal('https://www.themoviedb.org/settings/api'))} style={{ textDecoration: 'underline' }}>
                        themoviedb.org/settings/api
                    </a>
                    . It stays on this computer.
                </p>
                <form
                    className={s.inline}
                    onSubmit={(e) => {
                        e.preventDefault();
                        updateSettings({ tmdbKey: key.trim() });
                    }}
                >
                    <input className={s.input} value={key} onChange={(e) => setKey(e.target.value)} placeholder="TMDB API key" aria-label="TMDB API key" spellCheck={false} />
                    <button className="btn btn-accent" disabled={key.trim() === app.tmdbKey}>
                        Save
                    </button>
                </form>
                {app.tmdbKey && <p className={s.ok}>Key saved. Cast photos are on.</p>}
            </section>

            {settings && (
                <section className={s.section}>
                    <h2 className={s.h2}>Playback</h2>
                    <Toggle label="Play the next episode automatically" checked={settings.bingeWatching} onChange={(v) => setCoreSetting('bingeWatching', v)} />
                    <Toggle label="Hardware decoding" checked={settings.hardwareDecoding} onChange={(v) => setCoreSetting('hardwareDecoding', v)} />
                    <Toggle label="Surround sound" checked={settings.surroundSound} onChange={(v) => setCoreSetting('surroundSound', v)} />
                </section>
            )}

            <section className={s.section}>
                <h2 className={s.h2}>About</h2>
                <p className={s.hint}>
                    Streamio Orbit {import.meta.env.VITE_APP_VERSION ?? '0.1.0'} · {shell.active ? `desktop app ${shell.version ?? ''}` : 'browser'}
                </p>
            </section>
        </main>
    );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className={s.toggle}>
            <span>{label}</span>
            <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        </label>
    );
}
