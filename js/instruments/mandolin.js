// Mandolin view: standard first-position chords by default; tap the banner for closed chop shapes.
(function (J) {
  const TUNING = [55, 62, 69, 76]; // G D A E (MIDI)
  const PCS = TUNING.map(m => m % 12);

  // Common open/first-position shapes from standard mandolin chord charts (strings G D A E).
  const OPEN = {
    G: [0, 0, 2, 3], C: [0, 2, 3, 0], D: [2, 0, 0, 2], A: [2, 2, 4, 0], E: [1, 2, 2, 0],
    F: [5, 3, 0, 1], Bb: [3, 0, 1, 1], B: [4, 1, 2, 2], Eb: [3, 1, 1, 3], Ab: [1, 1, 3, 4],
    Db: [6, 3, 4, 4], 'F#': [3, 4, 4, 2],
    Em: [0, 2, 2, 0], Am: [2, 2, 3, 0], Dm: [2, 0, 0, 1], Bm: [4, 0, 2, 2], 'F#m': [2, 4, 4, 2],
    'C#m': [6, 2, 4, 4], Gm: [0, 0, 1, 3], Cm: [0, 1, 3, 3], Fm: [1, 3, 3, 1], Bbm: [3, 3, 4, 1],
    Ebm: [3, 1, 1, 2], 'G#m': [1, 1, 2, 4],
    G7: [0, 0, 2, 1], C7: [3, 2, 3, 0], D7: [2, 0, 3, 2], A7: [2, 2, 4, 3], E7: [1, 0, 2, 0],
    B7: [2, 1, 2, 2], 'F#7': [3, 4, 4, 0],
  };
  // Look shapes up by sound, so Gb finds F# and A# finds Bb.
  const BY_SOUND = {};
  for (const [name, frets] of Object.entries(OPEN)) {
    const m = /^([A-G][b#]?)(.*)$/.exec(name);
    BY_SOUND[J.music.parseKey(m[1]).pc + ':' + m[2]] = frets;
  }

  J.instruments.mandolin = {
    label: 'Mandolin',
    cycle(state) { state.chop = !state.chop; },
    prepare(key, chords, state) {
      const seen = new Set();
      const diagrams = [];
      for (const c of chords) {
        const name = J.music.chordName(c, key).replace(/\/.*/, '');
        if (seen.has(name)) continue;
        seen.add(name);
        const pcs = J.music.chordPcs(c, key);
        const open = !state.chop && BY_SOUND[pcs.root + ':' + c.quality];
        diagrams.push({ name, frets: open || J.fretboard.findVoicing(PCS, pcs, { preferClosed: !!state.chop, maxSpan: 3 }) });
      }
      return {
        chartKey: key, diagrams, bannerCycles: true,
        banner: state.chop ? 'Chop chords' : 'Open chords',
        breakTab: sections => J.fretboard.outlineBreak(TUNING, ['G', 'D', 'A', 'E'], sections, { maxFret: 5 }),
      };
    },
  };
})(window.Jambook = window.Jambook || {});
