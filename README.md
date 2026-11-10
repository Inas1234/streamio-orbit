# Streamio Orbit

A faster, cleaner Windows app for Stremio. It's a fork of
[stremio-community-v5](https://github.com/Zaarrg/stremio-community-v5) with a new interface.
It runs on Stremio's own engine, so your Stremio account, addons, library and watch
progress all carry over.

> **Unofficial.** Streamio Orbit is a community project. It is not made by, endorsed by or
> affiliated with Stremio or Smart Code.

## Download

Get **Streamio-Orbit-Setup-x.y.z.exe** from the [latest release](../../releases/latest) and run it.

- It installs for your Windows user only (no admin prompt), into
  `%LOCALAPPDATA%\Programs\Streamio Orbit`, and adds Start menu and desktop shortcuts.
- **Torrents work out of the box.** They need Stremio's streaming server, which isn't open source,
  so it isn't in this repo or the Setup file. Instead, if Stremio 5 or Stremio Service is already
  installed, Streamio Orbit uses that. If not, Setup downloads the official
  [Stremio Service](https://github.com/Stremio/stremio-service) package from Stremio's GitHub
  (about 31 MB) and takes the server from it.
- Needs Windows 10 or 11 with the Microsoft Edge WebView2 Runtime (built into Windows 11).
- The installer isn't code-signed yet, so Windows SmartScreen may warn you the first time.
  Choose **More info → Run anyway**.

## What's different

- **Look:** a top menu, a rotating featured title, and wide artwork cards. Title pages show
  cast photos, directors and writers, season tabs, and a source list that stays on screen.
- **My List:** views for your list, in-progress titles, watched titles and full watch history
  (including titles you played without adding). Each poster gets a progress ring: time left
  for movies, episodes left for shows.
- **Player:** an episode list where you can mark episodes or whole seasons watched. Subtitle
  size, position and delay controls are also built in.
- **Cast photos and actor pages** come from TMDB: add a free key under Settings.
- **Speed:**
  - The engine runs in a Web Worker, and bursts of engine updates are merged.
  - Home rows load as you scroll toward them; rows far off screen skip layout and painting.
  - The player and less-used pages load on demand. Startup ships about 95 KB of compressed
    code (the stock web interface: about 3 MB).
  - Sources appear as each addon answers, and addon answers are cached and refreshed in the
    background.
  - Sources are fetched ahead: the next episode while you watch, and titles you hover.

## Project layout

- `app/`: the interface (React + TypeScript + Vite).
- `shell/`: the Windows app (C++, WebView2 + mpv), from stremio-community-v5.
- `installer/`: the NSIS script that builds the Setup.

## Building from source

The interface:

```bash
pnpm --dir app install
pnpm --dir app dev            # http://localhost:5173 (browser preview)
pnpm --dir app build
```

The Windows app builds with MinGW-w64 (MSYS2), no Visual Studio needed. See
[`shell/BUILD-MINGW.md`](shell/BUILD-MINGW.md) for the one-time dependencies, then:

```bash
export PATH=/c/msys64/mingw64/bin:$PATH
cmake -S shell -B shell/build-mingw -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build shell/build-mingw
(cd shell && PUBLIC=1 ./package.sh ../release/public-stage)
```

The Setup builds with [NSIS](https://nsis.sourceforge.io) 3:

```bash
makensis -DVERSION=0.1.0 installer/streamio-orbit.nsi    # -> release/Streamio-Orbit-Setup-0.1.0.exe
```

## License

GPL-3.0, like stremio-community-v5 (see [LICENSE.md](LICENSE.md)).
Bundled third-party components are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Credits: [stremio-community-v5](https://github.com/Zaarrg/stremio-community-v5) by Zaarrg,
[stremio-core](https://github.com/Stremio/stremio-core) and
[stremio-video](https://github.com/Stremio/stremio-video) by Stremio, [mpv](https://mpv.io).
