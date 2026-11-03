import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, push, set, update as dbUpdate, remove as dbRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, setPersistence, indexedDBLocalPersistence, browserLocalPersistence, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Same Firebase project as the shopping list; data lives under users/{uid}/recs
const firebaseConfig = {
  apiKey: "AIzaSyBAnMbbd7hbQvx8mdNF5PajAdxl_VYOsxE",
  authDomain: "chris-shopping-list.firebaseapp.com",
  databaseURL: "https://chris-shopping-list-default-rtdb.firebaseio.com",
  projectId: "chris-shopping-list",
  storageBucket: "chris-shopping-list.firebasestorage.app",
  messagingSenderId: "222533323145",
  appId: "1:222533323145:web:f24d42c4dccd0fa19fb958"
};

// ?demo runs on sample data in this browser only, with no sign-in
const DEMO = new URLSearchParams(location.search).has('demo');

// ── Categories ──
// action decides the one button each card gets
const CATEGORIES = [
  { id: 'Restaurants', action: 'map', words: ['restaurant','pasta','pizza','sushi','ramen','taco','tacos','brunch','dinner','lunch','bbq','burger','burgers','steakhouse','thai','indian','italian','mexican','korean','chinese','japanese','ethiopian','nigerian','food','dumplings','omakase','bakery','deli','suya','jollof spot'] },
  { id: 'Bars & Cafes', action: 'map', words: ['bar','cocktail','cocktails','wine bar','pub','brewery','coffee','cafe','café','espresso','matcha','speakeasy','rooftop'] },
  { id: 'Recipes', action: 'search', words: ['recipe','recipes','stew','soup','sauce','marinade','jollof','how to cook','how to make'] },
  { id: 'Movies & TV', action: 'watch', words: ['movie','movies','film','series','tv show','show','tv','documentary','netflix','hbo','hulu','prime video','apple tv','disney+','season','anime'] },
  { id: 'Music', action: 'listen', words: ['album','song','songs','artist','band','playlist','ep','track','spotify','rapper','singer','dj','mixtape'] },
  { id: 'Books', action: 'search', words: ['book','books','novel','memoir','author','audiobook','kindle'] },
  { id: 'Podcasts', action: 'podcast', words: ['podcast','podcasts','episode','pod'] },
  { id: 'Courses & Certs', action: 'search', words: ['course','class','certification','cert','certificate','exam','bootcamp','workshop','training','udemy','coursera'] },
  { id: 'Services', action: 'map', words: ['barber','barbershop','haircut','salon','dentist','doctor','therapist','mechanic','tailor','plumber','trainer','physio','dermatologist','nails','spa','massage','gym','cleaner','stylist'] },
  { id: 'Apartments', action: 'map', words: ['apartment','apartments','apt','rental','rentals','1br','2br','3br','1 bedroom','2 bedroom','3 bedroom','one bedroom','two bedroom','listing','open house','broker','no fee','lease','sublet','condo','townhouse','brownstone','studio apartment'] },
  { id: 'Places & Travel', action: 'map', words: ['hotel','trip','travel','beach','park','museum','hike','island','airbnb','resort','gallery','vacation'] },
  { id: 'Products', action: 'search', words: ['buy','product','app','gadget','shoes','sneakers','jacket','headphones','skincare','cologne','perfume','moisturizer'] },
  { id: 'Other', action: 'search', words: [] },
];
const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

const DOMAINS = [
  [/spotify\.com\/(show|episode)|podcasts\.apple|overcast\.fm|pocketcasts/i, 'Podcasts'],
  [/netflix|hulu|hbomax|max\.com|disneyplus|primevideo|tv\.apple|imdb|letterboxd|justwatch|rottentomatoes/i, 'Movies & TV'],
  [/spotify\.com|music\.apple|soundcloud|bandcamp|tidal\.com/i, 'Music'],
  [/coursera|udemy|edx\.org|linkedin\.com\/learning|skillshare|masterclass|credly/i, 'Courses & Certs'],
  [/resy\.com|opentable|exploretock|yelp\.com|theinfatuation|eater\.com/i, 'Restaurants'],
  [/cooking\.nytimes|allrecipes|bonappetit|seriouseats|epicurious|food52|budgetbytes/i, 'Recipes'],
  [/goodreads|bookshop\.org/i, 'Books'],
  [/streeteasy|zillow|apartments\.com|renthop|redfin|trulia|realtor\.com|compass\.com|corcoran/i, 'Apartments'],
  [/airbnb|booking\.com|tripadvisor/i, 'Places & Travel'],
];

