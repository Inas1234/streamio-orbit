# iPhone In-App Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MKV debrid sources play inside the web player on iPhone (iOS 17.1+) by repackaging them on the phone into fragmented MP4, with a tiny Vercel link lookup for TorBox's redirect hop.

**Architecture:** `POST /api/resolve` (Vercel function, same code mounted in `vite dev`) follows Torrentio/TorBox redirects and returns the file-server link. In the web player, a probe decides direct / remux / unplayable. Remux reads the MKV with Mediabunny over byte ranges, copies packets into a fragmented MP4 `Output`, and appends the bytes to a `ManagedMediaSource` (or `MediaSource`) SourceBuffer. Its object URL is handed to stremio-video's HTML player as the stream URL, so controls, progress and subtitles keep their current code path.

**Tech Stack:** React 18 + Vite 6 + TypeScript, `@stremio/stremio-video` 0.0.103, `mediabunny` 1.66.0 (installed), `vitest` 3.2.4 (installed), Vercel Node functions.

**Spec:** `docs/superpowers/specs/2026-11-17-iphone-in-app-playback-design.md`

## Global Constraints

- Desktop app (`shell.active`) behaviour must not change.
- Movie bytes never go through Vercel; `/api/resolve` never fetches the final file.
- Allowlist: `torrentio.strem.fun`, `api.torbox.app`, `*.tb-cdn.st`, `*.tb-cdn.io`. At most 5 hops. Anything else → 400.
- Stream links travel in the POST body; never log URLs; responses `Cache-Control: no-store`.
- The TorBox key is never printed in test output, logs, commits or fixtures.
- Packets are copied, never decoded or re-encoded.
- Buffer ahead ~60 s, drop data more than ~30 s behind (builder may tune).
- `video.disableRemotePlayback = true` on the web video element before a ManagedMediaSource URL is set.
- Unplayable (no playable video, or only DTS/TrueHD audio) → message plus the existing VLC / Infuse buttons.
- Any failure in lookup or probe → fall back to today's behaviour (direct `src`).
- Build target stays `['chrome110', 'safari16']`; mediabunny stays out of `manualChunks` so it loads only with the player.
- Plain-language UI copy; no jargon like "remux", "CORS", "MSE".

## Review Focus

- Seeking far ahead into unbuffered time → playback resumes from there within a few seconds, not from where reading was.
- Resuming from "Continue watching" (start time > 0) → reading starts at that time, not at 0.
- Leaving the player mid-stream → all reads stop (no background downloading after `destroy()`).
- The TorBox file link expiring or the lookup returning 4xx/5xx → falls back to direct `src`, no infinite spinner.
- File whose audio tracks are all DTS but video is fine → unplayable message with VLC / Infuse, not silent video.

---

### Task 1: Link lookup (`/api/resolve`)

**Files:**
- Create: `app/src/lib/resolveLink.ts`
- Create: `app/src/lib/resolveLink.test.ts`
- Create: `app/api/resolve.ts`
- Create: `app/src/player/resolveClient.ts`
- Modify: `app/vite.config.ts` (dev plugin mounting the same handler at `/api/resolve`)
- Modify: `app/package.json` (`"test": "vitest run"`)

**Interfaces:**
- Produces: `isAllowedHost(host: string): boolean`; `isFileServer(host: string): boolean` (the `tb-cdn` hosts); `resolveLink(url: string, fetchFn?: typeof fetch): Promise<string>` (throws `ResolveError` with `status: 400 | 502`); `handleResolve(req: Request): Promise<Response>` (body `{ url }` → `{ url }`).
- Produces (client): `needsLookup(url: string): boolean` (host is `torrentio.strem.fun` or `api.torbox.app`); `lookupFileUrl(url: string): Promise<string | null>` (null on any failure, 8 s timeout).

- [ ] **Step 1: Write failing tests** in `resolveLink.test.ts` with a fake `fetchFn` returning scripted `Response`s (`status`, `Location`):
  - `follows torrentio → torbox api → tb-cdn and returns the cdn url` (asserts result `https://nexus-1.weur.tb-cdn.st/x`, and that the cdn url itself was never fetched).
  - `rejects a start url outside the allowlist` (`https://evil.example/x` → `ResolveError` status 400, fetchFn not called).
  - `rejects a redirect to a host outside the allowlist` (status 400).
  - `gives up after 5 hops` (status 502).
  - `non-redirect, non-file-server answer → 502`.
  - `isAllowedHost('a.b.tb-cdn.io') === true`, `isAllowedHost('tb-cdn.st.evil.com') === false`.
  - `handleResolve` with GET → 405; with a bad body → 400; success → 200 JSON and `cache-control: no-store`.
