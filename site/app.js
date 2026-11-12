import cfg from './config.js';

const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const money = (l) => (l.from ? 'From ' : '') + new Intl.NumberFormat('en-US', { style: 'currency', currency: l.currency }).format(l.price);
const etsy = (url) => { const u = new URL(url); u.searchParams.set('utm_source', cfg.utmSource); u.searchParams.set('utm_medium', 'referral'); return u.href; };
const STALE_MS = 6 * 3600e3; // Etsy API terms: listing content may be at most 6 hours old
const NEW_MS = 14 * 86400e3;

document.querySelectorAll('[data-shop-link]').forEach((a) => { a.href = etsy(cfg.shopUrl); a.rel = 'noopener'; });
$('#promises').append(...cfg.promises.map((t) => el('li', { textContent: t })));

let data;
try { data = await (await fetch('data/listings.json', { cache: 'no-cache' })).json(); } catch {}
const fresh = data && Date.now() - Date.parse(data.fetched_at) < STALE_MS && data.listings.length;

if (!fresh) {
  // Feed missing or too old to show under Etsy's rules: send people straight to the shop instead.
  for (const s of ['.tools', '#chips', '#grid', '#play']) $(s).hidden = true;
  $('#fallback').hidden = false;
} else {
  const byId = new Map(data.listings.map((l) => [String(l.id), l]));
  const state = { section: 'all', sort: 'loved', q: '' };
  const sorts = { loved: (a, b) => b.favs - a.favs || b.created - a.created, new: (a, b) => b.created - a.created, low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price };

  // ---------- catalog ----------
  const card = (l) => {
    const pics = el('span', { className: 'pics' }, el('img', { src: l.images[0].sm, alt: l.images[0].alt || l.title, loading: 'lazy' }));
    if (l.images[1]) pics.append(el('img', { src: l.images[1].sm, alt: '', loading: 'lazy', className: 'alt' }));
    if (Date.now() - l.created * 1000 < NEW_MS) pics.append(el('span', { className: 'tag', textContent: 'New' }));
    const meta = el('span', { className: 'meta' }, el('span', { className: 'price', textContent: money(l) }));
    if (l.favs >= 5) meta.append(el('span', { className: 'favs', textContent: `♥ ${l.favs}` }));
    const b = el('button', { className: 'card', type: 'button', onclick: () => open(l) }, pics, el('span', { className: 'title', textContent: l.title }), meta);
    b.style.viewTransitionName = `l${l.id}`;
    return b;
  };

  const render = () => {
    const q = state.q.trim().toLowerCase();
    const list = data.listings
      .filter((l) => (state.section === 'all' || l.section === state.section) && (!q || `${l.title} ${l.tags.join(' ')}`.toLowerCase().includes(q)))
      .sort(sorts[state.sort]);
    const grid = $('#grid');
    grid.replaceChildren(...list.map(card));
    if (!list.length) grid.append(el('p', { className: 'empty' }, `No designs match "${state.q}". `,
      el('button', { className: 'link', type: 'button', textContent: 'Clear search', onclick: () => { $('#search').value = state.q = ''; update(); } })));
  };
  const update = () => (document.startViewTransition ? document.startViewTransition(render) : render());

  const used = new Set(data.listings.map((l) => l.section));
  const chips = [{ id: 'all', title: 'All' }, ...data.sections.filter((s) => used.has(s.id))];
  $('#chips').append(...chips.map((s) => el('button', {
    type: 'button', className: 'chip', textContent: s.title, ariaPressed: String(s.id === 'all'),
    onclick: (e) => { state.section = s.id; document.querySelectorAll('.chip').forEach((c) => (c.ariaPressed = String(c === e.currentTarget))); update(); },
  })));
  $('#sort').onchange = (e) => { state.sort = e.target.value; update(); };
  $('#search').oninput = (e) => { state.q = e.target.value; render(); };
  render();

  $('#hero-stack').append(...[...data.listings].sort(sorts.loved).slice(0, 3).map((l) =>
    el('button', { type: 'button', className: 'sticker', ariaLabel: l.title, onclick: () => open(l) }, el('img', { src: l.images[0].sm, alt: '' }))));
  $('#updated').textContent = `Catalog updated ${new Date(data.fetched_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;

  // ---------- quick view ----------
  const dlg = $('#quick');
  function open(l) {
    const show = (im) => { $('#q-main').src = im.lg || im.sm; $('#q-main').alt = im.alt || l.title; };
    show(l.images[0]);
    $('#q-thumbs').replaceChildren(...(l.images.length > 1 ? l.images.slice(0, 8).map((im, i) =>
      el('button', { type: 'button', ariaLabel: `Photo ${i + 1}`, onclick: () => show(im) }, el('img', { src: im.sm, alt: '' }))) : []));
    $('#q-title').textContent = l.title;
    $('#q-price').textContent = money(l);
    $('#q-favs').textContent = l.favs >= 5 ? `♥ ${l.favs} people have favorited this on Etsy` : '';
    $('#q-desc').textContent = l.desc;
    $('#q-buy').href = $('#q-more').href = etsy(l.url);
    if (!dlg.open) dlg.showModal();
    history.replaceState(null, '', `#listing-${l.id}`); // shareable link straight to this design
  }
  dlg.addEventListener('close', () => history.replaceState(null, '', location.pathname));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  $('#q-close').onclick = () => dlg.close();
  const fromHash = () => { const l = byId.get(location.hash.replace('#listing-', '')); if (l) open(l); };
  addEventListener('hashchange', fromHash);
  fromHash();

  // ---------- matching game ----------
  if (data.listings.length >= 6) {
    const board = $('#board');
    const deal = () => {
      const picks = shuffle(data.listings).slice(0, 6);
      let first = null, locked = false, moves = 0, matched = 0;
      $('#moves').textContent = 0; $('#win').hidden = true; board.hidden = false;
      board.replaceChildren(...shuffle([...picks, ...picks]).map((l) => {
        const tile = el('button', { type: 'button', className: 'tile', ariaLabel: 'Hidden card' },
          el('span', { className: 'face back' }), el('span', { className: 'face front' }, el('img', { src: l.images[0].sm, alt: '' })));
        tile.onclick = () => {
          if (locked || tile.classList.contains('up')) return;
          tile.classList.add('up'); tile.ariaLabel = l.title;
          if (!first) { first = { tile, l }; return; }
          $('#moves').textContent = ++moves;
          if (first.l === l) { tile.classList.add('done'); first.tile.classList.add('done'); first = null; if (++matched === 6) win(picks, moves); return; }
          locked = true;
          const a = first.tile; first = null;
          setTimeout(() => { for (const t of [a, tile]) { t.classList.remove('up'); t.ariaLabel = 'Hidden card'; } locked = false; }, 800);
        };
        return tile;
      }));
    };
    const win = (picks, moves) => {
      const best = Math.min(moves, Number(store.get('kgcp-best')) || Infinity);
      store.set('kgcp-best', best);
      $('#win-title').textContent = `All six pairs in ${moves} moves${best < moves ? `. Your best is ${best}` : ''}.`;
      if (cfg.promo.code) { $('#win-promo').hidden = false; $('#win-promo').textContent = `Use code ${cfg.promo.code} at Etsy checkout for ${cfg.promo.text}.`; }
      $('#win-picks').replaceChildren(...picks.map((l) => el('button', { type: 'button', ariaLabel: l.title, onclick: () => open(l) }, el('img', { src: l.images[0].sm, alt: '' }))));
      setTimeout(() => { board.hidden = true; $('#win').hidden = false; }, 600);
    };
    $('#again').onclick = deal;
    deal();
  } else $('#game').hidden = true;
}

