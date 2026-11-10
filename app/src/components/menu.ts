// One right-click menu for the whole app. Anything can open it with a list of actions.
import { useSyncExternalStore, type MouseEvent } from 'react';

export type MenuAction = {
    label: string;
    onSelect: () => void;
    danger?: boolean;
    /** Draws a divider above this item. */
    separated?: boolean;
};

export type MenuState = { x: number; y: number; title?: string; actions: MenuAction[] } | null;

let state: MenuState = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openMenu(event: MouseEvent, actions: MenuAction[], title?: string) {
    event.preventDefault(); // also stops the browser's own menu
    event.stopPropagation();
    if (!actions.length) return;
    state = { x: event.clientX, y: event.clientY, title, actions };
    emit();
}

export function closeMenu() {
    if (state) {
        state = null;
        emit();
    }
}

export function useMenu(): MenuState {
    return useSyncExternalStore(
        (l) => {
            listeners.add(l);
            return () => listeners.delete(l);
        },
        () => state,
    );
}
