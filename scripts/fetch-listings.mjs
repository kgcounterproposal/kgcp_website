// Pulls the shop's active listings from the Etsy API and writes site/data/listings.json.
// Visitors never touch the Etsy API: this runs on a schedule (see .github/workflows/deploy.yml).
//   node --env-file=.env scripts/fetch-listings.mjs     real run (ETSY_API_KEY, ETSY_SHARED_SECRET)
//   node scripts/fetch-listings.mjs --mock              fake data for local preview + self-check
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const SHOP = 'kgcpprintworks';
const BASE = 'https://api.etsy.com/v3/application';
const OUT = new URL('../site/data/listings.json', import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let calls = 0;
async function api(path) {
  const key = `${process.env.ETSY_API_KEY}:${process.env.ETSY_SHARED_SECRET}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(300); // sequential + 300ms gap keeps us far below the per-second limit
    const res = await fetch(BASE + path, { headers: { 'x-api-key': key } });
    calls++;
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after')) || 2 ** attempt * 5;
      console.warn(`429 from Etsy, waiting ${wait}s`);
      await sleep(wait * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`Etsy ${res.status} on ${path}: ${(await res.text()).slice(0, 300)}`);
    console.log(`${path.split('?')[0]}  (daily quota left: ${res.headers.get('x-remaining-today') ?? '?'})`);
    return res.json();
  }
  throw new Error(`Still rate limited after retries: ${path}`);
}

const decode = (s = '') =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(n))
   .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const https = (u) => (typeof u === 'string' && u.startsWith('https://') ? u : null);

// Etsy listing -> the few fields the site shows. Exported shape is the site's whole contract.
export function slim(l) {
  const desc = decode(l.description).trim();
  const cut = desc.slice(0, 500);
  return {
    id: l.listing_id,
    title: decode(l.title),
    url: https(l.url),
    price: l.price.amount / l.price.divisor,
    currency: l.price.currency_code,
    from: Boolean(l.has_variations),
    section: l.shop_section_id ?? null,
    favs: l.num_favorers ?? 0,
    created: l.original_creation_timestamp ?? 0,
    tags: l.tags ?? [],
    desc: desc.length > 500 ? cut.slice(0, Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf('. ') + 1) || 500).trim() : desc,
    images: (l.images ?? [])
      .sort((a, b) => a.rank - b.rank)
      .map((i) => ({ sm: https(i.url_570xN), lg: https(i.url_fullxfull), alt: decode(i.alt_text ?? '') }))
      .filter((i) => i.sm),
  };
}

async function fromEtsy() {
  if (!process.env.ETSY_API_KEY || !process.env.ETSY_SHARED_SECRET)
    throw new Error('Set ETSY_API_KEY and ETSY_SHARED_SECRET (or run with --mock).');
  const shops = await api(`/shops?shop_name=${SHOP}`);
  const shop = shops.results.find((s) => s.shop_name.toLowerCase() === SHOP);
  if (!shop) throw new Error(`Shop "${SHOP}" not found`);

  const sections = (await api(`/shops/${shop.shop_id}/sections`)).results;
  const ids = [];
  for (let offset = 0, total = 1; offset < total; offset += 100) {
    const page = await api(`/shops/${shop.shop_id}/listings/active?limit=100&offset=${offset}`);
    total = page.count;
    ids.push(...page.results.map((l) => l.listing_id));
  }
  const listings = [];
  for (let i = 0; i < ids.length; i += 100)
    listings.push(...(await api(`/listings/batch?listing_ids=${ids.slice(i, i + 100).join(',')}&includes=Images`)).results);
  return { shop, sections, listings };
}

function mock() {
  const art = (hue, label) => 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 570 570"><rect width="570" height="570" fill="hsl(${hue} 80% 88%)"/>` +
    `<circle cx="285" cy="260" r="150" fill="hsl(${hue} 85% 55%)"/><text x="285" y="500" font-family="sans-serif" font-size="40" font-weight="700" text-anchor="middle" fill="#1A1B4B">${label}</text></svg>`);
  const kinds = [['Tee', 11], ['Sticker', 12], ['Hoodie', 13], ['Water bottle', 14], ['Basketball shorts', 15]];
  const names = ['Sunday Reset', 'Plant Parent', 'Low Battery', 'Court Vision', 'Night Shift', 'Snack Break', 'Good Trouble', 'Slow Morning'];
  const listings = names.flatMap((n, i) => kinds.slice(0, i % 2 ? 3 : 5).map(([kind, sec], k) => ({
    listing_id: 1000 + i * 10 + k,
    title: `${n} ${kind} &quot;sample&quot; listing`,
    description: `Sample description for the ${n} ${kind}.\nThis text comes from the listing on Etsy.\n\n` + 'More detail. '.repeat(60),
    url: `https://www.etsy.com/listing/${1000 + i * 10 + k}/sample`,
    price: { amount: [2400, 450, 4200, 2800, 3600][k] + i * 50, divisor: 100, currency_code: 'USD' },
    has_variations: kind !== 'Sticker',
    shop_section_id: sec,
    num_favorers: (i * 7 + k * 3) % 23,
    original_creation_timestamp: Math.floor(Date.now() / 1000) - (i * 5 + k) * 86400,
    tags: [n.toLowerCase(), kind.toLowerCase()],
    images: [{ rank: 2, url_570xN: art(i * 45 + 180, 'back'), url_fullxfull: art(i * 45 + 180, 'back') },
             { rank: 1, url_570xN: art(i * 45, kind), url_fullxfull: art(i * 45, kind), alt_text: `${n} ${kind}` }],
  })));
  return { shop: { shop_name: 'KGCPPrintWorks' }, sections: kinds.map(([title, shop_section_id], rank) => ({ title, shop_section_id, rank })), listings };
}

const isMock = process.argv.includes('--mock');
const raw = isMock ? mock() : await fromEtsy();
let listings = raw.listings.map(slim);

if (isMock) {
  // self-check of slim(), then restore the mock images the https filter (correctly) dropped
  const s = listings[0];
  assert.equal(s.title.includes('"sample"'), true, 'entities decoded');
  assert.equal(s.price, 24, 'amount/divisor');
  assert.ok(s.desc.length <= 500, 'description trimmed');
  assert.equal(s.images.length, 0, 'non-https image urls are dropped');
  assert.equal(slim({ ...raw.listings[0], url: 'javascript:alert(1)' }).url, null, 'bad listing url dropped');
  listings = listings.map((l, i) => ({ ...l, images: raw.listings[i].images.sort((a, b) => a.rank - b.rank).map((im) => ({ sm: im.url_570xN, lg: im.url_fullxfull, alt: im.alt_text ?? '' })) }));
  console.log('self-check passed');
}

await mkdir(new URL('.', OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({
  fetched_at: new Date().toISOString(),
  shop: { name: raw.shop.shop_name, url: `https://${SHOP}.etsy.com/` },
  sections: raw.sections.sort((a, b) => a.rank - b.rank).map((s) => ({ id: s.shop_section_id, title: decode(s.title) })),
  listings: listings.filter((l) => l.url && l.images.length),
}));
console.log(`Wrote ${listings.length} listings using ${calls} Etsy API calls.`);
