# Building Watch with MinGW (no Visual Studio)

Uses the MSYS2 MinGW-w64 toolchain (GCC, CMake, Ninja, curl, OpenSSL from `C:\msys64\mingw64`).
Everything else lives inside this folder.

## One-time dependencies (in `deps/`)

- `deps/libmpv` — clone of https://github.com/Zaarrg/libmpv. Uses `x86_64/libmpv.dll.a` for linking;
  put `libmpv-2.dll` in `deps/libmpv/x86_64/` (unpack the `.rar`, or copy it from an installed Stremio).
- `deps/webview2/build/native` — `include/` and `x64/` from the Microsoft.Web.WebView2 NuGet package.
- `deps/nlohmann/json.hpp` — single header from nlohmann/json releases.

## Build

```bash
export PATH=/c/msys64/mingw64/bin:$PATH
cmake -S . -B build-mingw -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build-mingw -j 8
./package.sh            # -> ../release/Watch
```

`package.sh` copies the MinGW DLLs Watch.exe imports, the streaming server (`stremio-runtime.exe`,
`server.js`) and ffmpeg from an installed Stremio (`STREMIO_DIR`), and the interface build
(`../app/dist`) into `ui/`.

## What differs from the upstream (MSVC) build

- `src/compat/mingw/` replaces the WIL/WRL pieces MinGW lacks (`wil::com_ptr`,
  `wil::unique_cotaskmem_string`, `Microsoft::WRL::Callback`, `CoreWebView2EnvironmentOptions`).
- Discord Rich Presence is a no-op (`src/compat/mingw/discord_rpc.h`): the upstream library is MSVC-only.
- WebView2 and mpv are linked from their DLLs.

## Fork changes (both toolchains)

- If `ui/index.html` exists next to the exe, it's served at `https://app.watch.example/` through a
  WebView2 virtual host and used as the interface (unless `--webui-url=` is given).
- The upstream auto-updater is off.
- Window title and exe name: Streamio Orbit (the bundled-interface host stays app.watch.example so stored data survives).