- [ ] **Step 2: Run** `pnpm --dir app test` → FAIL (module missing).
- [ ] **Step 3: Implement** `resolveLink.ts`: loop with `fetchFn(url, { redirect: 'manual', method: 'GET' })`, resolve relative `Location` against the current URL, stop when the next host `isFileServer`. Cancel each response body (`res.body?.cancel()`). `api/resolve.ts` exports `POST(request: Request)` calling `handleResolve`. Vite plugin: `configureServer` middleware that turns the Node request into a `Request` and pipes back the `Response`.
- [ ] **Step 4: Run** `pnpm --dir app test` → PASS; `pnpm --dir app typecheck` → no errors.
- [ ] **Step 5: Live check** (key never printed): start `vite dev`, POST one real Torrentio resolve link from the signed-in addon on this PC; expect 200 with a `tb-cdn` host. Print only the host.
- [ ] **Step 6: Commit** `Link lookup for TorBox sources on the web version`.

### Task 2: Choosing tracks and checking what the browser can play

**Files:**
- Create: `app/src/player/remux/pickTracks.ts`
- Create: `app/src/player/remux/pickTracks.test.ts`

**Interfaces:**
- Produces: `type TrackInfo = { id: number; codec: string | null; codecString: string | null; language: string; isDefault: boolean }`
- Produces: `pickTracks(video: TrackInfo[], audio: TrackInfo[], canPlay: (mime: string) => boolean, preferredLang?: string | null): { video: TrackInfo; audio: TrackInfo | null } | { unplayable: 'video' | 'audio' }`
- `canPlay` is called with `video/mp4; codecs="<codecString>"` / `audio/mp4; codecs="<codecString>"`.
- `preferredLang` is Stremio's `audioLanguage` setting (ISO 639-2, e.g. `eng`).

- [ ] **Step 1: Write failing tests:**
  - `picks the preferred-language playable audio over the default one`.
  - `falls back to the default-flagged playable audio, then the first playable`.
  - `skips DTS and picks the AC3 track` (dts canPlay false, `ac-3` true).
  - `only DTS audio → { unplayable: 'audio' }`.
  - `no audio tracks at all → audio: null` (silent files play).
  - `video codec not playable → { unplayable: 'video' }`.
- [ ] **Step 2: Run** `pnpm --dir app test pickTracks` → FAIL.
- [ ] **Step 3: Implement** `pickTracks`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Pick the audio track the phone can play`.

### Task 3: Repackaging core (packets → fragmented MP4 bytes)

**Files:**
- Create: `app/src/player/remux/remux.ts`
- Create: `app/src/player/remux/remux.test.ts`
- Create: `app/src/player/remux/__fixtures__/tiny.mkv` (≤ 200 KB: 6 s, 160×90 H.264 + AAC, key frame every 2 s; made with `release/Streamio Orbit/ffmpeg.exe`, command recorded in the test file header)

**Interfaces:**
- Consumes: `TrackInfo` ids from Task 2.
- Produces: `openFile(url: string | Blob): Promise<{ input: Input; video: InputVideoTrack[]; audio: InputAudioTrack[]; duration: number; format: 'mp4' | 'matroska' | 'other' }>` (uses `UrlSource` for strings, `BlobSource` for blobs).
- Produces: `toTrackInfo(track: InputTrack): Promise<TrackInfo>`.
- Produces: `remuxFrom(opts: { video: InputVideoTrack; audio: InputAudioTrack | null; start: number; write: (bytes: Uint8Array) => Promise<void>; signal: AbortSignal }): Promise<void>` — writes init segment then fragments; starts at the key packet at or before `start`; audio starts at the packet at or before that key frame's time; resolves at end of file or when aborted; `write` awaiting is the backpressure.
- Timestamps in the output must equal the source timestamps (so a later `remuxFrom` for a seek lines up in the same SourceBuffer without `timestampOffset`). If Mediabunny rebases to 0, record that in the interface comment and expose `startTime` in the return value instead: `Promise<{ startTime: number }>`.

- [ ] **Step 1: Make the fixture** and write failing tests (Node, `BlobSource` over the fixture bytes; output collected into one buffer and reopened with Mediabunny):
  - `full remux keeps both tracks and the duration (±0.1 s)`.
  - `remux from 3.1 s starts at the 2 s key frame` (first video packet timestamp `2` ±0.05, and is a key packet).
  - `aborting stops writing` (abort after the first write → promise resolves, no more writes).
  - `video-only when audio is null`.
- [ ] **Step 2: Run** `pnpm --dir app test remux` → FAIL.
- [ ] **Step 3: Implement** with `EncodedPacketSink`, `EncodedVideoPacketSource` / `EncodedAudioPacketSource` (first `add` gets `{ decoderConfig: await track.getDecoderConfig() }`), `Output` + `Mp4OutputFormat({ fastStart: 'fragmented', minimumFragmentDuration: 1 })` + `StreamTarget` whose writable calls `write`. Interleave video and audio by timestamp. Carry `languageCode`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Repackage MKV into streamable MP4 in the browser`.

