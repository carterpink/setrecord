# Third-Party Licenses

SetRecord bundles third-party software. This file is shipped inside the
application (see `extraResources` in `electron-builder.yml`) to satisfy the
attribution and license-notice obligations of the components below.

---

## FFmpeg

SetRecord bundles a precompiled **FFmpeg** binary (via the `ffmpeg-static` npm
package) and invokes it as a **separate process** to decode audio for energy
analysis, album-artwork extraction, and live fingerprinting. SetRecord does not
link FFmpeg into its own code; it is spawned at arm's length via
`child_process`.

- **Project:** FFmpeg — https://ffmpeg.org
- **License:** GNU Lesser General Public License, version 2.1 or later
  (**LGPL v2.1+**). Full text: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html
- **Source code:** The corresponding FFmpeg source is available from
  https://ffmpeg.org/download.html. SetRecord ships an **unmodified** FFmpeg
  build; no patches are applied.
- **No GPL / no nonfree components.** The bundled binary is built **without**
  `--enable-gpl` and **without** `--enable-nonfree`, so it carries no GPL or
  non-redistributable obligations. This is enforced at release time by
  `scripts/check-ffmpeg-redistributable.mjs` (run `npm run check:ffmpeg`), which
  fails the build if the binary's configuration contains `--enable-nonfree`.

> Maintainer note: FFmpeg's own license summary ships alongside the binary at
> `node_modules/ffmpeg-static/ffmpeg.LICENSE`. If the bundled build is ever
> swapped, re-run `npm run check:ffmpeg` and update this section to match the new
> binary's actual configuration.

---

## Other dependencies

JavaScript/TypeScript dependencies are distributed under their respective
licenses (MIT, BSD, Apache-2.0, and ISC predominate), retained in each package
under `node_modules/<pkg>/LICENSE`. A consolidated SBOM/license report can be
regenerated from `package-lock.json` at any time.
