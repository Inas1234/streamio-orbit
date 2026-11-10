/** The app mark: a play triangle with a softer echo behind it. Colored by the current accent. */
export function Logo({ size = 36 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
            {/* Echo: same shape, shifted left and faded. */}
            <path d="M4 10.2c0-2.1 2.3-3.4 4.1-2.3l14.6 9.6c1.6 1.1 1.6 3.5 0 4.6L8.1 31.8C6.3 33 4 31.7 4 29.6z" fill="currentColor" opacity="0.38" />
            <path d="M14 10.2c0-2.1 2.3-3.4 4.1-2.3l14.6 9.6c1.6 1.1 1.6 3.5 0 4.6L18.1 31.8c-1.8 1.2-4.1-.1-4.1-2.2z" fill="currentColor" />
        </svg>
    );
}
