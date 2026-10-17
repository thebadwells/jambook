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
  // Display-only: Bb → B♭, F# → F♯, b7 → ♭7.
  const pretty = t => String(t).replace(/([A-G])b/g, '$1♭').replace(/(^|\/)b(?=\d)/g, '$1♭').replace(/#/g, '♯');

  const ICON = {
    back: '<svg viewBox="0 0 12 20" aria-hidden="true"><path d="M10 2 2 10l8 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    search: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="m13 13 5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="currentColor"/></svg>',
  };

  // Dark by default (stages, porches); light for daylight jams. index.html applies it before first paint.
  function themeButton() {
    const light = document.documentElement.dataset.theme === 'light';
    return `<button class="iconbtn" data-theme-toggle aria-label="Switch to ${light ? 'dark' : 'light'} theme">${light ? ICON.moon : ICON.sun}</button>`;
  }
  function wireTheme(rerender) {
    const b = app.querySelector('[data-theme-toggle]');
    if (b) b.onclick = () => {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      store.set('theme', next);
      rerender();
    };
  }

  async function load() {
    if (J.bundle) { // shared single-file copy: songs are inlined
      songs = J.bundle.songs.map(({ file, text }) => J.parseSong(text, file.replace(/\.song$/, '')));
      songs.sort((a, b) => a.title.localeCompare(b.title));
      return;
    }
    const list = (await (await fetch('songs/index.txt')).text()).split('\n').map(s => s.trim()).filter(Boolean);
    // One missing song file (e.g. offline before it was ever cached) shouldn't break the rest.
    const results = await Promise.allSettled(list.map(async file => {
      const res = await fetch('songs/' + file);
      if (!res.ok) throw new Error(file);
      return J.parseSong(await res.text(), file.replace(/\.song$/, ''));
    }));
    songs = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    songs.sort((a, b) => a.title.localeCompare(b.title));
  }

  // ---------- Home ----------
  // Jam-common keys first; any other key in the library is appended in this order.
  const KEY_ORDER = ['G', 'A', 'D', 'C', 'F', 'E', 'Bb', 'B', 'Em', 'Am', 'Dm', 'Bm', 'Gm'];
  const RECENT_MAX = 6;
  let query = ''; // kept while you visit a song and come back

  const norm = t => t.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  function renderHome() {
    const counts = {};
    songs.forEach(s => { counts[s.key] = (counts[s.key] || 0) + 1; });
    const keys = Object.keys(counts).sort((a, b) => rank(a) - rank(b));
    function rank(k) { const i = KEY_ORDER.indexOf(k); return i < 0 ? 99 : i; }

    app.innerHTML = `
      <header class="navbar home-nav">
        <div class="navrow">
          <h1 class="largetitle">Jambook</h1>
          <div class="navactions">
            ${J.bundle
              ? `<a class="bundle-note" href="${esc(J.bundle.source)}">Shared copy · ${esc(J.bundle.builtAt.slice(0, 10))}</a>`
              : `<button class="iconbtn" data-share aria-label="Share a copy of Jambook">${ICON.share}</button>`}
            ${themeButton()}
          </div>
        </div>
        <label class="searchfield">${ICON.search}
          <input type="search" class="search" placeholder="Search ${songs.length} songs" value="${esc(query)}"
            autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Search songs">
        </label>
      </header>
      <main class="home-body">
      <nav class="keygrid" aria-label="Key">
        <button class="keybtn" data-key="all">All<small>${songs.length}</small></button>
        ${keys.map(k => `<button class="keybtn" data-key="${esc(k)}">${esc(pretty(k))}<small>${counts[k]}</small></button>`).join('')}
      </nav>
      <div class="homebar">
        <div class="segmented" role="group" aria-label="Type">
          ${[['all', 'All'], ['song', 'Songs'], ['instrumental', 'Tunes']].map(([v, l]) => `<button data-type="${v}">${l}</button>`).join('')}
        </div>
        <p class="count" aria-live="polite"></p>
      </div>
      <section class="recent"></section>
      <ul class="songlist"></ul>
      </main>`;

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
        q ? `${shown.length} match${shown.length === 1 ? '' : 'es'}` : `${shown.length} ${key === 'all' ? 'total' : 'in ' + pretty(key)}`;
      app.querySelector('.songlist').innerHTML = shown.length
        ? shown.map(songItem).join('')
        : `<li class="empty">No songs match “${esc(query)}”.</li>`;
      const recent = store.get('recent', []).map(id => songs.find(s => s.id === id)).filter(Boolean);
      app.querySelector('.recent').innerHTML = !q && recent.length
        ? `<h2 class="section-h">Recent</h2><div class="chips">${recent.map(s => `<a class="chip" href="#/song/${s.id}">${esc(s.title)}</a>`).join('')}</div>` : '';
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
    wireTheme(renderHome);
    const share = app.querySelector('[data-share]');
    if (share) share.onclick = async () => {
      share.disabled = true;
      toast('Preparing a copy…');
      try {
        const result = await J.exportBundle.shareBundle();
        toast(result === 'downloaded' ? 'Saved jambook.html' : result === 'shared' ? 'Shared' : '', 2500);
      } catch (err) {
        toast(`Couldn't make a copy: ${err.message}`, 4000);
      } finally { share.disabled = false; }
    };
    update();
  }

  function songItem(s) {
    return `<li><a href="#/song/${s.id}">
      <span class="t">${esc(s.title)}</span>
      <span class="k">${esc(pretty(s.key))}</span>
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
    const label = c => pretty(st.numbers ? M.chordNumber(c) : M.chordName(c, view.chartKey));

    const sections = song.sections.map(sec => `
      <section class="sec">
        <h3>${esc(sec.name)}</h3>
        <div class="rows">${sec.rows.map(row => `<div class="row" style="--bars:${row.length}">${row.map(bar =>
          `<div class="bar${bar.length > 1 ? ' split' : ''}">${bar.map(c => `<span class="ch">${esc(label(c))}</span>`).join('')}</div>`).join('')}</div>`).join('')}</div>
      </section>`).join('');

    const chords = J.songChords(song);
    const scale = J.fretboard.scaleHint(view.chartKey, chords);
    const tab = view.breakTab(song.sections.map(sec => ({
      name: sec.name, rows: sec.rows.map(r => r.map(bar => bar.map(c => M.chordPcs(c, view.chartKey)))),
    })));
    const ideas = song.breaks.filter(b => !b.instrument || b.instrument === st.instrument);
    const breaks = `
      <div class="breaks${st.breaksOpen ? ' open' : ''}">
        <button class="breaks-bar" data-act="breaks" aria-expanded="${st.breaksOpen}">Breaks <span>${st.breaksOpen ? 'Hide' : 'Show'}</span></button>
        <div class="breaks-body"${st.breaksOpen ? '' : ' hidden'}>
          ${ideas.length ? `<ul class="ideas">${ideas.map(b => `<li>${esc(b.text)}</li>`).join('')}</ul>` : ''}
          <p class="scale"><b>Scale:</b> ${esc(pretty(scale.name))} — ${scale.notes.map(n => esc(pretty(n))).join(' ')}</p>
          <p class="tabnote">Starter break: chord tones of each bar${view.chartKey.pc === key.pc ? '' : ' (tab relative to the capo)'}. Fill in the gaps with the melody.</p>
          <div class="tabs">${tab.map(t => `<div class="tabsec"><h4>${esc(t.name)}</h4>${t.systems.map(sys => `<pre>${esc(sys.join('\n'))}</pre>`).join('')}</div>`).join('')}</div>
        </div>
      </div>`;

    const words = song.lyrics
      ? `<div class="lyrics">${esc(song.lyrics)}</div>`
      : song.cue ? `<p class="cue">“${esc(song.cue)}…”</p>` : '';

    app.innerHTML = `
      <header class="navbar song-nav">
        <a class="back" href="#/">${ICON.back}<span>Songs</span></a>
        <div class="titleblock">
          <h1>${esc(song.title)}</h1>
          <p class="meta">${[song.form, song.feel, song.verified ? '' : 'unverified'].filter(Boolean).map(esc).join(' · ')}</p>
        </div>
        <div class="controls">
          <div class="stepper" role="group" aria-label="Key">
            <button data-act="down" aria-label="Key down a half step">−</button>
            <button data-act="reset" class="keyname${st.semis ? ' moved' : ''}" aria-label="Key ${esc(pretty(key.name))}${st.semis ? ', tap to reset to ' + esc(pretty(song.key)) : ''}">${esc(pretty(key.name))}</button>
            <button data-act="up" aria-label="Key up a half step">+</button>
          </div>
          <div class="segmented" role="group" aria-label="Instrument">
            ${Object.entries(J.instruments).map(([id, inst]) => `<button data-inst="${id}" class="${id === st.instrument ? 'on' : ''}">${inst.label}</button>`).join('')}
          </div>
          <button class="pill${st.numbers ? ' on' : ''}" data-act="numbers" aria-pressed="${st.numbers}" aria-label="Nashville numbers">1·4·5</button>
          ${themeButton()}
        </div>
      </header>
      <main class="songpage">
        <div class="chart"><div class="sections">${sections}</div>${breaks}</div>
        <aside class="side">
          <section class="card">
            <button class="banner" data-act="cycle" ${view.bannerCycles ? '' : 'disabled'}>
              <span>${esc(pretty(view.banner))}</span>${view.bannerCycles ? '<small>Change</small>' : ''}
            </button>
            <div class="diagrams">${view.diagrams.map(d => `<figure><figcaption>${esc(pretty(d.name))}</figcaption>${d.frets ? J.fretboard.diagramSvg(d.frets, d.name) : '<p class="nodiag">–</p>'}</figure>`).join('')}</div>
          </section>
          ${song.notes.length ? `<section class="card notes"><h2>Notes</h2>${song.notes.map(n => `<p>${esc(n)}</p>`).join('')}</section>` : ''}
          ${words ? `<section class="card"><h2>${song.lyrics ? 'Lyrics' : 'First line'}</h2>${words}</section>` : ''}
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
    wireTheme(() => renderSong(song));
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
    const tryCols = n => { el.style.setProperty('--cols', n); fit(el, 10, 88); return parseFloat(el.style.fontSize); };
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

  // Bottom notice. With `ms` it fades out; with an action it stays until tapped.
  function toast(message, ms, action) {
    document.querySelector('.toast')?.remove();
    if (!message) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.innerHTML = `<span>${esc(message)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
    if (action) t.querySelector('button').onclick = action.run;
    document.body.append(t);
    if (ms) setTimeout(() => t.remove(), ms);
  }

  // Offline support (see sw.js). When a background refresh finds new content, offer a reload.
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !J.bundle) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'updated') toast('Jambook was updated', 0, { label: 'Reload', run: () => location.reload() });
    });
  }

  load().then(route).catch(err => {
    app.innerHTML = `<p class="errors">Couldn't load songs (${esc(err.message)}). Serve this folder over http — see README.</p>`;
  });
})(window.Jambook = window.Jambook || {});
