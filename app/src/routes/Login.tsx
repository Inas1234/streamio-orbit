import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { core, ctxAction } from '../core/core';
import s from './Forms.module.css';

export function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const off = core.onEvent((name, args) => {
            if (name === 'UserAuthenticated') {
                setBusy(false);
                navigate('/');
            }
            if (name === 'Error' && args?.source?.event === 'UserAuthenticated') {
                setBusy(false);
                setError(args?.error?.message ?? 'Sign-in failed. Check your email and password.');
            }
        });
        return off;
    }, [navigate]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        void core.dispatch(ctxAction('Authenticate', { type: 'Login', email, password, facebook: false }));
    };

    return (
        <main className={s.center}>
            <form className={s.card} onSubmit={submit}>
                <h1 className={s.cardTitle}>Sign in</h1>
                <p className={s.hint}>Use your Stremio account. Your library, watch progress and addons come with you.</p>
                <label className={s.field}>
                    <span>Email</span>
                    <input className={s.input} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label className={s.field}>
                    <span>Password</span>
                    <input className={s.input} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </label>
                {error && <p className={s.error}>{error}</p>}
                <button className="btn btn-accent" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={busy}>
                    {busy ? 'Signing in…' : 'Sign in'}
                </button>
                <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }} onClick={() => navigate('/')}>
                    Continue without an account
                </button>
            </form>
        </main>
    );
}
