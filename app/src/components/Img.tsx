import { memo, useState, type ImgHTMLAttributes } from 'react';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
    src: string | null | undefined;
    fallback?: string | null;
    eager?: boolean;
};

/** Lazy image that fades in once decoded and swaps to a fallback on error. */
export const Img = memo(function Img({ src, fallback, eager, className, style, srcSet, alt = '', ...rest }: Props) {
    const [failed, setFailed] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);
    const usingFallback = failed === src;
    const url = usingFallback ? fallback : src;
    if (!url) return null;
    return (
        <img
            {...rest}
            srcSet={usingFallback ? undefined : srcSet}
            key={url}
            alt={alt}
            src={url}
            className={className}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            {...{ fetchpriority: eager ? 'high' : 'auto' }}
            style={{ opacity: loaded ? 1 : 0, transition: 'opacity .25s ease', ...style }}
            onLoad={() => setLoaded(true)}
            onError={() => {
                if (failed !== src) setFailed(src ?? null);
            }}
        />
    );
});
