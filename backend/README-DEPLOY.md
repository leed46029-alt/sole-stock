# Deploying the Sole Stock backend (free, on Cloudflare)

This is the part that makes the admin panel and stats possible. It's a
one-time setup — after this, you'll rarely touch it again.

## What you need first
- A free Cloudflare account (the same one from the images setup)
- [Node.js](https://nodejs.org) installed on your computer (the "LTS" version)

## Steps

**1. Install the Cloudflare CLI tool (wrangler)**

Open a terminal (Command Prompt / Terminal app) and run:
```
npm install -g wrangler
```

**2. Log in**
```
wrangler login
```
This opens a browser tab — click "Allow" to connect your Cloudflare account.

**3. Go into this backend folder**
```
cd path/to/backend
```

**4. Create the database**
```
wrangler d1 create sole-stock-db
```
This prints something like:
```
database_id = "1a2b3c4d-...."
```
Copy that `database_id` value into `wrangler.toml`, replacing
`REPLACE_WITH_YOUR_DATABASE_ID`.

**5. Create the tables (and a few sample shoes)**
```
wrangler d1 execute sole-stock-db --remote --file=./schema.sql
```

**6. Point to your R2 bucket**

If you already created the `sole-stock-images` bucket from the earlier
image-hosting setup, this step is done — `wrangler.toml` already references
it by name. Just update `R2_PUBLIC_BASE` in `wrangler.toml` to match your
real `pub-xxxxxxxx.r2.dev` URL from that bucket's settings.

If you haven't created the bucket yet:
```
wrangler r2 bucket create sole-stock-images
```
Then enable public access (R2.dev subdomain) in the Cloudflare dashboard
under that bucket's Settings, and copy the URL into `R2_PUBLIC_BASE`.

**7. Set your admin password (kept secret, never stored in code)**
```
wrangler secret put ADMIN_PASSWORD
```
Type the password you'll use to log into the admin panel, press enter.

**8. Deploy**
```
wrangler deploy
```
This prints your live API URL, something like:
```
https://sole-stock-api.your-name.workers.dev
```
**Save this URL** — you'll paste it into both the public site's `app.js`
and the admin panel's `app.js` (both have a line near the top marked
`const API_BASE = "..."`).

**9. Update ALLOWED_ORIGINS**

In `wrangler.toml`, replace the two placeholder URLs in `ALLOWED_ORIGINS`
with the real URLs of your public site and your admin panel once you know
them (e.g. `https://your-username.github.io` and
`https://sole-stock-admin.pages.dev`). Then run `wrangler deploy` again.

---

## Making a change later
Whenever you edit `src/index.js` or `wrangler.toml`, just run
`wrangler deploy` again to push the update live. No downtime, takes a few
seconds.
