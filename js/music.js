// Nashville-number chords, keys and spelling. Numbers are always relative to the
// major scale of the tonic, so in Am the progression is 1m 4m 5 b6 b7 b3.
(function (J) {
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const NATURAL = [0, 2, 4, 5, 7, 9, 11];
  const DEGREE = [0, 2, 4, 5, 7, 9, 11];

  const QUALITIES = {
    '': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10],
    'maj7': [0, 4, 7, 11], '6': [0, 4, 7, 9], 'm6': [0, 3, 7, 9], '9': [0, 4, 7, 10, 2],
    'dim': [0, 3, 6], 'dim7': [0, 3, 6, 9], 'aug': [0, 4, 8],
    'sus': [0, 5, 7], 'sus4': [0, 5, 7], 'sus2': [0, 2, 7],
  };
  const QUALITY_LABEL = { dim: '°', dim7: '°7', aug: '+', sus: 'sus4' };

  const MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const MINOR_KEYS = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

  function accidental(s) { return s === '#' ? 1 : s === 'b' ? -1 : 0; }

  function parseKey(name) {
    const m = /^([A-G])([b#]?)(m?)$/.exec(String(name).trim());
    if (!m) return null;
    const li = LETTERS.indexOf(m[1]);
    return { name: m[0], letterIndex: li, pc: (NATURAL[li] + accidental(m[2]) + 12) % 12, minor: m[3] === 'm' };
  }

  // Same mode, tonic moved by `semis`, using the conventional spelling for that key.
  function shiftKey(key, semis) {
    const pc = ((key.pc + semis) % 12 + 12) % 12;
    const names = key.minor ? MINOR_KEYS : MAJOR_KEYS;
    return parseKey(names.find(n => parseKey(n).pc === pc));
  }

  function keyDistance(from, to) { return ((to.pc - from.pc) % 12 + 12) % 12; }

  // "b7", "2m", "5/7", "1maj7", "#4dim"
  function parseChord(token) {
    const m = /^([b#]?)([1-7])([a-z0-9]*)(?:\/([b#]?)([1-7]))?$/.exec(token);
    if (!m || !(m[3] in QUALITIES)) return null;
    const chord = { acc: accidental(m[1]), degree: +m[2], quality: m[3], token };
    if (m[5]) chord.bass = { acc: accidental(m[4]), degree: +m[5] };
    return chord;
  }

  function degreePc(key, degree, acc) { return (key.pc + DEGREE[degree - 1] + acc + 12) % 12; }

  function spellDegree(key, degree, acc) {
    const li = (key.letterIndex + degree - 1) % 7;
    let diff = ((degreePc(key, degree, acc) - NATURAL[li]) % 12 + 12) % 12;
    if (diff > 6) diff -= 12;
    return LETTERS[li] + (diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff));
  }

  function qualityLabel(q) { return q in QUALITY_LABEL ? QUALITY_LABEL[q] : q; }

  function chordName(chord, key) {
    let s = spellDegree(key, chord.degree, chord.acc) + qualityLabel(chord.quality);
    if (chord.bass) s += '/' + spellDegree(key, chord.bass.degree, chord.bass.acc);
    return s;
  }

  function chordNumber(chord) {
    const a = c => (c.acc > 0 ? '#' : c.acc < 0 ? 'b' : '');
    let s = a(chord) + chord.degree + qualityLabel(chord.quality);
    if (chord.bass) s += '/' + a(chord.bass) + chord.bass.degree;
    return s;
  }

  function chordPcs(chord, key) {
    const root = degreePc(key, chord.degree, chord.acc);
    return { root, tones: QUALITIES[chord.quality].map(i => (root + i) % 12), intervals: QUALITIES[chord.quality] };
  }

  J.music = { parseKey, shiftKey, keyDistance, parseChord, chordName, chordNumber, chordPcs, spellDegree, qualityLabel };
})(window.Jambook = window.Jambook || {});
