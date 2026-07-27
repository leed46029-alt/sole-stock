# Sole Stock — full setup guide

You now have three folders:

- **backend/** — the Cloudflare Worker + database + image storage. Deploy this first.
- **public/** — your customer-facing catalog (put this on GitHub Pages, same as before).
- **admin/** — your private, installable admin panel (put this on Cloudflare Pages).

Do them in this order — each one depends on the last.

---

## Step 1 — Deploy the backend

Follow `backend/README-DEPLOY.md` fully. At the end you'll have:
- A live API URL like `https://sole-stock-api.your-name.workers.dev`
- An admin password you chose
- 6 sample shoes already in the database (delete them later from the admin panel)

**Don't continue until this step gives you a working API URL.**

---

## Step 2 — Put the API URL into both front-ends

Open these two files and replace the placeholder on the `API_BASE` line near
the top with your real Worker URL from Step 1:
- `public/app.js`
- `admin/app.js`

---

## Step 3 — Put the public site on GitHub Pages

Same as before:
1. Create (or reuse) a GitHub repo.
2. Upload `index.html`, `styles.css`, `app.js` from the `public/` folder.
3. Settings → Pages → deploy from `main` branch, root folder.
4. Your site is live at `https://your-username.github.io/repo-name/`.

You don't need `products.js` anymore — shoes now come live from the
database, so this file has been removed from `public/`.

---

## Step 4 — Put the admin panel on Cloudflare Pages

The admin panel needs its own separate address (never mix it into the
public repo, so customers can't stumble onto it):

1. In the Cloudflare dashboard, go to **Workers & Pages** → **Create** →
   **Pages** → **Upload assets** (the simplest option — no GitHub needed).
2. Name the project e.g. `sole-stock-admin`.
3. Upload every file from the `admin/` folder:
   `index.html`, `styles.css`, `app.js`, `manifest.json`, `sw.js`,
   `icon-192.png`, `icon-512.png`.
4. Deploy. Cloudflare gives you a URL like
   `https://sole-stock-admin.pages.dev`.

That URL is your admin panel. Bookmark it — nobody else will find it
unless you share it, and it's still protected by your password either way.

---

## Step 5 — Let the backend accept requests from both sites

Open `backend/wrangler.toml`, and set `ALLOWED_ORIGINS` to your two real
URLs from Steps 3 and 4, comma-separated, no spaces, e.g.:
```
ALLOWED_ORIGINS = "https://your-username.github.io,https://sole-stock-admin.pages.dev"
```
Then, back in the `backend/` folder, run:
```
wrangler deploy
```

---

## Step 6 — Install the admin panel on your phone

Open the admin panel URL in Chrome (Android) or Safari (iPhone) on your
phone.
- **Android/Chrome**: tap the ⋮ menu → "Add to Home screen" (or you'll see
  an automatic install banner).
- **iPhone/Safari**: tap the Share icon → "Add to Home Screen".

It now opens like a normal app, full screen, with an icon — no browser bar.

---

## Using it day to day

- **Add a shoe**: open the admin panel → Products tab → fill the form,
  attach a photo, tap Save. It appears on the live site within seconds.
- **Edit or remove a shoe**: tap Edit or Delete next to any shoe in the list.
- **Check performance**: Dashboard tab shows total visits, total WhatsApp
  clicks, and a breakdown of clicks per shoe — so you can see which shoes
  people are actually interested in.

## A few honest notes
- This uses entirely free Cloudflare tiers (Workers, D1, R2, Pages) at the
  traffic levels a small shop catalog would see. If the shop grows a lot,
  Cloudflare will tell you before anything breaks or costs money.
- The password protects the admin panel, but treat the admin URL itself as
  private too — don't post it publicly.
- "Visits" count every page load; it's a simple counter, not unique
  visitors — good enough to see trends, not a full analytics suite.