// ---------- poll (Google Form), Instagram, ads: each hidden until configured ----------
if (cfg.poll.formAction && cfg.poll.entry) {
  const form = $('#poll');
  const thanks = () => form.replaceChildren(el('h2', { textContent: 'Vote counted. Thanks for steering the next print run.' }));
  form.hidden = false;
  if (store.get('kgcp-poll') === cfg.poll.question) thanks();
  else {
    $('#poll-q').textContent = cfg.poll.question;
    $('#poll-options').append(...cfg.poll.options.map((o, i) => el('label', {}, el('input', { type: 'radio', name: 'vote', value: o, required: true, checked: i === 0 }), o)));
    form.onsubmit = (e) => {
      e.preventDefault();
      fetch(cfg.poll.formAction, { method: 'POST', mode: 'no-cors', body: new URLSearchParams({ [cfg.poll.entry]: new FormData(form).get('vote') }) }).catch(() => {});
      store.set('kgcp-poll', cfg.poll.question);
      thanks();
    };
  }
}
if (cfg.instagram) { $('#insta').hidden = false; $('#insta-link').href = `https://www.instagram.com/${encodeURIComponent(cfg.instagram)}/`; }
if (cfg.ads.adsenseClient) {
  $('#ad').hidden = false;
  $('#ad').append(el('ins', { className: 'adsbygoogle', style: 'display:block' }));
  Object.assign($('#ad ins').dataset, { adClient: cfg.ads.adsenseClient, adSlot: cfg.ads.slot, adFormat: 'auto', fullWidthResponsive: 'true' });
  document.head.append(el('script', { async: true, crossOrigin: 'anonymous', src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cfg.ads.adsenseClient)}` }));
  (window.adsbygoogle ||= []).push({});
}
