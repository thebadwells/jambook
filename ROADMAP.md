# Jambook roadmap

Handoff for the next working session. Last updated 2026-10-17.
Original brief: `~/Downloads/jambook-kickoff.md` (on the Mac). Live: https://thebadwells.github.io/jambook/

## Where things stand

Brief build steps 1–6 are done and live (GitHub Pages deploys on every push to `main`):

| Step | Status |
|---|---|
| 1. Song format + loader | Done. `.song` text files in Nashville numbers; parser enforces the lyrics/rights policy |
| 2. Song page | Done. Fits one iPad landscape screen; chart grows/shrinks to fill; two-column layout for long songs |
| 3. Key + instrument toggles | Done. Key stepper, Guitar (capo suggestions, open shapes) / Mandolin (standard open chords, chop on tap), 1·4·5 numbers toggle |
| 4. Home screen | Done. Search, key grid with counts, Songs/Tunes filter, Recent chips, two-column list |
| 5. PWA / offline | Done. `sw.js` cache-first + background refresh + "updated · Reload" toast; Add to Home Screen icon |
| 6. Single-file export | Done. Share icon on home builds one self-contained HTML (`js/export.js`); built from published files only |
| 7. ~100 songs | 90 songs in. All `verified: false`; 45 carry a "check against your jam" note (list below) |
| 8. Later | Not started: `.tef` breaks, set lists, more instruments |

Also built (not in the brief): Breaks panel (bar under the chart; written ideas + scale hint + generated
chord-tone starter tab), Apple-HIG-style redesign with light/dark theme (dark default).

## Next up (suggested order)

1. **Check on the iPad first.** Things not yet verified on real hardware:
   - Add to Home Screen → open offline (airplane mode) → confirm songs load.
   - The share icon's iOS share sheet (only tested the build, not the native sheet).
   - Phone-width layout (never visually tested; CSS rules exist under `@media (max-width: 760px)`).
2. **Personal lyrics field** (brief's lyrics policy). Type lyrics for any song, stored only on-device
   (`localStorage`, key like `jambook:lyrics:<song-id>`), shown in the side panel's Lyrics card.
   Export already can't include it (built from published files), but add a test that confirms it.
3. **Chart verification workflow.** A "check this chart" badge on the home list for flagged songs, and
   a quick way to mark a song verified (likely: edit the `.song` file, flip `verified: true`, delete the
   check note). Ask the user for their local jam's song list/keys — their versions should win.
4. **Swipe between songs** on the song page (next/previous within the current home filter).
5. **Library gaps:** full lyrics for the other public-domain songs (currently first-line cues only);
   Jerusalem Ridge parts C and D; B and E key songs (e.g. Molly and Tenbrooks) if the jam plays them.
6. **Step 8:** link `.tef` break tabs by reusing tef-viewer's `js/tef-parser.js`, `js/tef2-parser.js`,
   `js/render-canvas.js` (github.com/thebadwells/tef-viewer); this likely replaces the generated starter
   tab in the Breaks panel. Then set-list mode; then banjo/fiddle/bass/dobro modules.

## Charts flagged "check against your jam" (45)

Ashes of Love (D), Ashokan Farewell (D), Beaumont Rag (F), Billy in the Lowground (C), Black Mountain Rag (A),
Blackberry Blossom (G), Blue Moon of Kentucky (A), Cherokee Shuffle (A), Clinch Mountain Backstep (A),
Cluck Old Hen (A), Cold Frosty Morning (Am), Cumberland Gap (A), Darling Corey (D), Dooley (G),
Down in the Willow Garden (C), Eighth of January (D), Faded Love (D), Fisher's Hornpipe (D), Forked Deer (D),
Fox on the Run (G), Gold Rush (A), Jerusalem Ridge (Am), John Hardy (A), June Apple (A), Kentucky Waltz (D),
Liberty (D), Little Sadie (Am), Lonesome Fiddle Blues (G), Long Journey Home (A), Midnight on the Water (D),
Mississippi Sawyer (D), Ocean of Diamonds (D), Old Home Place (G), Over the Waterfall (D), Pretty Polly (D),
Ragtime Annie (D), Red Haired Boy (A), Rocky Top (G), Sail Away Ladies (D), Shady Grove (Dm),
St. Anne's Reel (D), Temperance Reel (G), Train 45 (A), Uncle Pen (A), Whiskey Before Breakfast (D)

Find them with `grep -l "check this one" songs/*.song`.

## Known issues / limitations

- **Light theme status bar** in the home-screen app: iOS fixes `black-translucent` (white text) at
  install, so the clock/battery are hard to read in light theme. Dark theme is fine.
- **Shared HTML on iPhone/iPad** previews without running JS; share the live link with iOS users.
- **Home-screen app storage** is separate from Safari's (settings/recents start fresh once).
- **GitHub Pages caches files for 10 minutes**; a just-pushed change can take a refresh to appear
  (the service worker revalidates, so installed apps pick it up and show the update toast).
- **Breaks panel** is a first pass the user may want to rethink; it's self-contained (markup in
  `renderSong()`, styles under the "Breaks" CSS block, generator in `js/fretboard.js`).

## Map of the code

- `songs/*.song` + `songs/index.txt` (list of files to load: regenerate with
  `ls songs/*.song | xargs -n1 basename > songs/index.txt`). Format documented in `README.md`.
- `js/music.js`: keys, Nashville-number chords, spelling in any key.
- `js/song-format.js`: `.song` parser + rights/lyrics enforcement.
- `js/fretboard.js`: voicing finder, SVG chord diagrams, starter-break tab generator, scale hints.
- `js/instruments/*.js`: one module per instrument: `{ label, cycle(state), prepare(key, chords, state) }`
  returning `chartKey`, `banner`, `diagrams`, `breakTab`.
- `js/app.js`: routing (`#/`, `#/song/<id>`), home + song rendering, `fitChart()` sizing, theme, toasts.
- `js/export.js`: single-file bundle. `sw.js`: offline cache (add new JS/CSS files to `SHELL`).
- `css/style.css`: Apple system palettes as tokens on `:root` / `:root[data-theme="light"]`.

## Conventions

- **Commit email must be the GitHub noreply address**
  (`277473987+thebadwells@users.noreply.github.com`, already the global git config). The user rewrote
  history to remove their Gmail; never commit with it.
- The user likes to review before pushing: commit locally, and ask before `git push` unless told to deploy.
- Every chart stays `verified: false` until the user checks it; low-confidence charts get the note
  `Chords vary between jams; check this one against yours.`
- Lyrics only for `rights: public-domain`; copyrighted songs get a first-line `cue:` only.
- Test on iPad-landscape size (1180×820 / 1024×768). Preview locally with
  `python3 -m http.server 8000` in `~/jambook` (iPad on the same Wi-Fi: `http://<mac-ip>:8000`).
