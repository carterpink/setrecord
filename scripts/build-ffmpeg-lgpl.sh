#!/usr/bin/env bash
#
# Build a minimal, REDISTRIBUTABLE ffmpeg for SetRecord.
#
# The prebuilt ffmpeg-static binary is built --enable-gpl --enable-nonfree, which
# by FFmpeg's own license is UNREDISTRIBUTABLE — it cannot ship in the paid DMG.
# SetRecord only DECODES audio (energy analysis, fingerprinting) and extracts
# embedded artwork, so FFmpeg's NATIVE codecs are sufficient. We build with
# --disable-gpl --disable-nonfree and no external libraries (no x264/x265/fdk-aac)
# → a clean LGPL v2.1 binary that is legal to bundle.
#
# Output:  resources/ffmpeg/ffmpeg   (gitignored; bundled via electron-builder
#          extraResources, see electron-builder.yml). Re-run after a clean
#          checkout. Self-verified by scripts/check-ffmpeg-redistributable.mjs.
#
# Usage:   npm run build:ffmpeg          (REBUILD=1 to force; FFMPEG_VERSION=x.y.z)
set -euo pipefail

FFMPEG_VERSION="${FFMPEG_VERSION:-7.0.2}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/resources/ffmpeg"
OUT_BIN="$OUT_DIR/ffmpeg"
ARCH="$(uname -m)" # arm64 | x86_64

# Skip if a clean binary already exists (unless REBUILD=1).
if [[ -x "$OUT_BIN" && "${REBUILD:-0}" != "1" ]]; then
  if "$OUT_BIN" -hide_banner -version 2>/dev/null | grep -q -- '--enable-nonfree'; then
    echo "→ existing $OUT_BIN is nonfree; rebuilding"
  else
    echo "✓ clean ffmpeg already present at $OUT_BIN (REBUILD=1 to force)"
    exit 0
  fi
fi

command -v clang >/dev/null || { echo "✗ need clang — run: xcode-select --install"; exit 1; }
command -v make >/dev/null || { echo "✗ need make — run: xcode-select --install"; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

TARBALL="ffmpeg-$FFMPEG_VERSION.tar.xz"
URL="https://ffmpeg.org/releases/$TARBALL"
echo "→ downloading $URL"
curl -fsSL "$URL" -o "$TARBALL"

# Verify against FFmpeg's published checksum (same TLS origin as the tarball).
if curl -fsSL "$URL.sha256" -o "$TARBALL.sha256" 2>/dev/null; then
  EXPECTED="$(awk '{print $1}' "$TARBALL.sha256" | tr -d '[:space:]')"
  ACTUAL="$(shasum -a 256 "$TARBALL" | awk '{print $1}')"
  if [[ "$EXPECTED" != "$ACTUAL" ]]; then
    echo "✗ sha256 mismatch: got $ACTUAL, expected $EXPECTED"
    exit 1
  fi
  echo "✓ sha256 verified ($ACTUAL)"
else
  echo "⚠ no published sha256 fetched — relying on https origin for $TARBALL"
fi

tar xf "$TARBALL"
cd "ffmpeg-$FFMPEG_VERSION"

echo "→ configuring (LGPL: --disable-gpl --disable-nonfree, no external libs, arch=$ARCH)"
./configure \
  --cc=clang \
  --arch="$ARCH" \
  --disable-gpl \
  --disable-nonfree \
  --disable-doc \
  --disable-htmlpages --disable-manpages --disable-podpages --disable-txtpages \
  --disable-ffplay \
  --disable-debug \
  --disable-network \
  --enable-pthreads \
  --enable-small \
  --prefix="$WORK/install"

echo "→ building (make -j$(sysctl -n hw.ncpu))"
make -j"$(sysctl -n hw.ncpu)" >/dev/null
make install >/dev/null

mkdir -p "$OUT_DIR"
cp "$WORK/install/bin/ffmpeg" "$OUT_BIN"
chmod +x "$OUT_BIN"

echo "→ verifying redistributability"
node "$ROOT/scripts/check-ffmpeg-redistributable.mjs" --bin "$OUT_BIN"

echo "✓ built clean LGPL ffmpeg → $OUT_BIN"
"$OUT_BIN" -hide_banner -version | head -2
