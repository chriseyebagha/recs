import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, get, push, set, update as dbUpdate, remove as dbRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
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
// action decides the one button each row gets
const CATEGORIES = [
  { id: 'Restaurants', action: 'map', words: ['restaurant','pasta','pizza','pizzeria','sushi','ramen','pho','noodle','noodles','taco','tacos','taqueria','brunch','dinner','lunch','breakfast','bbq','burger','burgers','steak','steakhouse','seafood','oyster','oysters','chicken','wings','halal','dim sum','dumplings','omakase','izakaya','tapas','trattoria','osteria','bistro','brasserie','diner','eatery','kitchen','grill','supper club','thai','indian','italian','mexican','korean','korean bbq','chinese','japanese','vietnamese','french','greek','mediterranean','ethiopian','nigerian','ghanaian','jamaican','caribbean','african','vegan','food','bakery','bagel','bagels','deli','sandwich','sandwiches','suya','jollof spot','dessert','ice cream','gelato','donut','donuts','patisserie','pastry'] },
  { id: 'Bars & Cafes', action: 'map', words: ['bar','cocktail','cocktails','wine bar','natural wine','pub','tavern','lounge','brewery','beer garden','coffee','cafe','café','espresso','matcha','tea','boba','juice','speakeasy','rooftop','jazz club','nightclub','club','karaoke'] },
  { id: 'Recipes', action: 'search', words: ['recipe','recipes','stew','soup','sauce','marinade','jollof','how to cook','how to make'] },
  { id: 'Movies & TV', action: 'watch', words: ['movie','movies','film','series','tv show','show','tv','documentary','netflix','hbo','hulu','prime video','apple tv','disney+','season','anime'] },
  { id: 'Music', action: 'listen', words: ['album','song','songs','artist','band','playlist','ep','track','spotify','rapper','singer','dj','mixtape'] },
  { id: 'Books', action: 'search', words: ['book','books','novel','memoir','author','audiobook','kindle'] },
  { id: 'Podcasts', action: 'podcast', words: ['podcast','podcasts','episode','pod'] },
  { id: 'Courses & Certs', action: 'search', words: ['course','class','certification','cert','certificate','exam','bootcamp','workshop','training','udemy','coursera'] },
  { id: 'Services', action: 'map', words: ['barber','barbershop','haircut','salon','dentist','doctor','therapist','mechanic','tailor','plumber','trainer','physio','dermatologist','nails','spa','massage','gym','cleaner','stylist','tattoo'] },
  { id: 'Apartments', action: 'map', words: ['apartment','apartments','apt','rental','rentals','1br','2br','3br','1 bedroom','2 bedroom','3 bedroom','one bedroom','two bedroom','listing','open house','broker','no fee','lease','sublet','condo','townhouse','brownstone','studio apartment'] },
  { id: 'Places & Travel', action: 'map', words: ['hotel','trip','travel','beach','park','museum','hike','island','airbnb','resort','gallery','vacation','market','bookstore','theater','theatre','cinema','venue'] },
  { id: 'Products', action: 'search', words: ['buy','product','app','gadget','shoes','sneakers','jacket','headphones','skincare','cologne','perfume','moisturizer'] },
  { id: 'Other', action: 'search', words: [] },
];
const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const isPlace = r => CAT[r.category]?.action === 'map';

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

// What the map says a place is, for places whose category was a guess
const OSM_CATS = {
  restaurant: 'Restaurants', fast_food: 'Restaurants', food_court: 'Restaurants', bakery: 'Restaurants', pasta: 'Restaurants',
  deli: 'Restaurants', pastry: 'Restaurants', confectionery: 'Restaurants',
  cafe: 'Bars & Cafes', bar: 'Bars & Cafes', pub: 'Bars & Cafes', biergarten: 'Bars & Cafes', nightclub: 'Bars & Cafes', ice_cream: 'Bars & Cafes', coffee: 'Bars & Cafes', tea: 'Bars & Cafes',
  hairdresser: 'Services', beauty: 'Services', massage: 'Services', tattoo: 'Services', dentist: 'Services', doctors: 'Services', clinic: 'Services', fitness_centre: 'Services',
  museum: 'Places & Travel', gallery: 'Places & Travel', hotel: 'Places & Travel', attraction: 'Places & Travel', viewpoint: 'Places & Travel', park: 'Places & Travel',
  theatre: 'Places & Travel', cinema: 'Places & Travel', books: 'Places & Travel', marketplace: 'Places & Travel',
};

