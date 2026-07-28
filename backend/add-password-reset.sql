-- One-time migration for the database you already deployed.
-- Adds support for self-service password reset (no code/terminal needed
-- after this point to change your admin password).
--
-- Run this once with:
--   wrangler d1 execute sole-stock-db --remote --file=./add-password-reset.sql
--
-- Safe to run even if you re-run it by accident — CREATE TABLE IF NOT
-- EXISTS won't touch anything that's already there.

CREATE TABLE IF NOT EXISTS admin_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT,
  password_salt TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
