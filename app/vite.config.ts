import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    base: './',
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
    worker: { format: 'es' },
    optimizeDeps: {
        include: ['@stremio/stremio-video', '@stremio/stremio-core-web/stremio_core_web.js', 'eventemitter3'],
    },
    build: {
        target: 'chrome110',
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
