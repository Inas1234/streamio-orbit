// App-only preferences (not synced to the Stremio account).
import { useSyncExternalStore } from 'react';

export type AppSettings = {
    tmdbKey: string;
    preferredQuality: '2160p' | '1080p' | '720p';
};

const KEY = 'watch.settings';
const defaults: AppSettings = { tmdbKey: '', preferredQuality: '1080p' };

let current: AppSettings = load();
const listeners = new Set<() => void>();

function load(): AppSettings {
    try {
        return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
    } catch {
        return defaults;
    }
}

export function getSettings() {
    return current;
}

export function updateSettings(patch: Partial<AppSettings>) {
    current = { ...current, ...patch };
    try {
        localStorage.setItem(KEY, JSON.stringify(current));
    } catch {
        /* ignore */
    }
    listeners.forEach((l) => l());
}

export function useSettings(): AppSettings {
    return useSyncExternalStore(
        (l) => {
            listeners.add(l);
            return () => listeners.delete(l);
        },
        () => current,
    );
}
