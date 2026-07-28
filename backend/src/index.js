/*
  SOLE STOCK API
  --------------
  One Cloudflare Worker serving:
    - Public endpoints the site (viewers) uses:
        GET  /api/products
        POST /api/track/visit
        POST /api/track/click
    - Admin endpoints the admin PWA uses (require a login token):
        POST   /api/admin/login
        POST   /api/admin/change-password  (requires login — old password + new password)
        POST   /api/admin/reset-password   (no login needed — recovery key + new password)
        GET    /api/admin/products
        POST   /api/admin/products        (JSON body — image is already a Cloudinary URL)
        PUT    /api/admin/products/:id     (JSON body — image is already a Cloudinary URL)
        DELETE /api/admin/products/:id
        GET    /api/admin/stats

  Your login password is NOT stored anywhere in this code — it lives only
  as a salted hash in the D1 database, set the first time via the
  "Forgot password?" flow in the admin panel itself.

  The one secret this file needs is ADMIN_RECOVERY_KEY — a long random
  string only you know, used only to reset your password if you ever
  forget it. Set it once, keep it written down somewhere safe (a notes
  app, a password manager), and you'll never need Antigravity or a
  terminal to regain access again:
    wrangler secret put ADMIN_RECOVERY_KEY
*/

// ---------- Two-layer product cache ----------
// Layer 1: module-level in-memory (survives across requests within the same
//          Worker isolate, ~30 s TTL, free).
// Layer 2: Cloudflare Cache API stored at the nearest edge PoP (~60 s TTL).
// Both layers are busted immediately whenever an admin writes a product.

const CACHE_TTL_MEMORY = 30;  // seconds
const CACHE_TTL_EDGE   = 60;  // seconds (Cache-Control max-age sent to CF edge)
const PRODUCTS_CACHE_KEY = "https://sole-stock-cache/api/products"; // fake key — never actually fetched

let memCache = null;       // { data: [...], expiresAt: <ms> }

function memCacheGet() {
  if (memCache && Date.now() < memCache.expiresAt) return memCache.data;
  return null;
}

function memCacheSet(data) {
  memCache = { data, expiresAt: Date.now() + CACHE_TTL_MEMORY * 1000 };
}

function memCacheBust() {
  memCache = null;
}

async function edgeCacheGet(cacheKey) {
  try {
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;
  } catch (_) { /* cache unavailable (local dev) — ignore */ }
  return null;
}

