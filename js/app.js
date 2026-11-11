import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, get, push, set, update as dbUpdate, remove as dbRemove, increment, query as dbQuery, orderByKey, startAt } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
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
  // Places: these get a map, and go on a city's public page
  { id: 'Restaurants', action: 'map', words: ['restaurant','pasta','pizza','pizzeria','sushi','ramen','pho','noodle','noodles','taco','tacos','taqueria','brunch','dinner','lunch','breakfast','bbq','burger','burgers','steak','steakhouse','seafood','oyster','oysters','chicken','wings','halal','dim sum','dumplings','omakase','izakaya','tapas','trattoria','osteria','bistro','brasserie','diner','eatery','kitchen','grill','supper club','thai','indian','italian','mexican','korean','korean bbq','chinese','japanese','vietnamese','french','greek','mediterranean','ethiopian','nigerian','ghanaian','jamaican','caribbean','african','vegan','food','bakery','bagel','bagels','deli','sandwich','sandwiches','suya','jollof spot','dessert','ice cream','gelato','donut','donuts','patisserie','pastry'] },
  { id: 'Bars & Cafes', action: 'map', words: ['bar','cocktail','cocktails','wine bar','natural wine','pub','tavern','lounge','brewery','beer garden','coffee','cafe','café','espresso','matcha','tea','boba','juice','speakeasy','rooftop','jazz club','nightclub','club','karaoke'] },
  { id: 'Hotels', action: 'map', words: ['hotel','hotels','airbnb','resort','hostel','motel','guesthouse','guest house','b&b','bnb','villa','boutique hotel'] },
  { id: 'Shops', action: 'map', words: ['shop','store','boutique','vintage','vintage store','thrift','thrift store','bookstore','bookshop','record store','flea market','florist','concept store'] },
  { id: 'Places & Travel', action: 'map', words: ['trip','travel','beach','park','museum','hike','island','gallery','vacation','market','theater','theatre','cinema','venue','viewpoint','garden','day trip'] },
  // Things: these go on their own public page, like a shelf
  { id: 'Movies', action: 'watch', words: ['movie','movies','film','films','documentary','trilogy','a24','criterion'] },
  { id: 'TV Shows', action: 'watch', words: ['show','shows','tv show','tv series','series','tv','season','miniseries','limited series','sitcom','anime','docuseries','k-drama','kdrama','netflix','hbo','hulu','prime video','apple tv','disney+'] },
  { id: 'Videos', action: 'video', words: ['youtube','youtube video','video','videos','ted talk','tiktok','vlog','youtuber','channel'] },
  { id: 'Books', action: 'search', words: ['book','books','novel','memoir','author','audiobook','kindle','short story'] },
  { id: 'Articles', action: 'search', words: ['article','articles','essay','newsletter','substack','blog','blog post','op-ed','longread','long read'] },
  { id: 'Podcasts', action: 'podcast', words: ['podcast','podcasts','episode','pod'] },
  { id: 'Music', action: 'listen', words: ['album','song','songs','artist','band','playlist','ep','track','spotify','rapper','singer','dj','mixtape'] },
  { id: 'Games', action: 'search', words: ['game','games','video game','board game','boardgame','ps5','xbox','nintendo','switch game','steam'] },
  { id: 'Events', action: 'search', words: ['concert','gig','festival','exhibition','exhibit','musical','broadway','comedy show','stand-up','standup','opera','ballet','tickets'] },
  { id: 'Recipes', action: 'search', words: ['recipe','recipes','stew','soup','sauce','marinade','jollof','how to cook','how to make'] },
  { id: 'Apps', action: 'search', words: ['app','apps','app store','ios app','android app','chrome extension','extension','software'] },
  { id: 'Products', action: 'search', words: ['buy','product','gadget','shoes','sneakers','jacket','headphones','skincare','cologne','perfume','moisturizer'] },
  { id: 'Courses & Certs', action: 'search', words: ['course','class','certification','cert','certificate','exam','bootcamp','workshop','training','udemy','coursera'] },
  // Private: never on a public page
  { id: 'Services', action: 'map', words: ['barber','barbershop','haircut','salon','dentist','doctor','therapist','mechanic','tailor','plumber','trainer','physio','dermatologist','nails','spa','massage','gym','cleaner','stylist','tattoo'] },
  { id: 'Apartments', action: 'map', words: ['apartment','apartments','apt','rental','rentals','1br','2br','3br','1 bedroom','2 bedroom','3 bedroom','one bedroom','two bedroom','listing','open house','broker','no fee','lease','sublet','condo','townhouse','brownstone','studio apartment'] },
  { id: 'Other', action: 'search', words: [] },
];
const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const isPlace = r => CAT[r.category]?.action === 'map';
// Movies & TV became two categories; saves from before, and old shared links, are read as one of them
const TV_WORDS = /\b(shows?|series|seasons?|episodes?|tv|hbo|sitcom|anime|miniseries|docuseries|netflix|hulu)\b/i;
const splitMoviesTv = r => TV_WORDS.test(`${r.name} ${r.note || ''} ${r.link || ''}`) ? 'TV Shows' : 'Movies';
const knownCat = (c, r) => c === 'Movies & TV' ? splitMoviesTv(r) : CAT[c] ? c : 'Other';

