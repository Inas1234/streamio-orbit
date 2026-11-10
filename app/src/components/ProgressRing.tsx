import { CheckIcon } from './Icons';
import s from './ProgressRing.module.css';

/** Small circle on a poster: fills up as you watch, turns into a green check when done. */
export function ProgressRing({ fraction, done, label }: { fraction: number; done: boolean; label: string }) {
    if (done) {
        return (
            <span className={`${s.ring} ${s.done}`} role="img" aria-label={label} title={label}>
                <CheckIcon size={17} strokeWidth={3} />
            </span>
        );
    }
    const r = 11;
    const c = 2 * Math.PI * r;
    // A sliver is always visible, so "just started" still reads as started.
    const shown = Math.max(0.04, Math.min(1, fraction));
    return (
        <span className={s.ring} role="img" aria-label={label} title={label}>
            <svg className={s.arc} viewBox="0 0 28 28" width="28" height="28" aria-hidden>
                <circle cx="14" cy="14" r={r} className={s.track} />
                <circle cx="14" cy="14" r={r} className={s.fill} strokeDasharray={`${shown * c} ${c}`} />
            </svg>
        </span>
    );
}
