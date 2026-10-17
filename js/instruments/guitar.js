// Guitar view: suggests a capo + open shape key, and shows open-position shapes.
(function (J) {
  const TUNING = [40, 45, 50, 55, 59, 64]; // E A D G B E (MIDI)
  const PCS = TUNING.map(m => m % 12);
  const SHAPES = {
    G: [3, 2, 0, 0, 3, 3], C: [-1, 3, 2, 0, 1, 0], D: [-1, -1, 0, 2, 3, 2], A: [-1, 0, 2, 2, 2, 0],
    E: [0, 2, 2, 1, 0, 0], F: [1, 3, 3, 2, 1, 1], Bb: [-1, 1, 3, 3, 3, 1], B: [-1, 2, 4, 4, 4, 2],
    Em: [0, 2, 2, 0, 0, 0], Am: [-1, 0, 2, 2, 1, 0], Dm: [-1, -1, 0, 2, 3, 1], Bm: [-1, 2, 4, 4, 3, 2],
    'F#m': [2, 4, 4, 2, 2, 2], 'C#m': [-1, 4, 6, 6, 5, 4], Gm: [3, 5, 5, 3, 3, 3], Cm: [-1, 3, 5, 5, 4, 3],
    G7: [3, 2, 0, 0, 0, 1], C7: [-1, 3, 2, 3, 1, 0], D7: [-1, -1, 0, 2, 1, 2], A7: [-1, 0, 2, 0, 2, 0],
    E7: [0, 2, 0, 1, 0, 0], B7: [-1, 2, 1, 2, 0, 2], F7: [1, 3, 1, 2, 1, 1], 'F#7': [2, 4, 2, 3, 2, 2],
    Em7: [0, 2, 2, 0, 3, 0], Am7: [-1, 0, 2, 0, 1, 0], Dsus4: [-1, -1, 0, 2, 3, 3], Asus4: [-1, 0, 2, 2, 3, 0],
    Cmaj7: [-1, 3, 2, 0, 0, 0], Fmaj7: [-1, -1, 3, 2, 1, 0], 'F#°': [2, -1, 1, 2, 1, -1],
  };
  const MAJOR_SHAPE_KEYS = ['G', 'C', 'D', 'A', 'E'];
  const MINOR_SHAPE_KEYS = ['Em', 'Am', 'Dm'];

  // All reasonable capo positions for a key, best first.
  function capoOptions(key) {
    const keys = key.minor ? MINOR_SHAPE_KEYS : MAJOR_SHAPE_KEYS;
    return keys.map((name, rank) => {
      const shapeKey = J.music.parseKey(name);
      return { capo: J.music.keyDistance(shapeKey, key), shapeKey, rank };
    }).filter(o => o.capo <= 7).sort((a, b) => a.capo - b.capo || a.rank - b.rank);
  }

  J.instruments.guitar = {
    label: 'Guitar',
    // state.capoChoice indexes capoOptions(); tapping the capo banner cycles it.
    cycle(state) { state.capoChoice = (state.capoChoice || 0) + 1; },
    prepare(key, chords, state) {
      const options = capoOptions(key);
      const choice = options[(state.capoChoice || 0) % options.length];
      const diagrams = chords.map(c => {
        const name = J.music.chordName(c, choice.shapeKey).replace(/\/.*/, '');
        const frets = SHAPES[name] ||
          J.fretboard.findVoicing(PCS, J.music.chordPcs(c, choice.shapeKey), { allowMute: true, rootInBass: true });
        return { name, frets };
      });
      const shapes = choice.shapeKey.name + (choice.shapeKey.minor ? '' : '') + ' shapes';
      return {
        chartKey: choice.shapeKey,
        banner: choice.capo ? `Capo ${choice.capo} · ${shapes}` : `No capo · ${shapes}`,
        bannerCycles: options.length > 1,
        diagrams: dedupe(diagrams),
        // Tab is relative to the capo, in open position.
        breakTab: sections => J.fretboard.outlineBreak(TUNING, ['E', 'A', 'D', 'G', 'B', 'e'], sections, { maxFret: 3 }),
      };
    },
  };

  function dedupe(list) {
    const seen = new Set();
    return list.filter(d => !seen.has(d.name) && seen.add(d.name));
  }
})(window.Jambook = window.Jambook || {});