// "987 Flushing Ave", "12 W 4th St", "350 Broadway"
const ADDRESS = /^\s*\d+[a-z]?\s+[\w .'-]*?\b(ave|avenue|st|street|blvd|boulevard|rd|road|pl|place|ln|lane|dr|drive|ct|court|pkwy|parkway|ter|terrace|broadway)\b/i;
const isCategoryWord = s => !!CAT[cap(s)] || KEYWORDS.some(k => k.w === s.toLowerCase());

const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Longest keyword wins, so "wine bar" beats "bar" and "tv show" beats "show"
const KEYWORDS = CATEGORIES
  .flatMap(c => c.words.map(w => ({ w, cat: c.id, re: new RegExp(`(^|[^a-z])${reEsc(w)}($|[^a-z])`, 'i') })))
  .sort((a, b) => b.w.length - a.w.length);

function guessCategory(text, link) {
  if (link) for (const [re, cat] of DOMAINS) if (re.test(link)) return cat;
  for (const k of KEYWORDS) if (k.re.test(text)) return k.cat;
  if (ADDRESS.test(text)) return 'Places & Travel';
  return 'Other';
}

// ── Parsing: "Lilia, pasta in Williamsburg, from Ana" ──
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

function parse(raw, override, fallbackCat) {
  let text = raw.trim();
  let link = '';
  const url = text.match(/https?:\/\/[^\s,]+/i);
  if (url) {
    link = url[0].replace(/[).]+$/, '');
    text = text.replace(url[0], ' ');
  }
  text = text.replace(/\s+/g, ' ').trim();

  let category = override || guessCategory(text, link);
  if (category === 'Other' && !override && fallbackCat) category = fallbackCat;

  let from = '';
  text = text.replace(/(?:^|[\s,;])(?:from|via|thanks to|recommended by|rec by)\s+([^,;.]{1,40}?)\s*(?=[,;.]|$)/i, (_, who) => {
    // "from apartments" names a category, not a person; the category was already read from it
    if (!isCategoryWord(who.trim())) from = cap(who.trim());
    return '';
  });

  // Only places get a "where"; "in theaters" on a movie stays in the note
  let where = '';
  if (CAT[category].action === 'map') {
    text = text.replace(/(?:^|\s)(?:in|near)\s+([^,;]{1,40}?)\s*(?=[,;]|$)/i, (_, w) => {
      where = cap(w.trim());
      return '';
    });
  }

  const parts = text.split(/\s*[,;]\s*|\s+[-–—:]\s+/).map(s => s.trim()).filter(Boolean);
  let name = cap(parts.shift() || '');
  const note = cap(parts.join(', '));

  let needsTitle = false;
  if (!name && link) {
    try { name = new URL(link).hostname.replace(/^www\./, ''); } catch { name = link; }
    needsTitle = true;
  }
  return { name, note, from, where, link, category, needsTitle };
}

