import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleResolve } from './src/lib/resolveLink';

/** The same link lookup the Vercel function (api/resolve.ts) runs, for `vite dev`. */
function resolveApi(): Plugin {
    return {
        name: 'resolve-api',
        configureServer(server) {
            server.middlewares.use('/api/resolve', async (req, res) => {
                const chunks: Buffer[] = [];
                for await (const c of req) chunks.push(c as Buffer);
                const answer = await handleResolve(
                    new Request('http://localhost/api/resolve', {
                        method: req.method,
                        headers: { 'content-type': 'application/json' },
                        body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
                    }),
                );
                res.statusCode = answer.status;
                answer.headers.forEach((v, k) => res.setHeader(k, v));
                res.end(await answer.text());
            });
        },
    };
}

export default defineConfig({
    plugins: [react(), resolveApi()],
    base: './',
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
    worker: { format: 'es' },
    optimizeDeps: {
        include: ['@stremio/stremio-video', '@stremio/stremio-core-web/stremio_core_web.js', 'eventemitter3'],
    },
    build: {
        // The desktop app runs Chromium (WebView2); the web version also has to run in Safari on iPhones.
        target: ['chrome110', 'safari16'],
        sourcemap: false,
        cssCodeSplit: true,
        rollupOptions: {
            output: {
                // The video engine stays out of manualChunks so it only loads with the player.
                manualChunks: {
                    react: ['react', 'react-dom', 'react-router-dom'],
                },
            },
        },
    },
});
