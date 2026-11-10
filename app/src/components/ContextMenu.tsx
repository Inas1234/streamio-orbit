import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { closeMenu, useMenu } from './menu';
import { closePreview } from './preview';
import s from './ContextMenu.module.css';

const MARGIN = 8;

export function ContextMenu() {
    const menu = useMenu();
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

    // Keep the menu on screen: flip left/up when it would overflow.
    useLayoutEffect(() => {
        if (!menu || !ref.current) return setPos(null);
        const { width, height } = ref.current.getBoundingClientRect();
        const left = menu.x + width + MARGIN > window.innerWidth ? Math.max(MARGIN, menu.x - width) : menu.x;
        const top = menu.y + height + MARGIN > window.innerHeight ? Math.max(MARGIN, menu.y - height) : menu.y;
        setPos({ left, top });
        ref.current.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    }, [menu]);

    useEffect(() => {
        if (!menu) return;
        closePreview();
        const onDown = (e: PointerEvent) => {
            if (!ref.current?.contains(e.target as Node)) closeMenu();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeMenu();
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
                const i = items.indexOf(document.activeElement as HTMLButtonElement);
                const next = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
                next?.focus();
            }
        };
        window.addEventListener('pointerdown', onDown, true);
        window.addEventListener('keydown', onKey);
        window.addEventListener('scroll', closeMenu, { passive: true, capture: true });
        window.addEventListener('blur', closeMenu);
        window.addEventListener('resize', closeMenu);
        return () => {
            window.removeEventListener('pointerdown', onDown, true);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', closeMenu, { capture: true });
            window.removeEventListener('blur', closeMenu);
            window.removeEventListener('resize', closeMenu);
        };
    }, [menu]);

    if (!menu) return null;

    return createPortal(
        <div
            ref={ref}
            className={s.menu}
            role="menu"
            style={{ left: pos?.left ?? menu.x, top: pos?.top ?? menu.y, visibility: pos ? 'visible' : 'hidden' }}
            onContextMenu={(e) => e.preventDefault()}
        >
            {menu.title && <div className={s.title}>{menu.title}</div>}
            {menu.actions.map((a, i) => (
                <div key={i}>
                    {a.separated && <div className={s.sep} />}
                    <button
                        role="menuitem"
                        className={`${s.item} ${a.danger ? s.danger : ''}`}
                        onClick={() => {
                            closeMenu();
                            a.onSelect();
                        }}
                    >
                        {a.label}
                    </button>
                </div>
            ))}
        </div>,
        document.body,
    );
}