// Title and picture for links from Spotify, YouTube, Vimeo and similar
async function fetchMeta(link) {
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(link)}`);
    const j = await res.json();
    if (j.error) return null;
    return { title: j.title || '', image: j.thumbnail_url || '', author: j.author_name || '' };
  } catch {
    return null;
  }
}

// ── Card action ──
function action(r) {
  if (r.link) return { label: 'Open', url: r.link };
  const name = encodeURIComponent(r.name);
  const kind = ADDRESS.test(r.name) ? 'map' : CAT[r.category]?.action;
  switch (kind) {
    case 'map':
      return { label: 'Map', url: `https://maps.apple.com/?q=${encodeURIComponent([r.name, r.where].filter(Boolean).join(' '))}` };
    case 'watch':
      return { label: 'Watch', url: `https://www.justwatch.com/us/search?q=${name}` };
    case 'listen':
      return { label: 'Listen', url: `https://open.spotify.com/search/${name}` };
    case 'podcast':
      return { label: 'Listen', url: `https://podcasts.apple.com/us/search?term=${name}` };
    default: {
      const hint = { Recipes: ' recipe', Books: ' book', 'Courses & Certs': ' course' }[r.category] || '';
      return { label: 'Search', url: `https://www.google.com/search?q=${encodeURIComponent(r.name + hint)}` };
    }
  }
}

// ── Helpers ──
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function ago(ts) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d < 1) return 'today';
  if (d < 2) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  if (d < 30) { const w = Math.floor(d / 7); return w === 1 ? '1 week ago' : `${w} weeks ago`; }
  if (d < 365) { const m = Math.floor(d / 30); return m === 1 ? '1 month ago' : `${m} months ago`; }
  const y = Math.floor(d / 365);
  return y === 1 ? '1 year ago' : `${y} years ago`;
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function toast(msg, undo) {
  const el = $('toast');
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button>Undo</button>' : ''}`;
  if (undo) el.querySelector('button').onclick = () => { el.classList.remove('show'); undo(); };
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), undo ? 4000 : 2000);
}

// ── Stores ──
function firebaseStore(db, uid) {
  const base = `users/${uid}/recs`;
  return {
    listen(cb) { onValue(ref(db, base), snap => cb(snap.val() || {})); },
    add(rec) { const r = push(ref(db, base)); set(r, rec); return r.key; },
    update(id, patch) { dbUpdate(ref(db, `${base}/${id}`), patch); },
    remove(id) { dbRemove(ref(db, `${base}/${id}`)); },
    restore(id, rec) { set(ref(db, `${base}/${id}`), rec); },
  };
}

function demoStore() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem('recs-demo')); } catch {}
  if (!data) data = demoSeed();
  let cb = () => {};
  const save = () => {
    try { localStorage.setItem('recs-demo', JSON.stringify(data)); } catch {}
    cb({ ...data });
  };
  return {
    listen(f) { cb = f; f({ ...data }); },
    add(rec) { const id = 'd' + Date.now().toString(36); data[id] = rec; save(); return id; },
    update(id, patch) { if (data[id]) { data[id] = { ...data[id], ...patch }; save(); } },
    remove(id) { delete data[id]; save(); },
    restore(id, rec) { data[id] = rec; save(); },
  };
}

function demoSeed() {
  const day = 86400000, now = Date.now();
  const rows = [
    ['Lilia', 'Restaurants', 'Get the pasta', 'Ana', 'Williamsburg', 3],
    ['Via Carota', 'Restaurants', 'Go early, no reservations', 'Tunde', 'West Village', 20],
    ['Dept of Culture', 'Restaurants', 'Nigerian, small, book ahead', 'Kemi', 'Bed-Stuy', 45, 'loved'],
    ['Severance', 'Movies & TV', 'Apple TV', 'Ana', '', 8],
    ['Perfect Days', 'Movies & TV', '', 'Sam', '', 60, 'tried'],
    ['Blonde', 'Music', 'Frank Ocean', 'Tunde', '', 12],
    ['Fade Room', 'Services', 'Ask for Marcus', 'Kemi', 'Bed-Stuy', 5],
    ['AWS Solutions Architect Professional', 'Courses & Certs', 'Take after Associate', 'Sam', '', 30],
    ['Smoky jollof', 'Recipes', 'Burn the bottom a little on purpose', 'Mum', '', 90],
    ['Project Hail Mary', 'Books', '', 'Ana', '', 15],
    ['Hardcore History', 'Podcasts', 'Start with Blueprint for Armageddon', 'Sam', '', 40],
    ['Devoción', 'Bars & Cafes', 'Coffee, skylight room', 'Tunde', 'Williamsburg', 2],
  ];
  return Object.fromEntries(rows.map(([name, category, note, from, where, daysAgo, status = 'todo'], i) => [
    `seed${i}`,
    { name, category, note, from, where, link: '', image: '', status, createdAt: now - daysAgo * day, updatedAt: now - daysAgo * day }
  ]));
}

