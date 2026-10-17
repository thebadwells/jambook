// Builds a single self-contained HTML copy of Jambook to share: all code, styles and songs
// inlined, no network or service worker needed. It is assembled only from the published files
// (index.html, css, js, songs/*.song), never from this device's storage, so personal data —
// settings, recents, personal lyrics — can't end up in a shared copy.
(function (J) {
  const text = async url => {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`couldn't load ${url}`);
    return res.text();
  };
  const dataUrl = async url => {
    const blob = await (await fetch(url)).blob();
    return new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
  };
  // Keep inlined code from closing its own <script>/<style> tag early.
  const safeScript = s => s.replace(/<\/script/gi, '<\\/script');
  const safeStyle = s => s.replace(/<\/style/gi, '<\\/style');

  async function buildBundle() {
    // Replacements use functions so `$&`-style sequences in the inlined code stay literal.
    let html = await text('index.html');
    const css = safeStyle(await text('css/style.css'));
    const icon = await dataUrl('icons/favicon-32.png');
    const files = (await text('songs/index.txt')).split('\n').map(s => s.trim()).filter(Boolean);
    const songs = await Promise.all(files.map(async file => ({ file, text: await text('songs/' + file) })));

    html = html
      .replace(/\s*<link rel="(manifest|apple-touch-icon)"[^>]*>/g, '')
      .replace(/<link rel="icon"([^>]*) href="([^"]+)">/, (m, attrs, href) => `<link rel="icon"${attrs} href="__ICON__">`)
      .replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${css}\n</style>`);
    html = html.replace('__ICON__', () => icon);

    const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
    for (const src of scripts) {
      const code = safeScript(await text(src));
      html = html.replace(`<script src="${src}"></script>`, () => `<script>/* ${src} */\n${code}\n</script>`);
    }
    const data = JSON.stringify({ builtAt: new Date().toISOString(), source: location.href.split('#')[0], songs })
      .replace(/</g, '\\u003c');
    html = html.replace('<script>window.Jambook = { instruments: {} };</script>',
      () => `<script>window.Jambook = { instruments: {}, bundle: ${data} };</script>`);
    return html;
  }

  // Share sheet on iPad/iPhone (AirDrop, Messages, Save to Files); plain download elsewhere.
  async function shareBundle() {
    const name = `jambook-${new Date().toISOString().slice(0, 10)}.html`;
    const file = new File([await buildBundle()], name, { type: 'text/html' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Jambook' }); return 'shared'; }
      catch (err) { if (err.name === 'AbortError') return 'cancelled'; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    return 'downloaded';
  }

  J.exportBundle = { buildBundle, shareBundle };
})(window.Jambook = window.Jambook || {});