### Task 4: Playback session (MediaSource, buffering, seeking)

**Files:**
- Create: `app/src/player/remux/RemuxSession.ts`

**Interfaces:**
- Consumes: `openFile`, `remuxFrom` (Task 3); `pickTracks` result (Task 2).
- Produces: `class RemuxSession { constructor(file: Awaited<ReturnType<typeof openFile>>, tracks: { video: InputVideoTrack; audio: InputAudioTrack | null }, start: number); readonly url: string; bind(video: HTMLVideoElement): void; destroy(): void }`
  - `url` is the MediaSource object URL (created in the constructor).
  - Uses `window.ManagedMediaSource` when present, else `MediaSource`. One SourceBuffer, `mode = 'segments'`, mime `video/mp4; codecs="<video>,<audio>"`.
  - Sets `mediaSource.duration` from `file.duration` after `sourceopen`.
  - Pump: `write` waits while buffered-ahead ≥ 60 s (re-check on `timeupdate`/`progress`) or, on ManagedMediaSource, between `endstreaming` and `startstreaming`. Removes ranges ending > 30 s behind `currentTime` before appending; on `QuotaExceededError`, remove behind and retry once.
  - On video `seeking`: if target is inside a buffered range, nothing; else abort the current `remuxFrom`, wait for the SourceBuffer to be idle, `abort()` it, and start `remuxFrom` at the target.
  - At end of file: `mediaSource.endOfStream()`.
  - `destroy()`: aborts reads, `input.dispose()`, revokes the URL, removes listeners.
- [ ] **Step 1: Implement** (browser-only; verified in Task 5 through the real player).
- [ ] **Step 2: Run** `pnpm --dir app typecheck` → no errors.
- [ ] **Step 3: Commit** `Stream repackaged video into the player with seeking`.

### Task 5: Player integration and messages

**Files:**
- Create: `app/src/player/webSource.ts`
- Modify: `app/src/routes/Player.tsx` (load effect ~line 238; `implementationChanged` handler ~line 216; error UI ~line 446)
- Modify: `THIRD-PARTY-NOTICES.md` (Mediabunny, MPL-2.0)

**Interfaces:**
- Consumes: `needsLookup`, `lookupFileUrl` (Task 1); `openFile`, `toTrackInfo` (Task 3); `pickTracks` (Task 2); `RemuxSession` (Task 4).
- Produces: `prepareWebStream(url: string, opts: { start: number; preferredLang: string | null }): Promise<{ kind: 'direct'; url: string } | { kind: 'remux'; session: RemuxSession } | { kind: 'unplayable'; reason: 'video' | 'audio' }>`
  - `'direct'` when: lookup/probe fails, the file is MP4/MOV and `video.canPlayType` says it can play, or no MediaSource exists.
  - `canPlay` = `(ManagedMediaSource ?? MediaSource).isTypeSupported`.
- In `Player.tsx`, only when `!shell.active && stream.url && !stream.infoHash`:
  - Await `prepareWebStream` before dispatching `load` (spinner shows meanwhile). For `'remux'`, load `{ ...stream, url: session.url, behaviorHints: { ...stream.behaviorHints, proxyHeaders: { response: { 'content-type': 'video/mp4' } } } }`.
  - In `implementationChanged`: find the `video` element in `containerRef`, set `disableRemotePlayback = true` (web only), and `session?.bind(video)`.
  - `session.destroy()` on unmount and when the stream changes.
  - `'unplayable'` → new message, copy: audio — "This file's sound can't play on this device" / "Its audio is in a format phones can't play (DTS or TrueHD). Pick another source, or open it in VLC or Infuse."; video — "This video format can't play here" / "Pick another source, or open it in VLC or Infuse." Both show the existing VLC / Infuse buttons and "Pick another source".
- [ ] **Step 1: Implement `prepareWebStream` and the Player changes.**
- [ ] **Step 2: Run** `pnpm --dir app typecheck && pnpm --dir app test` → PASS.
- [ ] **Step 3: Verify in the browser pane (Chrome, muted, no audible playback)** with real sources from the signed-in Torrentio addon: an H.264 MKV and an HEVC 10-bit MKV. Check: plays; seek +10 min starts within ~5 s; reload with a resume time starts there; leave the player → network requests to `tb-cdn` stop; an MP4 source still uses direct `src`. Record console errors (expect none).
- [ ] **Step 4: Verify desktop app untouched**: `pnpm --dir app build` and the shell package step from the project notes; launch once and confirm a source plays (silent clip).
- [ ] **Step 5: Commit** `Play MKV files inside the web player on iPhone`.

### Task 6: iPhone preview

- [ ] **Step 1:** Deploy a preview the way the user chooses (their Vercel account; not decided yet).
- [ ] **Step 2:** User checks on iPhone: an H.264 MKV, an HEVC HDR MKV, a DTS-only file (expect the message), seeking, resume, next episode, locking the phone and coming back.