// ── State ──
let store = null;
let user = null;
let items = {};
let query = '';
let tab = 'todo';
let filter = '';
let override = null;
let detailId = null;
let navigatedIn = false;

const all = () => Object.entries(items).map(([id, r]) => ({ id, ...r }));

function currentCat() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  return CAT[h] ? h : null;
}

// ── Rendering ──
function render() {
  const cat = currentCat();
  $('backBtn').classList.toggle('hidden', !cat);
  $('title').textContent = cat || 'Recs';
  $('searchWrap').classList.toggle('hidden', !!cat);
  $('main').innerHTML = cat ? renderCategory(cat) : query ? renderSearch() : renderHome();
  // Don't redraw the sheet under someone typing in it
  const typing = $('sheet').contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
  if (detailId && items[detailId] && !typing) renderDetail();
}

function renderHome() {
  const recs = all();
  if (!recs.length) {
    return `<div class="empty">
      <h2>Nothing saved yet</h2>
      <p>When someone recommends something, type it below the way you'd text it. Tap one to try it.</p>
      <div class="examples">
        <button class="example" data-example="Lilia, pasta in Williamsburg, from Ana">Lilia, pasta in Williamsburg, from Ana</button>
        <button class="example" data-example="Severance on Apple TV, from Tunde">Severance on Apple TV, from Tunde</button>
        <button class="example" data-example="Fade Room barber in Bed-Stuy, from Kemi">Fade Room barber in Bed-Stuy, from Kemi</button>
      </div>
    </div>`;
  }

  // One "to try" per category, stable for the day so the row doesn't reshuffle on every change
  const day = new Date().toDateString();
  const next = [];
  for (const c of CATEGORIES) {
    const todo = recs.filter(r => r.category === c.id && r.status === 'todo').sort((a, b) => a.createdAt - b.createdAt);
    if (todo.length) next.push(todo[hash(day + c.id) % todo.length]);
  }

  const tiles = CATEGORIES.map(c => {
    const inCat = recs.filter(r => r.category === c.id);
    if (!inCat.length) return '';
    const todo = inCat.filter(r => r.status === 'todo').length;
    return `<button class="tile" data-cat="${esc(c.id)}">
      <span class="tile-name">${esc(c.id)}</span>
      <span class="tile-count">${todo ? `${todo} to try` : 'All tried'}</span>
    </button>`;
  }).join('');

  return `${next.length ? `<section>
      <h2 class="label">Try next</h2>
      <div class="next-row">${next.map(r => `<button class="next" data-open="${r.id}">
        <span class="next-cat">${esc(r.category)}</span>
        <span class="next-name">${esc(r.name)}</span>
        <span class="next-meta">${esc(r.from ? 'from ' + r.from : ago(r.createdAt))}</span>
      </button>`).join('')}</div>
    </section>` : ''}
    <section>
      <h2 class="label">Categories</h2>
      <div class="tiles">${tiles}</div>
    </section>`;
}

