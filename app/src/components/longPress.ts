import type { MouseEvent, TouchEvent } from 'react';
import type { MenuEvent } from './menu';

const HOLD_MS = 480;
const SLOP_PX = 10;

// Only one finger-hold can be in progress at a time, so the state lives here.
let timer = 0;
let start: { x: number; y: number } | null = null;
let held = false;

const cancel = () => {
    window.clearTimeout(timer);
    start = null;
};

/**
 * Touch screens have no right-click: holding a finger still for half a second does the same.
 * Spread the result onto the element. A press that turned into a hold doesn't also count as a tap.
 */
export function longPress(onHold: ((e: MenuEvent) => void) | undefined) {
    if (!onHold) return {};
    return {
        onTouchStart: (e: TouchEvent) => {
            cancel();
            held = false;
            if (e.touches.length !== 1) return;
            const { clientX, clientY } = e.touches[0];
            start = { x: clientX, y: clientY };
            timer = window.setTimeout(() => {
                held = true;
                navigator.vibrate?.(10);
                onHold({ clientX, clientY });
            }, HOLD_MS);
        },
        onTouchMove: (e: TouchEvent) => {
            const t = e.touches[0];
            if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > SLOP_PX) cancel();
        },
        onTouchEnd: (e: TouchEvent) => {
            cancel();
            if (held) e.preventDefault(); // no tap after a hold
        },
        onTouchCancel: cancel,
        onClickCapture: (e: MouseEvent) => {
            if (!held) return;
            held = false;
            e.preventDefault();
            e.stopPropagation();
        },
        // Android also sends its own long-press menu event; the hold already handled it.
        onContextMenuCapture: (e: MouseEvent) => {
            if (held) {
                e.preventDefault();
                e.stopPropagation();
            }
        },
    };
}
