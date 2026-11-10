import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckIcon, ChevronDown } from './Icons';
import s from './Dropdown.module.css';

export type Option = { key: string; label: string; selected: boolean; onSelect: () => void; group?: string };

type Props = {
    label: string;
    value: ReactNode;
    options: Option[];
    /** Lay options out in columns (long genre lists). */
    columns?: number;
};

export function Dropdown({ label, value, options, columns = 1 }: Props) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: PointerEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
        window.addEventListener('pointerdown', onDown);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('pointerdown', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    let lastGroup: string | undefined;

    return (
        <div ref={ref} className={s.wrap}>
            <span className={s.label}>{label}</span>
            <button className={`${s.button} ${open ? s.open : ''}`} onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}>
                <span className={s.value}>{value}</span>
                <ChevronDown size={18} />
            </button>
            {open && (
                <div className={s.menu} role="listbox" style={{ gridTemplateColumns: `repeat(${columns}, minmax(140px, 1fr))` }}>
                    {options.map((o) => {
                        const header = o.group && o.group !== lastGroup ? o.group : null;
                        lastGroup = o.group;
                        return (
                            <div key={o.key} style={{ display: 'contents' }}>
                                {header && <div className={s.group}>{header}</div>}
                                <button
                                    role="option"
                                    aria-selected={o.selected}
                                    className={`${s.option} ${o.selected ? s.selected : ''}`}
                                    onClick={() => {
                                        o.onSelect();
                                        setOpen(false);
                                    }}
                                >
                                    <span className={s.check}>{o.selected && <CheckIcon size={15} />}</span>
                                    {o.label}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
