# Third-party components

Streamio Orbit is licensed under GPL-3.0 (see LICENSE.md). The Windows build bundles the
components below; each keeps its own license. Source code for all of them is available at
the links given.

| Component | Used for | License | Source |
|---|---|---|---|
| stremio-community-v5 shell | The Windows app this is forked from | GPL-3.0 | https://github.com/Zaarrg/stremio-community-v5 |
| mpv (`libmpv-2.dll`, includes FFmpeg and other libraries) | Video playback | GPL-2.0-or-later | https://github.com/mpv-player/mpv, build from https://sourceforge.net/projects/mpv-player-windows/files/libmpv/ |
| Microsoft Edge WebView2 SDK (`WebView2Loader.dll`) | Hosting the interface | Microsoft WebView2 SDK license (redistributable) | https://www.nuget.org/packages/Microsoft.Web.WebView2 |
| curl (`libcurl-4.dll`) | Network requests in the shell | curl license (MIT-style) | https://curl.se |
| OpenSSL (`libssl-3-x64.dll`, `libcrypto-3-x64.dll`) | TLS | Apache-2.0 | https://www.openssl.org |
| nghttp2, nghttp3, libssh2, libpsl, libidn2, libunistring, libiconv, libintl, brotli, zstd, zlib | curl dependencies (MSYS2 MinGW-w64 builds) | MIT / BSD / LGPL / zlib licenses | https://packages.msys2.org |
| winpthreads (`libwinpthread-1.dll`) | MinGW-w64 runtime | MIT / BSD | https://www.mingw-w64.org |
| nlohmann/json | JSON in the shell (compiled in) | MIT | https://github.com/nlohmann/json |
| @stremio/stremio-core-web | Stremio's engine (accounts, addons, library) | MIT | https://github.com/Stremio/stremio-core |
| @stremio/stremio-video | Video engine bridge | MIT | https://github.com/Stremio/stremio-video |
| React, React DOM, React Router, eventemitter3, @babel/runtime | Interface | MIT | https://www.npmjs.com |
| Archivo (font) | Interface typeface | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Archivo |

Not bundled: Stremio's streaming server (`server.js`, `stremio-runtime.exe`) is not open source.
Streamio Orbit uses the copy from an installed Stremio Service or Stremio app.

Stremio is a trademark of its owners. Streamio Orbit is an unofficial project and is not
affiliated with or endorsed by Stremio or Smart Code.
