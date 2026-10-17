# Jambook

A bluegrass fake book for jam sessions: plain HTML/CSS/JS, no build step.

## Use it

Live at https://thebadwells.github.io/jambook/ (GitHub Pages, deploys on every push to `main`).
On iPad: open it in Safari → Share → **Add to Home Screen**. After the first visit it works fully
offline; when online it refreshes in the background and shows an "updated · Reload" notice.

## Run it locally

```sh
python3 -m http.server 8000
```

Open http://localhost:8000, or `http://<mac-name>.local:8000` from an iPad on the same Wi-Fi
(songs load with `fetch`, so it must be served over http, not opened as a file).

## Offline (sw.js)

The service worker serves everything cache-first and refreshes in the background. Songs listed in
`songs/index.txt` are cached automatically. If you add a new JS/CSS file, add it to `SHELL` in
`sw.js` so it's available on a first offline launch.

## Layout

- `songs/*.song` — one song per file; `songs/index.txt` lists the files to load.
- `js/music.js` — Nashville numbers → chord names in any key.
- `js/song-format.js` — the `.song` parser.
- `js/instruments/*.js` — one self-contained view module per instrument. Each registers
  `Jambook.instruments.<id> = { label, prepare(key, chords, state) }` and returns the key to spell the
  chart in, a banner (e.g. capo), and chord diagrams. Add banjo, fiddle, etc. the same way.

## Song format

```
title: Salty Dog Blues
key: G                 # standard jam key; minor keys like Am are fine
type: song             # song | instrumental
form: verse/chorus     # or AABB
feel: 2/4, fast
rights: unknown        # public-domain | copyrighted | unknown
cue: "First line…"     # first-line cue for songs that aren't public domain
notes: One line per notes: field.
verified: false        # flip after checking against your local jam

[Verse]
| 1 | 1 | 6 | 6 |      # one line = one row of bar boxes
| 2 | 2 | 5 4 | 1 |    # two chords in a bar = split bar

[lyrics]               # only kept when rights is public-domain
...
```

Chords are Nashville numbers relative to the tonic's major scale: `1 4 5 2m 6m b7 b3 b6`,
with qualities `m 7 m7 maj7 6 m6 9 dim dim7 aug sus sus4 sus2` and slash bass like `5/7`.
