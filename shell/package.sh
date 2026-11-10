#!/usr/bin/env bash
# Assembles a runnable Streamio Orbit folder:
#   "Streamio Orbit.exe" + WebView2Loader.dll + libmpv-2.dll
#   the MinGW DLLs the exe actually needs (found by walking its imports)
#   the Stremio streaming server (stremio-runtime.exe + server.js) and ffmpeg
#   the interface build in ui/
#
# Usage: [PUBLIC=1] ./package.sh [output dir]   (default: "../release/Streamio Orbit")
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="Streamio Orbit"
OUT="${1:-$HERE/../release/$APP}"
MINGW_BIN="${MINGW_BIN:-/c/msys64/mingw64/bin}"
STREMIO_DIR="${STREMIO_DIR:-$LOCALAPPDATA/Programs/Stremio}"   # source of server.js and ffmpeg
UI_DIST="${UI_DIST:-$HERE/../app/dist}"
BUILD="$HERE/build-mingw"
OBJDUMP="$MINGW_BIN/objdump"

mkdir -p "$OUT"
cp -f "$BUILD/$APP.exe" "$BUILD/WebView2Loader.dll" "$BUILD/libmpv-2.dll" "$OUT/"

# The app used to be called Watch. WebView2 keeps sign-in and library data in a folder named
# after the exe, so carry the old one over instead of starting signed out.
if [[ -d "$OUT/Watch.exe.WebView2" && ! -e "$OUT/$APP.exe.WebView2" ]]; then
    mv "$OUT/Watch.exe.WebView2" "$OUT/$APP.exe.WebView2"
fi
rm -f "$OUT/Watch.exe"

# Walk DLL imports; copy any that live in the MinGW bin folder (system DLLs are skipped).
declare -A seen=()
queue=("$OUT/$APP.exe")
while ((${#queue[@]})); do
    file="${queue[0]}"; queue=("${queue[@]:1}")
    while read -r dll; do
        key="${dll,,}"
        [[ -n "${seen[$key]:-}" ]] && continue
        seen[$key]=1
        if [[ -f "$MINGW_BIN/$dll" ]]; then
            cp -f "$MINGW_BIN/$dll" "$OUT/"
            queue+=("$OUT/$dll")
        fi
    done < <("$OBJDUMP" -p "$file" | sed -n 's/^\s*DLL Name: //p')
done

# Streaming server and ffmpeg (taken from an installed Stremio). These are Stremio's own,
# not open source, so public builds (PUBLIC=1) leave them out: the app then uses the server
# from an installed Stremio Service or Stremio (see src/node/server.cpp).
if [[ "${PUBLIC:-0}" == 1 ]]; then
    echo "public build: not bundling Stremio's streaming server"
else
for f in stremio-runtime.exe server.js ffmpeg.exe ffprobe.exe \
         avcodec-58.dll avdevice-58.dll avfilter-7.dll avformat-58.dll avutil-56.dll \
         postproc-55.dll swresample-3.dll swscale-5.dll vcruntime140.dll vcruntime140_1.dll; do
    if [[ -f "$STREMIO_DIR/$f" ]]; then cp -f "$STREMIO_DIR/$f" "$OUT/"; else echo "warning: $f not found in $STREMIO_DIR"; fi
done
fi

# Interface.
rm -rf "$OUT/ui"
cp -r "$UI_DIST" "$OUT/ui"

echo "Packaged to $OUT"
ls "$OUT" | sed 's/^/  /'
du -sh "$OUT"
