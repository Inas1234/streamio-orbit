import { lazy, Suspense, useEffect, useRef } from 'react';
import { createHashRouter, Outlet, RouterProvider, useLocation } from 'react-router-dom';
import { core, ctxAction } from './core/core';
import { useModel } from './core/useModel';
import type { StreamingServer } from './core/types';
import { NavBar } from './components/NavBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PreviewLayer } from './components/PreviewLayer';
import { ContextMenu } from './components/ContextMenu';
import { closePreview } from './components/preview';
import { resetAmbient } from './lib/ambient';
import { Home } from './routes/Home';
import { Details } from './routes/Details';

// Less-visited screens load on demand to keep startup small.
const Player = lazy(() => import('./routes/Player').then((m) => ({ default: m.Player })));
const Search = lazy(() => import('./routes/Search').then((m) => ({ default: m.Search })));
const Browse = lazy(() => import('./routes/Browse').then((m) => ({ default: m.Browse })));
const Library = lazy(() => import('./routes/Library').then((m) => ({ default: m.Library })));
const Addons = lazy(() => import('./routes/Addons').then((m) => ({ default: m.Addons })));
const Settings = lazy(() => import('./routes/Settings').then((m) => ({ default: m.Settings })));
const Login = lazy(() => import('./routes/Login').then((m) => ({ default: m.Login })));
const Person = lazy(() => import('./routes/Person').then((m) => ({ default: m.Person })));

const SYNC_EVERY_MS = 60_000;

function useAccountSync() {
    useEffect(() => {
        let last = 0;
        const sync = () => {
            const now = Date.now();
            // Upstream syncs on every window focus; once a minute is plenty.
            if (now - last < SYNC_EVERY_MS) return;
            last = now;
            void core.dispatch(ctxAction('PullAddonsFromAPI'));
            void core.dispatch(ctxAction('PullUserFromAPI', {}));
            void core.dispatch(ctxAction('SyncLibraryWithAPI'));
            void core.dispatch(ctxAction('PullNotifications'));
        };
        sync();
        window.addEventListener('focus', sync);
        return () => window.removeEventListener('focus', sync);
    }, []);
}

/**
 * The desktop app starts its streaming server at the same time as this interface, so the engine's
 * first check can run before the server is listening. The engine doesn't retry on its own;
 * keep asking it to re-check (2s, 4s, 8s, then every 15s) until the server answers.
 */
function useStreamingServerRetry() {
    const server = useModel<StreamingServer>('streaming_server');
    const failed = server?.settings?.type === 'Err';
    const attempt = useRef(0);
    useEffect(() => {
        if (!failed) {
            attempt.current = 0;
            return;
        }
        const delay = Math.min(15_000, 2_000 * 2 ** attempt.current);
        const t = window.setTimeout(() => {
            attempt.current += 1;
            void core.dispatch({ action: 'StreamingServer', args: { action: 'Reload' } });
        }, delay);
        return () => window.clearTimeout(t);
    }, [failed, server]);
}

function Layout() {
    const { pathname } = useLocation();
    const inPlayer = pathname.startsWith('/player');
    useAccountSync();
    useStreamingServerRetry();
    useEffect(() => {
        closePreview();
        window.scrollTo({ top: 0 });
        // Title colors belong to movie and show pages (and their player); everywhere else uses the default look.
        if (!pathname.startsWith('/detail') && !pathname.startsWith('/player')) resetAmbient();
    }, [pathname]);
    return (
        <>
            {/* No glow in the player: in the desktop app the video is drawn behind the page,
                so anything painted here would tint the picture. */}
            {!inPlayer && <div className="ambient" aria-hidden />}
            {!inPlayer && <NavBar />}
            {!inPlayer && <PreviewLayer />}
            {!inPlayer && <ContextMenu />}
            <ErrorBoundary resetKey={pathname}>
                <Suspense fallback={null}>
                    <Outlet />
                </Suspense>
            </ErrorBoundary>
        </>
    );
}

const router = createHashRouter([
    {
        element: <Layout />,
        children: [
            { path: '/', element: <Home /> },
            { path: '/discover/:type', element: <Browse /> },
            { path: '/detail/:type/:id/:videoId?', element: <Details /> },
            { path: '/player', element: <Player /> },
            { path: '/search', element: <Search /> },
            { path: '/library', element: <Library /> },
            { path: '/addons', element: <Addons /> },
            { path: '/settings', element: <Settings /> },
            { path: '/login', element: <Login /> },
            { path: '/person/:personId', element: <Person /> },
            { path: '*', element: <Home /> },
        ],
    },
]);

export function App() {
    return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