const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const titleCase = s => s.replace(/(^|[\s-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
// Same input, same answer: rows ask for city and neighborhood many times a render
const memo = f => { const m = new Map(); return s => { s = s || ''; if (!m.has(s)) m.set(s, f(s)); return m.get(s); }; };
const wordRe = memo(w => new RegExp(`(^|[^a-z])${reEsc(w)}($|[^a-z])`, 'i'));

// ── Cities and neighborhoods ──
const BOROUGHS = ['new york city', 'staten island', 'the bronx', 'manhattan', 'new york', 'brooklyn', 'queens', 'bronx', 'nyc'];
const NYC_HOODS = ['midtown','williamsburg','greenpoint','bushwick','bed-stuy','bed stuy','bedford-stuyvesant','prospect heights','park slope','crown heights','fort greene','clinton hill','dumbo','cobble hill','carroll gardens','boerum hill','brooklyn heights','red hook','gowanus','flatbush','prospect lefferts','ditmas park','windsor terrace','sunset park','bay ridge','lower east side','les','east village','west village','greenwich village','soho','noho','nolita','tribeca','chinatown','little italy','chelsea','flatiron','gramercy','murray hill','koreatown','k-town','nomad','kips bay','hudson yards','meatpacking','hell\'s kitchen','hells kitchen','upper east side','ues','upper west side','uws','harlem','financial district','fidi','two bridges','astoria','long island city','lic','jackson heights','flushing','ridgewood','sunnyside'];
const CITIES = ['london','lagos','abuja','accra','nairobi','paris','rome','milan','barcelona','madrid','lisbon','berlin','amsterdam','tokyo','seoul','mexico city','toronto','montreal','los angeles','la','san francisco','chicago','miami','austin','dallas','houston','seattle','boston','philadelphia','washington','dc','new orleans','nashville','atlanta'];

const normCity = c => BOROUGHS.includes((c || '').trim().toLowerCase()) ? 'New York' : (c || '').trim();

const STATEZIP = /^([a-z]{2}\s*)?\d{5}(-\d{4})?$|^[a-z]{2}$|^(usa?|united states)$/i;

// "Prospect Heights" → New York, "Shoreditch, London" → London, "Lagos" → Lagos
const cityFromWhere = memo(w => cityFromWhereRaw(w));
const hoodFromWhere = memo(w => hoodFromWhereRaw(w));

function cityFromWhereRaw(w) {
  if (!w) return '';
  if (ADDRESS.test(w) && !w.includes(',')) return '';
  // A pasted address ends in a state, zip or country: "…, Dallas, TX 75206" → Dallas
  const parts = w.split(',').map(x => x.trim()).filter(x => x && !STATEZIP.test(x));
  if (parts.length > 1) return titleCase(normCity(parts.at(-1)));
  if (w.includes(',')) return '';
  if ([...BOROUGHS, ...NYC_HOODS].some(h => wordRe(h).test(w))) return 'New York';
  return titleCase(w);
}

// "Brooklyn Prospect Heights" → Prospect Heights, "Midtown Manhattan" → Midtown, "Lagos" → none
function hoodFromWhereRaw(w) {
  if (!w || ADDRESS.test(w)) return '';
  let h = w.split(',')[0];
  if (!w.includes(',') && cityFromWhere(w) !== 'New York') return '';
  for (const b of BOROUGHS) h = h.replace(wordRe(b), ' ');
  return titleCase(h.replace(/\s+/g, ' ').trim());
}

const isPlaceName = w => !!w && (cityFromWhere(w) === 'New York' || CITIES.includes(w.toLowerCase().split(',').pop().trim()));
const cityOf = r => r.city || cityFromWhere(r.where);
// What you typed wins, then the New York map below. Elsewhere the map data's names are too odd to show ("Winslow").
const hoodOf = r => hoodFromWhere(r.where) || nycHood(r.lat, r.lng);

// New York neighborhoods by center point and rough size (km), named the way people say them.
// The map data's own names are uneven here ("Manhattan Community Board 3", "Five Points").
const NYC_MAP = [
  ['Financial District', 40.7077, -74.0093, .7], ['Battery Park City', 40.711, -74.0169, .5], ['Tribeca', 40.7178, -74.0089, .6],
  ['Chinatown', 40.7158, -73.997, .5], ['Little Italy', 40.7193, -73.9978, .3], ['Nolita', 40.7232, -73.9955, .35],
  ['SoHo', 40.7233, -74.0013, .5], ['NoHo', 40.7265, -73.9935, .3], ['Two Bridges', 40.7113, -73.9922, .5],
  ['Lower East Side', 40.7185, -73.9868, .75], ['East Village', 40.7275, -73.984, .8], ['West Village', 40.7342, -74.0056, .6],
  ['Greenwich Village', 40.7316, -73.997, .6], ['Meatpacking', 40.7408, -74.0068, .35], ['Chelsea', 40.7465, -74.0015, .9],
  ['Flatiron', 40.7408, -73.9897, .4], ['Union Square', 40.7359, -73.9906, .3], ['Gramercy', 40.7368, -73.9841, .45],
  ['Kips Bay', 40.7408, -73.9776, .5], ['Murray Hill', 40.7482, -73.9788, .6], ['NoMad', 40.7447, -73.9883, .35],
  ['Koreatown', 40.7477, -73.9867, .25], ['Midtown', 40.7568, -73.9844, 1.2], ['Midtown East', 40.7535, -73.9689, .8],
  ["Hell's Kitchen", 40.7644, -73.9924, .9], ['Hudson Yards', 40.7545, -74.0015, .5], ['Upper East Side', 40.7736, -73.9566, 1.8],
  ['Upper West Side', 40.787, -73.9754, 1.8], ['Morningside Heights', 40.81, -73.9625, .8], ['Harlem', 40.8116, -73.9465, 1.5],
  ['East Harlem', 40.7947, -73.9425, 1], ['Washington Heights', 40.8417, -73.9394, 1.8], ['Inwood', 40.8677, -73.9212, 1],
  ['Williamsburg', 40.7146, -73.9535, 1.6], ['Greenpoint', 40.7298, -73.9542, 1], ['Bushwick', 40.6958, -73.9171, 1.5],
  ['Bed-Stuy', 40.6834, -73.9412, 1.6], ['Clinton Hill', 40.6897, -73.9653, .6], ['Fort Greene', 40.6908, -73.9766, .6],
  ['Prospect Heights', 40.6775, -73.9692, .55], ['Crown Heights', 40.6694, -73.9422, 1.6], ['Park Slope', 40.672, -73.9778, 1.1],
  ['Gowanus', 40.6782, -73.9888, .5], ['Carroll Gardens', 40.6795, -73.9991, .5], ['Cobble Hill', 40.6862, -73.9962, .35],
  ['Boerum Hill', 40.6856, -73.9842, .45], ['Brooklyn Heights', 40.6961, -73.995, .6], ['Dumbo', 40.7033, -73.9881, .4],
  ['Downtown Brooklyn', 40.6928, -73.9871, .45], ['Red Hook', 40.6751, -74.0096, .8], ['Windsor Terrace', 40.6535, -73.9772, .6],
  ['Prospect Lefferts Gardens', 40.6587, -73.951, .7], ['Flatbush', 40.6415, -73.9594, 1.4], ['Ditmas Park', 40.6375, -73.9634, .5], ['Midwood', 40.6204, -73.9599, .9],
  ['Sunset Park', 40.6455, -74.0124, 1.3], ['Greenwood Heights', 40.6565, -74.0, .6], ['Bay Ridge', 40.6264, -74.0299, 1.4],
  ['Coney Island', 40.5765, -73.9929, 1.2], ['Brighton Beach', 40.5781, -73.9597, .8], ['Astoria', 40.7644, -73.9235, 1.6],
  ['Long Island City', 40.7447, -73.9485, 1.3], ['Sunnyside', 40.7433, -73.9196, .8], ['Woodside', 40.7454, -73.9054, .9],
  ['Jackson Heights', 40.7557, -73.8831, 1], ['Elmhurst', 40.7366, -73.8784, 1], ['Flushing', 40.7654, -73.8174, 1.5],
  ['Ridgewood', 40.7043, -73.9018, 1], ['Forest Hills', 40.7214, -73.8448, 1.2], ['Mott Haven', 40.809, -73.9229, 1],
  ['Arthur Avenue', 40.8553, -73.8864, .8]
];
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 84);
function nycHood(lat, lng) {
  if (!lat || lat < 40.49 || lat > 40.92 || lng < -74.27 || lng > -73.68) return '';
  let best = '', score = 2;  // farther than twice a neighborhood's size from all of them: no guess
  for (const [name, la, ln, size] of NYC_MAP) {
    const s = km(lat, lng, la, ln) / size;
    if (s < score) [best, score] = [name, s];
  }
  return best;
}

// "987 Flushing Ave", "12 W 4th St", "350 Broadway"
const ADDRESS = /^\s*\d+[a-z]?\s+[\w .'-]*?\b(ave|avenue|st|street|blvd|boulevard|rd|road|pl|place|ln|lane|dr|drive|ct|court|pkwy|parkway|ter|terrace|broadway)\b/i;
const isCategoryWord = s => !!CAT[cap(s)] || KEYWORDS.some(k => k.w === s.toLowerCase());

// Longest keyword wins, so "wine bar" beats "bar" and "tv show" beats "show"
const KEYWORDS = CATEGORIES
  .flatMap(c => c.words.map(w => ({ w, cat: c.id, re: wordRe(w) })))
  .sort((a, b) => b.w.length - a.w.length);

function guessCategory(text, link) {
  if (link) for (const [re, cat] of DOMAINS) if (re.test(link)) return cat;
  for (const k of KEYWORDS) if (k.re.test(text)) return k.cat;
  if (ADDRESS.test(text)) return 'Places & Travel';
  return 'Other';
}

// ── Parsing: "Lilia, pasta in Williamsburg, from Ana" ──
// been: logging a place already visited. "Sushi Lin, Prospect Heights, yesterday"
function parse(raw, override, fallbackCat, been) {
  let text = raw.trim();
  let beenAt = 0;
  if (been) {
    text = text.replace(/^(?:went to|been to|visited)\s+/i, '');
    text = text.replace(/(?:^|[\s,;])(today|tonight|yesterday|last night)(?=[\s,;.]|$)/i, (_, w) => {
      if (/yesterday|last night/i.test(w)) beenAt = Date.now() - 86400000;
      return ' ';
    });
  }
  let link = '';
  const url = text.match(/https?:\/\/[^\s,]+/i);
  if (url) {
    link = url[0].replace(/[).]+$/, '');
    text = text.replace(url[0], ' ');
  }
  text = text.replace(/\s+/g, ' ').trim();

  let category = override || guessCategory(text, link);
  let auto = false;
  if (category === 'Other' && !override) {
    if (fallbackCat) category = fallbackCat;
    else {
      // A named spot in a known neighborhood or city is most likely somewhere to eat; the map corrects it later
      const inPlace = text.match(/(?:^|\s)(?:in|near)\s+([^,;]{1,40}?)\s*(?=[,;]|$)/i)?.[1];
      const rest = text.split(/\s*[,;]\s*/).slice(1);
      if (been || isPlaceName(inPlace) || rest.some(isPlaceName)) { category = 'Restaurants'; auto = true; }
    }
  }

  let from = '';
  // "via" only after something, so "Via Carota" stays a name
  text = text.replace(/(?:(?:^|[\s,;])(?:from|thanks to|recommended by|rec by)|[\s,;]via)\s+([^,;.]{1,40}?)\s*(?=[,;.]|$)/i, (_, who) => {
    // "from apartments" names a category, not a person; the category was already read from it
    if (!isCategoryWord(who.trim())) from = cap(who.trim());
    return '';
  });

  // Only places get a "where"; "in theaters" on a movie stays in the note
  let where = '';
  if (CAT[category].action === 'map') {
    text = text.replace(/(?:^|\s)(?:in|near)\s+([^,;]{1,40}?)\s*(?=[,;]|$)/i, (_, w) => {
      where = titleCase(w.trim());
      return '';
    });
  }

  const parts = text.split(/\s*[,;]\s*|\s+[-–—:]\s+/).map(s => s.trim()).filter(Boolean);
  let name = cap(parts.shift() || '');
  if (!where && parts.length && CAT[category].action === 'map' && (been || parts.slice(0, 2).some(isPlaceName))) {
    where = titleCase(parts.shift());
    // "Shoreditch, London" keeps the city with the neighborhood
    if (parts.length && CITIES.includes(parts[0].toLowerCase())) where += ', ' + titleCase(parts.shift());
    // A pasted address keeps its city, state and zip: "5521 Greenville Ave, Dallas, TX 75206"
    if (ADDRESS.test(where)) while (parts.length && (STATEZIP.test(parts[0]) || STATEZIP.test(parts[1] || ''))) where += ', ' + parts.shift();
  }
  const note = cap(parts.join(', '));

  let needsTitle = false;
  if (!name && link) {
    try { name = new URL(link).hostname.replace(/^www\./, ''); } catch { name = link; }
    needsTitle = true;
  }
  return { name, note, from, where, link, category, auto, needsTitle, beenAt };
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

// ── Finding places on the map ──
// Photon (OpenStreetMap). A result only counts if its name matches, since it always returns something.
const NYC = [40.7128, -74.006];
const normName = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/\b(the|st|saint|nyc)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

function sameName(a, b) {
  a = normName(a); b = normName(b);
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  // Whole words only, so "Uncle Lou" isn't "Uncle Louie G"
  // "Peter Luger" is "Peter Luger Steak House": a leading name counts even when the rest is long
  return ` ${long} `.includes(` ${short} `) && (short.length / long.length >= 0.5 || long.startsWith(short + ' '));
}

// "403 Madison Ave N #103" → "403 Madison Ave N"; unit numbers confuse the lookup
const street = w => (w || '').split(',')[0].replace(/\s*(?:#|\bapt\.?|\bunit|\bste\.?|\bsuite)\s*[\w-]*\s*$/i, '').trim();

async function lookup(q) {
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${NYC[0]}&lon=${NYC[1]}&limit=6`);
  return (await res.json()).features || [];
}

async function geocode(r) {
  try {
    const hit = await geocodeName(r);
    if (!ADDRESS.test(r.where || '')) return hit;
    // An address you gave beats a name match: the map data can hold another place with a similar name
    const at = await geocodeAddress(r);
    if (!at) return hit;
    const [[x, y], [u, v]] = [hit?.geometry.coordinates || [0, 0], at.geometry.coordinates];
    if (hit && km(y, x, v, u) < 0.3) return hit;
    return { ...at, byAddress: true };
  } catch {
    return { error: true };
  }
}

// A result must sit where you said: the right city, the right borough, near the named neighborhood.
// No pin beats a wrong pin.
const BORO = ['brooklyn', 'manhattan', 'queens', 'bronx', 'staten island'];
const inNYC = (lat, lng) => lat > 40.49 && lat < 40.92 && lng > -74.27 && lng < -73.68;
function fits(f, r) {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const city = cityOf(r);
  if (city === 'New York') {
    if (!inNYC(lat, lng)) return false;
    const boro = BORO.find(b => wordRe(b).test(r.where || ''));
    if (boro && ![p.district, p.city, p.county, p.locality].some(x => (x || '').toLowerCase().includes(boro))) return false;
    const h = NYC_MAP.find(x => x[0].toLowerCase() === hoodFromWhere(r.where).toLowerCase());
    return !h || km(lat, lng, h[1], h[2]) < h[3] * 2 + 1;
  }
  return !city || normCity(p.city || p.county).toLowerCase() === city.toLowerCase();
}

async function geocodeAddress(r) {
  const st = street(r.where);
  const num = st.match(/^\d+[a-z]?/i)[0].toLowerCase();
  const q = [st, r.where.includes(',') ? r.where.split(',').slice(1).join(' ') : '', r.city].filter(Boolean).join(' ');
  return (await lookup(q)).find(f => (f.properties.housenumber || '').toLowerCase() === num && fits(f, r)) || null;
}

async function geocodeName(r) {
  const addr = ADDRESS.test(r.name);
  const queries = [[r.name, r.where, r.city].filter(Boolean).join(' ')];
  if (r.where || r.city) queries.push(r.name);
  for (const q of queries) {
    const hit = (await lookup(q)).find(f => {
      const p = f.properties;
      if (addr) return !!p.housenumber && r.name.trim().toLowerCase().startsWith(p.housenumber.toLowerCase()) && fits(f, r);
      return sameName(p.name, r.name) && fits(f, r);
    });
    if (hit) return hit;
  }
  return null;
}

function placeFields(hit, r) {
  const p = hit.properties;
  const [lng, lat] = hit.geometry.coordinates;
  const f = { lat, lng, geo: 'ok', city: normCity(p.city || p.county || p.state || ''), hood: nycHood(lat, lng) };
  if (r.city) delete f.city;
  if (!r.where && f.hood) f.where = f.hood;
  if (r.auto && !hit.byAddress) {
    const c = OSM_CATS[p.osm_value];
    if (c && c !== r.category) f.category = c;
    f.auto = null;
  }
  return f;
}

// Bumped when the lookup gets better, so places it missed get another try
const GEO_VERSION = 4;
// Older pins with a Where get checked once against it, and dropped if they don't fit
const wantsGeo = r => (!r.geo || (r.geo === 'none' && (r.geoTry || 0) < GEO_VERSION)
  || (r.geo === 'ok' && !!r.where && (r.geoV || 0) < GEO_VERSION))
  && (isPlace(r) || (r.category === 'Other' && !!r.where));
const geoQueue = [];
let geoBusy = false;

function queueGeo() {
  for (const r of all()) if (wantsGeo(r) && !geoQueue.includes(r.id)) geoQueue.push(r.id);
  pumpGeo();
}

// One lookup a second, as Photon asks
async function pumpGeo() {
  if (geoBusy) return;
  geoBusy = true;
  while (geoQueue.length) {
    const id = geoQueue.shift();
    const r = items[id] && { id, ...items[id] };
    if (!r || !wantsGeo(r)) continue;
    // An old wrong pin also saved its own city ("Jersey City" for a place you said was in Brooklyn)
    const stale = r.city && cityFromWhere(r.where) === 'New York' && r.city !== 'New York';
    if (stale) r.city = '';
    const hit = await geocode(r);
    if (hit?.error) { geoQueue.length = 0; break; }  // offline; tried again on the next data change
    // Skip if it was edited while we looked
    if (items[id] && items[id].name === r.name && items[id].where === r.where && wantsGeo({ id, ...items[id] })) {
      const fields = hit ? { ...placeFields(hit, r), geoTry: null, geoV: GEO_VERSION }
        : { geo: 'none', geoTry: GEO_VERSION, lat: null, lng: null, hood: null, ...(stale && { city: null }) };
      items[id] = { ...items[id], ...fields };
      for (const k in fields) if (fields[k] === null) delete items[id][k];
      store.update(id, fields);
    }
    await new Promise(res => setTimeout(res, 1100));
  }
  geoBusy = false;
}

// ── Row action ──
function action(r) {
  // Web links only: a typed "javascript:" link must never become a button
  if (/^https?:\/\//i.test(r.link || '')) return { label: 'Open', url: r.link };
  const name = encodeURIComponent(r.name);
  const kind = ADDRESS.test(r.name) ? 'map' : CAT[r.category]?.action;
  switch (kind) {
    case 'map': {
      const url = r.lat
        ? `https://maps.apple.com/?q=${name}&ll=${r.lat},${r.lng}`
        : `https://maps.apple.com/?q=${encodeURIComponent([r.name, r.where].filter(Boolean).join(' '))}`;
      return { label: 'Map', url };
    }
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

function toast(msg, undo) {
  const el = $('toast');
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button>Undo</button>' : ''}`;
  if (undo) el.querySelector('button').onclick = () => { el.classList.remove('show'); undo(); };
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), undo ? 4000 : 2000);
}

const pref = {
  get(k, d) { try { return localStorage.getItem('recs-' + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('recs-' + k, v); } catch {} },
};

const ICON = {
  map: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="2 6 2 21 8.5 18 15.5 21 22 18 22 3 15.5 6 8.5 3 2 6"/><line x1="8.5" y1="3" x2="8.5" y2="18"/><line x1="15.5" y1="6" x2="15.5" y2="21"/></svg>',
  list: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>',
  heart: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.2 1.8-2 3.3-3.2 5.4-3.2 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21z"/></svg>',
  check: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12.5 10 17.5 19 7"/></svg>',
  chevron: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>',
};

// ── Stores ──
function firebaseStore(db, uid) {
  const base = `users/${uid}/recs`;
  const conf = `users/${uid}/recsPublic`;
  return {
    uid,
    listen(cb) { onValue(ref(db, base), snap => cb(snap.val() || {})); },
    add(rec) { const r = push(ref(db, base)); set(r, rec); return r.key; },
    update(id, patch) { dbUpdate(ref(db, `${base}/${id}`), patch); },
    remove(id) { dbRemove(ref(db, `${base}/${id}`)); },
    restore(id, rec) { set(ref(db, `${base}/${id}`), rec); },
    // Which cities you made public, and the name in your link
    listenPublic(cb) { onValue(ref(db, conf), snap => cb(snap.val() || {})); },
    savePublic(v) { return set(ref(db, conf), v); },
  };
}

// Public pages: one record per person at pub/{name}, readable by anyone, written only by its owner.
// Needs these database rules next to the existing ones:
//   "pub": { "$name": {
//     ".read": true,
//     ".write": "auth != null && (data.exists() ? data.child('uid').val() === auth.uid : newData.child('uid').val() === auth.uid)",
//     ".validate": "$name.matches(/^[a-z0-9-]{2,24}$/) && newData.child('uid').val() === auth.uid" } }
function firebasePub(db) {
  return {
    get: name => get(ref(db, `pub/${name}`)).then(s => s.val()),
    set: (name, v) => set(ref(db, `pub/${name}`), v),
    remove: name => dbRemove(ref(db, `pub/${name}`)),
  };
}

// Demo: the same, kept in this browser
function demoPub() {
  const read = () => { try { return JSON.parse(localStorage.getItem('recs-demo-pub')) || {}; } catch { return {}; } };
  const write = d => { try { localStorage.setItem('recs-demo-pub', JSON.stringify(d)); } catch {} };
  return {
    get: async name => read()[name] || null,
    set: async (name, v) => { const d = read(); d[name] = v; write(d); },
    remove: async name => { const d = read(); delete d[name]; write(d); },
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
  let conf = {};
  try { conf = JSON.parse(localStorage.getItem('recs-demo-public')) || {}; } catch {}
  let confCb = () => {};
  return {
    uid: 'demo',
    listen(f) { cb = f; f({ ...data }); },
    listenPublic(f) { confCb = f; f(conf); },
    savePublic(v) { conf = v; try { localStorage.setItem('recs-demo-public', JSON.stringify(v)); } catch {} confCb(conf); return Promise.resolve(); },
    add(rec) { const id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); data[id] = rec; save(); return id; },
    update(id, patch) {
      if (!data[id]) return;
      data[id] = { ...data[id], ...patch };
      for (const k in patch) if (patch[k] === null) delete data[id][k];
      save();
    },
    remove(id) { delete data[id]; save(); },
    restore(id, rec) { data[id] = rec; save(); },
  };
}

function demoSeed() {
  const day = 86400000, now = Date.now();
  const rows = [
    ['Lilia', 'Restaurants', 'Get the pasta', 'Ana', 'Williamsburg', 3],
    ['Via Carota', 'Restaurants', 'Go early, no reservations', 'Tunde', 'West Village', 20],
    ['Sushi Lin', 'Restaurants', 'Omakase at the bar', '', 'Prospect Heights', 1, 'loved'],
    ['Forma Pasta Factory', 'Restaurants', '', 'Kemi', 'Fort Greene', 6, 'tried'],
    ['Severance', 'Movies & TV', 'Apple TV', 'Ana', '', 8],
    ['Perfect Days', 'Movies & TV', '', 'Sam', '', 60, 'tried'],
    ['Blonde', 'Music', 'Frank Ocean', 'Tunde', '', 12],
    ['Fade Room', 'Services', 'Ask for Marcus', 'Kemi', 'Bed-Stuy', 5],
    ['AWS Solutions Architect Professional', 'Courses & Certs', 'Take after Associate', 'Sam', '', 30],
    ['Smoky jollof', 'Recipes', 'Burn the bottom a little on purpose', 'Mum', '', 90],
    ['Project Hail Mary', 'Books', '', 'Ana', '', 15],
    ['Hardcore History', 'Podcasts', 'Start with Blueprint for Armageddon', 'Sam', '', 40],
    ['Devoción', 'Bars & Cafes', 'Coffee, skylight room', 'Tunde', 'Williamsburg', 2],
    // A trip, already on the map, to try public pages with
    ['Casa Lucio', 'Restaurants', 'Huevos rotos. Book ahead', 'Marta', 'La Latina, Madrid', 24, 'loved', [40.4128, -3.7085]],
    ['Sobrino de Botín', 'Restaurants', 'Oldest restaurant in the world. Get the suckling pig', '', 'Sol, Madrid', 25, 'tried', [40.4142, -3.7081]],
    ['Museo del Prado', 'Places & Travel', 'Free the last two hours of the day', 'Marta', 'Retiro, Madrid', 23, 'loved', [40.4138, -3.6921]],
    ['Salmon Guru', 'Bars & Cafes', 'Cocktails. Get there before nine', '', 'Huertas, Madrid', 24, 'loved', [40.4146, -3.6987]],
    ['Mercado de San Miguel', 'Places & Travel', 'Busy, but good for a quick bite', '', 'Sol, Madrid', 25, 'tried', [40.4154, -3.709]],
    ['Chocolatería San Ginés', 'Bars & Cafes', 'Churros at 2am', 'Marta', 'Sol, Madrid', 23, 'loved', [40.4168, -3.7069]],
    ['Sala Equis', 'Places & Travel', '', 'Marta', 'Lavapiés, Madrid', 30],
  ];
  return Object.fromEntries(rows.map(([name, category, note, from, where, daysAgo, status = 'todo', ll], i) => {
    const t = now - daysAgo * day;
    const rec = { name, category, note, from, where, link: '', image: '', status, createdAt: t, updatedAt: t };
    if (status !== 'todo') rec.beenAt = t;
    if (ll) Object.assign(rec, { lat: ll[0], lng: ll[1], geo: 'ok', geoV: GEO_VERSION });
    return [`seed${i}`, rec];
  }));
}

// ── State ──
let store = null;
let user = null;
let items = {};
let query = '';
let status = pref.get('status', 'all');
let place = { city: '', hood: '' };
let override = null;
let detailId = null;
let navigatedIn = false;

const all = () => Object.entries(items).map(([id, r]) => ({ id, ...r }));
const STATUSES = ['all', 'todo', 'tried', 'loved'];
if (!STATUSES.includes(status)) status = 'all';
// Loved is a kind of tried, so Tried shows both
const statusMatch = r => status === 'all' || (status === 'tried' ? r.status !== 'todo' : r.status === status);
const placeMatch = r => (!place.city || cityOf(r) === place.city) && (!place.hood || hoodOf(r) === place.hood);
const beenTime = r => r.beenAt || r.updatedAt;
const sortKey = r => r.status === 'todo' ? r.createdAt : beenTime(r);
const byRecent = (a, b) => sortKey(b) - sortKey(a);
const logging = () => status === 'tried' || status === 'loved';

function route() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  if (h.startsWith('s/')) return { view: 'shared', key: h.slice(2) };
  // Public pages: #/@chris is everywhere Chris made public, #/@chris/madrid is one city
  if (h.startsWith('@')) {
    const [name, trip = ''] = h.slice(1).split('/');
    return { view: 'pub', name: name.toLowerCase(), trip: trip.toLowerCase() };
  }
  if (h === 'map') return { view: 'map' };
  if (CAT[h]) return { view: 'cat', cat: h };
  return { view: 'home' };
}

// Items the current page draws from, before the status and place filters
function scope() {
  const r = route();
  let list = all();
  if (r.view === 'cat') list = list.filter(x => x.category === r.cat);
  if (r.view === 'map') list = list.filter(isPlace);
  return list;
}

// ── Rendering ──
function render() {
  const r = route();
  if (r.view === 'shared') { renderShared(); return; }
  if (r.view === 'pub') { renderPub(); return; }
  document.title = 'Recs';
  $('sharedView').classList.add('hidden');
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  const onMap = r.view === 'map';
  $('backBtn').classList.toggle('hidden', r.view !== 'cat');
  $('title').textContent = r.view === 'cat' ? r.cat : onMap ? 'Map' : 'Recs';
  $('viewBtn').innerHTML = onMap ? ICON.list : ICON.map;
  $('viewBtn').setAttribute('aria-label', onMap ? 'Show list' : 'Show map');
  $('searchWrap').classList.toggle('hidden', r.view !== 'home');
  $('addBar').classList.toggle('hidden', onMap);
  $('main').classList.toggle('hidden', onMap);
  $('mapView').classList.toggle('hidden', !onMap);
  $('addInput').placeholder = addHint(r);

  // One controls node, moved rather than redrawn, so the segment indicator can slide
  if (onMap && $('controls').parentElement !== $('mapTop')) $('mapTop').append($('controls'));
  if (!onMap && $('controls').parentElement !== $('app')) $('app').insertBefore($('controls'), $('main'));
  renderControls();

  if (onMap) renderMap();
  else $('main').innerHTML = mainHtml();

  if (detailId && items[detailId]) renderDetail();
  else if (detailId) closeSheet();
}

// The add box hint spells out what the parser reads here: "in" sets where, "from" sets who
function addHint(r) {
  if (logging()) return 'Place, neighborhood or address';
  if (r.view !== 'cat') return 'Name in neighborhood, from who';
  if (r.cat === 'Apartments') return 'Address, what you thought';
  if (r.cat === 'Recipes') return 'Dish or link, from who';
  if (CAT[r.cat].action === 'map') return 'Name in neighborhood, from who';
  return 'Title or link, from who';
}

function renderControls() {
  if (place.city && !placeOptions().cities.some(c => c.name === place.city)) place = { city: '', hood: '' };
  const seg = $('statusSeg');
  const i = STATUSES.indexOf(status);
  seg.style.setProperty('--i', i);
  seg.querySelectorAll('button').forEach((b, j) => {
    b.classList.toggle('on', j === i);
    b.setAttribute('aria-selected', j === i);
  });
  const shown = scope().filter(r => statusMatch(r) && placeMatch(r));
  $('placeLabel').textContent = place.hood || place.city || 'Everywhere';
  $('placeBtn').classList.toggle('on', !!place.city);
  $('shareListBtn').classList.toggle('hidden', !shown.length);
  $('countLabel').textContent = shown.length ? `${shown.length} ${route().view === 'map' ? (shown.length === 1 ? 'place' : 'places') : (shown.length === 1 ? 'item' : 'items')}` : '';
  $('controls').classList.toggle('hidden', route().view === 'home' && (!!query || !all().length));
}

function mainHtml() {
  const r = route();
  if (r.view === 'cat') return renderCategory(r.cat);
  if (query) return renderSearch();
  return renderHome();
}

function mark(r) {
  if (r.status === 'loved') return `<span class="mark loved" title="Loved">${ICON.heart}</span>`;
  if (r.status === 'tried') return `<span class="mark tried" title="Tried">${ICON.check}</span>`;
  return '<span class="mark todo" title="Want to try"></span>';
}

function row(r, opts = {}) {
  const when = r.status === 'todo' ? ago(r.createdAt) : `${isPlace(r) ? 'went' : 'tried'} ${ago(beenTime(r))}`;
  // A street address is too long for a row; its city says enough
  const meta = [opts.showCat && r.category, hoodOf(r) || (ADDRESS.test(r.where || '') ? cityOf(r) : r.where), r.from && 'from ' + r.from, when].filter(Boolean).join(' · ');
  const act = action(r);
  return `<div class="row" data-open="${r.id}" tabindex="0">
    ${mark(r)}
    <div class="row-body">
      <div class="row-name">${esc(r.name)}</div>
      ${r.note ? `<div class="row-note">${esc(r.note)}</div>` : ''}
      <div class="row-meta">${esc(meta)}</div>
    </div>
    <a class="row-act" href="${esc(act.url)}" target="_blank" rel="noopener">${act.label}</a>
  </div>`;
}

function emptyFor() {
  const where = place.hood || place.city;
  const what = { all: 'Nothing here', todo: 'Nothing to try', tried: 'Nothing tried', loved: 'Nothing loved' }[status];
  const hint = logging() ? 'Type a place you went below, like "Sushi Lin, Prospect Heights".' : 'Type a rec below the way you\'d text it.';
  return `<div class="none"><p>${what}${where ? ` in ${esc(where)}` : ''} yet.</p><p class="sub">${hint}</p></div>`;
}

function renderHome() {
  const recs = all();
  if (!recs.length) {
    return `<div class="empty">
      <h2>Nothing saved yet</h2>
      <p>When someone recommends something, type it below the way you'd text it.</p>
      <div class="examples">
        ${['Lilia, pasta in Williamsburg, from Ana', 'Severance on Apple TV, from Tunde', 'Fade Room barber in Bed-Stuy, from Kemi']
          .map(t => `<button class="example" data-example="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>
    </div>`;
  }

  const shown = recs.filter(r => statusMatch(r) && placeMatch(r));
  if (!shown.length) return emptyFor();

  // One group per category: the three most recent, then a way into the rest
  return CATEGORIES.map(c => {
    const inCat = shown.filter(r => r.category === c.id).sort(byRecent);
    if (!inCat.length) return '';
    return `<section class="group">
      <button class="group-head" data-cat="${esc(c.id)}">
        <span>${esc(c.id)}</span>
        <span class="group-count">${inCat.length}${ICON.chevron}</span>
      </button>
      <div class="list">
        ${inCat.slice(0, 3).map(r => row(r)).join('')}
        ${inCat.length > 3 ? `<button class="more" data-cat="${esc(c.id)}">See all ${inCat.length}</button>` : ''}
      </div>
    </section>`;
  }).join('');
}

function renderCategory(cat) {
  const shown = all().filter(r => r.category === cat && statusMatch(r) && placeMatch(r)).sort(byRecent);
  if (!shown.length) return emptyFor();
  return `<div class="list">${shown.map(r => row(r)).join('')}</div>`;
}

function renderSearch() {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = all()
    .filter(r => {
      const hay = [r.name, r.note, r.from, r.where, hoodOf(r), cityOf(r), r.category].join(' ').toLowerCase();
      return terms.every(t => hay.includes(t));
    })
    .sort((a, b) => (a.status === 'todo' ? 0 : 1) - (b.status === 'todo' ? 0 : 1) || byRecent(a, b));
  if (!hits.length) return `<div class="none"><p>Nothing matches "${esc(query)}".</p></div>`;
  return `<p class="label">${hits.length} result${hits.length === 1 ? '' : 's'}</p>
    <div class="list">${hits.map(r => row(r, { showCat: true })).join('')}</div>`;
}

// ── Where sheet: cities, each with its neighborhoods ──
function placeOptions() {
  const base = scope().filter(statusMatch);
  const cities = {};
  for (const r of base) {
    const c = cityOf(r);
    if (!c) continue;
    cities[c] ??= { name: c, count: 0, hoods: {} };
    cities[c].count++;
    const h = hoodOf(r);
    if (h) cities[c].hoods[h] = (cities[c].hoods[h] || 0) + 1;
  }
  return {
    total: base.length,
    cities: Object.values(cities).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}

function sheetHead(title) {
  return `<div class="grab"><div class="handle"></div>
    <div class="sheet-head"><h2 class="sheet-title">${esc(title)}</h2><button class="link-btn" data-close>Done</button></div>
  </div>`;
}

const openCities = new Set();

function openPlaces() {
  detailId = null;
  shareState = null;
  const { total, cities } = placeOptions();
  if (place.city) openCities.add(place.city);
  const opt = (city, hood, label, count, sub) => {
    const on = place.city === city && place.hood === hood;
    return `<button class="opt ${sub ? 'sub' : ''} ${on ? 'on' : ''}" data-place="${esc(city)}" data-hood="${esc(hood)}">
      <span class="opt-name">${esc(label)}</span><span class="opt-count">${count}</span>
    </button>`;
  };
  // A city with neighborhoods opens and closes; "All of" inside it picks the whole city
  const city = c => {
    const hoods = Object.entries(c.hoods).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (!hoods.length) return opt(c.name, '', c.name, c.count);
    const open = openCities.has(c.name);
    return `<div class="city ${open ? 'open' : ''}">
      <button class="opt city-head ${place.city === c.name ? 'on' : ''}" data-toggle-city="${esc(c.name)}" aria-expanded="${open}">
        <span class="opt-name">${ICON.chevron}${esc(c.name)}</span><span class="opt-count">${c.count}</span>
      </button>
      <div class="hoods"><div>
        ${opt(c.name, '', `All of ${c.name}`, c.count, true)}
        ${hoods.map(([h, n]) => opt(c.name, h, h, n, true)).join('')}
      </div></div>
    </div>`;
  };
  $('sheet').innerHTML = `${sheetHead('Where')}
    <div class="list opts">
      ${opt('', '', 'Everywhere', total)}
      ${cities.map(city).join('')}
    </div>
    ${cities.length ? '' : '<p class="hint">Places get a city once they have a neighborhood or are found on the map.</p>'}`;
  delete $('sheet').dataset.id;
  openSheet();
}

function toggleCity(btn) {
  const el = btn.closest('.city');
  const open = el.classList.toggle('open');
  btn.setAttribute('aria-expanded', open);
  if (open) openCities.add(btn.dataset.toggleCity);
  else openCities.delete(btn.dataset.toggleCity);
}

function listSheet(title, recs) {
  detailId = null;
  shareState = null;
  $('sheet').innerHTML = `${sheetHead(title)}
    <p class="hint">Open one and put its street address in Where to pin it.</p>
    <div class="list">${recs.map(r => row(r)).join('')}</div>`;
  delete $('sheet').dataset.id;
  openSheet();
}

// ── Map ──
// MapLibre with OpenFreeMap tiles: free, no key, light and dark styles
let ml = null, map = null, markers = [], meMarker = null, mini = null;
let lastFit = '';
let focusing = false;
let mapLoading = null;
const dark = matchMedia('(prefers-color-scheme: dark)');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const styleUrl = () => `https://tiles.openfreemap.org/styles/${dark.matches ? 'dark' : 'positron'}`;
const ML = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl';
// Every map follows the phone into dark mode and back
dark.addEventListener('change', () => { for (const m of [map, mini, pubMap]) try { m?.setStyle(styleUrl()); } catch {} });

function loadMap() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  mapLoading ??= new Promise((res, rej) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = ML + '.css';
    document.head.append(css);
    const s = document.createElement('script');
    s.src = ML + '.js';
    s.onload = () => res(window.maplibregl);
    s.onerror = () => { mapLoading = null; rej(); };
    document.head.append(s);
  });
  return mapLoading;
}

// The marker element gets MapLibre's positioning transform, so the visible pin lives inside it
function pinEl(r, onTap) {
  const el = document.createElement('div');
  el.className = 'pin-wrap';
  el.innerHTML = `<span class="pin ${r.status}"></span>`;
  if (onTap) {
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', r.name);
    el.addEventListener('click', e => { e.stopPropagation(); onTap(); });
  }
  return el;
}

const RANK = { todo: 0, tried: 1, loved: 2 };

async function renderMap() {
  const recs = scope().filter(r => statusMatch(r) && placeMatch(r));
  // Loved pins drawn last so they sit on top
  const pinned = recs.filter(r => r.lat).sort((a, b) => RANK[a.status] - RANK[b.status]);
  const unpinned = recs.filter(r => !r.lat && r.geo === 'none');
  $('unpinned').classList.toggle('hidden', !unpinned.length);
  $('unpinned').textContent = `${unpinned.length} not on the map`;

  try { ml = await loadMap(); } catch { toast('The map could not load'); return; }
  if (route().view !== 'map') return;
  // The map sits under the header; size it to whatever the header is on this phone
  $('mapView').style.top = $('top').offsetHeight + 'px';

  const first = !map;
  if (first) {
    map = new ml.Map({ container: 'map', style: styleUrl(), center: [NYC[1], NYC[0]], zoom: 11, attributionControl: false, pitchWithRotate: false, dragRotate: false });
    map.touchZoomRotate.disableRotation();
    map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-right');
    // Credit stays a small (i) until tapped
    map.on('load', () => document.querySelector('#map .maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
  }
  map.resize();
  markers.forEach(m => m.remove());
  markers = pinned.map(r => {
    const m = new ml.Marker({ element: pinEl(r, () => openDetail(r.id)) }).setLngLat([r.lng, r.lat]).addTo(map);
    m.getElement().setAttribute('aria-label', r.name);  // MapLibre sets a generic label
    return m;
  });

  // Refit when the filters change or a new pin lands, not on every edit
  const key = `${status}|${place.city}|${place.hood}|${pinned.length}`;
  if (focusing) { lastFit = key; focusing = false; return; }
  if (key === lastFit) return;
  lastFit = key;
  const duration = first || reduceMotion.matches ? 0 : 600;
  // Leave room for the floating filters at the top
  const padding = { top: 150, bottom: 90, left: 48, right: 48 };
  if (pinned.length === 1) map.easeTo({ center: [pinned[0].lng, pinned[0].lat], zoom: 15, duration, padding });
  else if (pinned.length) {
    const b = new ml.LngLatBounds();
    pinned.forEach(r => b.extend([r.lng, r.lat]));
    map.fitBounds(b, { padding, maxZoom: 15, duration });
  }
}

function focusOnMap(id) {
  const r = items[id];
  if (!r?.lat) return;
  // Already on the map: no hash change will close the sheet, so close it here
  if (route().view === 'map' && map) {
    closeSheet();
    map.easeTo({ center: [r.lng, r.lat], zoom: 16, duration: reduceMotion.matches ? 0 : 500 });
    return;
  }
  focusing = true;
  navigatedIn = true;
  location.hash = '/map';
  // Wait for the map to exist before moving it
  const go = () => map ? map.jumpTo({ center: [r.lng, r.lat], zoom: 16 }) : setTimeout(go, 50);
  loadMap().then(() => setTimeout(go, 0));
}

function locate() {
  if (!navigator.geolocation || !map) return;
  navigator.geolocation.getCurrentPosition(pos => {
    const ll = [pos.coords.longitude, pos.coords.latitude];
    if (!meMarker) {
      const el = document.createElement('div');
      el.innerHTML = '<span class="me"></span>';
      meMarker = new ml.Marker({ element: el });
    }
    meMarker.setLngLat(ll).addTo(map);
    map.easeTo({ center: ll, zoom: 15, duration: reduceMotion.matches ? 0 : 600 });
  }, () => toast('Location is off for this app'), { enableHighAccuracy: true, timeout: 8000 });
}

// ── Detail sheet ──
function openDetail(id) {
  detailId = id;
  renderDetail();
  openSheet();
}

function detailParts(r) {
  const act = action(r);
  const thanks = r.status === 'loved'
    ? `Finally tried ${r.name}. Loved it, thank you!`
    : `Finally tried ${r.name}, thanks for the rec!`;
  const tell = r.from && r.status !== 'todo'
    ? `<a class="btn sec" href="sms:&body=${encodeURIComponent(thanks)}">Tell ${esc(r.from.split(' ')[0])}</a>`
    : '';
  const when = r.status !== 'todo' && r.beenAt ? `${isPlace(r) ? 'Went' : 'Tried'} ${ago(r.beenAt)}` : `Added ${ago(r.createdAt)}`;
  let where = '';
  if (isPlace(r)) {
    if (r.lat) {
      const label = [hoodOf(r), cityOf(r)].filter(Boolean).join(', ') || 'On the map';
      where = `<div class="mini" role="button" tabindex="0" data-focus="${r.id}" aria-label="Show on the map"><div id="miniMap"></div><span class="mini-label">${esc(label)}</span></div>`;
    } else if (r.geo === 'none') {
      where = '<p class="hint">Not on the map yet. Put its street address in Where to pin it.</p>';
    }
  }
  // The picture arrives after saving, so it lives in the part that redraws
  if (r.image) where += `<img class="hero" src="${esc(r.image)}" alt="" loading="lazy" />`;
  const share = '<button class="btn sec" data-share-one>Share</button>';
  return { actions: `<a class="btn" href="${esc(act.url)}" target="_blank" rel="noopener">${act.label}</a>${tell}${share}`, when, where };
}

function renderDetail() {
  const r = { id: detailId, ...items[detailId] };
  const parts = detailParts(r);
  const sheet = $('sheet');
  const i = ['todo', 'tried', 'loved'].indexOf(r.status);
  const whereKey = `${r.lat},${r.lng},${r.geo},${r.category},${r.image}`;

  // Same item already open: update in place so inputs keep focus and the segment can slide
  if (sheet.dataset.id === detailId) {
    const seg = sheet.querySelector('.seg');
    seg.style.setProperty('--i', i);
    seg.querySelectorAll('button').forEach((b, j) => b.classList.toggle('on', j === i));
    $('dCat').textContent = r.category;
    $('dActions').innerHTML = parts.actions;
    $('dWhen').textContent = parts.when;
    sheet.querySelectorAll('[data-setcat]').forEach(b => b.classList.toggle('on', b.dataset.setcat === r.category));
    sheet.querySelectorAll('[data-field]').forEach(el => {
      const v = r[el.dataset.field] || '';
      if (el !== document.activeElement && el.value !== v) el.value = v;
    });
    if ($('dWhere').dataset.key !== whereKey) {
      $('dWhere').dataset.key = whereKey;
      $('dWhere').innerHTML = parts.where;
      drawMini(r);
    }
    return;
  }

  sheet.dataset.id = detailId;
  sheet.innerHTML = `
    <div class="grab"><div class="handle"></div>
      <div class="sheet-head">
        <span class="eyebrow" id="dCat">${esc(r.category)}</span>
        <button class="link-btn" data-close>Done</button>
      </div>
    </div>
    <input class="f-name" data-field="name" value="${esc(r.name)}" aria-label="Name" />
    <div class="seg" style="--n:3;--i:${i}">
      ${[['todo', 'Want to try'], ['tried', 'Tried'], ['loved', 'Loved']].map(([s, l]) =>
        `<button class="${r.status === s ? 'on' : ''}" data-status="${s}">${l}</button>`).join('')}
    </div>
    <div class="actions" id="dActions">${parts.actions}</div>
    <div id="dWhere" data-key="${whereKey}">${parts.where}</div>
    <label class="field"><span>Note</span><textarea data-field="note" rows="2">${esc(r.note)}</textarea></label>
    <label class="field"><span>From</span><input data-field="from" value="${esc(r.from)}" /></label>
    <div class="field-pair">
      <label class="field"><span>Where</span><input data-field="where" value="${esc(r.where)}" placeholder="Neighborhood or address" /></label>
      <label class="field"><span>City</span><input data-field="city" value="${esc(r.city)}" placeholder="${esc(cityFromWhere(r.where))}" /></label>
    </div>
    <label class="field"><span>Link</span><input data-field="link" type="url" inputmode="url" value="${esc(r.link)}" /></label>
    <div class="field"><span>Category</span>
      <div class="chips">${CATEGORIES.map(c =>
        `<button class="chip ${r.category === c.id ? 'on' : ''}" data-setcat="${esc(c.id)}">${esc(c.id)}</button>`).join('')}</div>
    </div>
    <div class="sheet-foot">
      <button class="link-btn danger" data-delete>Delete</button>
      <span id="dWhen">${parts.when}</span>
    </div>`;
  drawMini(r);
}

function drawMini(r) {
  if (mini) { mini.remove(); mini = null; }
  if (!r.lat || !$('miniMap')) return;
  loadMap().then(lib => {
    if (!$('miniMap') || detailId !== r.id) return;
    ml = lib;
    mini = new lib.Map({ container: 'miniMap', style: styleUrl(), center: [r.lng, r.lat], zoom: 14.5, interactive: false, attributionControl: false });
    new lib.Marker({ element: pinEl(r) }).setLngLat([r.lng, r.lat]).addTo(mini);
  }).catch(() => {});
}

// Focus goes into the sheet, and back where it was on close (except into a text box, which would raise the keyboard)
let sheetFrom = null;
const isOpen = () => $('sheetWrap').classList.contains('open');

function openSheet() {
  $('sheet').scrollTop = 0;
  if (!isOpen()) sheetFrom = document.activeElement;
  $('sheetWrap').classList.add('open');
  $('sheet').focus({ preventScroll: true });
}

function closeSheet() {
  const wasOpen = isOpen();
  $('sheetWrap').classList.remove('open');
  delete $('sheet').dataset.id;
  detailId = null;
  shareState = null;
  document.activeElement?.blur();
  const back = sheetFrom;
  sheetFrom = null;
  if (wasOpen && back?.isConnected && !back.matches('input, textarea')) back.focus({ preventScroll: true });
}

function patch(id, fields) {
  const p = { ...fields, updatedAt: Date.now() };
  items[id] = { ...items[id], ...p };
  for (const k in p) if (p[k] === null) delete items[id][k];
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
  shareState = null;
  const name = user.displayName || 'Signed in';
  $('sheet').innerHTML = `
    <div class="grab"><div class="handle"></div></div>
    <div class="account">
      <h2>${esc(name)}</h2>
      <p>${esc(user.email || user.phoneNumber || '')}</p>
      <p class="sub">Everything is saved to this account, so it's on any phone or computer you sign in on.</p>
    </div>
    ${publicSection()}
    <div class="account-actions">
      <button class="btn sec wide" data-invite>Invite a friend</button>
      <button class="btn sec wide" data-signout>Sign out</button>
    </div>`;
  delete $('sheet').dataset.id;
  openSheet();
}

// Your public page: its link, which cities are on it, notes, and the name in the link
function publicSection() {
  const cities = Object.values(pubCfg.cities || {});
  if (!pubCfg.name) {
    return `<h3 class="sheet-sub">Public page</h3>
      <p class="hint">Show friends where you went and what you loved. Pick a city in Where, tap Share, and turn on its public page.</p>`;
  }
  const url = pubUrl(pubCfg.name);
  return `<h3 class="sheet-sub">Public page</h3>
    <div class="pub-card">
      <a class="pub-link" href="${esc(url)}">${esc(prettyUrl(url))}</a>
      <button class="btn wide" data-pub-share="">Share my page</button>
      <p class="hint">${cities.length ? `${esc(listJoin(cities))} ${cities.length === 1 ? 'is' : 'are'} on it.` : 'No cities on it right now.'} To add or remove one, pick it in Where and tap Share.</p>
    </div>
    <label class="toggle"><span>Show my notes</span><input type="checkbox" id="pubNotes" ${pubCfg.notes !== false ? 'checked' : ''} /></label>
    <label class="field"><span>Name in the link</span><input id="pubName" value="${esc(pubCfg.name)}" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" /></label>`;
}

// Pull the sheet down to close it: it follows the finger, and a quick flick is enough
function bindSheetDrag() {
  const sheet = $('sheet');
  let y0 = 0, dy = 0, id = null, trail = [];
  sheet.addEventListener('pointerdown', e => {
    if (!e.target.closest('.grab') || e.target.closest('button')) return;
    id = e.pointerId;
    y0 = e.clientY;
    dy = 0;
    trail = [[e.clientY, e.timeStamp]];
    sheet.setPointerCapture(id);
    sheet.classList.add('dragging');
  });
  sheet.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    dy = e.clientY - y0;
    trail.push([e.clientY, e.timeStamp]);
    if (trail.length > 4) trail.shift();
    // Pulling up meets growing resistance instead of a wall
    const up = Math.max(0, -dy);
    const y = dy >= 0 ? dy : -(up * 0.55 * 80) / (80 + 0.55 * up);
    sheet.style.transform = `translateY(${y}px)`;
  });
  const end = e => {
    if (e.pointerId !== id) return;
    id = null;
    const [a, b] = [trail[0], trail[trail.length - 1]];
    const v = b[1] > a[1] ? (b[0] - a[0]) / (b[1] - a[1]) : 0;
    sheet.classList.remove('dragging');
    sheet.style.transform = '';
    if (dy > 120 || (dy > 10 && v > 0.4)) closeSheet();
  };
  sheet.addEventListener('pointerup', end);
  sheet.addEventListener('pointercancel', end);
}

// ── Sharing ──
// A shared list travels inside the link (after the #), so nothing is stored on a server
// and whoever opens it sees only what you chose to send
const appUrl = () => location.origin + location.pathname + (DEMO ? '?demo' : '');
const canZip = 'CompressionStream' in window;

function b64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const unb64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

async function pack(obj) {
  let bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (canZip) bytes = await pipe(bytes, new CompressionStream('deflate-raw'));
  return (canZip ? 'z' : 'j') + b64url(bytes);
}

async function unpack(s) {
  let bytes = unb64url(s.slice(1));
  if (s[0] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  return JSON.parse(new TextDecoder().decode(bytes));
}

const r5 = n => Math.round(n * 1e5) / 1e5;
const encodeRec = (r, notes) => [r.name, r.category, r.where || '', notes ? r.note || '' : '', r.status, r.link || '', r.lat ? r5(r.lat) : 0, r.lng ? r5(r.lng) : 0];
// Everything from a link is untrusted: known categories and statuses only, web links only
const decodeRec = a => ({
  name: String(a[0] || '').slice(0, 200),
  category: CAT[a[1]] ? a[1] : 'Other',
  where: String(a[2] || '').slice(0, 100),
  note: String(a[3] || '').slice(0, 500),
  status: ['todo', 'tried', 'loved'].includes(a[4]) ? a[4] : 'todo',
  link: /^https?:\/\//i.test(a[5]) ? String(a[5]) : '',
  lat: Number(a[6]) || 0,
  lng: Number(a[7]) || 0,
  day: Number(a[8]) || 0,
});

function oneLine(r) {
  const how = { loved: 'I loved it.', tried: 'I tried it.', todo: 'On my list to try.' }[r.status];
  return `${r.name}${r.where ? ', ' + r.where : ''}. ${how}`;
}

// "Restaurants I loved in Prospect Heights"
function listTitle(recs) {
  const r = route();
  const cats = [...new Set(recs.map(x => x.category))];
  const what = r.view === 'cat' ? r.cat : cats.length === 1 && cats[0] !== 'Other' ? cats[0] : recs.every(isPlace) ? 'Places' : 'Things';
  const where = place.hood || place.city;
  const t = {
    all: r.view === 'home' ? 'My recs' : `${what} on my list`,
    todo: `${what} I want to try`,
    tried: `${what} I've tried`,
    loved: `${what} I loved`,
  }[status];
  return t + (where ? ` in ${where}` : '');
}

let shareState = null;

// city: the Where filter's city, which can also have a public page
function openShare(recs, title, city = '') {
  detailId = null;
  pubErr = '';
  shareState = { recs: recs.slice(0, 100), title, notes: true, url: '', city };
  drawShareSheet();
  openSheet();
  buildShareUrl();
}

function drawShareSheet() {
  const s = shareState;
  const n = s.recs.length;
  const names = s.recs.slice(0, 4).map(r => r.name).join(', ') + (n > 4 ? ` and ${n - 4} more` : '');
  $('sheet').innerHTML = `${sheetHead(s.city ? `Share ${s.city}` : n === 1 ? 'Share' : `Share ${n}`)}
    ${s.city ? publicCard(s.city) + `<h3 class="sheet-sub">Or send ${n === 1 ? 'this one' : `these ${n}`} as a list</h3>` : ''}
    <label class="field"><span>Title</span><input id="shareTitle" value="${esc(s.title)}" /></label>
    <p class="hint">${esc(names)}</p>
    <label class="toggle"><span>Include my notes</span><input type="checkbox" id="shareNotes" ${s.notes ? 'checked' : ''} /></label>
    <button class="btn wide ${s.city ? 'sec' : ''}" data-share-go>Share list</button>
    <p class="hint">Whoever opens the link sees ${n === 1 ? 'this' : 'these'} and can save ${n === 1 ? 'it' : 'any of them'} to their own Recs. Nothing else of yours is visible.</p>`;
  delete $('sheet').dataset.id;
}

const redrawShare = () => { if (shareState && isOpen() && !$('sheet').dataset.id) drawShareSheet(); };

// Built ahead of the tap, because iOS only lets a page open the share sheet straight from a tap
async function buildShareUrl() {
  const s = shareState;
  if (!s) return;
  s.url = '';
  const by = (user?.displayName || '').split(' ')[0];
  const key = await pack({ v: 1, by, t: s.title, i: s.recs.map(r => encodeRec(r, s.notes)) });
  if (shareState === s) s.url = `${appUrl()}#/s/${key}`;
}

function shareOut(title, text, url) {
  if (navigator.share) return navigator.share({ title, text, url }).then(() => true, () => false);
  return navigator.clipboard.writeText(`${text}\n${url}`).then(() => { toast('Link copied'); return true; }, () => false);
}

function doShare() {
  const s = shareState;
  if (!s?.url) { toast('One moment'); return; }
  const text = s.recs.length === 1 && s.title === s.recs[0].name ? oneLine(s.recs[0]) : s.title;
  shareOut(s.title, text, s.url).then(ok => { if (ok) closeSheet(); });
}

function invite() {
  shareOut('Recs', 'This is what I use to keep track of things people recommend. Open it in Safari, sign in with Google, then tap Share and Add to Home Screen.', appUrl());
}

// ── Public pages ──
// "What I did in Madrid": the places you tried or loved in a city you made public, live, at #/@name/madrid.
// Only eating, drinking and seeing: never apartments, doctors or anything else that says where you live.
// Who recommended a place stays private; a street address shows as its neighborhood.
let pub = null;          // where public pages are read and written
let pubCfg = {};         // { name, cities: { madrid: 'Madrid' }, notes }
let pubErr = '';         // 'setup' when the database doesn't allow public pages yet, 'taken' when no name was free
let pubBusy = false;
let pubLast = '', pubTimer = 0, loaded = false;

const PUB_CATS = ['Restaurants', 'Bars & Cafes', 'Places & Travel'];
const publishable = r => PUB_CATS.includes(r.category) && r.status !== 'todo';
const slug = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const firstName = () => (user?.displayName || '').split(' ')[0] || 'Me';
const pubUrl = (name, trip = '') => `${appUrl()}#/@${name}${trip ? '/' + trip : ''}`;
const prettyUrl = u => u.replace(/^https?:\/\//, '');
const isPublic = city => !!pubCfg.cities?.[slug(city)];
const toDay = ts => Math.floor((ts || 0) / 864e5);
const listJoin = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a.at(-1);

function buildPub() {
  const notes = pubCfg.notes !== false;
  const trips = {};
  for (const [key, city] of Object.entries(pubCfg.cities || {})) {
    const recs = all().filter(r => publishable(r) && cityOf(r) === city).sort(byRecent).slice(0, 300);
    trips[key] = {
      c: city,
      i: recs.map(r => [r.name, r.category, hoodOf(r) || '', notes ? r.note || '' : '', r.status,
        /^https?:\/\//i.test(r.link || '') ? r.link : '', r.lat ? r5(r.lat) : 0, r.lng ? r5(r.lng) : 0, toDay(beenTime(r))]),
    };
  }
  return { uid: store.uid, by: firstName(), trips };
}

// Republish a moment after anything changes; only when the page would look different
function syncPub() {
  if (!pubCfg.name || !loaded || !pub) return;
  clearTimeout(pubTimer);
  pubTimer = setTimeout(async () => {
    const body = buildPub();
    const json = JSON.stringify(body);
    if (json === pubLast) return;
    try { await pub.set(pubCfg.name, { ...body, updatedAt: Date.now() }); pubLast = json; }
    catch { pubErr = 'setup'; redrawShare(); }
  }, 1000);
}

function savePublic(v) {
  pubCfg = v;
  store.savePublic(v);
  syncPub();
}

// Your first name, or first name plus a number when someone else has it
async function claimName(want) {
  let base = slug(want).replace(/-/g, '').slice(0, 20);
  if (base.length < 2) base = 'recs' + base;
  for (let n = 1; n <= 30; n++) {
    const name = n === 1 ? base : base + n;
    try {
      const cur = await pub.get(name);
      if (cur && cur.uid !== store.uid) continue;
      await pub.set(name, { uid: store.uid, by: firstName(), updatedAt: Date.now() });
      return name;
    } catch {
      pubErr = 'setup';
      return '';
    }
  }
  pubErr = 'taken';
  return '';
}

async function setCityPublic(city, on) {
  pubErr = '';
  const cities = { ...(pubCfg.cities || {}) };
  if (on) cities[slug(city)] = city;
  else delete cities[slug(city)];
  let name = pubCfg.name;
  if (on && !name) {
    pubBusy = true;
    redrawShare();
    name = await claimName(firstName());
    pubBusy = false;
    if (!name) { redrawShare(); return; }
  }
  savePublic({ ...pubCfg, name, cities });
  redrawShare();
}

async function renamePub(want) {
  const old = pubCfg.name;
  const name = slug(want).slice(0, 24);
  if (!name || name === old) { openAccount(); return; }
  if (name.length < 2) { toast('Use at least two letters'); openAccount(); return; }
  try {
    const cur = await pub.get(name);
    if (cur && cur.uid !== store.uid) { toast(`Someone already has ${name}`); openAccount(); return; }
    pubCfg = { ...pubCfg, name };
    await pub.set(name, { ...buildPub(), updatedAt: Date.now() });
  } catch {
    pubCfg = { ...pubCfg, name: old };
    toast('That name could not be saved');
    openAccount();
    return;
  }
  if (old) pub.remove(old).catch(() => {});
  pubLast = '';
  savePublic(pubCfg);
  openAccount();
  toast('Link changed. The old one stops working.');
}

function sharePub(trip) {
  const city = trip ? pubCfg.cities?.[trip] : '';
  const by = firstName();
  shareOut(city ? `${by} in ${city}` : `${by}'s places`, city ? `Where I went in ${city}` : 'Places I went and what I thought', pubUrl(pubCfg.name, trip));
}

// The top of the share sheet when a city is picked
function publicCard(city) {
  const on = isPublic(city) && !!pubCfg.name;
  const n = all().filter(r => publishable(r) && cityOf(r) === city).length;
  const url = on ? pubUrl(pubCfg.name, slug(city)) : '';
  const notes = pubCfg.notes !== false ? ', with your notes' : '';
  const what = n
    ? `Anyone with the link sees the ${n === 1 ? 'place' : `${n} places`} you tried or loved in ${esc(city)}${notes}. It updates as you go. Who recommended them stays private.`
    : `Mark places in ${esc(city)} as Tried or Loved and they show up here.`;
  const err = {
    setup: 'Public pages need one change in the Firebase database rules first. The rule is in the code, above firebasePub.',
    taken: 'Every name like yours is taken. Try again later.',
  }[pubErr];
  return `<div class="pub-card">
    <label class="toggle bare"><span>Public page</span><input type="checkbox" data-pub-city="${esc(city)}" ${on ? 'checked' : ''} ${pubBusy ? 'disabled' : ''} /></label>
    ${on ? `<a class="pub-link" href="${esc(url)}">${esc(prettyUrl(url))}</a>
      <button class="btn wide" data-pub-share="${esc(slug(city))}">Share page</button>` : ''}
    <p class="hint">${err ? esc(err) : what}</p>
  </div>`;
}

// ── Opening a public page ──
let pubPage = null;  // { name, at, data }

async function renderPub() {
  const { name, trip } = route();
  $('login').classList.add('hidden');
  $('app').classList.add('hidden');
  $('sharedView').classList.remove('hidden');
  closeSheet();
  // Fetched once a visit, and again after half a minute so an open tab catches up
  if (!pubPage || pubPage.name !== name || Date.now() - pubPage.at > 30000) {
    const mine = { name, at: Date.now() };
    const fresh = pubPage?.name !== name;
    pubPage = mine;
    if (fresh) { $('sharedView').innerHTML = ''; $('sharedView').dataset.key = ''; }
    try { mine.data = await pub.get(name); } catch { mine.data = null; }
    if (pubPage !== mine || route().view !== 'pub') return;
  }
  const r = route();
  const data = pubPage.data;
  const trips = data?.trips || {};
  if (!data) { drawMissing('Nothing here', 'The link may be wrong, or the page was taken down.'); return; }
  const by = String(data.by || 'A friend').slice(0, 40);
  if (!r.trip) { drawProfile(data, name, by); return; }
  const t = trips[r.trip];
  if (!t) { drawMissing(`${by} hasn't made this city public`, '', `#/@${name}`, `See ${by}'s places`); return; }
  const key = `@${name}/${r.trip}`;
  if (shared?.key !== key || shared.at !== data.updatedAt) {
    shared = {
      key, at: data.updatedAt, by, title: String(t.c || '').slice(0, 80), city: String(t.c || '').slice(0, 80), name,
      recs: (Array.isArray(t.i) ? t.i : []).map(decodeRec).filter(x => x.name),
    };
  }
  drawShared();
  flushPending();
}

function drawMissing(title, sub, href = '', label = 'Open Recs') {
  const v = $('sharedView');
  v.dataset.key = '';
  document.title = 'Recs';
  v.innerHTML = `<div class="none"><p>${esc(title)}</p>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
    ${href ? `<a class="btn-primary as-link" href="${esc(href)}">${esc(label)}</a>` : '<button class="btn-primary" data-go-home>Open Recs</button>'}</div>`;
}

// "October 2026", "Mar – Oct 2026", "2025 – 2026"
function fmtSpan(days) {
  const d = days.filter(Boolean);
  if (!d.length) return '';
  const a = new Date(Math.min(...d) * 864e5), b = new Date(Math.max(...d) * 864e5);
  const mon = (x, month) => x.toLocaleString('en-US', { month, timeZone: 'UTC' });
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${a.getUTCFullYear()} – ${b.getUTCFullYear()}`;
  if (a.getUTCMonth() === b.getUTCMonth()) return `${mon(a, 'long')} ${a.getUTCFullYear()}`;
  return `${mon(a, 'short')} – ${mon(b, 'short')} ${a.getUTCFullYear()}`;
}

const tripLine = recs => {
  const loved = recs.filter(r => r.status === 'loved').length;
  return [fmtSpan(recs.map(r => r.day)), `${recs.length} ${recs.length === 1 ? 'place' : 'places'}`, loved && `${loved} loved`].filter(Boolean).join(' · ');
};

function drawProfile(data, name, by) {
  const v = $('sharedView');
  const trips = Object.entries(data.trips || {})
    .map(([k, t]) => ({ k, city: String(t.c || k), recs: (Array.isArray(t.i) ? t.i : []).map(decodeRec).filter(x => x.name) }))
    .filter(t => t.recs.length)
    .sort((a, b) => Math.max(0, ...b.recs.map(r => r.day)) - Math.max(0, ...a.recs.map(r => r.day)));
  const key = `@${name}|${data.updatedAt}`;
  document.title = `${by}'s places`;
  if (v.dataset.key === key) return;
  v.dataset.key = key;
  shared = null;
  const places = trips.flatMap(t => t.recs);
  const rows = trips.map(t => `<a class="row city-row" href="#/@${esc(name)}/${esc(t.k)}">
      <div class="row-body"><div class="row-name">${esc(t.city)}</div><div class="row-meta">${esc(tripLine(t.recs))}</div></div>
      <span class="chev">${ICON.chevron}</span>
    </a>`).join('');
  v.innerHTML = `
    <header class="shared-head">
      <p class="eyebrow">Recs</p>
      <h1>${esc(by)}'s places</h1>
      ${trips.length ? `<p class="trip-sub">${trips.length} ${trips.length === 1 ? 'city' : 'cities'} · ${places.length} places · ${places.filter(r => r.status === 'loved').length} loved</p>` : ''}
    </header>
    ${places.some(r => r.lat) ? '<div class="pub-map"><div id="pubMap"></div></div>' : ''}
    ${trips.length ? `<div class="list">${rows}</div>` : `<div class="none"><p>Nothing public yet.</p></div>`}
    <div class="shared-foot">${footNote()}</div>`;
  window.scrollTo(0, 0);
  drawPubMap(trips.flatMap(t => t.recs.map(r => ({ ...r, trip: t.k }))), r => { location.hash = `/@${name}/${r.trip}`; });
}

// Bottom of a page friends open: a way home, or what Recs is
const footNote = () => store
  ? '<button class="link-btn" data-go-home>Open my Recs</button>'
  : '<p class="hint">Recs keeps what people tell you to try, in one place, so you can find it later. Free, with your Google account.</p>';

// One map at the top of a public page; loved pins sit on top
let pubMap = null;
async function drawPubMap(recs, onTap) {
  const pts = recs.filter(r => r.lat && r.lng).sort((a, b) => RANK[a.status] - RANK[b.status]);
  const box = $('pubMap')?.parentElement;
  if (!box) return;
  if (!pts.length) { box.remove(); return; }
  let lib;
  try { lib = await loadMap(); } catch { box.remove(); return; }
  if (!$('pubMap') || $('pubMap').parentElement !== box) return;
  ml = lib;
  pubMap?.remove();
  pubMap = new lib.Map({ container: 'pubMap', style: styleUrl(), center: [pts[0].lng, pts[0].lat], zoom: 14,
    attributionControl: false, cooperativeGestures: true, dragRotate: false, pitchWithRotate: false });
  pubMap.touchZoomRotate.disableRotation();
  pubMap.addControl(new lib.AttributionControl({ compact: true }), 'bottom-right');
  pubMap.on('load', () => box.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
  for (const r of pts) new lib.Marker({ element: pinEl(r, () => onTap(r)) }).setLngLat([r.lng, r.lat]).addTo(pubMap);
  if (pts.length > 1) {
    const b = new lib.LngLatBounds();
    pts.forEach(r => b.extend([r.lng, r.lat]));
    pubMap.fitBounds(b, { padding: 40, maxZoom: 15, duration: 0 });
  }
}

// Tapping a pin on a trip page brings its row into view and marks it for a moment
function showRow(i) {
  const el = document.querySelector(`[data-pub-row="${i}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

// ── Opening a shared list ──
let shared = null;
let signIn = () => {};
const PENDING = 'recs-pending';

async function renderShared() {
  const key = route().key;
  $('login').classList.add('hidden');
  $('app').classList.add('hidden');
  $('sharedView').classList.remove('hidden');
  closeSheet();
  if (!shared || shared.key !== key) {
    shared = { key };
    try {
      const data = await unpack(key);
      shared.by = String(data.by || '').slice(0, 40);
      shared.title = String(data.t || 'Recs').slice(0, 120);
      shared.recs = (Array.isArray(data.i) ? data.i : []).map(decodeRec).filter(r => r.name);
    } catch {
      shared.error = true;
    }
    if (shared.key !== key) return;
    window.scrollTo(0, 0);
  }
  drawShared();
  flushPending();
}

const isSaved = r => all().some(x => x.name.toLowerCase() === r.name.toLowerCase() && x.category === r.category);

// A list someone sent, or a public trip page (s.city). The header and map are drawn once; the rows redraw as you save.
function drawShared() {
  const s = shared;
  const v = $('sharedView');
  if (s.error) {
    v.dataset.key = '';
    v.innerHTML = `<div class="none"><p>This link didn't open.</p><p class="sub">It may have been cut off when it was copied. Ask for it again.</p>
      <button class="btn-primary" data-go-home>Open Recs</button></div>`;
    return;
  }
  const by = s.by || 'A friend';
  const trip = !!s.city;
  document.title = trip ? `${by} in ${s.city}` : s.title;
  if (v.dataset.key !== `${s.key}|${s.at || ''}`) {
    const fresh = !v.dataset.key?.startsWith(s.key + '|');
    v.dataset.key = `${s.key}|${s.at || ''}`;
    v.innerHTML = `
      <header class="shared-head">
        ${trip ? `<a class="eyebrow" href="#/@${esc(s.name)}">${esc(by)}</a>` : `<p class="eyebrow">From ${esc(by)}</p>`}
        <h1>${esc(s.title)}</h1>
        ${trip ? `<p class="trip-sub">${esc(tripLine(s.recs))}</p>` : ''}
      </header>
      ${trip && s.recs.some(r => r.lat) ? '<div class="pub-map"><div id="pubMap"></div></div>' : ''}
      <div id="sharedBody"></div>`;
    if (fresh) window.scrollTo(0, 0);
    if (trip) drawPubMap(s.recs.map((r, i) => ({ ...r, i })), r => showRow(r.i));
  }

  const mixed = new Set(s.recs.map(r => r.category)).size > 1;
  const signedIn = !!store;
  const left = s.recs.filter(r => !isSaved(r)).length;
  const row = (r, i) => {
    // On a trip page the section says loved or tried; on a list it's said in words
    const did = !trip && { loved: `${by} loved it`, tried: `${by} tried it` }[r.status];
    const meta = [mixed && r.category, hoodOf(r) || (ADDRESS.test(r.where || '') ? cityOf(r) : r.where), did].filter(Boolean).join(' · ');
    const act = action(r);
    const saved = signedIn && isSaved(r);
    // The mark is for your own list: empty on a list someone sent, left out on a trip page
    return `<div class="row" data-pub-row="${i}">
      ${trip ? '' : mark({ status: 'todo' })}
      <a class="row-body" href="${esc(act.url)}" target="_blank" rel="noopener">
        <div class="row-name">${esc(r.name)}</div>
        ${r.note ? `<div class="row-note wrap">${esc(r.note)}</div>` : ''}
        <div class="row-meta">${esc(meta)}</div>
      </a>
      ${saved ? '<span class="row-act saved">Saved</span>' : `<button class="row-act" data-save="${i}">Save</button>`}
    </div>`;
  };
  const indexed = s.recs.map((r, i) => [r, i]);
  const section = (label, list) => list.length
    ? `${label ? `<h2 class="pub-h">${label}</h2>` : ''}<div class="list${trip ? ' bare' : ''}">${list.map(([r, i]) => row(r, i)).join('')}</div>` : '';
  const body = trip
    ? section('Loved', indexed.filter(([r]) => r.status === 'loved')) + section('Tried', indexed.filter(([r]) => r.status !== 'loved'))
    : section('', indexed);
  const cta = !signedIn ? 'Save to my Recs'
    : left ? `Save ${left === 1 && s.recs.length === 1 ? 'it' : left === s.recs.length ? `all ${left}` : `the other ${left}`} to my Recs`
    : '';
  $('sharedBody').innerHTML = `${body || '<div class="none"><p>Nothing here yet.</p></div>'}
    <div class="shared-foot">
      ${cta && s.recs.length ? `<button class="btn-primary" data-save-all>${cta}</button>` : ''}
      ${footNote()}
    </div>`;
}

function saveShared(list) {
  const added = [];
  for (const r of list) {
    if (isSaved(r)) continue;
    const now = Date.now();
    const rec = { name: r.name, category: r.category, note: r.note, from: shared.by, where: r.where, link: r.link, image: '', status: 'todo', createdAt: now, updatedAt: now };
    // A trip page gives the neighborhood alone; the place keeps its city too
    if (shared.city) {
      rec.city = shared.city;
      if (r.where && shared.city !== 'New York') rec.where = `${r.where}, ${shared.city}`;
    }
    if (r.lat && r.lng) Object.assign(rec, { lat: r.lat, lng: r.lng, geo: 'ok', geoV: GEO_VERSION });
    items[store.add(rec)] = rec;
    added.push(r.name);
  }
  toast(added.length ? `Saved ${added.length === 1 ? added[0] : added.length + ' recs'}` : 'Already saved');
  drawShared();
}

// Save after signing in, if that's what the sign-in was for
function flushPending() {
  if (!store || !shared?.recs || route().view !== 'shared') return;
  let pending = null;
  try { pending = JSON.parse(sessionStorage.getItem(PENDING)); sessionStorage.removeItem(PENDING); } catch {}
  if (pending?.key !== shared.key) return;
  saveShared(pending.all ? shared.recs : pending.idx.map(i => shared.recs[i]).filter(Boolean));
}

function wantSave(idx) {
  const list = idx === null ? shared.recs : [shared.recs[idx]];
  if (store) { saveShared(list); return; }
  try { sessionStorage.setItem(PENDING, JSON.stringify({ key: shared.key, all: idx === null, idx: idx === null ? [] : [idx] })); } catch {}
  signIn();
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
  const p = parse(text, override, route().cat, logging());
  const when = logging() ? (p.beenAt ? 'went yesterday' : 'went today') : '';
  const meta = [p.from && 'from ' + p.from, p.where, when].filter(Boolean).join(' · ');
  $('preview').innerHTML = `
    <button class="pv-cat" data-pick>${esc(p.category)}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    ${logging() ? `<span class="pv-status">${status === 'loved' ? 'Loved' : 'Tried'}</span>` : ''}
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
  const been = logging();
  const p = parse(text, override, route().cat, been);
  if (!p.name) { toast('Add a name first'); return; }

  const done = () => { input.value = ''; override = null; updatePreview(); input.blur(); };
  const dupe = all().find(r => r.name.toLowerCase() === p.name.toLowerCase() && (r.category === p.category || p.auto));
  // Logging a place you'd saved as a rec ticks off the rec instead of making a second one
  if (dupe && been) {
    const fields = { status, beenAt: p.beenAt || Date.now() };
    if (!dupe.where && p.where) fields.where = p.where;
    patch(dupe.id, fields);
    done();
    toast(`Marked ${dupe.name} as ${status === 'loved' ? 'loved' : 'tried'}`);
    return;
  }
  if (dupe) {
    toast(`Already saved in ${dupe.category}`);
    openDetail(dupe.id);
    return;
  }

  const now = Date.now();
  const rec = {
    name: p.name, category: p.category, note: p.note, from: p.from, where: p.where,
    link: p.link, image: '', status: been ? status : 'todo', createdAt: now, updatedAt: now
  };
  if (been) rec.beenAt = p.beenAt || now;
  if (p.auto) rec.auto = true;
  const id = store.add(rec);

  done();
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

  $('viewBtn').addEventListener('click', () => {
    navigatedIn = true;
    location.hash = route().view === 'map' ? '' : '/map';
  });

  $('accountBtn').addEventListener('click', openAccount);
  $('locateBtn').addEventListener('click', locate);

  window.addEventListener('hashchange', () => {
    closeSheet();
    paint();
    window.scrollTo(0, 0);
  });
  window.addEventListener('resize', () => {
    if (map && route().view === 'map') { $('mapView').style.top = $('top').offsetHeight + 'px'; map.resize(); }
  });

  $('sheetWrap').addEventListener('click', e => { if (e.target === $('sheetWrap')) closeSheet(); });

  // Keyboard: Escape closes the sheet, Enter or Space opens a focused row
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen()) { e.preventDefault(); closeSheet(); return; }
    const row = e.target.closest?.('[data-open]');
    if (row && e.target === row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetail(row.dataset.open); }
  });

  $('sheet').addEventListener('input', e => {
    if (e.target.id === 'shareTitle' && shareState) { shareState.title = e.target.value.trim() || 'Recs'; buildShareUrl(); }
  });

  $('sheet').addEventListener('change', e => {
    if (e.target.id === 'shareNotes' && shareState) { shareState.notes = e.target.checked; buildShareUrl(); return; }
    if (e.target.dataset.pubCity !== undefined) { setCityPublic(e.target.dataset.pubCity, e.target.checked); return; }
    if (e.target.id === 'pubNotes') { savePublic({ ...pubCfg, notes: e.target.checked }); return; }
    if (e.target.id === 'pubName') { renamePub(e.target.value); return; }
    const field = e.target.dataset.field;
    if (!field || !detailId) return;
    let value = e.target.value.trim();
    if (field === 'name' && !value) { e.target.value = items[detailId].name; return; }
    if (field === 'city') value = titleCase(value);
    const id = detailId;
    const fields = { [field]: value };
    // A new name or place means finding it on the map again
    if (['name', 'where', 'city'].includes(field)) Object.assign(fields, { geo: null, lat: null, lng: null, hood: null });
    items[id] = { ...items[id], ...fields };
    for (const k in fields) if (fields[k] === null) delete items[id][k];
    store.update(id, { ...fields, updatedAt: Date.now() });
    if (route().view === 'map') renderMap();
    else $('main').innerHTML = mainHtml();
    renderControls();
    renderDetail();
  });

  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('a')) return;

    const el = t.closest('[data-pub-share],[data-toggle-city],[data-share-list],[data-share-one],[data-share-go],[data-invite],[data-save],[data-save-all],[data-go-home],[data-cat],[data-open],[data-example],[data-status],[data-status-filter],[data-places],[data-place],[data-unpinned],[data-focus],[data-setcat],[data-delete],[data-close],[data-pick],[data-pickcat],[data-signout]');
    if (!el) return;
    const d = el.dataset;

    if (d.pubShare !== undefined) sharePub(d.pubShare);
    else if (d.toggleCity !== undefined) toggleCity(el);
    else if (d.shareList !== undefined) {
      const recs = scope().filter(r => statusMatch(r) && placeMatch(r)).sort(byRecent);
      openShare(recs, listTitle(recs), place.city);
    }
    else if (d.shareOne !== undefined) { const r = { id: detailId, ...items[detailId] }; openShare([r], r.name); }
    else if (d.shareGo !== undefined) doShare();
    else if (d.invite !== undefined) invite();
    else if (d.save !== undefined) wantSave(Number(d.save));
    else if (d.saveAll !== undefined) wantSave(null);
    else if (d.goHome !== undefined) location.hash = '';
    else if (d.cat !== undefined) { navigatedIn = true; location.hash = '/' + encodeURIComponent(d.cat); }
    else if (d.open !== undefined) openDetail(d.open);
    else if (d.example !== undefined) { $('addInput').value = d.example; updatePreview(); $('addInput').focus(); }
    else if (d.statusFilter !== undefined) {
      status = d.statusFilter;
      pref.set('status', status);
      render();
      updatePreview();
    }
    else if (d.places !== undefined) openPlaces();
    else if (d.place !== undefined) { place = { city: d.place, hood: d.hood }; closeSheet(); render(); }
    else if (d.unpinned !== undefined) listSheet('Not on the map', scope().filter(r => statusMatch(r) && placeMatch(r) && !r.lat && r.geo === 'none'));
    else if (d.focus !== undefined) focusOnMap(d.focus);
    else if (d.status !== undefined) {
      const p = { status: d.status };
      if (d.status !== 'todo' && !items[detailId].beenAt) p.beenAt = Date.now();
      patch(detailId, p);
    }
    else if (d.setcat !== undefined) patch(detailId, { category: d.setcat, auto: null });
    else if (d.delete !== undefined) deleteRec(detailId);
    else if (d.close !== undefined) closeSheet();
    else if (d.pick !== undefined) {
      const picker = $('picker');
      picker.classList.toggle('hidden');
      if (!picker.classList.contains('hidden')) renderPicker(parse($('addInput').value, override, route().cat, logging()).category);
    }
    else if (d.pickcat !== undefined) { override = d.pickcat; $('picker').classList.add('hidden'); updatePreview(); }
    else if (d.signout !== undefined) {
      if (DEMO) { localStorage.removeItem('recs-demo'); location.reload(); }
      else signOut(getAuth()).then(() => location.reload());
    }
  });

  bindSheetDrag();
}

// ── Start ──
function start(s, u) {
  store = s;
  user = u;
  // The old Been page is now the Tried filter
  if (/^#\/?Been$/.test(location.hash)) { status = 'tried'; history.replaceState(null, '', location.pathname + location.search); }
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  const btn = $('accountBtn');
  btn.innerHTML = u.photoURL
    ? `<img src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer" />`
    : esc((u.displayName || '?')[0].toUpperCase());
  store.listen(data => { items = data; loaded = true; render(); queueGeo(); syncPub(); });
  store.listenPublic(v => {
    pubCfg = v || {};
    syncPub();
    redrawShare();
  });
}

// Shared links open for anyone; everything else needs signing in
function paint() {
  if (route().view === 'shared') renderShared();
  else if (route().view === 'pub') renderPub();
  else if (store) render();
  else { $('sharedView').classList.add('hidden'); $('app').classList.add('hidden'); $('login').classList.remove('hidden'); }
}

if (navigator.standalone || matchMedia('(display-mode: standalone)').matches) $('loginTip').classList.add('hidden');

bindEvents();

if (DEMO) {
  pub = demoPub();
  start(demoStore(), { displayName: 'Demo', email: 'Sample data, saved only in this browser. Sign out resets it.' });
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  setPersistence(auth, indexedDBLocalPersistence).catch(() => setPersistence(auth, browserLocalPersistence));
  const db = getDatabase(app);
  pub = firebasePub(db);
  let started = false;

  signIn = () => signInWithPopup(auth, new GoogleAuthProvider()).catch(() => toast('Sign-in failed. Try again.'));
  $('loginBtn').addEventListener('click', signIn);
  if (route().view === 'shared' || route().view === 'pub') paint();

  onAuthStateChanged(auth, u => {
    if (u && !started) {
      started = true;
      start(firebaseStore(db, u.uid), u);
    } else if (!u) {
      paint();
    }
  });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
