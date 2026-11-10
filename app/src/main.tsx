import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { core } from './core/core';
import { shell } from './shell/shell';
import { App } from './App';
import '@fontsource-variable/archivo/wdth.css';
import './styles/global.css';

const APP_VERSION = '0.1.0';
const root = createRoot(document.getElementById('root')!);

async function start() {
    // Don't let a shell that never answers the handshake keep the app from starting.
    await Promise.race([shell.ready, new Promise((r) => setTimeout(r, 2000))]);
    try {
        await core.init(APP_VERSION, shell.version);
    } catch (e) {
        console.error('core init failed', e);
        root.render(
            <div style={{ padding: 48, textAlign: 'center' }}>
                <h1>Couldn't start</h1>
                <p style={{ color: 'var(--mute)' }}>{String((e as Error)?.message ?? e)}</p>
            </div>,
        );
        // Still drop the splash screen, so the error is visible instead of an endless loader.
        shell.send('app-ready');
        return;
    }
    root.render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
    // Tells the desktop app to drop its splash screen.
    shell.send('app-ready');
    // A clean start: allow the next update-reload if one is ever needed.
    setTimeout(() => {
        try {
            sessionStorage.removeItem('watch.reloadedForUpdate');
        } catch {
            /* ignore */
        }
    }, 10_000);
}

void start();