function renderCategory(cat) {
  const inCat = all().filter(r => r.category === cat);
  const todo = inCat.filter(r => r.status === 'todo').sort((a, b) => b.createdAt - a.createdAt);
  const done = inCat.filter(r => r.status !== 'todo')
    .sort((a, b) => (a.status === 'loved' ? 0 : 1) - (b.status === 'loved' ? 0 : 1) || b.updatedAt - a.updatedAt);

  let shown = tab === 'todo' ? todo : done;
  const tags = [...new Set(shown.flatMap(r => [r.from, r.where]).filter(Boolean))];
  if (filter && !tags.includes(filter)) filter = '';
  if (filter) shown = shown.filter(r => r.from === filter || r.where === filter);

  const seg = `<div class="seg">
    <button class="${tab === 'todo' ? 'on' : ''}" data-tab="todo">To try<span>${todo.length}</span></button>
    <button class="${tab === 'tried' ? 'on' : ''}" data-tab="tried">Tried<span>${done.length}</span></button>
  </div>`;
  const chips = tags.length > 1
    ? `<div class="chips">${['', ...tags].map(t => `<button class="chip ${filter === t ? 'on' : ''}" data-filter="${esc(t)}">${t ? esc(t) : 'All'}</button>`).join('')}</div>`
    : '';
  const body = shown.length
    ? `<div class="cards">${shown.map(r => card(r)).join('')}</div>`
    : `<p class="none">${tab === 'todo' ? 'Nothing left to try here.' : 'Nothing tried yet.'}</p>`;
  return seg + chips + body;
}

function renderSearch() {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = all()
    .filter(r => {
      const hay = [r.name, r.note, r.from, r.where, r.category].join(' ').toLowerCase();
      return terms.every(t => hay.includes(t));
    })
    .sort((a, b) => (a.status === 'todo' ? 0 : 1) - (b.status === 'todo' ? 0 : 1) || b.createdAt - a.createdAt);
  if (!hits.length) return `<p class="none">Nothing matches "${esc(query)}".</p>`;
  return `<p class="label">${hits.length} result${hits.length === 1 ? '' : 's'}</p>
    <div class="cards">${hits.map(r => card(r, true)).join('')}</div>`;
}

function card(r, showCat) {
  const meta = [showCat && r.category, r.from && 'from ' + r.from, r.where, ago(r.createdAt)].filter(Boolean).join(' · ');
  const act = action(r);
  return `<div class="card ${r.status !== 'todo' ? 'done' : ''}" data-open="${r.id}">
    ${r.image ? `<img class="thumb" src="${esc(r.image)}" alt="" loading="lazy" />` : ''}
    <div class="card-body">
      <div class="card-name">${esc(r.name)}${r.status === 'loved' ? '<span class="badge">Loved</span>' : ''}</div>
      ${r.note ? `<div class="card-note">${esc(r.note)}</div>` : ''}
      <div class="card-meta">${esc(meta)}</div>
    </div>
    <a class="card-act" href="${esc(act.url)}" target="_blank" rel="noopener">${act.label}</a>
  </div>`;
}

// ── Detail sheet ──
function openDetail(id) {
  detailId = id;
  renderDetail();
  $('sheetWrap').classList.add('open');
}

function renderDetail() {
  const r = { id: detailId, ...items[detailId] };
  const act = action(r);
  const thanks = r.status === 'loved'
    ? `Finally tried ${r.name}. Loved it, thank you!`
    : `Finally tried ${r.name}, thanks for the rec!`;
  const tell = r.from && r.status !== 'todo'
    ? `<a class="btn sec" href="sms:&body=${encodeURIComponent(thanks)}">Tell ${esc(r.from.split(' ')[0])}</a>`
    : '';

  $('sheet').innerHTML = `
    <div class="handle"></div>
    <div class="sheet-head">
      <span class="label" style="margin:0">${esc(r.category)}</span>
      <button class="link-btn" data-close>Done</button>
    </div>
    <input class="f-name" data-field="name" value="${esc(r.name)}" aria-label="Name" />
    <div class="seg">
      ${[['todo', 'To try'], ['tried', 'Tried'], ['loved', 'Loved']].map(([s, l]) =>
        `<button class="${r.status === s ? 'on' : ''}" data-status="${s}">${l}</button>`).join('')}
    </div>
    <div class="actions">
      <a class="btn" href="${esc(act.url)}" target="_blank" rel="noopener">${act.label}</a>
      ${tell}
    </div>
    <label class="field"><span>Note</span><textarea data-field="note" rows="2">${esc(r.note)}</textarea></label>
    <label class="field"><span>From</span><input data-field="from" value="${esc(r.from)}" /></label>
    <label class="field"><span>Where</span><input data-field="where" value="${esc(r.where)}" /></label>
    <label class="field"><span>Link</span><input data-field="link" type="url" inputmode="url" value="${esc(r.link)}" /></label>
    <div class="field"><span>Category</span>
      <div class="chips">${CATEGORIES.map(c =>
        `<button class="chip ${r.category === c.id ? 'on' : ''}" data-setcat="${esc(c.id)}">${esc(c.id)}</button>`).join('')}</div>
    </div>
    <div class="sheet-foot">
      <button class="link-btn danger" data-delete>Delete</button>
      <span>Added ${ago(r.createdAt)}</span>
    </div>`;
}

