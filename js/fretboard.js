// Shared fretted-instrument helpers: a small chord-voicing finder and an SVG diagram.
(function (J) {
  // tuning: open-string pitch classes, low to high. Returns frets (-1 = muted).
  function findVoicing(tuning, chord, opts = {}) {
    const { allowMute = false, rootInBass = false, maxSpan = 3, preferClosed = false } = opts;
    const n = tuning.length;
    const required = new Set([chord.tones[0], chord.tones[1]]);
    if (chord.intervals.length > 3) required.add(chord.tones[chord.tones.length - 1]);
    if (chord.tones[1] !== undefined && chord.intervals[1] === 7) required.add(chord.tones[1]); // sus2/sus4 edge
    let best = null;

    for (let base = 1; base <= 10; base++) {
      const options = tuning.map((open, s) => {
        const o = [];
        if (allowMute && s < n - 4) o.push(-1);
        for (let f = 0; f <= base + maxSpan; f++) {
          if (f !== 0 && f < base) continue;
          if (chord.tones.includes((open + f) % 12)) o.push(f);
        }
        return o;
      });
      if (options.some(o => !o.length)) continue;
      const frets = new Array(n);
      (function walk(s) {
        if (s === n) return consider(frets.slice(), base);
        for (const f of options[s]) {
          if (f === -1 && s > 0 && frets[s - 1] !== -1) continue; // mutes only at the low end
          frets[s] = f; walk(s + 1);
        }
      })(0);
    }
    return best && best.frets;

    function consider(frets, base) {
      const sounding = frets.map((f, s) => (f < 0 ? null : (tuning[s] + f) % 12)).filter(p => p !== null);
      if (sounding.length < Math.min(n, 4)) return;
      for (const r of required) if (!sounding.includes(r)) return;
      if (rootInBass && sounding[0] !== chord.root) return;
      const fretted = frets.filter(f => f > 0);
      const lo = Math.min(...fretted), hi = Math.max(...fretted);
      if (fretted.length && hi - lo > maxSpan) return;
      const opens = frets.filter(f => f === 0).length;
      let score = (fretted.length ? lo : 0) * 0.6 + (hi - lo) + (new Set(fretted).size) * 0.3;
      score += preferClosed ? opens * 3 : -opens * 0.5;
      if (sounding[0] !== chord.root) score += 1.5;
      if (!best || score < best.score) best = { frets, score };
    }
  }

  function diagramSvg(frets, label) {
    const strings = frets.length, rows = 4;
    const fretted = frets.filter(f => f > 0);
    const hi = fretted.length ? Math.max(...fretted) : 0;
    const base = hi <= rows ? 1 : Math.min(...fretted);
    const w = 100, gap = (w - 20) / (strings - 1), top = 22, fh = 18;
    const x = s => 10 + s * gap;
    let svg = `<svg viewBox="0 0 ${w + 16} ${top + rows * fh + 6}" class="diagram" role="img" aria-label="${label} chord: ${frets.map(f => (f < 0 ? 'x' : f)).join(' ')}">`;
    svg += base === 1
      ? `<rect x="${x(0)}" y="${top - 3}" width="${x(strings - 1) - x(0)}" height="4" fill="currentColor"/>`
      : `<text x="${x(strings - 1) + 5}" y="${top + fh * 0.7}" class="fretno">${base}</text>`;
    for (let r = 0; r <= rows; r++) svg += `<line x1="${x(0)}" x2="${x(strings - 1)}" y1="${top + r * fh}" y2="${top + r * fh}" stroke="currentColor" stroke-width="1"/>`;
    for (let s = 0; s < strings; s++) {
      svg += `<line x1="${x(s)}" x2="${x(s)}" y1="${top}" y2="${top + rows * fh}" stroke="currentColor" stroke-width="1"/>`;
      const f = frets[s];
      if (f < 0) svg += `<text x="${x(s)}" y="${top - 8}" class="mark">×</text>`;
      else if (f === 0) svg += `<circle cx="${x(s)}" cy="${top - 11}" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/>`;
      else svg += `<circle cx="${x(s)}" cy="${top + (f - base + 0.5) * fh}" r="6.5" class="dot"/>`;
    }
    return svg + '</svg>';
  }

  J.fretboard = { findVoicing, diagramSvg };
})(window.Jambook = window.Jambook || {});

// Starter break: a chord-tone outline of each bar, voice-led in one position, as tab.
// tuning is MIDI note numbers low→high; rows are chart rows of bars of chordPcs() results.
(function (J) {
  function outlineBreak(tuning, stringNames, sections, { maxFret = 4, notesPerBar = 4 } = {}) {
    const byMidi = new Map();
    tuning.forEach((open, s) => {
      for (let f = 0; f <= maxFret; f++) {
        const q = byMidi.get(open + f);
        if (!q || f < q.f) byMidi.set(open + f, { s, f, midi: open + f });
      }
    });
    const all = [...byMidi.values()].sort((a, b) => a.midi - b.midi);
    const center = (all[0].midi + all[all.length - 1].midi) / 2;
    let prev = center;

    function notesFor(chord, count, ending) {
      const tones = all.filter(p => chord.tones.includes(p.midi % 12));
      const roots = tones.map((p, i) => ({ p, i })).filter(({ p }) => p.midi % 12 === chord.root);
      const { i } = roots.reduce((a, b) => (cost(b.p) < cost(a.p) ? b : a));
      if (ending) { prev = tones[i].midi; return [tones[i], ...new Array(count - 1).fill(null)]; }
      const dir = i + 2 < tones.length ? 1 : -1;
      const steps = count === 1 ? [0] : count === 2 ? [0, 1] : [0, 1, 2, 1];
      const out = steps.map(k => tones[Math.max(0, Math.min(tones.length - 1, i + k * dir))]);
      prev = out[out.length - 1].midi;
      return out;
    }
    function cost(p) { return Math.abs(p.midi - prev) + 0.35 * Math.abs(p.midi - center); }

    return sections.map(sec => {
      const lastRow = sec.rows.length - 1;
      const systems = sec.rows.map((row, r) => {
        const cols = row.map((bar, b) => {
          const ending = r === lastRow && b === row.length - 1 && bar.length === 1;
          return bar.flatMap(ch => notesFor(ch, Math.max(1, notesPerBar / bar.length), ending));
        });
        return tuning.map((_, s) => s).reverse().map(s =>
          stringNames[s].padEnd(2) + '|' + cols.map(notes => notes.map(n =>
            (n && n.s === s ? String(n.f) : '').padEnd(3, '-')).join('') + '-|').join(''));
      });
      return { name: sec.name, systems };
    });
  }

  // A scale to improvise from, chosen from the song's chords.
  function scaleHint(key, chords) {
    const has = (deg, acc) => chords.some(c => c.degree === deg && c.acc === acc);
    const [name, degrees] = key.minor ? ['minor pentatonic', [[1, 0], [3, -1], [4, 0], [5, 0], [7, -1]]]
      : has(7, -1) ? ['mixolydian (major scale with ♭7)', [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, -1]]]
      : ['major pentatonic', [[1, 0], [2, 0], [3, 0], [5, 0], [6, 0]]];
    const tonic = J.music.spellDegree(key, 1, 0) + (key.minor ? 'm' : '');
    return { name: `${tonic.replace(/m$/, '')} ${name}`, notes: degrees.map(([d, a]) => J.music.spellDegree(key, d, a)) };
  }

  Object.assign(J.fretboard, { outlineBreak, scaleHint });
})(window.Jambook = window.Jambook || {});
