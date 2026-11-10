// "Ambilight": the interface picks up the colors of the artwork you're looking at.
// One tiny 32×18 sample per image, cached forever, so it costs almost nothing.
import { useEffect } from 'react';
import { cached, DAY } from './cache';

export type Ambient = {
    /** Big soft glow behind the page. */
    glow: string;
    /** Second glow, a different hue from the same artwork. */
    glow2: string;
    /** Bright, readable-on-dark accent for buttons and progress. */
    accent: string;
    /** Text color that sits on the accent. */
    onAccent: string;
};

// Outside movie and show pages the glow is off: plain black.
export const DEFAULT_AMBIENT: Ambient = {
    glow: 'hsl(0 0% 0%)',
    glow2: 'hsl(0 0% 0%)',
    accent: 'hsl(226 100% 76%)',
    onAccent: '#0b0d12',
};

type HSL = [number, number, number];

function rgbToHsl(r: number, g: number, b: number): HSL {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    return [h, s, l];
}

const hueDistance = (a: number, b: number) => {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
};

async function sample(url: string): Promise<Ambient> {
    // Fetched directly (not through an <img>) and outside the HTTP cache, so this CORS request never
    // collides with the on-screen copy. No cache-busting query string: metahub's CDN sends a broken
    // duplicate CORS header for URLs that have one.
    const res = await fetch(url, { mode: 'cors', cache: 'no-store', credentials: 'omit' });
    if (!res.ok) throw new Error(`image ${res.status}`);
    const w = 32;
    const h = 18;
    const bitmap = await createImageBitmap(await res.blob(), { resizeWidth: w, resizeHeight: h, resizeQuality: 'low' });
    const ctx = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const data = ctx.getImageData(0, 0, w, h).data;

    // Bucket by hue (24 bins); weight saturated, mid-light pixels highest.
    const bins = Array.from({ length: 24 }, () => ({ weight: 0, s: 0, l: 0, n: 0 }));
    for (let i = 0; i < data.length; i += 4) {
        const [hh, ss, ll] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
        if (ll < 0.08 || ll > 0.92 || ss < 0.12) continue;
        const bin = bins[Math.floor(hh / 15) % 24];
        bin.weight += ss * (1 - Math.abs(ll - 0.5) * 1.4);
        bin.s += ss;
        bin.l += ll;
        bin.n += 1;
    }
    const ranked = bins
        .map((b, i) => ({ ...b, hue: i * 15 + 7.5 }))
        .filter((b) => b.n > 0)
        .sort((a, b) => b.weight - a.weight);
    if (!ranked.length) return DEFAULT_AMBIENT;

    const first = ranked[0];
    const second = ranked.find((b) => hueDistance(b.hue, first.hue) > 40) ?? first;
    const sat = (b: typeof first) => Math.min(0.85, Math.max(0.35, b.s / b.n));
    const h1 = Math.round(first.hue);
    const h2 = Math.round(second.hue);
    return {
        glow: `hsl(${h1} ${Math.round(sat(first) * 70)}% 32%)`,
        glow2: `hsl(${h2} ${Math.round(sat(second) * 65)}% 26%)`,
        accent: `hsl(${h1} ${Math.round(Math.max(0.6, sat(first)) * 100)}% 70%)`,
        onAccent: '#0b0d12',
    };
}

export function ambientFor(url: string) {
    // A distinct URL keeps this CORS request apart from the on-screen <img> copy in the HTTP cache;
    // sharing one cache entry between CORS and non-CORS requests makes one of them fail.
    // If one size fails, try the others.
    const candidates = [url];
    if (url.includes('/background/small/')) candidates.push(url.replace('/background/small/', '/background/medium/'), url.replace('/background/small/', '/poster/small/'));
    return cached(`amb3.${url}`, 365 * DAY, async () => {
        for (const c of candidates) {
            try {
                return await sample(c);
            } catch {
                /* next */
            }
        }
        return DEFAULT_AMBIENT;
    });
}

function apply(a: Ambient) {
    const root = document.documentElement.style;
    root.setProperty('--amb-1', a.glow);
    root.setProperty('--amb-2', a.glow2);
    root.setProperty('--accent', a.accent);
    root.setProperty('--on-accent', a.onAccent);
}

/** Tint the whole interface from this image. Keeps the previous colors while the new ones load. */
export function useAmbient(url: string | null | undefined) {
    useEffect(() => {
        if (!url) return;
        let alive = true;
        ambientFor(url)
            .then((a) => alive && apply(a))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, [url]);
}

export function resetAmbient() {
    apply(DEFAULT_AMBIENT);
}