function closeSheet() {
  $('sheetWrap').classList.remove('open');
  detailId = null;
  document.activeElement?.blur();
}

function patch(id, fields) {
  const p = { ...fields, updatedAt: Date.now() };
  items[id] = { ...items[id], ...p };
  store.update(id, p);
  render();
}

function deleteRec(id) {
  const copy = { ...items[id] };
  closeSheet();
  delete items[id];
  store.remove(id);
  render();
  toast(`Deleted ${copy.name}`, () => store.restore(id, copy));
}

function openAccount() {
  detailId = null;
  const name = user.displayName || 'Signed in';
  $('sheet').innerHTML = `
    <div class="handle"></div>
    <div class="account">
      <h2>${esc(name)}</h2>
      <p>${esc(user.email || user.phoneNumber || '')}</p>
      <button class="btn sec" style="width:100%" data-signout>Sign out</button>
    </div>`;
  $('sheetWrap').classList.add('open');
}

// ── Adding ──
function updatePreview() {
  const text = $('addInput').value.trim();
  if (!text) {
    override = null;
    $('preview').classList.add('hidden');
    $('picker').classList.add('hidden');
    return;
  }
  const p = parse(text, override, currentCat());
  const meta = [p.from && 'from ' + p.from, p.where].filter(Boolean).join(' · ');
  $('preview').innerHTML = `
    <button class="pv-cat" data-pick>${esc(p.category)}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    <span class="pv-meta">${esc(meta)}</span>`;
  $('preview').classList.remove('hidden');
  if (!$('picker').classList.contains('hidden')) renderPicker(p.category);
}

function renderPicker(selected) {
  $('picker').innerHTML = CATEGORIES.map(c =>
    `<button class="chip ${c.id === selected ? 'on' : ''}" data-pickcat="${esc(c.id)}">${esc(c.id)}</button>`).join('');
}

function save() {
  const input = $('addInput');
  const text = input.value.trim();
  if (!text) { input.focus(); return; }
  const p = parse(text, override, currentCat());
  if (!p.name) { toast('Add a name first'); return; }

  const dupe = all().find(r => r.name.toLowerCase() === p.name.toLowerCase() && r.category === p.category);
  if (dupe) {
    toast(`Already saved in ${p.category}`);
    openDetail(dupe.id);
    return;
  }

  const now = Date.now();
  const id = store.add({
    name: p.name, category: p.category, note: p.note, from: p.from, where: p.where,
    link: p.link, image: '', status: 'todo', createdAt: now, updatedAt: now
  });

  input.value = '';
  updatePreview();
  input.blur();
  toast(`Saved to ${p.category}`);

  if (p.link) {
    fetchMeta(p.link).then(m => {
      if (!m || !items[id]) return;
      const fields = {};
      if (m.image) fields.image = m.image;
      if (p.needsTitle && m.title) fields.name = m.title;
      if (!p.note && m.author) fields.note = m.author;
      if (Object.keys(fields).length) store.update(id, fields);
    });
  }
}

