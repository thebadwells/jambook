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

  // ---------- Home ----------
  // Jam-common keys first; any other key in the library is appended in this order.
  const KEY_ORDER = ['G', 'A', 'D', 'C', 'F', 'E', 'Bb', 'B', 'Em', 'Am', 'Dm', 'Bm', 'Gm'];
  const RECENT_MAX = 6;
  let query = ''; // kept while you visit a song and come back

  const norm = t => t.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const prettyKey = k => k.replace(/^([A-G])b/, '$1♭').replace(/^([A-G])#/, '$1♯');

  function renderHome() {
    const counts = {};
    songs.forEach(s => { counts[s.key] = (counts[s.key] || 0) + 1; });
    const keys = Object.keys(counts).sort((a, b) => rank(a) - rank(b));
    function rank(k) { const i = KEY_ORDER.indexOf(k); return i < 0 ? 99 : i; }

    app.innerHTML = `
      <header class="topbar home-top">
        <h1>Jambook</h1>
        <input type="search" class="search" placeholder="Search ${songs.length} songs" value="${esc(query)}"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Search songs">
      </header>
      <nav class="keygrid" aria-label="Key">
        <button class="keybtn" data-key="all">All<small>${songs.length}</small></button>
        ${keys.map(k => `<button class="keybtn" data-key="${esc(k)}">${esc(prettyKey(k))}<small>${counts[k]}</small></button>`).join('')}
      </nav>
      <div class="homebar">
        <div class="seg" role="group" aria-label="Type">
          ${[['all', 'All'], ['song', 'Songs'], ['instrumental', 'Tunes']].map(([v, l]) => `<button data-type="${v}">${l}</button>`).join('')}
        </div>
        <p class="count" aria-live="polite"></p>
      </div>
      <section class="recent"></section>
      <ul class="songlist"></ul>`;

    const search = app.querySelector('.search');
    const update = () => {
      const key = store.get('homeKey', 'all'), type = store.get('homeType', 'all');
      const q = norm(query);
      app.querySelectorAll('[data-key]').forEach(b => b.classList.toggle('on', !q && b.dataset.key === key));
      app.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('on', b.dataset.type === type));
      // A search looks across every key, so a song is never hidden behind the key filter.
      const shown = songs.filter(s => (type === 'all' || s.type === type) &&
        (q ? norm(s.title).includes(q) : key === 'all' || s.key === key));
      app.querySelector('.count').textContent =
        q ? `${shown.length} match${shown.length === 1 ? '' : 'es'}` : `${shown.length} ${key === 'all' ? 'total' : 'in ' + prettyKey(key)}`;
      app.querySelector('.songlist').innerHTML = shown.length
        ? shown.map(songItem).join('')
        : `<li class="empty">No songs match “${esc(query)}”.</li>`;
      const recent = store.get('recent', []).map(id => songs.find(s => s.id === id)).filter(Boolean);
      app.querySelector('.recent').innerHTML = !q && recent.length
        ? `<h2>Recent</h2><div class="chips">${recent.map(s => `<a class="chip" href="#/song/${s.id}">${esc(s.title)}</a>`).join('')}</div>` : '';
    };

    search.oninput = () => { query = search.value; update(); };
    search.onkeydown = e => { // Enter opens the top result
      const first = app.querySelector('.songlist a');
      if (e.key === 'Enter' && first) location.hash = first.getAttribute('href');
    };
    app.querySelectorAll('[data-key]').forEach(b => b.onclick = () => {
      store.set('homeKey', b.dataset.key); query = ''; search.value = ''; update();
    });
    app.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { store.set('homeType', b.dataset.type); update(); });
    update();
  }

  function songItem(s) {
    return `<li><a href="#/song/${s.id}">
      <span class="t">${esc(s.title)}</span>
      <span class="k">${esc(prettyKey(s.key))}</span>
      <small>${s.type === 'instrumental' ? 'tune' : 'song'}${s.form ? ' · ' + esc(s.form) : ''}</small>
    </a></li>`;
  }

  function addRecent(id) {
    store.set('recent', [id, ...store.get('recent', []).filter(r => r !== id)].slice(0, RECENT_MAX));
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
      <div class="breaks${st.breaksOpen ? ' open' : ''}">
        <button class="breaks-bar" data-act="breaks" aria-expanded="${st.breaksOpen}">Breaks <span aria-hidden="true">${st.breaksOpen ? '▾' : '▴'}</span></button>
        <div class="breaks-body"${st.breaksOpen ? '' : ' hidden'}>
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
  }

  function route() {
    const m = /^#\/song\/(.+)$/.exec(location.hash);
    const song = m && songs.find(s => s.id === decodeURIComponent(m[1]));
    breaksOpen = false;
    document.body.classList.toggle('on-song', !!song);
    if (song) addRecent(song.id);
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
