import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

// pnpm sometimes saves GitHub's signed download links for the player's tarball dependencies. They expire
// within an hour, and clean installs (Vercel's) then fail. The lockfile must keep the permanent release links.
it('lockfile has no expiring GitHub download links', () => {
    const lock = readFileSync(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8');
    expect(lock).not.toContain('release-assets.githubusercontent.com');
    expect(lock).toContain('https://github.com/Stremio/hls.js/releases/download/v1.5.4-patch2/hls.js-1.5.4-patch2.tgz');
    expect(lock).toContain('https://github.com/Stremio/JavascriptSubtitlesOctopus/releases/download/v4.2.7/stremio-libass-wasm-4.2.7.tgz');
});