// ── Events ──
function bindEvents() {
  $('addBtn').addEventListener('click', save);
  $('addInput').addEventListener('input', updatePreview);
  $('addInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); save(); } });

  // Keep the keyboard up while picking a category
  for (const id of ['preview', 'picker', 'addBtn']) {
    $(id).addEventListener('pointerdown', e => { if (document.activeElement === $('addInput')) e.preventDefault(); });
  }

  $('search').addEventListener('input', e => { query = e.target.value.trim(); render(); });

  $('backBtn').addEventListener('click', () => {
    if (navigatedIn) history.back();
    else location.hash = '';
  });

  $('accountBtn').addEventListener('click', openAccount);

  window.addEventListener('hashchange', () => {
    tab = 'todo';
    filter = '';
    render();
    window.scrollTo(0, 0);
  });

  $('sheetWrap').addEventListener('click', e => { if (e.target === $('sheetWrap')) closeSheet(); });

  $('sheet').addEventListener('change', e => {
    const field = e.target.dataset.field;
    if (!field || !detailId) return;
    const value = e.target.value.trim();
    if (field === 'name' && !value) { e.target.value = items[detailId].name; return; }
    const id = detailId;
    items[id] = { ...items[id], [field]: value };
    store.update(id, { [field]: value, updatedAt: Date.now() });
    // Re-render the list only, so the sheet's inputs keep focus
    const cat = currentCat();
    $('main').innerHTML = cat ? renderCategory(cat) : query ? renderSearch() : renderHome();
  });

  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('a')) return;

    const el = t.closest('[data-cat],[data-open],[data-tab],[data-filter],[data-example],[data-status],[data-setcat],[data-delete],[data-close],[data-pick],[data-pickcat],[data-signout]');
    if (!el) return;
    const d = el.dataset;

    if (d.cat !== undefined) { navigatedIn = true; location.hash = '/' + encodeURIComponent(d.cat); }
    else if (d.open !== undefined) openDetail(d.open);
    else if (d.tab !== undefined) { tab = d.tab; filter = ''; render(); }
    else if (d.filter !== undefined) { filter = d.filter; render(); }
    else if (d.example !== undefined) { $('addInput').value = d.example; updatePreview(); $('addInput').focus(); }
    else if (d.status !== undefined) patch(detailId, { status: d.status });
    else if (d.setcat !== undefined) patch(detailId, { category: d.setcat });
    else if (d.delete !== undefined) deleteRec(detailId);
    else if (d.close !== undefined) closeSheet();
    else if (d.pick !== undefined) {
      const picker = $('picker');
      picker.classList.toggle('hidden');
      if (!picker.classList.contains('hidden')) renderPicker(parse($('addInput').value, override, currentCat()).category);
    }
    else if (d.pickcat !== undefined) { override = d.pickcat; $('picker').classList.add('hidden'); updatePreview(); }
    else if (d.signout !== undefined) {
      if (DEMO) { localStorage.removeItem('recs-demo'); location.reload(); }
      else signOut(getAuth()).then(() => location.reload());
    }
  });
}

// ── Start ──
function start(s, u) {
  store = s;
  user = u;
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  const btn = $('accountBtn');
  btn.innerHTML = u.photoURL
    ? `<img src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer" />`
    : esc((u.displayName || '?')[0].toUpperCase());
  store.listen(data => { items = data; render(); });
}

bindEvents();

if (DEMO) {
  start(demoStore(), { displayName: 'Demo', email: 'Sample data, saved only in this browser. Sign out resets it.' });
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  setPersistence(auth, indexedDBLocalPersistence).catch(() => setPersistence(auth, browserLocalPersistence));
  const db = getDatabase(app);
  let started = false;

  $('loginBtn').addEventListener('click', () => {
    signInWithPopup(auth, new GoogleAuthProvider()).catch(() => toast('Sign-in failed. Try again.'));
  });

  onAuthStateChanged(auth, u => {
    if (u && !started) {
      started = true;
      start(firebaseStore(db, u.uid), u);
    } else if (!u) {
      $('app').classList.add('hidden');
      $('login').classList.remove('hidden');
    }
  });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
