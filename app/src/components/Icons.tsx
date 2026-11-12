import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = ({ size = 20, ...rest }: P) => ({
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...rest,
});

export const PlayIcon = (p: P) => (
    <svg {...base(p)} fill="currentColor" stroke="none">
        <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" />
    </svg>
);
export const PauseIcon = (p: P) => (
    <svg {...base(p)} fill="currentColor" stroke="none">
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
);
export const PlusIcon = (p: P) => (
    <svg {...base(p)}>
        <path d="M12 5v14M5 12h14" />
    </svg>
);
export const CheckIcon = (p: P) => (
    <svg {...base(p)}>
        <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
);
export const EyeIcon = (p: P & { off?: boolean }) => {
    const { off, ...rest } = p;
    return (
        <svg {...base(rest)}>
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            {off && <path d="M4 4l16 16" />}
        </svg>
    );
};
export const SearchIcon = (p: P) => (
    <svg {...base(p)}>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
    </svg>
);
export const ChevronLeft = (p: P) => (
    <svg {...base(p)}>
        <path d="M15 18l-6-6 6-6" />
    </svg>
);
export const ChevronRight = (p: P) => (
    <svg {...base(p)}>
        <path d="M9 18l6-6-6-6" />
    </svg>
);
export const ChevronDown = (p: P) => (
    <svg {...base(p)}>
        <path d="M6 9l6 6 6-6" />
    </svg>
);
export const BackIcon = (p: P) => (
    <svg {...base(p)}>
        <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
);
export const FilmIcon = (p: P) => (
    <svg {...base(p)}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4" />
    </svg>
);
export const TrailerIcon = (p: P) => (
    <svg {...base(p)}>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" />
    </svg>
);
export const VolumeIcon = (p: P & { muted?: boolean }) => {
    const { muted, ...rest } = p;
    return (
        <svg {...base(rest)}>
            <path d="M11 5L6 9H3v6h3l5 4z" fill="currentColor" />
            {muted ? <path d="M22 9l-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
        </svg>
    );
};
export const SubtitlesIcon = (p: P) => (
    <svg {...base(p)}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 12h3M13 12h4M7 15.5h6M15 15.5h2" />
    </svg>
);
export const FullscreenIcon = (p: P) => (
    <svg {...base(p)}>
        <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
);
export const EpisodesIcon = (p: P) => (
    <svg {...base(p)}>
        <rect x="3" y="5" width="12" height="14" rx="2" />
        <path d="M19 6v12M22 8v8" />
    </svg>
);
export const SkipBack = (p: P) => (
    <svg {...base(p)}>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
        <text x="12" y="15.5" fontSize="7" textAnchor="middle" fill="currentColor" stroke="none" fontWeight="700">10</text>
    </svg>
);
export const SkipFwd = (p: P) => (
    <svg {...base(p)}>
        <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
        <path d="M21 3v5h-5" />
        <text x="12" y="15.5" fontSize="7" textAnchor="middle" fill="currentColor" stroke="none" fontWeight="700">10</text>
    </svg>
);
export const NextIcon = (p: P) => (
    <svg {...base(p)} fill="currentColor" stroke="none">
        <path d="M5 5.5v13a1 1 0 0 0 1.5.86L16 13.5V18a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v4.5L6.5 4.64A1 1 0 0 0 5 5.5z" />
    </svg>
);
export const MagnetIcon = (p: P) => (
    <svg {...base(p)}>
        <path d="M6 3v8a6 6 0 0 0 12 0V3h-4v8a2 2 0 0 1-4 0V3z" />
        <path d="M6 7h4M14 7h4" />
    </svg>
);
export const HomeIcon = (p: P) => (
    <svg {...base(p)}>
        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
);
export const TvIcon = (p: P) => (
    <svg {...base(p)}>
        <rect x="2.5" y="6" width="19" height="13" rx="2" />
        <path d="m8 2.5 4 3.5 4-3.5" />
    </svg>
);
export const ListIcon = (p: P) => (
    <svg {...base(p)}>
        <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1z" />
    </svg>
);
export const PuzzleIcon = (p: P) => (
    <svg {...base(p)}>
        <path d="M10 3.5a2 2 0 1 1 4 0V5h4a1 1 0 0 1 1 1v4h-1.5a2 2 0 1 0 0 4H19v4a1 1 0 0 1-1 1h-4v-1.5a2 2 0 1 0-4 0V19H6a1 1 0 0 1-1-1v-4h1.5a2 2 0 1 0 0-4H5V6a1 1 0 0 1 1-1h4z" />
    </svg>
);
