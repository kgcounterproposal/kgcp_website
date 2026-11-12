# KGCP Print Works site

A static catalog site for the Etsy shop. All purchases happen on Etsy.

## How it works

```
GitHub Actions (every 2 hours)
  └─ scripts/fetch-listings.mjs  →  ~5 Etsy API calls  →  site/data/listings.json
  └─ deploys site/ to GitHub Pages
Visitor's browser  →  static files only (never calls the Etsy API)
```

- **API limits:** about 60 calls a day against a limit in the thousands, no matter how many visitors you get.
  Calls run one at a time with a 300 ms gap, and a 429 response waits for Etsy's `retry-after`.
- **6-hour freshness rule:** Etsy's API terms cap listing content at 6 hours old. The feed refreshes every 2 hours.
  If refreshes ever stop, the site hides the catalog once the feed passes 6 hours and points visitors to the Etsy shop.
- **No server, no database, no dependencies.** Node 22 is only needed to run the fetch script.

## Go live (about 15 minutes)

1. Create a **public** GitHub repo and push this folder to the `main` branch. (Pages is free on public repos. Your keys stay private in step 3.)
2. Repo **Settings > Pages > Source: GitHub Actions**.
3. Repo **Settings > Secrets and variables > Actions**, add two secrets from your Etsy app
   (etsy.com/developers > Your Apps). The app you already use for n8n works:
   - `ETSY_API_KEY` = the keystring
   - `ETSY_SHARED_SECRET` = the shared secret
4. **Actions > Refresh listings and deploy > Run workflow.** The site appears at `https://<user>.github.io/<repo>/`.
5. Optional custom domain: Settings > Pages > Custom domain. Do not put "etsy" in the domain name.

GitHub pauses scheduled workflows after 60 days with no repo activity and emails you first. Any commit, or clicking "Enable workflow", resumes it.

## Preview on your PC

```
node scripts/fetch-listings.mjs --mock        # sample data + self-check
node --env-file=.env scripts/fetch-listings.mjs   # or real data (.env holds the two keys)
npx serve site                                # or: python -m http.server -d site
```

## Things to set in `site/config.js`

| Setting | What it does |
|---|---|
| `promises` | The three facts under the hero. Keep them true for every listing. |
| `instagram` | Your handle. Shows the Instagram block. |
| `promo` | A code shown to people who win the matching game. Create it in Etsy first. |
| `poll` | Question and options. Votes post to a Google Form, so results land in a Google Sheet. |
| `ads` | AdSense IDs. Read the note below first. |

### Poll setup
Create a Google Form with one multiple-choice question whose options match `poll.options` exactly.
Open the form's "Get pre-filled link", pick an option, and copy the link: the `entry.123456` part is `entry`,
and `formAction` is the form URL ending in `/formResponse` instead of `/viewform`.

### A note on ads
Etsy's API Terms say you may not use the API to connect with any third-party advertising or marketing platform.
They don't spell out whether an ad network may run on the same site that shows API data, so ads are **off** by default
and the one ad slot sits in the Play section, away from the listings. Email developer@etsy.com and get a yes in
writing before filling in `ads`. Ads also send shoppers away from your own products, so measure whether they earn more than they cost.

## Etsy rules this site follows
- Trademark notice in the footer, and "Etsy" never appears in the site name.
- Listing data comes only from the API (no scraping) and is never older than 6 hours.
- Only your own shop's listings are shown, and every one links to its Etsy page.
- `privacy.html` covers the privacy policy the API terms ask for. Edit it if you add analytics or ads.
