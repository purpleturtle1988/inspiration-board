const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'inspiration.db');
const dbDir = path.dirname(DB_PATH);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = createClient({ url: `file:${DB_PATH}` });

async function initDB() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_url TEXT,
      filename TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS image_tags (
      image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (image_id, category, value)
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      emoji TEXT NOT NULL DEFAULT '📁',
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS session_images (
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      image_id   INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id, image_id)
    );
    CREATE TABLE IF NOT EXISTS filter_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS filter_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      value TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(slug, value)
    );
    PRAGMA foreign_keys = ON;
  `);

  // Seed filter categories + options if empty
  const fcRes = await db.execute('SELECT COUNT(*) as count FROM filter_categories');
  const fcCount = Number(fcRes.rows[0]?.count ?? fcRes.rows[0]?.[0] ?? 0);
  if (fcCount === 0) {
    await db.executeMultiple(`
      INSERT INTO filter_categories (slug, label, sort_order) VALUES ('typ', 'Typ', 1);
      INSERT INTO filter_categories (slug, label, sort_order) VALUES ('pose', 'Posen', 2);
      INSERT INTO filter_categories (slug, label, sort_order) VALUES ('location', 'Location', 3);
      INSERT INTO filter_options (slug, value, sort_order) VALUES ('typ', 'Sportlich', 1);
      INSERT INTO filter_options (slug, value, sort_order) VALUES ('typ', 'Verschmust', 2);
      INSERT INTO filter_options (slug, value, sort_order) VALUES ('typ', 'Energiegeladen', 3);
      INSERT INTO filter_options (slug, value, sort_order) VALUES ('typ', 'Fröhlich', 4);
      INSERT INTO filter_options (slug, value, sort_order) VALUES ('pose', 'Stehend', 1);
      INSERT INTO filter_options (slug, value, sort_order) VALUES ('pose', 'Laufend', 2);
      INSERT INTO filter_options (slug, value, sort_order) VALUES ('pose', 'Sitzend', 3);
      INSERT INTO filter_options (slug, value, sort_order) VALUES ('location', 'Indoor', 1);
      INSERT INTO filter_options (slug, value, sort_order) VALUES ('location', 'Outdoor', 2);
      INSERT INTO filter_options (slug, value, sort_order) VALUES ('location', 'Stadt', 3);
    `);
  }
}

module.exports = { db, initDB };
