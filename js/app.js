// Loads songs and renders the home and song screens. Routes: #/ and #/song/<id>
(function (J) {
  const M = J.music;
  const app = document.getElementById('app');
  let songs = [];
  let breaksOpen = false; // breaks panel open over the chart; resets when leaving a song

  const store = {
    get(k, fallback) { try { const v = localStorage.getItem('jambook:' + k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem('jambook:' + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function load() {
    const list = (await (await fetch('songs/index.txt')).text()).split('\n').map(s => s.trim()).filter(Boolean);
    songs = await Promise.all(list.map(async file => {
      const text = await (await fetch('songs/' + file)).text();
      return J.parseSong(text, file.replace(/\.song$/, ''));
    }));
    songs.sort((a, b) => a.title.localeCompare(b.title));
  }

  // ---------- Home (minimal; full home screen is build step 4) ----------
  function renderHome() {
    const keys = [...new Set(songs.map(s => s.key))].sort();
    const active = store.get('homeKey', 'all');
    const shown = songs.filter(s => active === 'all' || s.key === active);
    app.innerHTML = `
      <header class="topbar"><h1>Jambook</h1></header>
      <nav class="keygrid">
        ${['all', ...keys].map(k => `<button class="keybtn${k === active ? ' on' : ''}" data-key="${k}">${k === 'all' ? 'All' : esc(k)}</button>`).join('')}
      </nav>
      <ul class="songlist">
        ${shown.map(s => `<li><a href="#/song/${s.id}"><span>${esc(s.title)}</span><small>${esc(s.key)} · ${s.type === 'instrumental' ? 'tune' : 'song'}</small></a></li>`).join('')}
      </ul>`;
    app.querySelectorAll('.keybtn').forEach(b => b.onclick = () => { store.set('homeKey', b.dataset.key); renderHome(); });
  }

  // ---------- Song page ----------
  function songState(song) {
    return Object.assign({ semis: 0, instrument: 'guitar', numbers: false, capoChoice: 0 },
      { instrument: store.get('instrument', 'guitar'), numbers: store.get('numbers', false), chop: store.get('chop', false) },
      store.get('song:' + song.id, {}));
  }
  function saveState(song, st) {
    store.set('instrument', st.instrument);
    store.set('numbers', st.numbers);
    store.set('chop', !!st.chop);
    store.set('song:' + song.id, { semis: st.semis, capoChoice: st.capoChoice });
  }

  function renderSong(song) {
    const st = songState(song);
    const key = M.shiftKey(song.keyObj, st.semis);
    const view = J.instruments[st.instrument].prepare(key, J.songChords(song), st);
    st.breaksOpen = breaksOpen;
    const label = c => (st.numbers ? M.chordNumber(c) : M.chordName(c, view.chartKey));

    const sections = song.sections.map(sec => `
      <section class="sec">
        <h3>${esc(sec.name)}</h3>
        ${sec.rows.map(row => `<div class="row" style="--bars:${row.length}">${row.map(bar =>
          `<div class="bar${bar.length > 1 ? ' split' : ''}">${bar.map(c => `<span class="ch">${esc(label(c))}</span>`).join('')}</div>`).join('')}</div>`).join('')}
      </section>`).join('');

    const chords = J.songChords(song);
    const scale = J.fretboard.scaleHint(view.chartKey, chords);
    const tab = view.breakTab(song.sections.map(sec => ({
      name: sec.name, rows: sec.rows.map(r => r.map(bar => bar.map(c => M.chordPcs(c, view.chartKey)))),
    })));
    const ideas = song.breaks.filter(b => !b.instrument || b.instrument === st.instrument);
    const breaks = `
      <div class="breaks"${st.breaksOpen ? '' : ' hidden'}>
        <div class="breaks-body">
          <h3>Breaks</h3>
          ${ideas.length ? `<ul class="ideas">${ideas.map(b => `<li>${esc(b.text)}</li>`).join('')}</ul>` : ''}
          <p class="scale"><b>Scale:</b> ${esc(scale.name)} — ${scale.notes.map(esc).join(' ')}</p>
          <p class="tabnote">Starter break: chord tones of each bar${view.chartKey.pc === key.pc ? '' : ' (tab relative to the capo)'}. Fill in the gaps with the melody.</p>
          <div class="tabs">${tab.map(t => `<div class="tabsec"><h4>${esc(t.name)}</h4>${t.systems.map(sys => `<pre>${esc(sys.join('\n'))}</pre>`).join('')}</div>`).join('')}</div>
        </div>
      </div>`;

    const words = song.lyrics
      ? `<div class="lyrics">${esc(song.lyrics)}</div>`
      : song.cue ? `<p class="cue">“${esc(song.cue)}…”</p>` : '';

    app.innerHTML = `
      <header class="topbar song-top">
        <a class="back" href="#/" aria-label="Back to songs">‹</a>
        <div class="titleblock">
          <h1>${esc(song.title)}</h1>
          <p class="meta">${[song.form, song.feel, song.verified ? '' : 'unverified'].filter(Boolean).map(esc).join(' · ')}</p>
        </div>
        <div class="controls">
          <div class="keystep" role="group" aria-label="Key">
            <button data-act="down" aria-label="Key down a half step">−</button>
            <button data-act="reset" class="keyname${st.semis ? ' moved' : ''}" title="Reset to ${esc(song.key)}">${esc(key.name)}</button>
            <button data-act="up" aria-label="Key up a half step">+</button>
          </div>
          <div class="seg" role="group" aria-label="Instrument">
            ${Object.entries(J.instruments).map(([id, inst]) => `<button data-inst="${id}" class="${id === st.instrument ? 'on' : ''}">${inst.label}</button>`).join('')}
          </div>
          <button class="toggle${st.numbers ? ' on' : ''}" data-act="numbers" aria-label="Show Nashville numbers">123</button>
          <button class="toggle${st.breaksOpen ? ' on' : ''}" data-act="breaks" aria-pressed="${st.breaksOpen}">Breaks</button>
        </div>
      </header>
      <main class="songpage">
        <div class="chart"><div class="sections">${sections}</div>${breaks}</div>
        <aside class="side">
          <button class="banner" data-act="cycle" ${view.bannerCycles ? '' : 'disabled'}>${esc(view.banner)}${view.bannerCycles ? '<small>tap to change</small>' : ''}</button>
          <div class="diagrams">${view.diagrams.map(d => `<figure><figcaption>${esc(d.name)}</figcaption>${d.frets ? J.fretboard.diagramSvg(d.frets, d.name) : '<p class="nodiag">–</p>'}</figure>`).join('')}</div>
          ${song.notes.length ? `<div class="notes">${song.notes.map(n => `<p>${esc(n)}</p>`).join('')}</div>` : ''}
          ${words}
          ${song.errors.length ? `<div class="errors">${song.errors.map(esc).join('<br>')}</div>` : ''}
        </aside>
      </main>`;

    const rerender = () => { saveState(song, st); renderSong(song); };
    app.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      const act = b.dataset.act;
      if (act === 'up') st.semis = (st.semis + 1) % 12;
      if (act === 'down') st.semis = (st.semis + 11) % 12;
      if (act === 'reset') st.semis = 0;
      if (act === 'numbers') st.numbers = !st.numbers;
      if (act === 'cycle') J.instruments[st.instrument].cycle(st);
      if (act === 'breaks') { breaksOpen = !breaksOpen; renderSong(song); return; }
      if (/up|down|reset/.test(act)) st.capoChoice = 0;
      rerender();
    });
    app.querySelectorAll('[data-inst]').forEach(b => b.onclick = () => { st.instrument = b.dataset.inst; rerender(); });
    fitAll();
  }

  // Grow or shrink each panel's type so it fills the screen without scrolling.
  function fit(el, min, max) {
    if (!el) return;
    let lo = min, hi = max;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      el.style.fontSize = mid + 'px';
      const overflows = el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1 ||
        [...el.querySelectorAll('.bar')].some(b => b.scrollWidth > b.clientWidth + 1);
      if (overflows) hi = mid; else lo = mid;
    }
    el.style.fontSize = lo + 'px';
  }
  // Long charts can go two sections across; keep whichever layout gives bigger chords.
  function fitChart(el) {
    if (!el) return;
    const tryCols = n => { el.style.setProperty('--cols', n); fit(el, 10, 64); return parseFloat(el.style.fontSize); };
    const one = tryCols(1);
    if (el.children.length > 1 && tryCols(2) <= one) tryCols(1);
  }
  function fitAll() {
    if (window.matchMedia('(max-width: 760px)').matches) return;
    fitChart(app.querySelector('.sections'));
    fit(app.querySelector('.side'), 9, 22);
  }

  function route() {
    const m = /^#\/song\/(.+)$/.exec(location.hash);
    const song = m && songs.find(s => s.id === decodeURIComponent(m[1]));
    breaksOpen = false;
    document.body.classList.toggle('on-song', !!song);
    song ? renderSong(song) : renderHome();
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', route);
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(fitAll, 100); });

  load().then(route).catch(err => {
    app.innerHTML = `<p class="errors">Couldn't load songs (${esc(err.message)}). Serve this folder over http — see README.</p>`;
  });
})(window.Jambook = window.Jambook || {});
