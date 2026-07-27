-- Run this once with:
-- wrangler d1 execute sole-stock-db --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  sizes TEXT NOT NULL,
  sku TEXT,
  image TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- A few starter shoes so the site isn't empty on first deploy.
-- Feel free to delete these from the admin panel once you add real stock.
INSERT INTO products (name, category, price, sizes, sku, image) VALUES
  ('Classic Court Sneaker', 'Sneakers', 3200, '39-45', 'SNK-001', 'https://picsum.photos/seed/shoe1/600/600'),
  ('Oxford Leather', 'Official', 5200, '40-45', 'OFC-001', 'https://picsum.photos/seed/shoe3/600/600'),
  ('Block Heel Pump', 'Heels', 3600, '37-42', 'HEL-002', 'https://picsum.photos/seed/shoe6/600/600'),
  ('Slide Sandal', 'Sandals', 1500, '39-45', 'SND-002', 'https://picsum.photos/seed/shoe8/600/600'),
  ('Chelsea Boot', 'Boots', 6200, '40-44', 'BOT-002', 'https://picsum.photos/seed/shoe10/600/600'),
  ('Kids Sneaker', 'Kids', 2000, '27-34', 'KID-002', 'https://picsum.photos/seed/shoe12/600/600');
