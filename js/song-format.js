// Parses a .song file. See songs/README.md for the format.
(function (J) {
  const FIELDS = ['title', 'key', 'type', 'form', 'feel', 'rights', 'verified', 'notes', 'cue', 'break'];
  const RIGHTS = ['public-domain', 'copyrighted', 'unknown'];

  function parseSong(text, id) {
    const song = { id, notes: [], breaks: [], sections: [], lyrics: '', errors: [] };
    let section = null;
    const lyricLines = [];

    text.split(/\r?\n/).forEach((raw, i) => {
      const line = raw.trim();
      const err = msg => song.errors.push(`line ${i + 1}: ${msg}`);
      if (section === 'lyrics') {
        if (/^\[.+\]$/.test(line)) section = null; else { lyricLines.push(raw.trimEnd()); return; }
      }
      if (!line || line.startsWith('#')) return;

      const header = /^\[(.+)\]$/.exec(line);
      if (header) {
        const name = header[1].trim();
        if (name.toLowerCase() === 'lyrics') { section = 'lyrics'; return; }
        section = { name, rows: [] };
        song.sections.push(section);
        return;
      }

      if (line.startsWith('|')) {
        if (!section || section === 'lyrics') return err('bar line outside a [section]');
        const bars = line.split('|').slice(1, -1).map(b => b.trim());
        if (!line.endsWith('|')) return err('bar line must end with |');
        section.rows.push(bars.map(bar => bar.split(/\s+/).filter(Boolean).map(tok => {
          const chord = J.music.parseChord(tok);
          if (!chord) err(`unknown chord "${tok}"`);
          return chord;
        }).filter(Boolean)));
        return;
      }

      // "break.mandolin: ..." tags a break idea for one instrument.
      const field = /^([a-z]+)(?:\.([a-z]+))?:\s*(.*)$/.exec(line);
      if (field && FIELDS.includes(field[1]) && (!field[2] || field[1] === 'break')) {
        const [, k, inst, v] = field;
        if (k === 'notes') song.notes.push(v);
        else if (k === 'break') song.breaks.push({ instrument: inst || null, text: v });
        else if (k === 'verified') song.verified = v === 'true';
        else song[k] = v.replace(/^"(.*)"$/, '$1');
        return;
      }
      err(`can't read "${line}"`);
    });

    song.lyrics = lyricLines.join('\n').trim();
    song.keyObj = J.music.parseKey(song.key || '');
    if (!song.title) song.errors.push('missing title');
    if (!song.keyObj) song.errors.push(`bad or missing key "${song.key || ''}"`);
    if (!RIGHTS.includes(song.rights)) song.errors.push(`rights must be one of ${RIGHTS.join(', ')}`);
    if (song.lyrics && song.rights !== 'public-domain') {
      song.errors.push('lyrics removed: only public-domain songs may include lyrics');
      song.lyrics = '';
    }
    return song;
  }

  // Every distinct chord in the song, in order of first appearance.
  function songChords(song) {
    const seen = new Map();
    song.sections.forEach(s => s.rows.forEach(r => r.forEach(bar => bar.forEach(c => {
      if (!seen.has(c.token)) seen.set(c.token, c);
    }))));
    return [...seen.values()];
  }

  J.parseSong = parseSong;
  J.songChords = songChords;
})(window.Jambook = window.Jambook || {});
