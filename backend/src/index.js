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
        GET    /api/admin/products
        POST   /api/admin/products        (multipart/form-data, optional image file)
        PUT    /api/admin/products/:id     (multipart/form-data, optional image file)
        DELETE /api/admin/products/:id
        GET    /api/admin/stats

  Nothing here needs editing except ADMIN_PASSWORD, which is set as a
  secret (never put a password directly in this file or in wrangler.toml):
    wrangler secret put ADMIN_PASSWORD
*/

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

async function uploadImageIfPresent(formData, env) {
  const file = formData.get("image");
  if (!file || typeof file === "string" || !env.IMAGES) return null;
  const key = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "")}`;
  await env.IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "image/jpeg" },
  });
  return `${env.R2_PUBLIC_BASE}/${key}`;
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
      // ---------- PUBLIC: products ----------
      if (path === "/api/products" && method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM products ORDER BY created_at DESC"
        ).all();
        return json(results.map(productFromRow), 200, cors);
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
        if (!env.ADMIN_PASSWORD || body.password !== env.ADMIN_PASSWORD) {
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
        const formData = await request.formData();
        const imageUrl =
          (await uploadImageIfPresent(formData, env)) ||
          formData.get("existingImage") ||
          "";
        await env.DB.prepare(
          `INSERT INTO products (name, category, price, sizes, sku, image)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
          .bind(
            formData.get("name"),
            formData.get("category"),
            Number(formData.get("price")) || 0,
            formData.get("sizes"),
            formData.get("sku") || "",
            imageUrl
          )
          .run();
        return json({ ok: true }, 200, cors);
      }

      // ---------- ADMIN: update product ----------
      const editMatch = path.match(/^\/api\/admin\/products\/(\d+)$/);
      if (editMatch && method === "PUT") {
        const id = editMatch[1];
        const formData = await request.formData();
        const uploaded = await uploadImageIfPresent(formData, env);
        const imageUrl = uploaded || formData.get("existingImage") || "";
        await env.DB.prepare(
          `UPDATE products
           SET name = ?, category = ?, price = ?, sizes = ?, sku = ?, image = ?
           WHERE id = ?`
        )
          .bind(
            formData.get("name"),
            formData.get("category"),
            Number(formData.get("price")) || 0,
            formData.get("sizes"),
            formData.get("sku") || "",
            imageUrl,
            id
          )
          .run();
        return json({ ok: true }, 200, cors);
      }

      // ---------- ADMIN: delete product ----------
      if (editMatch && method === "DELETE") {
        const id = editMatch[1];
        await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
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
