# Deploying the Sole Stock backend (free, on Cloudflare)

> **Already deployed your backend before?** You don't need to redo any of
> this. Instead: run
> `wrangler d1 execute sole-stock-db --remote --file=./add-password-reset.sql`
> once, then do Step 6 and Step 9 below (recovery key + first password),
> then `wrangler deploy` to push the updated `src/index.js`. Skip
> everything else on this page.

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

**6. Set your recovery key (kept secret, never stored in code)**
```
wrangler secret put ADMIN_RECOVERY_KEY
```
This is NOT your login password — it's a separate, rarely-used master key
that only exists to reset your login password if you ever forget it.
Type a long, random string (mash the keyboard, or use a password
manager's "generate password" feature), press enter, then **save it
somewhere safe** — a password manager or a written note. You'll almost
never need it day-to-day, but without it, a forgotten login password
can't be recovered without redoing this step.

**7. Deploy**
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

**8. Update ALLOWED_ORIGINS**

In `wrangler.toml`, replace the two placeholder URLs in `ALLOWED_ORIGINS`
with the real URLs of your public site and your admin panel once you know
them (e.g. `https://your-username.github.io` and
`https://sole-stock-admin.pages.dev`). Then run `wrangler deploy` again.

**9. Set your actual login password**

Your login password isn't set by any command — it's set through the admin
panel itself, using the recovery key from Step 6:

1. Open your admin panel (once deployed — see the main README) and click
   **Forgot password?** on the login screen.
2. Enter your recovery key and choose the password you'll actually log in
   with day to day.
3. Click **Set new password** — you can now log in normally.

This same screen is also exactly what you'd use later if you ever forget
your day-to-day password — no terminal needed at that point, just the
recovery key from Step 6.

---

## Making a change later
Whenever you edit `src/index.js` or `wrangler.toml`, just run
`wrangler deploy` again to push the update live. No downtime, takes a few
seconds.