const DOMAINS = [
  [/spotify\.com\/(show|episode)|podcasts\.apple|overcast\.fm|pocketcasts/i, 'Podcasts'],
  [/letterboxd|imdb|rottentomatoes\.com\/m\//i, 'Movies'],
  [/rottentomatoes\.com\/tv\/|netflix|hulu|hbomax|max\.com|disneyplus|primevideo|tv\.apple|justwatch/i, 'TV Shows'],
  [/spotify\.com|music\.apple|music\.youtube|soundcloud|bandcamp|tidal\.com/i, 'Music'],
  [/youtube\.com|youtu\.be|vimeo\.com|tiktok\.com/i, 'Videos'],
  [/coursera|udemy|edx\.org|linkedin\.com\/learning|skillshare|masterclass|credly/i, 'Courses & Certs'],
  [/resy\.com|opentable|exploretock|yelp\.com|theinfatuation|eater\.com/i, 'Restaurants'],
  [/cooking\.nytimes|allrecipes|bonappetit|seriouseats|epicurious|food52|budgetbytes/i, 'Recipes'],
  [/goodreads|bookshop\.org/i, 'Books'],
  [/streeteasy|zillow|apartments\.com|renthop|redfin|trulia|realtor\.com|compass\.com|corcoran/i, 'Apartments'],
  [/airbnb|booking\.com|hotels\.com|expedia|vrbo|marriott|hilton|hyatt/i, 'Hotels'],
  [/tripadvisor/i, 'Places & Travel'],
  [/store\.steampowered|boardgamegeek|nintendo\.com|playstation\.com|xbox\.com|itch\.io/i, 'Games'],
  [/apps\.apple\.com|play\.google\.com|chromewebstore|chrome\.google\.com\/webstore|producthunt/i, 'Apps'],
  [/eventbrite|dice\.fm|ra\.co|ticketmaster|seatgeek|partiful|lu\.ma|songkick/i, 'Events'],
  [/substack|medium\.com|newyorker|theatlantic|nytimes\.com|wsj\.com|ft\.com|economist\.com|bloomberg\.com|wired\.com|theverge|paulgraham\.com/i, 'Articles'],
];

// What the map says a place is, for places whose category was a guess
const OSM_CATS = {
  restaurant: 'Restaurants', fast_food: 'Restaurants', food_court: 'Restaurants', bakery: 'Restaurants', pasta: 'Restaurants',
  deli: 'Restaurants', pastry: 'Restaurants', confectionery: 'Restaurants',
  cafe: 'Bars & Cafes', bar: 'Bars & Cafes', pub: 'Bars & Cafes', biergarten: 'Bars & Cafes', nightclub: 'Bars & Cafes', ice_cream: 'Bars & Cafes', coffee: 'Bars & Cafes', tea: 'Bars & Cafes',
  hairdresser: 'Services', beauty: 'Services', massage: 'Services', tattoo: 'Services', dentist: 'Services', doctors: 'Services', clinic: 'Services', fitness_centre: 'Services',
  hotel: 'Hotels', hostel: 'Hotels', guest_house: 'Hotels', motel: 'Hotels',
  clothes: 'Shops', boutique: 'Shops', second_hand: 'Shops', gift: 'Shops', florist: 'Shops', jewelry: 'Shops', shoes: 'Shops', books: 'Shops', department_store: 'Shops',
  museum: 'Places & Travel', gallery: 'Places & Travel', attraction: 'Places & Travel', viewpoint: 'Places & Travel', park: 'Places & Travel',
  theatre: 'Places & Travel', cinema: 'Places & Travel', marketplace: 'Places & Travel',
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
  // A kind word you add after the name beats one inside it: "Dover Street Market, shop" is a shop
  const rest = text.split(/[,;]/).slice(1).join(',');
  for (const t of [rest, text]) for (const k of KEYWORDS) if (k.re.test(t)) return k.cat;
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
  // "for Daksh": only a friend's name counts, so "good for dates" stays a note
  let to = null;
  text = text.replace(/(?:^|[\s,;])for\s+@?([\p{L}\w-]+)(?=[\s,;.]|$)/giu, (m, w) => {
    const f = !to && findFriend(w);
    if (!f) return m;
    to = f;
    return ' ';
  });
  text = text.replace(/\s+/g, ' ').trim();

  let category = override || guessCategory(text, link);
  let auto = false;
  if (category === 'Other' && !override) {
    if (fallbackCat) category = fallbackCat;
    else {
      // A named spot in a known neighborhood or city is most likely somewhere to eat; the map corrects it later
      const inPlace = text.match(/(?:^|\s)(?:in|near)\s+([^,;]{1,40}?)\s*(?=[,;]|$)/i)?.[1];
      const rest = text.split(/\s*[,;]\s*/).slice(1);
      if (been || inPlace || rest.some(isPlaceName)) { category = 'Restaurants'; auto = true; }
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
  // "book" or "show" on its own set the category; it isn't a note
  const note = cap(parts.filter(x => !isCategoryWord(x)).join(', '));

  let needsTitle = false;
  if (!name && link) {
    try { name = new URL(link).hostname.replace(/^www\./, ''); } catch { name = link; }
    needsTitle = true;
  }
  return { name, note, from, where, link, category, auto, needsTitle, beenAt, to };
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
    case 'video':
      return { label: 'Watch', url: `https://www.youtube.com/results?search_query=${name}` };
    default: {
      const hint = { Recipes: ' recipe', Books: ' book', 'Courses & Certs': ' course', Games: ' game', Apps: ' app', Events: ' tickets', Products: ' buy' }[r.category] || '';
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

// act: a button on the toast, Undo unless named otherwise
function toast(msg, act, label = 'Undo') {
  const el = $('toast');
  el.innerHTML = `<span>${esc(msg)}</span>${act ? `<button>${esc(label)}</button>` : ''}`;
  if (act) el.querySelector('button').onclick = () => { el.classList.remove('show'); act(); };
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), act ? (label === 'Undo' ? 4000 : 6000) : 2000);
}

// Dates as the date picker reads and writes them, in your own time zone
const pad = n => String(n).padStart(2, '0');
const isoDay = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// How well you remember when you went: the day, just the month, or just the year (beenPrec; none means the day)
const precOf = r => r.beenPrec || 'day';
function whenText(ts, prec) {
  const d = new Date(ts);
  if (prec === 'year') return String(d.getFullYear());
  if (prec === 'month') return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
// "went 3 days ago", or "went in Oct 2025" when the day isn't known
const wentText = r => precOf(r) === 'day' ? ago(beenTime(r)) : `in ${whenText(beenTime(r), precOf(r))}`;

const pref = {
  get(k, d) { try { return localStorage.getItem('recs-' + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('recs-' + k, v); } catch {} },
};

const ICON = {
  map: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="2 6 2 21 8.5 18 15.5 21 22 18 22 3 15.5 6 8.5 3 2 6"/><line x1="8.5" y1="3" x2="8.5" y2="18"/><line x1="15.5" y1="6" x2="15.5" y2="21"/></svg>',
  list: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>',
  heart: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.2 1.8-2 3.3-3.2 5.4-3.2 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21z"/></svg>',
  check: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12.5 10 17.5 19 7"/></svg>',
  x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
  send: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
  plus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 20 7"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>',
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
    // Friends you can send recs to, and what they sent you
    listenFriends(cb) { onValue(ref(db, `users/${uid}/friends`), snap => cb(snap.val() || {})); },
    setFriend(name, f) { const r = ref(db, `users/${uid}/friends/${name}`); return f ? set(r, f) : dbRemove(r); },
    listenInbox(cb) { onValue(ref(db, `inbox/${uid}`), snap => cb(snap.val() || {}), () => cb({})); },
    dropInbox(id) { dbRemove(ref(db, `inbox/${uid}/${id}`)); },
    send(toUid, item) { return set(push(ref(db, `inbox/${toUid}`)), item); },
    // Ideas everyone can see and vote on
    listenIdeas(cb) { onValue(ref(db, 'ideas'), snap => cb(snap.val() || {}), () => cb({})); },
    addIdea(v) { return set(push(ref(db, 'ideas')), v); },
    vote(id, on) { const r = ref(db, `ideas/${id}/votes/${uid}`); return on ? set(r, true) : dbRemove(r); },
    ideaStatus(id, st) { return set(ref(db, `ideas/${id}/status`), st); },
    isAdmin() { return get(ref(db, `admins/${uid}`)).then(snap => snap.val() === true, () => false); },
  };
}

// Usage counts: per day, how many times each thing happened, and which accounts were active.
// Never what anyone saved: no names, notes or places. Everyone can add to the counts; only admins read them.
function firebaseStats(db) {
  return {
    bump(day, keys, uid) {
      const up = {};
      for (const k of keys) up[`stats/${day}/n/${k}`] = increment(1);
      if (uid) up[`stats/${day}/u/${uid}`] = true;
      return dbUpdate(ref(db), up).catch(() => {});
    },
    read: from => get(dbQuery(ref(db, 'stats'), orderByKey(), startAt(from))).then(snap => snap.val() || {}),
  };
}

function demoStats() {
  const read = () => { try { return JSON.parse(localStorage.getItem('recs-demo-stats')) || {}; } catch { return {}; } };
  return {
    bump(day, keys, uid) {
      const d = read();
      d[day] ??= { n: {}, u: {} };
      for (const k of keys) d[day].n[k] = (d[day].n[k] || 0) + 1;
      if (uid) d[day].u[uid] = true;
      try { localStorage.setItem('recs-demo-stats', JSON.stringify(d)); } catch {}
      return Promise.resolve();
    },
    read: async from => Object.fromEntries(Object.entries(read()).filter(([k]) => k >= from)),
  };
}

// Public pages: one record per person at pub/{name}, readable by anyone, written only by its owner.
// The database rules for this and everything else live in database.rules.json.
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
  // Friends, things they sent, and ideas: sample data, kept in this browser
  const kept = (key, seed) => {
    let v = null;
    try { v = JSON.parse(localStorage.getItem(key)); } catch {}
    let cb = () => {};
    v ??= seed;
    const put = next => { v = next; try { localStorage.setItem(key, JSON.stringify(v)); } catch {} cb({ ...v }); };
    return { listen(f) { cb = f; f({ ...v }); }, get: () => v, put };
  };
  const day = 864e5, now = Date.now();
  const friends = kept('recs-demo-friends', { ana: { by: 'Ana', uid: 'd-ana' }, tunde: { by: 'Tunde', uid: 'd-tunde' }, daksh: { by: 'Daksh', uid: 'd-daksh' } });
  const inbox = kept('recs-demo-inbox', {
    i1: { name: 'Dishoom', category: 'Restaurants', note: 'Get the black daal. Worth the line', where: 'Covent Garden, London', st: 'loved', from: 'Daksh', fromName: 'daksh', fromUid: 'd-daksh', at: now - 2 * 3600e3 },
  });
  const ideas = kept('recs-demo-ideas', {
    a1: { uid: 'd-ana', by: 'Ana', text: 'Sort what I want to try by distance when I travel', at: now - 3 * day, votes: { 'd-tunde': true, 'd-daksh': true } },
    a2: { uid: 'd-tunde', by: 'Tunde', text: 'Bring in my saved places from Google Maps', at: now - 6 * day, votes: { 'd-ana': true }, status: 'planned' },
  });
  return {
    uid: 'demo',
    listenFriends: friends.listen,
    setFriend(name, f) { const v = { ...friends.get() }; if (f) v[name] = f; else delete v[name]; friends.put(v); return Promise.resolve(); },
    listenInbox: inbox.listen,
    dropInbox(id) { const v = { ...inbox.get() }; delete v[id]; inbox.put(v); },
    send: () => Promise.resolve(),
    listenIdeas: ideas.listen,
    addIdea(x) { ideas.put({ ...ideas.get(), ['i' + Date.now().toString(36)]: x }); return Promise.resolve(); },
    vote(id, on) { const v = structuredClone(ideas.get()); v[id].votes ??= {}; if (on) v[id].votes.demo = true; else delete v[id].votes.demo; ideas.put(v); return Promise.resolve(); },
    ideaStatus(id, st) { const v = structuredClone(ideas.get()); v[id].status = st; ideas.put(v); return Promise.resolve(); },
    isAdmin: () => Promise.resolve(true),
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
    ['Severance', 'TV Shows', 'Apple TV', 'Ana', '', 8],
    ['Perfect Days', 'Movies', 'Quiet and perfect. Watch it on a big screen', 'Sam', '', 60, 'loved'],
    ['The Bear', 'TV Shows', 'Season 1, then skip to Fishes', 'Tunde', '', 45, 'loved'],
    ['Piranesi', 'Books', 'Go in knowing nothing', 'Kemi', '', 70, 'loved'],
    ['Outer Wilds', 'Games', 'Best game I have played', 'Sam', '', 50, 'tried'],
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
  if (h === 'usage') return { view: 'usage' };
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
  if (r.view === 'usage') { renderUsage(); return; }
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

// ── How adding works: one rule everywhere, shown three ways ──
// The rule: Name, a note, in where, from who. A kind word (book, show, bar) or a link sets the category.
//   1. The placeholder is a real example for the page you're on
//   2. Focus an empty box and the rule itself shows above it
//   3. As you type, a preview shows each part as it will be saved, with "+ in" and "+ from" for what's missing
const EXAMPLE = {
  Restaurants: 'Lilia, in Williamsburg, from Ana', 'Bars & Cafes': 'Devoción, in Williamsburg, from Tunde',
  Hotels: 'Hotel Esencia, in Tulum, from Ana', Shops: 'Café Forgot, in the LES, from Kemi', 'Places & Travel': 'The Cloisters, in Inwood, from Sam',
  Movies: 'Perfect Days, from Sam', 'TV Shows': 'The Bear, from Tunde', Videos: 'Paste a link, or a title, from who',
  Books: 'Piranesi, from Kemi', Articles: 'Paste a link, from who', Podcasts: 'Hardcore History, from Sam',
  Music: 'Blonde, Frank Ocean, from Tunde', Games: 'Outer Wilds, from Sam', Events: 'Paste a link, or a name, from who',
  Recipes: 'Smoky jollof, from Mum', Apps: 'Paste a link, or a name, from who', Products: 'Name, from who',
  'Courses & Certs': 'AWS SA Pro, from Sam', Services: 'Fade Room barber, in Bed-Stuy, from Kemi', Apartments: '350 Broadway, great light',
  Other: 'Name, a note, from who',
};

function addHint(r) {
  if (logging()) return 'Sushi Lin, Prospect Heights';
  if (r.view !== 'cat') return 'Lilia, in Williamsburg, from Ana';
  return EXAMPLE[r.cat] || 'Name, a note, from who';
}

// The rule, in words, for the page you're on
function formula() {
  const r = route();
  const kw = w => `<b>${w}</b>`;
  if (logging()) return `${kw('Place')}, where it is. Add ${kw('yesterday')} if it was.`;
  if (r.cat === 'Apartments') return `${kw('Address')}, what you thought`;
  const place = r.view !== 'cat' || CAT[r.cat].action === 'map';
  const rule = `${kw(r.view === 'cat' && !place ? 'Title' : 'Name')}, a note, ${place ? `${kw('in')} where, ` : ''}${kw('from')} who`;
  const more = r.view === 'cat' ? 'A link works too.' : `Say ${kw('book')}, ${kw('show')} or ${kw('bar')} to set the kind, or paste a link.`;
  const f = friendList()[0];
  const send = f ? `<span class="pv-more">Add ${kw('for ' + esc(f.by))} to send it to a friend instead.</span>` : '';
  return `${rule}<span class="pv-more">${more}</span>${send}`;
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
  const when = r.status === 'todo' ? ago(r.createdAt) : `${isPlace(r) ? 'went' : 'tried'} ${wentText(r)}`;
  // A street address is too long for a row; its city says enough
  const meta = [opts.showCat && r.category, hoodOf(r) || (ADDRESS.test(r.where || '') ? cityOf(r) : r.where), r.from && 'from ' + r.from, when].filter(Boolean).join(' · ');
  const act = action(r);
  // Behind each row: what a swipe right or left will do
  return `<div class="sw"><div class="sw-bg" aria-hidden="true"><span class="sw-l">${r.status === 'todo' ? ICON.check : ICON.heart} ${NEXT_LABEL[r.status]}</span><span class="sw-r">Delete ${ICON.trash}</span></div>
  <div class="row" data-open="${r.id}" tabindex="0">
    ${mark(r)}
    <div class="row-body">
      <div class="row-name">${esc(r.name)}</div>
      ${r.note ? `<div class="row-note">${esc(r.note)}</div>` : ''}
      <div class="row-meta">${esc(meta)}</div>
    </div>
    <a class="row-act" href="${esc(act.url)}" target="_blank" rel="noopener">${act.label}</a>
  </div></div>`;
}

// ── Swipe a row: left deletes, right moves it on (Want to try → Tried → Loved) ──
// The row follows the finger, slows past the point where letting go acts, and a quick flick is enough.
// Both can be undone from the toast.
const NEXT = { todo: 'tried', tried: 'loved', loved: 'tried' };
const NEXT_LABEL = { todo: 'Tried', tried: 'Loved', loved: 'Unlove' };
let swiped = false;

function bindSwipe() {
  const main = $('main');
  let s = null;
  const reset = cur => {
    cur.row.style.transform = '';
    cur.wrap.classList.remove('dragging', 'armed');
  };
  main.addEventListener('pointerdown', e => {
    if (s || e.button !== 0) return;  // one finger at a time
    const row = e.target.closest('.sw > .row');
    if (!row || e.target.closest('.row-act')) return;
    s = { row, wrap: row.parentElement, id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: e.timeStamp, dx: 0, axis: '' };
  });
  main.addEventListener('pointermove', e => {
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
    if (!s.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (s.axis === 'y') { s = null; return; }  // the page scrolls instead
      try { s.row.setPointerCapture(e.pointerId); } catch {}
      s.wrap.classList.add('dragging');
      s.w = s.wrap.offsetWidth;
    }
    s.dx = dx;
    const at = s.w * 0.32;
    const x = Math.abs(dx) <= at ? dx : Math.sign(dx) * (at + (Math.abs(dx) - at) * 0.3);
    s.row.style.transform = `translateX(${x}px)`;
    s.wrap.dataset.dir = dx < 0 ? 'left' : 'right';
    s.wrap.classList.toggle('armed', Math.abs(dx) > at);
  });
  main.addEventListener('pointerup', e => {
    if (!s || e.pointerId !== s.id) return;
    const cur = s;
    s = null;
    if (cur.axis !== 'x') return;
    swiped = true;  // the click that follows a swipe doesn't open the row
    setTimeout(() => { swiped = false; }, 0);
    const speed = Math.abs(cur.dx) / Math.max(1, e.timeStamp - cur.t0);
    const go = Math.abs(cur.dx) > cur.w * 0.32 || (speed > 0.4 && Math.abs(cur.dx) > 48);
    const id = cur.row.dataset.open;
    if (go && cur.dx < 0) { cur.wrap.classList.remove('dragging'); swipeDelete(cur.wrap, id); return; }
    reset(cur);
    if (go) swipeStatus(id);
  });
  main.addEventListener('pointercancel', e => { if (s && e.pointerId === s.id) { if (s.axis === 'x') reset(s); s = null; } });
}

function swipeDelete(wrap, id) {
  track('swipe');
  if (reduceMotion.matches) { deleteRec(id); return; }
  // Off to the left, then the gap closes
  wrap.querySelector('.row').style.transform = 'translateX(-100%)';
  wrap.style.height = wrap.offsetHeight + 'px';
  requestAnimationFrame(() => { wrap.classList.add('gone'); wrap.style.height = '0px'; });
  setTimeout(() => deleteRec(id), 240);
}

function swipeStatus(id) {
  const r = items[id];
  if (!r) return;
  const prev = { status: r.status, beenAt: r.beenAt ?? null };
  const next = NEXT[r.status];
  const p = { status: next };
  if (!r.beenAt) p.beenAt = Date.now();
  patch(id, p);
  track(next, r.category);
  track('swipe');
  toast(next === 'loved' ? `Loved ${r.name}` : r.status === 'loved' ? `${r.name} back to Tried` : `Tried ${r.name}`, () => patch(id, prev));
}

function emptyFor() {
  const where = place.hood || place.city;
  const what = { all: 'Nothing here', todo: 'Nothing to try', tried: 'Nothing tried', loved: 'Nothing loved' }[status];
  const hint = logging() ? 'Type a place you went below, like "Sushi Lin, Prospect Heights".' : 'Type a rec below the way you\'d text it.';
  return `<div class="none"><p>${what}${where ? ` in ${esc(where)}` : ''} yet.</p><p class="sub">${hint}</p></div>`;
}

function renderHome() {
  const recs = all();
  const sent = status === 'all' && !place.city ? inboxHtml() : '';
  if (!recs.length) {
    return `${sent}<div class="empty">
      <h2>Nothing saved yet</h2>
      <p>When someone recommends something, type it below the way you'd text it.</p>
      <div class="examples">
        ${['Lilia, pasta in Williamsburg, from Ana', 'The Bear, TV show from Tunde', 'Piranesi, book from Kemi']
          .map(t => `<button class="example" data-example="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>
    </div>`;
  }

  const shown = recs.filter(r => statusMatch(r) && placeMatch(r));
  if (!shown.length) return sent + emptyFor();

  // One group per category: the three most recent, then a way into the rest
  return sent + CATEGORIES.map(c => {
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
  delete $('sheet').dataset.view;
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
  delete $('sheet').dataset.view;
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
  const when = `Added ${ago(r.createdAt)}`;
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
    const row = $('dWhenRow');
    row.classList.toggle('hidden', r.status === 'todo');
    row.querySelector('span').textContent = isPlace(r) ? 'Went' : 'Tried';
    const key = `${beenTime(r)}|${precOf(r)}`;
    if (row.dataset.key !== key) { row.dataset.key = key; $('dWhen2').innerHTML = whenPicker(r); }
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
    <div class="toggle date-row ${r.status === 'todo' ? 'hidden' : ''}" id="dWhenRow" data-key="${beenTime(r)}|${precOf(r)}">
      <span>${isPlace(r) ? 'Went' : 'Tried'}</span><span class="when-pick" id="dWhen2">${whenPicker(r)}</span>
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
  delete $('sheet').dataset.view;
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

// When you went, as pills: what you remember is solid, what you don't is a dashed "+ day" or "+ month".
// Each pill is the phone's own picker underneath; "Not sure" at the top of a list takes that part away.
function whenPicker(r) {
  const d = new Date(beenTime(r)), prec = precOf(r), now = new Date();
  const y = d.getFullYear(), m = d.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const opt = (v, label, on) => `<option value="${v}" ${on ? 'selected' : ''}>${label}</option>`;
  const pill = (id, label, shown, opts, add) => `<label class="wp ${add ? 'add' : ''}"><span>${shown}</span>
    <select id="${id}" aria-label="${label}">${opts}</select></label>`;
  const dayOpts = opt('', 'Not sure', prec !== 'day') + Array.from({ length: days }, (_, i) => opt(i + 1, i + 1, prec === 'day' && d.getDate() === i + 1)).join('');
  const monOpts = opt('', 'Not sure', prec === 'year') + MONTHS.map((n, i) => opt(i, n, prec !== 'year' && i === m)).join('');
  const yearOpts = Array.from({ length: now.getFullYear() - Math.min(1980, y) + 1 }, (_, i) => now.getFullYear() - i).map(v => opt(v, v, v === y)).join('');
  const day = pill('dDayD', 'Day', prec === 'day' ? d.getDate() : '+ day', dayOpts, prec !== 'day');
  const mon = pill('dDayM', 'Month', prec === 'year' ? '+ month' : MONTHS[m], monOpts, prec === 'year');
  const year = pill('dDayY', 'Year', y, yearOpts);
  // Known parts in reading order, then what you could add
  return prec === 'day' ? mon + day + year : prec === 'month' ? mon + year + day : year + mon;
}

// What the three pickers say, as a time and how exact it is. Never later than now.
function readWhen() {
  const d = $('dDayD')?.value || '', m = $('dDayM').value, y = Number($('dDayY').value);
  const [ts, prec] = m === '' ? [new Date(y, 6, 1, 12), 'year']
    : d === '' ? [new Date(y, Number(m), 15, 12), 'month']
    : [new Date(y, Number(m), Math.min(Number(d), new Date(y, Number(m) + 1, 0).getDate()), 12), 'day'];
  return { ts: Math.min(ts.getTime(), Date.now()), prec };
}

// Backdating: change when you went. Places from the same trip logged the same day can follow in one tap.
function setWhen(id) {
  const r = { id, ...items[id] };
  const { ts, prec } = readWhen();
  if (ts === beenTime(r) && prec === precOf(r)) return;
  const was = isoDay(beenTime(r));
  const fields = { beenAt: ts, beenPrec: prec === 'day' ? null : prec };
  patch(id, fields);
  const city = cityOf(r);
  const same = city ? all().filter(x => x.id !== id && x.status !== 'todo' && cityOf(x) === city && isoDay(beenTime(x)) === was) : [];
  if (!same.length) return;
  toast(`Move ${same.length} other ${city} ${same.length === 1 ? 'place' : 'places'} too?`, () => {
    const now = Date.now();
    for (const x of same) {
      items[x.id] = { ...items[x.id], beenAt: ts, updatedAt: now, beenPrec: fields.beenPrec };
      if (!fields.beenPrec) delete items[x.id].beenPrec;
      store.update(x.id, { ...fields, updatedAt: now });
    }
    render();
    toast(`Moved ${same.length + 1} places to ${whenText(ts, prec)}`);
  }, 'Move');
}

function deleteRec(id) {
  track('delete');
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
    <div class="list opts">
      <button class="opt" data-friends><span class="opt-name">Friends</span><span class="opt-count">${friendList().length || 'Add'} ${ICON.chevron}</span></button>
      <button class="opt" data-pub-manage><span class="opt-name">Public page</span><span class="opt-count">${pubCfg.name ? esc(listJoin(pubLabels()) || 'Nothing on it') : 'Off'} ${ICON.chevron}</span></button>
      <button class="opt" data-ideas><span class="opt-name">Ideas</span><span class="opt-count">Suggest or vote ${ICON.chevron}</span></button>
      ${isAdmin ? `<a class="opt" href="#/usage"><span class="opt-name">Usage</span><span class="opt-count">Only you see this ${ICON.chevron}</span></a>` : ''}
    </div>
    <div class="account-actions">
      <button class="btn sec wide" data-invite>Invite a friend</button>
      <button class="btn sec wide" data-signout>Sign out</button>
    </div>`;
  delete $('sheet').dataset.id;
  $('sheet').dataset.view = 'account';
  openSheet();
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
  category: knownCat(a[1], { name: String(a[0] || ''), note: String(a[3] || '') }),
  where: String(a[2] || '').slice(0, 100),
  note: String(a[3] || '').slice(0, 500),
  status: ['todo', 'tried', 'loved'].includes(a[4]) ? a[4] : 'todo',
  link: /^https?:\/\//i.test(a[5]) ? String(a[5]) : '',
  lat: Number(a[6]) || 0,
  lng: Number(a[7]) || 0,
  day: Number(a[8]) || 0,
  image: /^https?:\/\//i.test(a[9]) ? String(a[9]) : '',
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

// page: { kind: 'trip', label: 'Madrid' } or { kind: 'shelf', label: 'Books' }, which can also have a public page
function openShare(recs, title, page = null) {
  detailId = null;
  pubErr = '';
  shareState = { recs: recs.slice(0, 100), title, notes: true, url: '', page };
  drawShareSheet();
  openSheet();
  buildShareUrl();
}

function drawShareSheet() {
  const s = shareState;
  const n = s.recs.length;
  const names = s.recs.slice(0, 4).map(r => r.name).join(', ') + (n > 4 ? ` and ${n - 4} more` : '');
  const one = n === 1 && s.title === s.recs[0].name;
  $('sheet').innerHTML = `${sheetHead(one ? 'Share' : s.page ? `Share ${s.page.label}` : `Share ${n}`)}
    ${n <= 20 ? friendsCard() : ''}
    ${s.page ? publicCard(s.page) : publicIntro()}
    <h3 class="sheet-sub">Or send ${n === 1 ? 'just this' : `these ${n}`} as a list</h3>
    <label class="field"><span>Title</span><input id="shareTitle" value="${esc(s.title)}" /></label>
    ${one ? '' : `<p class="hint">${esc(names)}</p>`}
    <label class="toggle"><span>Include my notes</span><input type="checkbox" id="shareNotes" ${s.notes ? 'checked' : ''} /></label>
    <button class="btn wide sec" data-share-go>Share list</button>
    <p class="hint">Whoever opens the link sees ${n === 1 ? 'this' : 'these'} and can save ${n === 1 ? 'it' : 'any of them'} to their own Recs. Nothing else of yours is visible.</p>`;
  delete $('sheet').dataset.id;
  $('sheet').dataset.view = 'share';
}

// Sheets that show public page state redraw when it changes
function redrawSheet() {
  if (!isOpen() || $('sheet').dataset.id) return;
  const v = $('sheet').dataset.view;
  if (v === 'share' && shareState) drawShareSheet();
  else if (v === 'public') drawPublic();
  else if (v === 'friends') drawFriends();
  else if (v === 'ideas') drawIdeas();
}


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
  track('share_list');
  shareOut(s.title, text, s.url).then(ok => { if (ok) closeSheet(); });
}

function invite() {
  track('invite');
  if (pubCfg.name) shareOut('Add me on Recs', 'Add me on Recs so we can send each other recs. Open it, sign in with Google, and tap Add.', pubUrl(pubCfg.name));
  else shareOut('Recs', 'This is what I use to keep track of things people recommend. Open it in Safari, sign in with Google, then tap Share and Add to Home Screen.', appUrl());
}

// ── Public pages ──
// Two kinds, both live, both under #/@name:
//   a trip:  #/@chris/madrid  the places you tried or loved in a city, with a map
//   a shelf: #/@chris/books   the books (or shows, games…) you tried or loved
// Never apartments, services or anything else that says where you live or who your doctor is.
// Who recommended a thing stays private; a street address shows as its neighborhood.
let pub = null;          // where public pages are read and written
let pubCfg = {};         // { name, cities: { madrid: 'Madrid' }, shelves: { books: 'Books' }, notes }
let pubErr = '';         // 'setup' when the database doesn't allow public pages yet, 'taken' when no name was free
let pubBusy = false;
let pubLast = '', pubTimer = 0, loaded = false;

const TRIP_CATS = ['Restaurants', 'Bars & Cafes', 'Hotels', 'Shops', 'Places & Travel'];
const SHELF_CATS = ['Movies', 'TV Shows', 'Videos', 'Books', 'Articles', 'Podcasts', 'Music', 'Games', 'Events', 'Recipes', 'Apps', 'Products', 'Courses & Certs'];
const done = r => r.status !== 'todo';
const inTrip = city => r => done(r) && TRIP_CATS.includes(r.category) && cityOf(r) === city;
const inShelf = cat => r => done(r) && r.category === cat;
const pageRecs = (kind, label) => all().filter(kind === 'trip' ? inTrip(label) : inShelf(label));
const slug = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const firstName = () => (user?.displayName || '').split(' ')[0] || 'Me';
const pubUrl = (name, key = '') => `${appUrl()}#/@${name}${key ? '/' + key : ''}`;
const prettyUrl = u => u.replace(/^https?:\/\//, '');
const cfgKey = kind => kind === 'trip' ? 'cities' : 'shelves';
const isPublic = (kind, label) => !!pubCfg[cfgKey(kind)]?.[slug(label)];
const pubLabels = () => [...Object.values(pubCfg.cities || {}), ...Object.values(pubCfg.shelves || {})];
const toDay = ts => Math.floor((ts || 0) / 864e5);
const listJoin = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a.at(-1);
const webUrl = u => /^https?:\/\//i.test(u || '') ? u : '';

// "6 books", "1 show"
const NOUN = { Movies: 'movie', 'TV Shows': 'show', Videos: 'video', Books: 'book', Articles: 'article', Podcasts: 'podcast', Games: 'game', Events: 'event', Recipes: 'recipe', Apps: 'app', 'Courses & Certs': 'course' };
const count = (n, cat) => { const w = NOUN[cat] || (cat ? 'pick' : 'place'); return `${n} ${w}${n === 1 ? '' : 's'}`; };

function buildPub() {
  const notes = pubCfg.notes !== false;
  const enc = r => [r.name, r.category, isPlace(r) ? hoodOf(r) || '' : '', notes ? r.note || '' : '', r.status,
    webUrl(r.link), r.lat ? r5(r.lat) : 0, r.lng ? r5(r.lng) : 0, toDay(beenTime(r)), webUrl(r.image)];
  const pages = kind => Object.fromEntries(Object.entries(pubCfg[cfgKey(kind)] || {}).map(([key, label]) =>
    [key, { c: label, i: pageRecs(kind, label).sort(byRecent).slice(0, 300).map(enc) }]));
  return { uid: store.uid, by: firstName(), trips: pages('trip'), shelves: pages('shelf') };
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
    catch { pubErr = 'setup'; redrawSheet(); }
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

async function setPublic(kind, label, on) {
  pubErr = '';
  const k = cfgKey(kind);
  const list = { ...(pubCfg[k] || {}) };
  if (on) list[slug(label)] = label;
  else delete list[slug(label)];
  let name = pubCfg.name;
  if (on && !name) {
    pubBusy = true;
    redrawSheet();
    name = await claimName(firstName());
    pubBusy = false;
    if (!name) { redrawSheet(); return; }
  }
  savePublic({ ...pubCfg, name, [k]: list });
  if (on) track('public_on');
  redrawSheet();
}

async function renamePub(want) {
  const old = pubCfg.name;
  const name = slug(want).slice(0, 24);
  if (!name || name === old) { drawPublic(); return; }
  if (name.length < 2) { toast('Use at least two letters'); drawPublic(); return; }
  try {
    const cur = await pub.get(name);
    if (cur && cur.uid !== store.uid) { toast(`Someone already has ${name}`); drawPublic(); return; }
    pubCfg = { ...pubCfg, name };
    await pub.set(name, { ...buildPub(), updatedAt: Date.now() });
  } catch {
    pubCfg = { ...pubCfg, name: old };
    toast('That name could not be saved');
    drawPublic();
    return;
  }
  if (old) pub.remove(old).catch(() => {});
  pubLast = '';
  savePublic(pubCfg);
  drawPublic();
  toast('Link changed. The old one stops working.');
}

function sharePub(key) {
  track('share_page');
  const by = firstName();
  const city = pubCfg.cities?.[key], cat = pubCfg.shelves?.[key];
  const [title, text] = city ? [`${by} in ${city}`, `Where I went in ${city}`]
    : cat ? [`${by}'s ${cat}`, `${cat} I'd recommend`]
    : [`${by}'s recs`, 'Things I loved, and where I went'];
  shareOut(title, text, pubUrl(pubCfg.name, key));
}

// The top of the share sheet, for a city picked in Where or a category you're in
function publicCard({ kind, label }) {
  const on = isPublic(kind, label) && !!pubCfg.name;
  const n = pageRecs(kind, label).length;
  const url = on ? pubUrl(pubCfg.name, slug(label)) : '';
  const notes = pubCfg.notes !== false ? ', with your notes' : '';
  const thing = kind === 'trip' ? `${n === 1 ? 'place' : `${n} places`} you tried or loved in ${esc(label)}` : `${n === 1 ? NOUN[label] || 'one' : count(n, label)} you tried or loved`;
  const what = n
    ? `Anyone with the link sees the ${thing}${notes}. It updates as you go. Who recommended ${n === 1 ? 'it' : 'them'} stays private.`
    : `Mark ${kind === 'trip' ? `places in ${esc(label)}` : esc(label.toLowerCase())} as Tried or Loved and they show up here.`;
  const err = {
    setup: 'Public pages need one change in the Firebase database rules first. The rule is in the code, above firebasePub.',
    taken: 'Every name like yours is taken. Try again later.',
  }[pubErr];
  return `<div class="pub-card">
    <label class="toggle bare"><span>${esc(label)} on your public page</span><input type="checkbox" data-pub-kind="${kind}" data-pub-label="${esc(label)}" ${on ? 'checked' : ''} ${pubBusy ? 'disabled' : ''} /></label>
    ${on ? `<a class="pub-link" href="${esc(url)}">${esc(prettyUrl(url))}</a>
      <button class="btn wide" data-pub-share="${esc(slug(label))}">Share page</button>` : ''}
    <p class="hint">${err ? esc(err) : what}</p>
    <button class="link-btn manage" data-pub-manage>Everything on your page ${ICON.chevron}</button>
  </div>`;
}

// The page an item belongs on: its city for a place, its category for a book or show. Only once tried or loved.
function pageOf(r) {
  if (r.status === 'todo') return null;
  if (TRIP_CATS.includes(r.category) && cityOf(r)) return { kind: 'trip', label: cityOf(r) };
  if (SHELF_CATS.includes(r.category)) return { kind: 'shelf', label: r.category };
  return null;
}

// Share sheet top when there's no one city or category: what a public page is, and the way in
function publicIntro() {
  const url = pubCfg.name ? pubUrl(pubCfg.name) : '';
  const on = pubLabels();
  return `<div class="pub-card">
    <button class="pub-head" data-pub-manage>
      <span><b>Your public page</b><small>${on.length && url ? esc(listJoin(on)) : 'Show friends what you loved, by city or by category'}</small></span>
      ${ICON.chevron}
    </button>
    ${on.length && url ? `<button class="btn wide" data-pub-share="">Share my page</button>` : ''}
  </div>`;
}

// ── The Public page screen: everything that's on it, in one place ──
function openPublic() {
  detailId = null;
  pubErr = '';
  drawPublic();
  openSheet();
}

function drawPublic() {
  const done = all().filter(r => r.status !== 'todo');
  const cities = {};
  for (const r of done) if (TRIP_CATS.includes(r.category) && cityOf(r)) cities[cityOf(r)] = (cities[cityOf(r)] || 0) + 1;
  for (const c of Object.values(pubCfg.cities || {})) cities[c] ??= 0;
  const shelves = {};
  for (const r of done) if (SHELF_CATS.includes(r.category)) shelves[r.category] = (shelves[r.category] || 0) + 1;
  for (const c of Object.values(pubCfg.shelves || {})) shelves[c] ??= 0;
  const row = (kind, label, n) => `<label class="opt pub-opt">
      <span class="opt-name">${esc(label)}</span>
      <span class="pub-opt-end"><span class="opt-count">${n ? kind === 'trip' ? count(n, '') : count(n, label) : 'none yet'}</span>
      <input type="checkbox" data-pub-kind="${kind}" data-pub-label="${esc(label)}" ${isPublic(kind, label) && pubCfg.name ? 'checked' : ''} ${pubBusy ? 'disabled' : ''} /></span>
    </label>`;
  const group = (title, kind, obj, order) => {
    const keys = Object.keys(obj).sort(order);
    return keys.length ? `<h3 class="sheet-sub">${title}</h3><div class="list opts toggles">${keys.map(k => row(kind, k, obj[k])).join('')}</div>` : '';
  };
  const url = pubCfg.name ? pubUrl(pubCfg.name) : '';
  const err = { setup: 'Public pages need one change in the Firebase database rules first.', taken: 'Every name like yours is taken. Try again later.' }[pubErr];
  $('sheet').innerHTML = `${sheetHead('Public page')}
    <p class="hint">Friends see what you tried or loved in the cities and categories you turn on, with your notes if you like. It updates as you go. Who recommended things stays private.</p>
    ${err ? `<p class="hint err">${esc(err)}</p>` : ''}
    ${url && pubLabels().length ? `<div class="pub-card"><a class="pub-link first" href="${esc(url)}">${esc(prettyUrl(url))}</a><button class="btn wide" data-pub-share="">Share my page</button></div>` : ''}
    ${group('Places', 'trip', cities, (a, b) => cities[b] - cities[a] || a.localeCompare(b))}
    ${group('Things', 'shelf', shelves, (a, b) => SHELF_CATS.indexOf(a) - SHELF_CATS.indexOf(b))}
    ${Object.keys(cities).length + Object.keys(shelves).length ? '' : '<p class="hint">Mark things as Tried or Loved, and the cities and categories they belong to show up here.</p>'}
    ${pubCfg.name ? `<h3 class="sheet-sub">Settings</h3>
      <label class="toggle"><span>Show my notes</span><input type="checkbox" id="pubNotes" ${pubCfg.notes !== false ? 'checked' : ''} /></label>
      <label class="field"><span>Name in the link</span><input id="pubName" value="${esc(pubCfg.name)}" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" /></label>` : ''}`;
  delete $('sheet').dataset.id;
  $('sheet').dataset.view = 'public';
}

// ── Opening a public page ──
let pubPage = null;  // { name, at, data }

async function renderPub() {
  const { name } = route();
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
    if (mine.data && (!store || mine.data.uid !== store.uid)) track('page_view');
  }
  let want = null;
  try { want = sessionStorage.getItem('recs-friend'); } catch {}
  if (store && want === name && pubPage.data) { try { sessionStorage.removeItem('recs-friend'); } catch {} addFriend(name); return; }
  const r = route();
  const data = pubPage.data;
  if (!data) { drawMissing('Nothing here', 'The link may be wrong, or the page was taken down.'); return; }
  const by = String(data.by || 'A friend').slice(0, 40);
  if (!r.trip) { drawProfile(data, name, by); return; }
  const t = data.trips?.[r.trip], sh = data.shelves?.[r.trip];
  const page = t || sh;
  if (!page) { drawMissing(`${by} hasn't made this public`, '', `#/@${name}`, `See ${by}'s recs`); return; }
  const key = `@${name}/${r.trip}`;
  if (shared?.key !== key || shared.at !== data.updatedAt) {
    const label = String(page.c || '').slice(0, 80);
    shared = {
      key, at: data.updatedAt, by, name, title: label, page: t ? 'trip' : 'shelf', city: t ? label : '', cat: t ? '' : label,
      recs: (Array.isArray(page.i) ? page.i : []).map(decodeRec).filter(x => x.name),
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

// "October 2026 · 6 places · 4 loved", "6 books · 4 loved"
const pageLine = (recs, cat = '') => {
  const loved = recs.filter(r => r.status === 'loved').length;
  return [!cat && fmtSpan(recs.map(r => r.day)), count(recs.length, cat), loved && `${loved} loved`].filter(Boolean).join(' · ');
};

const decodePages = (obj, kind) => Object.entries(obj || {})
  .map(([k, t]) => ({ k, kind, label: String(t.c || k).slice(0, 80), recs: (Array.isArray(t.i) ? t.i : []).map(decodeRec).filter(x => x.name) }))
  .filter(t => t.recs.length);

function drawProfile(data, name, by) {
  const v = $('sharedView');
  const latest = t => Math.max(0, ...t.recs.map(r => r.day));
  const trips = decodePages(data.trips, 'trip').sort((a, b) => latest(b) - latest(a));
  const shelves = decodePages(data.shelves, 'shelf').sort((a, b) => SHELF_CATS.indexOf(a.label) - SHELF_CATS.indexOf(b.label));
  const me = !!store && data.uid === store.uid;
  const friend = !!friends[name];
  const key = `@${name}|${data.updatedAt}|${!!store}|${friend}`;
  document.title = `${by}'s recs`;
  if (v.dataset.key === key) return;
  v.dataset.key = key;
  shared = null;
  const everything = [...trips, ...shelves].flatMap(t => t.recs);
  const places = trips.flatMap(t => t.recs);
  const pageRow = t => `<a class="row city-row" href="#/@${esc(name)}/${esc(t.k)}">
      <div class="row-body">
        <div class="row-name">${esc(t.label)}</div>
        ${t.kind === 'shelf' ? `<div class="row-note">${esc(t.recs.slice(0, 3).map(r => r.name).join(', '))}</div>` : ''}
        <div class="row-meta">${esc(pageLine(t.recs, t.kind === 'shelf' ? t.label : ''))}</div>
      </div>
      <span class="chev">${ICON.chevron}</span>
    </a>`;
  const line = [trips.length && `${trips.length} ${trips.length === 1 ? 'city' : 'cities'}`,
    shelves.length && `${shelves.length} ${shelves.length === 1 ? 'category' : 'categories'}`,
    everything.some(r => r.status === 'loved') && `${everything.filter(r => r.status === 'loved').length} loved`].filter(Boolean).join(' · ');
  v.innerHTML = `
    <header class="shared-head">
      <p class="eyebrow">Recs</p>
      <h1>${esc(by)}'s recs</h1>
      ${line ? `<p class="trip-sub">${line}</p>` : ''}
      ${me ? '' : friend ? `<p class="friend-on">${ICON.check} Friends. Send ${esc(by)} recs from Share.</p>`
        : `<button class="btn-primary add-friend" data-add-friend="${esc(name)}">Add ${esc(by)}</button>`}
    </header>
    ${places.some(r => r.lat) ? '<div class="pub-map"><div id="pubMap"></div></div>' : ''}
    ${trips.length ? `${shelves.length ? '<h2 class="pub-h">Places</h2>' : ''}<div class="list bare">${trips.map(pageRow).join('')}</div>` : ''}
    ${shelves.length ? `${trips.length ? '<h2 class="pub-h">Things</h2>' : ''}<div class="list bare">${shelves.map(pageRow).join('')}</div>` : ''}
    ${trips.length || shelves.length ? '' : '<div class="none"><p>Nothing public yet.</p></div>'}
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

// A list someone sent, or a public page (s.page: trip or shelf). The header and map are drawn once; the rows redraw as you save.
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
  const trip = s.page === 'trip';
  const onPage = !!s.page;
  document.title = trip ? `${by} in ${s.city}` : onPage ? `${by}'s ${s.cat}` : s.title;
  if (v.dataset.key !== `${s.key}|${s.at || ''}`) {
    const fresh = !v.dataset.key?.startsWith(s.key + '|');
    v.dataset.key = `${s.key}|${s.at || ''}`;
    v.innerHTML = `
      <header class="shared-head">
        ${onPage ? `<a class="eyebrow" href="#/@${esc(s.name)}">${esc(by)}</a>` : `<p class="eyebrow">From ${esc(by)}</p>`}
        <h1>${esc(s.title)}</h1>
        ${onPage ? `<p class="trip-sub">${esc(pageLine(s.recs, s.cat))}</p>` : ''}
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
    const did = !onPage && { loved: `${by} loved it`, tried: `${by} tried it` }[r.status];
    const meta = [mixed && r.category, hoodOf(r) || (ADDRESS.test(r.where || '') ? cityOf(r) : r.where), did].filter(Boolean).join(' · ');
    const act = action(r);
    const saved = signedIn && isSaved(r);
    // The mark is for your own list: empty on a list someone sent, left out on a trip page
    return `<div class="row" data-pub-row="${i}">
      ${onPage ? (r.image ? `<img class="thumb" src="${esc(r.image)}" alt="" loading="lazy" />` : '') : mark({ status: 'todo' })}
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
    ? `${label ? `<h2 class="pub-h">${label}</h2>` : ''}<div class="list${onPage ? ' bare' : ''}">${list.map(([r, i]) => row(r, i)).join('')}</div>` : '';
  const body = onPage
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
    if (shared.page === 'trip') {
      rec.city = shared.city;
      if (r.where && shared.city !== 'New York') rec.where = `${r.where}, ${shared.city}`;
    }
    if (r.lat && r.lng) Object.assign(rec, { lat: r.lat, lng: r.lng, geo: 'ok', geoV: GEO_VERSION });
    items[store.add(rec)] = rec;
    added.push(r.name);
  }
  if (added.length) track('page_save');
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

// ── Friends: send a rec straight into someone's Recs ──
// Everyone has a short name (@daksh), the same one their public page uses. Add someone from their page;
// after that "for Daksh" in the add box, or Daksh in any Share sheet, sends it to them.
// It lands in their "Sent to you", where they save it or let it go. Nothing goes into their list without them.
let friends = {};   // { daksh: { by: 'Daksh', uid } }
let inbox = {};     // what friends sent you
let stats = null;   // usage counts
let isAdmin = null;  // unknown until the database answers

const friendList = () => Object.entries(friends).map(([name, f]) => ({ name, by: f.by || name, uid: f.uid }))
  .filter(f => f.uid).sort((a, b) => a.by.localeCompare(b.by));
function findFriend(word) {
  const w = String(word).toLowerCase().replace(/^@/, '');
  return friendList().find(f => f.name === w || f.by.toLowerCase() === w) || null;
}

function sendTo(friend, recs) {
  const at = Date.now();
  const out = recs.slice(0, 20).map(r => ({
    name: r.name, category: r.category, note: r.note || '', where: r.where || '', city: r.city || '',
    link: webUrl(r.link), lat: r.lat || 0, lng: r.lng || 0, st: r.status || 'todo',
    from: firstName(), fromName: pubCfg.name || '', fromUid: store.uid, at,
  }));
  return Promise.all(out.map(x => store.send(friend.uid, x))).then(() => {
    track('send');
    toast(`Sent ${out.length === 1 ? out[0].name : `${out.length} recs`} to ${friend.by}`);
    return true;
  }, () => {
    toast(`Couldn't send to ${friend.by} yet. The database rules need the inbox part.`);
    return false;
  });
}

async function addFriend(name) {
  const data = pubPage?.data;
  if (!store) {
    try { sessionStorage.setItem('recs-friend', name); } catch {}
    signIn();
    return;
  }
  if (!data?.uid || data.uid === store.uid) return;
  const by = String(data.by || name).slice(0, 40);
  try { await store.setFriend(name, { by, uid: data.uid }); } catch { toast('Adding friends needs the new database rules'); return; }
  friends = { ...friends, [name]: { by, uid: data.uid } };
  // Tell them, so you're on their list too
  store.send(data.uid, { kind: 'friend', name: '', from: firstName(), fromName: pubCfg.name || '', fromUid: store.uid, at: Date.now() }).catch(() => {});
  track('friend_add');
  toast(`Added ${by}. Send them recs from Share, or add "for ${by}".`);
  $('sharedView').dataset.key = '';
  renderPub();
}

// Someone who adds you, or sends you something, becomes your friend too
function takeNotices() {
  for (const [id, x] of Object.entries(inbox)) {
    const name = slug(x.fromName || '');
    if (name && x.fromUid && !friends[name] && x.fromUid !== store.uid) {
      friends = { ...friends, [name]: { by: String(x.from || name).slice(0, 40), uid: x.fromUid } };
      store.setFriend(name, friends[name]).catch(() => {});
      if (x.kind === 'friend') toast(`${x.from || name} added you as a friend`);
    }
    if (x.kind === 'friend') { store.dropInbox(id); delete inbox[id]; }
  }
}

const inboxList = () => Object.entries(inbox).filter(([, x]) => x.kind !== 'friend' && x.name).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));

function inboxHtml() {
  const list = inboxList();
  if (!list.length) return '';
  return `<section class="group">
    <div class="group-head static"><span>Sent to you</span><span class="group-count">${list.length}</span></div>
    <div class="list">${list.map(([id, x]) => {
      const cat = knownCat(x.category, x);
      const did = { loved: `${x.from} loved it`, tried: `${x.from} tried it` }[x.st] || (x.from && `from ${x.from}`);
      const meta = [did, cat, x.where && String(x.where).split(',')[0], x.at && ago(x.at)].filter(Boolean).join(' · ');
      return `<div class="row in-row">
        <span class="who" aria-hidden="true">${esc(String(x.from || '?')[0].toUpperCase())}</span>
        <div class="row-body">
          <div class="row-name">${esc(x.name)}</div>
          ${x.note ? `<div class="row-note wrap">${esc(x.note)}</div>` : ''}
          <div class="row-meta">${esc(meta)}</div>
        </div>
        <button class="row-act" data-in-save="${esc(id)}">Save</button>
        <button class="in-x" data-in-drop="${esc(id)}" aria-label="Not for me">${ICON.x}</button>
      </div>`;
    }).join('')}</div>
  </section>`;
}

// Everything from a friend is untrusted: known categories, web links, short text only
function inboxSave(id) {
  const x = inbox[id];
  if (!x) return;
  const now = Date.now();
  const rec = {
    name: String(x.name).slice(0, 200), category: knownCat(x.category, x), note: String(x.note || '').slice(0, 500),
    from: String(x.from || '').slice(0, 40), where: String(x.where || '').slice(0, 100), link: webUrl(x.link), image: '',
    status: 'todo', createdAt: now, updatedAt: now,
  };
  if (x.city) rec.city = String(x.city).slice(0, 80);
  if (Number(x.lat) && Number(x.lng)) Object.assign(rec, { lat: Number(x.lat), lng: Number(x.lng), geo: 'ok', geoV: GEO_VERSION });
  items[store.add(rec)] = rec;
  store.dropInbox(id);
  delete inbox[id];
  render();
  track('inbox_save', rec.category);
  toast(`Saved ${rec.name}`);
}

function inboxDrop(id) {
  const x = inbox[id];
  if (!x) return;
  store.dropInbox(id);
  delete inbox[id];
  render();
  toast(`Let ${x.name} go`);
}

// The top of every Share sheet: send it to a friend
function friendsCard() {
  const fs = friendList();
  if (!fs.length) {
    return `<div class="pub-card"><button class="pub-head" data-friends>
      <span><b>Send to a friend</b><small>Add friends to send recs straight into their Recs</small></span>${ICON.chevron}</button></div>`;
  }
  return `<h3 class="sheet-sub first">Send to a friend</h3>
    <div class="send-chips">${fs.map(f => `<button class="chip" data-send="${esc(f.name)}">${esc(f.by)}</button>`).join('')}</div>`;
}

function openFriends() {
  detailId = null;
  shareState = null;
  drawFriends();
  openSheet();
}

function drawFriends() {
  const url = pubCfg.name ? pubUrl(pubCfg.name) : '';
  const fs = friendList();
  $('sheet').innerHTML = `${sheetHead('Friends')}
    <p class="hint">Friends can send recs straight into each other's Recs. To add someone, open their link and tap Add. To be added, send them yours.</p>
    ${url ? `<div class="pub-card"><a class="pub-link first" href="${esc(url)}">${esc(prettyUrl(url))}</a><button class="btn wide" data-invite>Send my link</button></div>` : '<button class="btn wide" data-invite>Invite a friend</button>'}
    ${fs.length ? `<h3 class="sheet-sub">${fs.length} ${fs.length === 1 ? 'friend' : 'friends'}</h3>
      <div class="list opts">${fs.map(f => `<div class="opt friend-opt">
        <a class="opt-name" href="#/@${esc(f.name)}">${esc(f.by)} <small>@${esc(f.name)}</small></a>
        <button class="link-btn danger" data-unfriend="${esc(f.name)}">Remove</button>
      </div>`).join('')}</div>` : ''}`;
  delete $('sheet').dataset.id;
  $('sheet').dataset.view = 'friends';
}

// ── Ideas: anyone can suggest one, everyone votes, the owner marks what's planned and done ──
let ideas = {};
let ideasOn = false;
const IDEA_STATUS = ['', 'planned', 'building', 'done'];
const IDEA_LABEL = { planned: 'Planned', building: 'Building', done: 'Done' };

function openIdeas() {
  detailId = null;
  shareState = null;
  if (!ideasOn) { ideasOn = true; store.listenIdeas(v => { ideas = v; redrawSheet(); }); }
  drawIdeas();
  openSheet();
}

function drawIdeas() {
  // Keep what you're typing when the list updates under you
  const draft = $('ideaText')?.value || '';
  const typing = document.activeElement?.id === 'ideaText';
  const list = Object.entries(ideas).filter(([, x]) => x?.text)
    .map(([id, x]) => ({ id, ...x, n: Object.keys(x.votes || {}).length, mine: !!x.votes?.[store.uid] }))
    .sort((a, b) => (a.status === 'done') - (b.status === 'done') || b.n - a.n || (b.at || 0) - (a.at || 0));
  const row = x => `<div class="idea">
      <button class="vote ${x.mine ? 'on' : ''}" data-vote="${esc(x.id)}" aria-pressed="${x.mine}" aria-label="Vote, ${x.n} so far">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5l8 10H4z"/></svg><span>${x.n}</span>
      </button>
      <div class="row-body">
        <div class="idea-text">${esc(x.text)}</div>
        <div class="row-meta">${esc([x.by, x.at && ago(x.at)].filter(Boolean).join(' · '))}</div>
      </div>
      ${isAdmin ? `<button class="status-chip ${x.status || 'unset'}" data-idea-status="${esc(x.id)}">${IDEA_LABEL[x.status] || '+ status'}</button>`
        : x.status ? `<span class="status-chip ${x.status}">${IDEA_LABEL[x.status]}</span>` : ''}
    </div>`;
  $('sheet').innerHTML = `${sheetHead('Ideas')}
    <p class="hint">What would make Recs better? Add an idea, or vote for the ones you want most.</p>
    <label class="field"><textarea id="ideaText" rows="2" maxlength="500" placeholder="I wish Recs could…" aria-label="Your idea">${esc(draft)}</textarea></label>
    <button class="btn wide" data-idea-send>Add idea</button>
    ${list.length ? `<div class="list ideas">${list.map(row).join('')}</div>` : '<p class="hint">No ideas yet. Be the first.</p>'}`;
  delete $('sheet').dataset.id;
  $('sheet').dataset.view = 'ideas';
  if (typing) { const t = $('ideaText'); t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
}

function sendIdea() {
  const t = $('ideaText');
  const text = t.value.trim();
  if (text.length < 3) { t.focus(); return; }
  // Cleared first, so the list redrawing under it can't bring the text back
  t.value = '';
  t.blur();
  store.addIdea({ uid: store.uid, by: firstName(), text: text.slice(0, 500), at: Date.now() })
    .then(() => { track('idea'); toast('Thanks. Your idea is on the list.'); },
      () => { if ($('ideaText')) $('ideaText').value = text; toast('Ideas need the new database rules'); });
}

// ── Usage: what people do, counted per day ──
function track(e, cat) {
  if (!stats) return;
  const keys = [e];
  if (cat) keys.push(`${e}~${slug(cat)}`);
  stats.bump(isoDay(Date.now()), keys, store?.uid || '');
}

const SUM = (days, data, k) => days.reduce((n, d) => n + (data[d]?.n?.[k] || 0), 0);
const PEOPLE = (days, data) => new Set(days.flatMap(d => Object.keys(data[d]?.u || {}))).size;

async function renderUsage() {
  $('login').classList.add('hidden');
  $('app').classList.add('hidden');
  $('sharedView').classList.remove('hidden');
  closeSheet();
  document.title = 'Usage';
  const v = $('sharedView');
  v.dataset.key = '';
  if (store && isAdmin === null) { v.innerHTML = ''; return; }  // still asking; drawn again once we know
  if (!store || !isAdmin) { drawMissing('Nothing here', 'Usage is only for the owner.'); return; }
  const days = Array.from({ length: 30 }, (_, i) => isoDay(Date.now() - (29 - i) * 864e5));
  let data = {};
  try { data = await stats.read(days[0]); } catch { drawMissing('Usage didn\'t load', 'The database rules may need the stats part.'); return; }
  if (route().view !== 'usage') return;
  const last = days.slice(-7), prev = days.slice(-14, -7);
  const tile = (label, cur, before) => {
    const d = cur - before;
    return `<div class="kpi"><span class="kpi-label">${label}</span><span class="kpi-num">${cur}</span>
      <span class="kpi-was">${d === 0 ? 'same as' : d > 0 ? `up ${d} from` : `down ${-d} from`} ${before} the week before</span></div>`;
  };
  const sumBoth = keys => [last, prev].map(ds => keys.reduce((n, k) => n + SUM(ds, data, k), 0));
  const [aNow, aWas] = [PEOPLE(last, data), PEOPLE(prev, data)];
  const tiles = [
    ['People', aNow, aWas], ['Added', ...sumBoth(['add'])], ['Tried or loved', ...sumBoth(['tried', 'loved'])],
    ['Shared', ...sumBoth(['share_list', 'share_page', 'send'])], ['Page views', ...sumBoth(['page_view'])], ['Saved from friends', ...sumBoth(['inbox_save', 'page_save'])],
  ].map(t => tile(...t)).join('');
  const daily = days.map(d => PEOPLE([d], data));
  const top = Math.max(1, ...daily);
  const fmt = d => new Date(d + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const bars = days.map((d, i) => `<span class="bar" style="--h:${daily[i] / top}" data-tip="${esc(fmt(d))}: ${daily[i]} ${daily[i] === 1 ? 'person' : 'people'}" title="${esc(fmt(d))}: ${daily[i]}"></span>`).join('');
  const cats = CATEGORIES.map(c => [c.id, SUM(days, data, `add~${slug(c.id)}`), SUM(days, data, `loved~${slug(c.id)}`)]).filter(c => c[1] || c[2]).sort((a, b) => b[1] - a[1] || b[2] - a[2]);
  const cmax = Math.max(1, ...cats.map(c => c[1]));
  const swipes = sumBoth(['swipe'])[0], ideasN = sumBoth(['idea'])[0];
  const anyData = days.some(d => data[d]);
  v.innerHTML = `
    <header class="shared-head">
      <p class="eyebrow">Recs${DEMO ? ' · sample, this browser only' : ''}</p>
      <h1>Usage</h1>
      <p class="trip-sub">Last 7 days, against the 7 before. ${PEOPLE(days, data)} ${PEOPLE(days, data) === 1 ? 'person' : 'people'} in 30 days.</p>
    </header>
    ${anyData ? '' : '<p class="hint">No counts yet. They start as people use this version of the app.</p>'}
    <div class="kpis">${tiles}</div>
    <h2 class="pub-h">People each day</h2>
    <div class="chart">
      <span class="chart-max">${top}</span>
      <div class="bars" role="img" aria-label="People active each day, last 30 days, most ${top}">${bars}</div>
      <div class="chart-axis"><span>${fmt(days[0])}</span><span id="barTip" aria-live="polite">Tap a bar</span><span>Today</span></div>
    </div>
    ${cats.length ? `<h2 class="pub-h">What people add, 30 days</h2>
      <div class="list rank">${cats.map(([c, n, l]) => `<div class="rank-row">
        <span class="rank-name">${esc(c)}</span>
        <span class="rank-bar"><i style="--w:${n / cmax}"></i></span>
        <span class="rank-num">${n}${l ? ` <small>· ${l} loved</small>` : ''}</span>
      </div>`).join('')}</div>` : ''}
    <p class="hint usage-foot">This week: ${swipes} swipes, ${ideasN} new ${ideasN === 1 ? 'idea' : 'ideas'}. Counts only, never what anyone saved.</p>
    <div class="shared-foot"><button class="btn sec wide" data-ideas>Open ideas</button>${footNote()}</div>`;
}

// ── Adding ──
function updatePreview() {
  const input = $('addInput');
  const raw = input.value;
  const text = raw.trim();
  const box = $('preview');
  if (!text) {
    override = null;
    sendMode(null);
    $('picker').classList.add('hidden');
    const show = document.activeElement === input;
    box.innerHTML = show ? `<p class="pv-formula">${formula()}</p>` : '';
    box.classList.toggle('hidden', !show);
    return;
  }
  const p = parse(text, override, route().cat, logging());
  const place = CAT[p.category].action === 'map' || p.category === 'Other';
  const part = (w, v) => `<span class="pv-part"><i>${w}</i> ${esc(v)}</span>`;
  // No "+ for" while you're already typing a "for" name
  const typingKw = raw.match(/(?:^|[\s,])(from|in|near|for)\s+[^,;.]*$/i)?.[1].toLowerCase();
  const add = w => w === typingKw ? '' : `<button class="pv-add" data-insert="${w}">+ ${w}</button>`;
  const when = logging() ? `<span class="pv-status">${status === 'loved' ? 'Loved' : 'Tried'}${p.beenAt ? ' yesterday' : ''}</span>` : '';
  const sugg = suggestions(raw);
  box.innerHTML = `
    ${sugg ? `<div class="pv-sugg">${sugg}</div>` : ''}
    <div class="pv-row">
      <button class="pv-cat" data-pick>${esc(p.category)}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      ${when}
      ${p.name ? `<span class="pv-name">${esc(p.name)}</span>` : ''}
      ${p.where ? part('in', p.where) : ''}
      ${p.from ? part('from', p.from) : ''}
      ${p.note ? `<span class="pv-note">${esc(p.note)}</span>` : ''}
      ${p.link ? '<span class="pv-part"><i>link</i></span>' : ''}
      ${p.to ? `<span class="pv-part to"><i>for</i> ${esc(p.to.by)}</span>` : ''}
      ${!p.where && place && !logging() ? add('in') : ''}
      ${!p.from && !p.to ? add('from') : ''}
      ${!p.to && !logging() && friendList().length ? add('for') : ''}
    </div>`;
  box.classList.remove('hidden');
  sendMode(p.to);
  // Typing at the end: keep the newest part in view
  const row = box.querySelector('.pv-row');
  if (input.selectionStart === raw.length) row.scrollLeft = row.scrollWidth;
  if (!$('picker').classList.contains('hidden')) renderPicker(p.category);
}

// The add button says what will happen: save it, or send it
function sendMode(to) {
  const b = $('addBtn');
  const mode = to ? 'send' : 'save';
  if (b.dataset.mode === mode) return;
  b.dataset.mode = mode;
  b.innerHTML = to ? ICON.send : ICON.plus;
  b.setAttribute('aria-label', to ? `Send to ${to.by}` : 'Save');
  b.classList.toggle('sending', !!to);
}

// Right after "from", "in" or "for", the people, places and friends you've used before, so names stay spelled one way
function suggestions(raw) {
  const m = raw.match(/(?:^|[\s,])(from|in|near|for)\s+([^,;.]*)$/i);
  if (!m) return '';
  const kw = m[1].toLowerCase();
  const typed = m[2].trim().toLowerCase();
  const seen = new Map();
  if (kw === 'for') for (const f of friendList()) seen.set(f.by.toLowerCase(), { v: f.by, n: 1 });
  else for (const r of all()) {
    for (const v of kw === 'from' ? [r.from] : [hoodOf(r), cityOf(r)]) {
      if (!v) continue;
      const k = v.toLowerCase();
      const e = seen.get(k) || { v, n: 0 };
      e.n++;
      seen.set(k, e);
    }
  }
  const hits = [...seen.values()]
    .filter(e => e.v.toLowerCase().startsWith(typed) && e.v.toLowerCase() !== typed)
    .sort((a, b) => b.n - a.n || a.v.localeCompare(b.v))
    .slice(0, 6);
  return hits.map(e => `<button class="chip" data-complete="${esc(e.v)}">${esc(e.v)}</button>`).join('');
}

// "+ from" adds the word for you; a suggestion finishes the name you started
function insertWord(w) {
  const input = $('addInput');
  input.value = `${input.value.replace(/[\s,]+$/, '')}, ${w} `;
  caretEnd(input);
}

function complete(v) {
  const input = $('addInput');
  input.value = input.value.replace(/((?:^|[\s,])(?:from|in|near|for)\s+)[^,;.]*$/i, (_, a) => a + v);
  caretEnd(input);
}

function caretEnd(input) {
  input.focus();
  const n = input.value.length;
  input.setSelectionRange(n, n);
  input.scrollLeft = input.scrollWidth;
  updatePreview();
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
  // Written for a friend: it goes to them, not into your list
  if (p.to) {
    sendTo(p.to, [{ name: p.name, category: p.category, note: p.note, where: p.where, link: p.link, status: 'todo' }]).then(ok => { if (ok) done(); });
    return;
  }
  const dupe = all().find(r => r.name.toLowerCase() === p.name.toLowerCase() && (r.category === p.category || p.auto));
  // Logging a place you'd saved as a rec ticks off the rec instead of making a second one
  if (dupe && been) {
    const fields = { status, beenAt: p.beenAt || Date.now(), beenPrec: null };
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
  track('add', p.category);
  if (been) track(status, p.category);

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
  $('addInput').addEventListener('focus', updatePreview);
  $('addInput').addEventListener('blur', () => { if (!$('addInput').value.trim()) updatePreview(); });
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
    if (e.target.dataset.pubKind) { setPublic(e.target.dataset.pubKind, e.target.dataset.pubLabel, e.target.checked); return; }
    if (['dDayD', 'dDayM', 'dDayY'].includes(e.target.id) && detailId) { setWhen(detailId); return; }
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
    if (swiped) { swiped = false; e.preventDefault(); return; }
    if (t.closest('a')) return;

    const el = t.closest('[data-in-save],[data-in-drop],[data-send],[data-friends],[data-unfriend],[data-ideas],[data-vote],[data-idea-send],[data-idea-status],[data-add-friend],[data-pub-manage],[data-insert],[data-complete],[data-pub-share],[data-toggle-city],[data-share-list],[data-share-one],[data-share-go],[data-invite],[data-save],[data-save-all],[data-go-home],[data-cat],[data-open],[data-example],[data-status],[data-status-filter],[data-places],[data-place],[data-unpinned],[data-focus],[data-setcat],[data-delete],[data-close],[data-pick],[data-pickcat],[data-signout]');
    if (!el) return;
    const d = el.dataset;

    if (d.inSave !== undefined) inboxSave(d.inSave);
    else if (d.inDrop !== undefined) inboxDrop(d.inDrop);
    else if (d.send !== undefined) {
      const f = friendList().find(x => x.name === d.send);
      if (f && shareState) sendTo(f, shareState.recs).then(ok => { if (ok) { el.classList.add('on'); el.disabled = true; el.textContent = `Sent to ${f.by}`; } });
    }
    else if (d.friends !== undefined) openFriends();
    else if (d.unfriend !== undefined) { store.setFriend(d.unfriend, null); const f = friends[d.unfriend]; friends = { ...friends }; delete friends[d.unfriend]; drawFriends(); toast(`Removed ${f?.by || d.unfriend}`); }
    else if (d.ideas !== undefined) openIdeas();
    else if (d.vote !== undefined) { const x = ideas[d.vote]; const on = !x?.votes?.[store.uid]; store.vote(d.vote, on).catch(() => toast('Voting needs the new database rules')); if (on) track('vote'); }
    else if (d.ideaSend !== undefined) sendIdea();
    else if (d.ideaStatus !== undefined && isAdmin) { const cur = ideas[d.ideaStatus]?.status || ''; store.ideaStatus(d.ideaStatus, IDEA_STATUS[(IDEA_STATUS.indexOf(cur) + 1) % IDEA_STATUS.length]); }
    else if (d.addFriend !== undefined) addFriend(d.addFriend);
    else if (d.insert !== undefined) insertWord(d.insert);
    else if (d.complete !== undefined) complete(d.complete);
    else if (d.pubShare !== undefined) sharePub(d.pubShare);
    else if (d.toggleCity !== undefined) toggleCity(el);
    else if (d.shareList !== undefined) {
      const recs = scope().filter(r => statusMatch(r) && placeMatch(r)).sort(byRecent);
      const r = route();
      const page = r.view === 'cat' && SHELF_CATS.includes(r.cat) ? { kind: 'shelf', label: r.cat }
        : place.city ? { kind: 'trip', label: place.city } : null;
      openShare(recs, listTitle(recs), page);
    }
    else if (d.shareOne !== undefined) { const r = { id: detailId, ...items[detailId] }; openShare([r], r.name, pageOf(r)); }
    else if (d.pubManage !== undefined) openPublic();
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
      if (d.status !== 'todo') track(d.status, items[detailId].category);
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
  bindSwipe();

  // Usage chart: hover or tap a bar to read it
  const readBar = e => { const b = e.target.closest?.('.bar[data-tip]'); if (b && $('barTip')) $('barTip').textContent = b.dataset.tip; };
  document.addEventListener('pointerover', readBar);
  document.addEventListener('click', readBar);
}

// Saves from before a category split are moved once, in place
function migrate() {
  for (const [id, r] of Object.entries(items)) {
    if (r.category !== 'Movies & TV') continue;
    const category = splitMoviesTv(r);
    items[id] = { ...r, category };
    store.update(id, { category });
  }
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
  store.listen(data => { items = data; migrate(); loaded = true; render(); queueGeo(); syncPub(); });
  let claimed = false;
  store.listenPublic(v => {
    pubCfg = v || {};
    // Everyone gets a short name once, so friends can find them; quietly, and only if the rules allow it
    if (!pubCfg.name && !claimed) {
      claimed = true;
      claimName(firstName()).then(name => { pubErr = ''; if (name && !pubCfg.name) savePublic({ ...pubCfg, name }); });
    }
    syncPub();
    redrawSheet();
  });
  store.listenFriends(v => { friends = v || {}; if (route().view === 'pub') { $('sharedView').dataset.key = ''; renderPub(); } redrawSheet(); });
  store.listenInbox(v => { inbox = v || {}; takeNotices(); if (route().view === 'home') render(); });
  store.isAdmin().then(v => { isAdmin = v; if (route().view === 'usage') renderUsage(); });
  track('open');
}

// Shared links open for anyone; everything else needs signing in
function paint() {
  if (route().view === 'shared') renderShared();
  else if (route().view === 'pub') renderPub();
  else if (route().view === 'usage' && store) renderUsage();
  else if (store) render();
  else { $('sharedView').classList.add('hidden'); $('app').classList.add('hidden'); $('login').classList.remove('hidden'); }
}

if (navigator.standalone || matchMedia('(display-mode: standalone)').matches) $('loginTip').classList.add('hidden');

bindEvents();

if (DEMO) {
  pub = demoPub();
  stats = demoStats();
  start(demoStore(), { displayName: 'Demo', email: 'Sample data, saved only in this browser. Sign out resets it.' });
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  setPersistence(auth, indexedDBLocalPersistence).catch(() => setPersistence(auth, browserLocalPersistence));
  const db = getDatabase(app);
  pub = firebasePub(db);
  stats = firebaseStats(db);
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
