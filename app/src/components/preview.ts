// One hover preview for the whole app. Cards schedule it; the layer renders it.
import { useSyncExternalStore } from 'react';
import type { CardData } from './Card';

export type PreviewState = { data: CardData; rect: DOMRect } | null;

const OPEN_DELAY_MS = 450;

let state: PreviewState = null;
let timer = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function schedulePreview(el: HTMLElement, data: CardData) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
        // Only open if the pointer is still resting on this card.
        if (!el.matches(':hover') && document.activeElement !== el) return;
        state = { data, rect: el.getBoundingClientRect() };
        emit();
    }, OPEN_DELAY_MS);
}

export function cancelPreview() {
    window.clearTimeout(timer);
}

export function closePreview() {
    window.clearTimeout(timer);
    if (state) {
        state = null;
        emit();
    }
}

export function usePreview(): PreviewState {
    return useSyncExternalStore(
        (l) => {
            listeners.add(l);
            return () => listeners.delete(l);
        },
        () => state,
    );
}
