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
    PRAGMA foreign_keys = ON;
  `);
  // Seed default categories if table is empty
  const existing = await db.execute('SELECT COUNT(*) as count FROM categories');
  const count = Number(existing.rows[0]?.count ?? existing.rows[0]?.[0] ?? 0);
  if (count === 0) {
    await db.executeMultiple(`
      INSERT INTO categories (name, emoji, sort_order) VALUES ('Paare', '💑', 1);
      INSERT INTO categories (name, emoji, sort_order) VALUES ('Familie', '👨‍👩‍👧', 2);
      INSERT INTO categories (name, emoji, sort_order) VALUES ('Business', '💼', 3);
    `);
  }
}

module.exports = { db, initDB };