async function edgeCacheSet(cacheKey, jsonData, corsHeaders) {
  try {
    const resp = new Response(jsonData, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_TTL_EDGE}`,
        ...corsHeaders,
      },
    });
    await caches.default.put(cacheKey, resp);
  } catch (_) { /* ignore in local dev */ }
}

async function edgeCacheBust() {
  try {
    await caches.default.delete(PRODUCTS_CACHE_KEY);
  } catch (_) { /* ignore */ }
}

// ---------- Password hashing (PBKDF2-SHA256, salted) ----------
// Never store or compare plain-text passwords — only these hashes.

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function randomHex(byteLength) {
  const arr = new Uint8Array(byteLength);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations: 2000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

async function setAdminPassword(env, newPassword) {
  const salt = randomHex(16);
  const hash = await hashPassword(newPassword, salt);
  await env.DB.prepare(
    `INSERT INTO admin_settings (id, password_hash, password_salt, updated_at)
     VALUES (1, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       password_hash = excluded.password_hash,
       password_salt = excluded.password_salt,
       updated_at = excluded.updated_at`
  )
    .bind(hash, salt)
    .run();
  // Any password change invalidates all existing logins, including on
  // other devices — a reasonable safety default.
  await env.DB.prepare("DELETE FROM sessions").run();
}

async function verifyAdminPassword(env, password) {
  const row = await env.DB.prepare(
    "SELECT password_hash, password_salt FROM admin_settings WHERE id = 1"
  ).first();
  if (!row || !row.password_hash) return false;
  const attemptHash = await hashPassword(password, row.password_salt);
  return attemptHash === row.password_hash;
}

function corsHeaders(env, request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function requireAuth(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return false;
  const row = await env.DB.prepare(
    "SELECT token FROM sessions WHERE token = ? AND expires_at > datetime('now')"
  )
    .bind(token)
    .first();
  return !!row;
}

function productFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    sizes: row.sizes,
    sku: row.sku,
    image: row.image,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const cors = corsHeaders(env, request);

    if (method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    try {
      // ---------- PUBLIC: products (two-layer cache) ----------
      if (path === "/api/products" && method === "GET") {
        // Layer 1: in-memory (same isolate, near-zero latency)
        const memHit = memCacheGet();
        if (memHit) {
          return json(memHit, 200, { ...cors, "X-Cache": "MEM" });
        }

        // Layer 2: Cloudflare edge cache (nearest PoP, ~0 ms for cached)
        const cacheKey = new Request(PRODUCTS_CACHE_KEY);
        const edgeHit = await edgeCacheGet(cacheKey);
        if (edgeHit) {
          // Warm the in-memory layer too so the next request skips edge lookup
          const data = await edgeHit.clone().json();
          memCacheSet(data);
          return new Response(edgeHit.body, {
            headers: { ...Object.fromEntries(edgeHit.headers), "X-Cache": "EDGE", ...cors },
          });
        }

        // Cache miss — query D1, then populate both layers
        const { results } = await env.DB.prepare(
          "SELECT * FROM products ORDER BY created_at DESC"
        ).all();
        const data = results.map(productFromRow);
        memCacheSet(data);
        await edgeCacheSet(cacheKey, JSON.stringify(data), cors);
        return json(data, 200, { ...cors, "X-Cache": "MISS" });
      }

      // ---------- PUBLIC: tracking ----------
      if (path === "/api/track/visit" && method === "POST") {
        await env.DB.prepare("INSERT INTO visits DEFAULT VALUES").run();
        return json({ ok: true }, 200, cors);
      }

      if (path === "/api/track/click" && method === "POST") {
        const body = await request.json().catch(() => ({}));
        await env.DB.prepare("INSERT INTO clicks (product_id) VALUES (?)")
          .bind(body.productId || null)
          .run();
        return json({ ok: true }, 200, cors);
      }

      // ---------- ADMIN: login ----------
      if (path === "/api/admin/login" && method === "POST") {
        const body = await request.json().catch(() => ({}));
        const valid = await verifyAdminPassword(env, body.password || "");
        if (!valid) {
          return json({ error: "Wrong password" }, 401, cors);
        }
        const token = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO sessions (token, expires_at) VALUES (?, datetime('now', '+30 days'))"
        )
          .bind(token)
          .run();
        return json({ token }, 200, cors);
      }

      // ---------- ADMIN: reset password with recovery key (no login needed) ----------
      if (path === "/api/admin/reset-password" && method === "POST") {
        const body = await request.json().catch(() => ({}));
        if (!env.ADMIN_RECOVERY_KEY || body.recoveryKey !== env.ADMIN_RECOVERY_KEY) {
          return json({ error: "Wrong recovery key" }, 401, cors);
        }
        if (!body.newPassword || body.newPassword.length < 6) {
          return json({ error: "New password must be at least 6 characters" }, 400, cors);
        }
        await setAdminPassword(env, body.newPassword);
        return json({ ok: true }, 200, cors);
      }

      // ---------- ADMIN: change password while logged in ----------
      if (path === "/api/admin/change-password" && method === "POST") {
        const authed = await requireAuth(request, env);
        if (!authed) return json({ error: "Unauthorized" }, 401, cors);
        const body = await request.json().catch(() => ({}));
        const valid = await verifyAdminPassword(env, body.currentPassword || "");
        if (!valid) return json({ error: "Current password is wrong" }, 401, cors);
        if (!body.newPassword || body.newPassword.length < 6) {
          return json({ error: "New password must be at least 6 characters" }, 400, cors);
        }
        await setAdminPassword(env, body.newPassword);
        return json({ ok: true }, 200, cors);
      }

      // Everything below this line requires a valid admin token.
      if (path.startsWith("/api/admin/")) {
        const authed = await requireAuth(request, env);
        if (!authed) return json({ error: "Unauthorized" }, 401, cors);
      }

      // ---------- ADMIN: products list ----------
      if (path === "/api/admin/products" && method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM products ORDER BY created_at DESC"
        ).all();
        return json(results.map(productFromRow), 200, cors);
      }

      // ---------- ADMIN: create product ----------
      if (path === "/api/admin/products" && method === "POST") {
        const body = await request.json();
        await env.DB.prepare(
          `INSERT INTO products (name, category, price, sizes, sku, image)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
          .bind(
            body.name,
            body.category,
            Number(body.price) || 0,
            body.sizes,
            body.sku || "",
            body.image || ""
          )
          .run();
        memCacheBust();
        await edgeCacheBust();
        return json({ ok: true }, 200, cors);
      }

      // ---------- ADMIN: update product ----------
      const editMatch = path.match(/^\/api\/admin\/products\/(\d+)$/);
      if (editMatch && method === "PUT") {
        const id = editMatch[1];
        const body = await request.json();
        await env.DB.prepare(
          `UPDATE products
           SET name = ?, category = ?, price = ?, sizes = ?, sku = ?, image = ?
           WHERE id = ?`
        )
          .bind(
            body.name,
            body.category,
            Number(body.price) || 0,
            body.sizes,
            body.sku || "",
            body.image || "",
            id
          )
          .run();
        memCacheBust();
        await edgeCacheBust();
        return json({ ok: true }, 200, cors);
      }

      // ---------- ADMIN: delete product ----------
      if (editMatch && method === "DELETE") {
        const id = editMatch[1];
        await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
        memCacheBust();
        await edgeCacheBust();
        return json({ ok: true }, 200, cors);
      }

      // ---------- ADMIN: stats ----------
      if (path === "/api/admin/stats" && method === "GET") {
        const totalVisits = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM visits"
        ).first();
        const totalClicks = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM clicks"
        ).first();
        const perProduct = await env.DB.prepare(
          `SELECT p.id, p.name, COUNT(c.id) AS clicks
           FROM products p
           LEFT JOIN clicks c ON c.product_id = p.id
           GROUP BY p.id
           ORDER BY clicks DESC`
        ).all();
        const byDay = await env.DB.prepare(
          `SELECT date(created_at) AS day, COUNT(*) AS n
           FROM visits
           GROUP BY day
           ORDER BY day DESC
           LIMIT 14`
        ).all();
        return json(
          {
            totalVisits: totalVisits.n,
            totalClicks: totalClicks.n,
            perProduct: perProduct.results,
            visitsByDay: byDay.results.reverse(),
          },
          200,
          cors
        );
      }

      return json({ error: "Not found" }, 404, cors);
    } catch (err) {
      return json({ error: "Server error", detail: String(err) }, 500, cors);
    }
  },
};
