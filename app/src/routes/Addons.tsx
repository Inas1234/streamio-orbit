import { useState, type FormEvent } from 'react';
import { core, ctxAction } from '../core/core';
import { useModel } from '../core/useModel';
import type { Addon, Ctx } from '../core/types';
import { Img } from '../components/Img';
import s from './Forms.module.css';

export function Addons() {
    const ctx = useModel<Ctx>('ctx');
    const addons = ctx?.profile.addons ?? [];
    const [url, setUrl] = useState('');
    const [status, setStatus] = useState<{ error?: string; busy?: boolean }>({});

    const install = async (e: FormEvent) => {
        e.preventDefault();
        let transportUrl = url.trim().replace(/^stremio:\/\//, 'https://');
        if (!transportUrl) return;
        if (!transportUrl.endsWith('manifest.json')) transportUrl = transportUrl.replace(/\/?$/, '/manifest.json');
        setStatus({ busy: true });
        try {
            const res = await fetch(transportUrl);
            if (!res.ok) throw new Error(`The addon answered ${res.status}`);
            const manifest = await res.json();
            if (!manifest?.id || !manifest?.name) throw new Error("That address isn't a Stremio addon manifest");
            await core.dispatch(ctxAction('InstallAddon', { transportUrl, manifest, flags: { official: false, protected: false } }));
            setUrl('');
            setStatus({});
        } catch (err) {
            setStatus({ error: err instanceof Error ? err.message : 'Install failed' });
        }
    };

    const uninstall = (addon: Addon) => {
        if (confirm(`Remove ${addon.manifest.name}?`)) void core.dispatch(ctxAction('UninstallAddon', addon));
    };

    return (
        <main className="page page-pad">
            <h1 className="page-title">Addons</h1>
            <form className={s.inline} onSubmit={install}>
                <input className={s.input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste an addon link (…/manifest.json)" aria-label="Addon link" />
                <button className="btn btn-accent" disabled={status.busy || !url.trim()}>
                    {status.busy ? 'Installing…' : 'Install'}
                </button>
            </form>
            {status.error && <p className={s.error}>{status.error}</p>}
            <p className={s.hint}>Addons are saved to your Stremio account, so they show up on every device you use.</p>

            <ul className={s.list}>
                {addons.map((a) => (
                    <li key={a.transportUrl} className={s.addon}>
                        <div className={s.addonLogo}>{a.manifest.logo ? <Img src={a.manifest.logo} alt="" /> : <span>{a.manifest.name[0]}</span>}</div>
                        <div className={s.addonText}>
                            <div className={s.addonName}>
                                {a.manifest.name} <span className={s.version}>v{a.manifest.version}</span>
                            </div>
                            {a.manifest.description && <div className={s.addonDesc}>{a.manifest.description}</div>}
                        </div>
                        {!a.flags?.protected && (
                            <button className="btn btn-ghost" style={{ height: 36, fontSize: 14 }} onClick={() => uninstall(a)}>
                                Remove
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </main>
    );
}
