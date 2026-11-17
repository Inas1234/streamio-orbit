# iPhone in-app playback (web version)

## Why

On the web version (the iPhone home-screen app hosted on Vercel), most TorBox sources are MKV files.
Safari can't open MKV, so today the player sends you to VLC or Infuse. The goal is to play them
right inside Streamio Orbit on the iPhone, with no other app and no PC needed.

## Goals

- MKV sources from debrid (TorBox through Torrentio) play in the web player on iPhone (iOS 17.1+).
- Smooth, battery-friendly playback: the phone's own hardware decodes the video; nothing is re-encoded.
- Seeking, resume, progress sync, next episode and addon subtitles keep working as they do now.
- The VLC / Infuse buttons stay as a backup.

## Non-goals (for now)

- DTS and TrueHD audio. The iPhone can't decode them. If a file has another audio track the phone can
  play, that one is used. If not, the player says so and offers VLC / Infuse.
- Subtitles stored inside the MKV. Addon subtitles (OpenSubtitles etc.) still work.
- Switching between the file's audio tracks during playback (the best one is picked automatically).
- Torrents on the web (still need a debrid source).
- Any change to the desktop app.

## Anti-goals

- Movies must never stream through Vercel (bandwidth and cost). Only a small link lookup goes there.
- The link lookup must not become an open proxy anyone can use.
- The TorBox key must not be logged anywhere.

## Constraints found

Tested on 2026-11-17 with a real source. A Torrentio + TorBox link goes through three hops:

1. `torrentio.strem.fun/resolve/...`: allows any web page (`Access-Control-Allow-Origin: *`).
2. `api.torbox.app/.../requestdl?...&redirect=true`: only allows `https://torbox.app`. A web page can't follow it.
3. `*.tb-cdn.st` file server: allows any origin, supports byte ranges and the `Range` preflight.

The final file link isn't tied to the device that asked for it (Torrentio's server asks for it, and it
worked from this PC).

## Approaches considered

1. **Repackage on the phone (chosen).** The phone reads the MKV in pieces and rewraps the same video and
   audio into fragmented MP4, which Safari plays through ManagedMediaSource (iOS 17.1+). No server, works
   away from home. Can't help with DTS/TrueHD-only files.
2. **Convert on the PC.** Stremio's streaming server turns anything into HLS; the phone reaches it over
   Tailscale or similar. Handles every file, but the PC must be on and reachable.
3. **Cloud converter or relay.** Costs money and bandwidth, and against Vercel's limits. Rejected.

The user picked 1, plus a small link lookup on Vercel for hop 2.

## Design

### Link lookup (`app/api/resolve.ts`, Vercel function)

- `POST /api/resolve` with the stream link in the body (so the TorBox key never appears in Vercel's
  request logs) follows redirects itself (`redirect: 'manual'`, at most 5 hops)
  and returns `{ url }` as soon as it reaches a file-server host. It never downloads the file.
- Only follows hosts on an allowlist: `torrentio.strem.fun`, `api.torbox.app`, and TorBox file servers
  (`*.tb-cdn.st`, `*.tb-cdn.io`). Anything else is refused with 400.
- No logging of URLs. `Cache-Control: no-store`.
- Scope (Claude's call): TorBox only, whether it comes through Torrentio or TorBox's own Stremio addon
  (both hand out `api.torbox.app` links). Links from hosts that already allow web pages skip the lookup,
  so other services may work without it; adding Real-Debrid and others later means checking each one's
  hops the same way and adding them to the list.
- The same handler runs in `vite dev` through a small dev-server plugin, so it can be tested locally.

### Choosing how to play (web only, in `Player.tsx`)

- Desktop app: unchanged.
- Web, direct link: resolve through `/api/resolve` when the host is on the allowlist, then open the file
  with Mediabunny (reads only the header through byte ranges).
  - MP4/MOV that the browser can play: play the file link directly as today.
  - MKV/WebM: the repackaging player (below).
  - Nothing playable (unsupported video codec, or only DTS/TrueHD audio): a clear message with the
    VLC / Infuse buttons.
- If any step fails (lookup down, server refuses), fall back to today's behaviour.

### Repackaging player (`app/src/player/remux/`)

- Input: Mediabunny `Input` + `UrlSource` on the file link (byte ranges, MKV Cues for seeking).
- Tracks: first video track; audio track picked by the preferred audio language in your Stremio settings,
  then default flag, among those the browser can play (`MediaSource.isTypeSupported` with the
  track's codec string). Supported in practice on iPhone: H.264/HEVC video; AAC, AC3, E-AC3, Opus, FLAC, MP3 audio.
- Output: Mediabunny `Output` with `Mp4OutputFormat({ fastStart: 'fragmented' })` and a `StreamTarget`;
  packets are copied as-is (no decoding). Init segment + fragments go into one SourceBuffer.
- MediaSource: `ManagedMediaSource` when present (iPhone), else `MediaSource` (desktop browsers, for testing).
  The video element gets `disableRemotePlayback = true` (required by ManagedMediaSource).
- Buffering: keep reading while less than ~60 s is buffered ahead; pause otherwise. With
  ManagedMediaSource, also honour `startstreaming` / `endstreaming`. Drop data more than ~30 s behind.
- Seeking: when the target isn't buffered, stop the current read, start a new one from the key frame at or
  before the target, and set the SourceBuffer's `timestampOffset` so times line up.
- Hooking into the existing player engine: the repackager makes an object URL and the player passes it
  to stremio-video's HTML player as the stream URL (with a content-type hint so it doesn't try to
  `HEAD` it). Everything else (controls, progress, subtitles) stays on the current code path.

### 4K, HDR and Dolby Vision (Claude's call)

- HEVC 10-bit HDR10 is copied as-is; the codec string and colour information (`colr`) are carried into the
  MP4 so the iPhone shows HDR correctly.
- Dolby Vision profile 8 and profile 7 files play their HDR10-compatible base layer as plain HEVC HDR10
  (the Dolby Vision layer is dropped). If the phone refuses a file anyway, the player falls back to the
  VLC / Infuse message.
- Testing covers one HDR10 HEVC file as well as H.264.

### Dependency

- `mediabunny` 1.66.0 (MPL-2.0, ~12 MB in node_modules, only the parts used end up in the player chunk,
  which already loads only with the player). Added to THIRD-PARTY-NOTICES.md.

## Testing

- Locally in Chrome with an H.264/AAC MKV and an HDR10 HEVC MKV: playback, seek, resume, next episode.
  Real sources come from the user's signed-in Torrentio addon on this PC (key never printed or saved).
- Then a Vercel preview deployment the user opens on their iPhone (how it gets deployed is the user's call).

## Left to the builder

- Exact buffer sizes, fragment duration, and retry timing.
- Error wording in the player.
