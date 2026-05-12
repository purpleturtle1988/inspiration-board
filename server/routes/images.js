const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const { db } = require('../db');

const UPLOADS_PATH =
  process.env.UPLOADS_PATH || path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(UPLOADS_PATH)) {
  fs.mkdirSync(UPLOADS_PATH, { recursive: true });
}

const storage = multer.diskStorage({
  destination: UPLOADS_PATH,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, crypto.randomUUID() + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Nur Bilder erlaubt'));
  },
});

async function getImageWithTags(id) {
  const imgRes = await db.execute({ sql: 'SELECT * FROM images WHERE id = ?', args: [id] });
  if (!imgRes.rows.length) return null;
  const image = rowToObj(imgRes.rows[0]);

  const tagRes = await db.execute({
    sql: 'SELECT category, value FROM image_tags WHERE image_id = ?',
    args: [id],
  });
  const tags = {};
  tagRes.rows.forEach((r) => {
    const cat = r[0] ?? r.category;
    const val = r[1] ?? r.value;
    if (!tags[cat]) tags[cat] = [];
    tags[cat].push(val);
  });
  return { ...image, tags };
}

function rowToObj(row) {
  if (!row) return null;
  if (typeof row === 'object' && !Array.isArray(row)) return row;
  return row;
}

async function attachTags(images) {
  if (!images.length) return [];
  const ids = images.map((img) => img.id);
  const placeholders = ids.map(() => '?').join(',');
  const tagRes = await db.execute({
    sql: `SELECT image_id, category, value FROM image_tags WHERE image_id IN (${placeholders})`,
    args: ids,
  });
  const tagMap = {};
  tagRes.rows.forEach((r) => {
    const imageId = r.image_id ?? r[0];
    const cat = r.category ?? r[1];
    const val = r.value ?? r[2];
    if (!tagMap[imageId]) tagMap[imageId] = {};
    if (!tagMap[imageId][cat]) tagMap[imageId][cat] = [];
    tagMap[imageId][cat].push(val);
  });
  return images.map((img) => ({ ...img, tags: tagMap[img.id] || {} }));
}

function toPlain(rows) {
  return rows.map((row) => {
    if (row && typeof row === 'object' && !Array.isArray(row)) return row;
    return row;
  });
}

// ── Sessions ──────────────────────────────────────────────────────────────────

function buildSessionTree(rows, countMap) {
  const byId = {};
  rows.forEach((r) => {
    const id = Number(r.id ?? r[0]);
    byId[id] = {
      id,
      name:      r.name      ?? r[1],
      parent_id: r.parent_id != null ? Number(r.parent_id) : null,
      sort_order: Number(r.sort_order ?? r[3] ?? 0),
      _count:    countMap[id] || 0,
      children:  [],
    };
  });
  const roots = [];
  Object.values(byId).forEach((s) => {
    if (s.parent_id != null && byId[s.parent_id]) byId[s.parent_id].children.push(s);
    else roots.push(s);
  });
  // Sort children by sort_order
  const sort = (arr) => { arr.sort((a, b) => a.sort_order - b.sort_order); arr.forEach((s) => sort(s.children)); };
  sort(roots);
  return roots;
}

// GET /api/sessions
router.get('/sessions', async (req, res) => {
  try {
    const [sessRes, cntRes] = await Promise.all([
      db.execute('SELECT * FROM sessions ORDER BY sort_order ASC, id ASC'),
      db.execute('SELECT session_id, COUNT(*) as cnt FROM session_images GROUP BY session_id'),
    ]);
    const countMap = {};
    cntRes.rows.forEach((r) => { countMap[Number(r.session_id ?? r[0])] = Number(r.cnt ?? r[1]); });
    res.json(buildSessionTree(sessRes.rows, countMap));
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// POST /api/sessions  {name, parent_id?}
router.post('/sessions', async (req, res) => {
  try {
    const { name, parent_id = null } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name erforderlich' });
    const result = await db.execute({
      sql: 'INSERT INTO sessions (name, parent_id) VALUES (?, ?)',
      args: [name.trim(), parent_id],
    });
    res.status(201).json({ id: Number(result.lastInsertRowid), name: name.trim(), parent_id, _count: 0, children: [] });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// DELETE /api/sessions/:id  (cascade deletes children + session_images rows)
router.delete('/sessions/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// GET /api/sessions/:id/images
router.get('/sessions/:id/images', async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT i.* FROM images i
            INNER JOIN session_images si ON i.id = si.image_id
            WHERE si.session_id = ?
            ORDER BY si.sort_order ASC, i.id ASC`,
      args: [req.params.id],
    });
    res.json(await attachTags(result.rows));
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// POST /api/sessions/:id/images  {imageId}
router.post('/sessions/:id/images', async (req, res) => {
  try {
    const { imageId } = req.body;
    if (!imageId) return res.status(400).json({ error: 'imageId erforderlich' });
    const orderRes = await db.execute({
      sql: 'SELECT MAX(sort_order) as max FROM session_images WHERE session_id = ?',
      args: [req.params.id],
    });
    const next = Number(orderRes.rows[0]?.max ?? 0) + 1;
    await db.execute({
      sql: 'INSERT OR IGNORE INTO session_images (session_id, image_id, sort_order) VALUES (?, ?, ?)',
      args: [req.params.id, imageId, next],
    });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// DELETE /api/sessions/:id/images/:imageId
router.delete('/sessions/:id/images/:imageId', async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM session_images WHERE session_id = ? AND image_id = ?',
      args: [req.params.id, req.params.imageId],
    });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// PATCH /api/sessions/:id/images/reorder  {orderedIds: [imageId,...]}
router.patch('/sessions/:id/images/reorder', async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds array erforderlich' });
    await Promise.all(orderedIds.map((imageId, i) =>
      db.execute({ sql: 'UPDATE session_images SET sort_order = ? WHERE session_id = ? AND image_id = ?', args: [i, req.params.id, imageId] })
    ));
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// ── Filter management ────────────────────────────────────────────────────────

// GET /api/filters  →  [{slug, label, options: [{id, value}]}]
router.get('/filters', async (req, res) => {
  try {
    const [cats, opts] = await Promise.all([
      db.execute('SELECT * FROM filter_categories ORDER BY sort_order ASC, id ASC'),
      db.execute('SELECT * FROM filter_options ORDER BY sort_order ASC, id ASC'),
    ]);
    const optMap = {};
    opts.rows.forEach((r) => {
      const slug = r.slug ?? r[1];
      const id   = Number(r.id ?? r[0]);
      const val  = r.value ?? r[2];
      if (!optMap[slug]) optMap[slug] = [];
      optMap[slug].push({ id, value: val });
    });
    const result = cats.rows.map((r) => ({
      slug:  r.slug  ?? r[1],
      label: r.label ?? r[2],
      options: optMap[r.slug ?? r[1]] || [],
    }));
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/filters/categories  →  {label}
router.post('/filters/categories', async (req, res) => {
  try {
    const { label } = req.body;
    if (!label?.trim()) return res.status(400).json({ error: 'Label erforderlich' });
    const slug = label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_äöüß]/g, '');
    if (!slug) return res.status(400).json({ error: 'Ungültiger Name' });
    const orderRes = await db.execute('SELECT MAX(sort_order) as max FROM filter_categories');
    const nextOrder = Number(orderRes.rows[0]?.max ?? orderRes.rows[0]?.[0] ?? 0) + 1;
    await db.execute({
      sql: 'INSERT INTO filter_categories (slug, label, sort_order) VALUES (?, ?, ?)',
      args: [slug, label.trim(), nextOrder],
    });
    res.status(201).json({ slug, label: label.trim(), options: [] });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Kategorie existiert bereits' });
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/filters/categories/:slug
router.delete('/filters/categories/:slug', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM filter_options WHERE slug = ?', args: [req.params.slug] });
    await db.execute({ sql: 'DELETE FROM filter_categories WHERE slug = ?', args: [req.params.slug] });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/filters/options  →  {slug, value}
router.post('/filters/options', async (req, res) => {
  try {
    const { slug, value } = req.body;
    if (!slug || !value?.trim()) return res.status(400).json({ error: 'slug und value erforderlich' });
    const orderRes = await db.execute({
      sql: 'SELECT MAX(sort_order) as max FROM filter_options WHERE slug = ?',
      args: [slug],
    });
    const nextOrder = Number(orderRes.rows[0]?.max ?? orderRes.rows[0]?.[0] ?? 0) + 1;
    const result = await db.execute({
      sql: 'INSERT INTO filter_options (slug, value, sort_order) VALUES (?, ?, ?)',
      args: [slug, value.trim(), nextOrder],
    });
    res.status(201).json({ id: Number(result.lastInsertRowid), slug, value: value.trim() });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Option existiert bereits' });
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/filters/options/:id
router.delete('/filters/options/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM filter_options WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── Images ────────────────────────────────────────────────────────────────────

// GET /api/images?view=inbox|paare|familie|business
router.get('/images', async (req, res) => {
  try {
    const { view = 'inbox' } = req.query;
    let result;

    if (view === 'inbox') {
      result = await db.execute(
        `SELECT * FROM images
         WHERE id NOT IN (SELECT DISTINCT image_id FROM image_tags WHERE category = 'art')
         ORDER BY created_at DESC`
      );
    } else {
      const artValue = view.charAt(0).toUpperCase() + view.slice(1);
      result = await db.execute({
        sql: `SELECT i.* FROM images i
              INNER JOIN image_tags it ON i.id = it.image_id
              WHERE it.category = 'art' AND it.value = ?
              ORDER BY i.created_at DESC`,
        args: [artValue],
      });
    }

    const images = await attachTags(result.rows);
    res.json(images);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/images/counts — must come before /:id
router.get('/images/counts', async (req, res) => {
  try {
    const [inboxRes, artRes] = await Promise.all([
      db.execute(
        `SELECT COUNT(*) as count FROM images
         WHERE id NOT IN (SELECT DISTINCT image_id FROM image_tags WHERE category = 'art')`
      ),
      db.execute(
        `SELECT value, COUNT(*) as count FROM image_tags WHERE category = 'art' GROUP BY value`
      ),
    ]);

    const inbox = Number(inboxRes.rows[0]?.count ?? inboxRes.rows[0]?.[0] ?? 0);
    const artCounts = {};
    artRes.rows.forEach((r) => {
      const val = (r.value ?? r[0] ?? '').toLowerCase();
      artCounts[val] = Number(r.count ?? r[1] ?? 0);
    });

    res.json({
      inbox,
      paare:    artCounts.paare    || 0,
      familie:  artCounts.familie  || 0,
      business: artCounts.business || 0,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/images/:id
router.get('/images/:id', async (req, res) => {
  try {
    const image = await getImageWithTags(req.params.id);
    if (!image) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json(image);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/images/upload
router.post('/images/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Keine Datei angegeben' });
  try {
    const result = await db.execute({
      sql: 'INSERT INTO images (filename, source_url) VALUES (?, ?)',
      args: [req.file.filename, req.body.sourceUrl || null],
    });
    res.json(await getImageWithTags(Number(result.lastInsertRowid)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/images/url
router.post('/images/url', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL erforderlich' });

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Referer: (() => { try { return new URL(url).origin; } catch { return ''; } })(),
      },
      maxRedirects: 5,
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    const ext = contentType.includes('png')
      ? '.png'
      : contentType.includes('gif')
      ? '.gif'
      : contentType.includes('webp')
      ? '.webp'
      : '.jpg';

    const filename = crypto.randomUUID() + ext;
    fs.writeFileSync(path.join(UPLOADS_PATH, filename), response.data);

    const result = await db.execute({
      sql: 'INSERT INTO images (filename, source_url) VALUES (?, ?)',
      args: [filename, url],
    });
    res.json(await getImageWithTags(Number(result.lastInsertRowid)));
  } catch (err) {
    console.error('URL fetch error:', err.message);
    res.status(400).json({ error: 'Bild konnte nicht geladen werden: ' + err.message });
  }
});

// PATCH /api/images/:id
router.patch('/images/:id', async (req, res) => {
  const { id } = req.params;
  const { tags, notes, title } = req.body;

  try {
    const check = await db.execute({ sql: 'SELECT id FROM images WHERE id = ?', args: [id] });
    if (!check.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });

    if (title !== undefined) {
      await db.execute({ sql: 'UPDATE images SET title = ? WHERE id = ?', args: [title, id] });
    }
    if (notes !== undefined) {
      await db.execute({ sql: 'UPDATE images SET notes = ? WHERE id = ?', args: [notes, id] });
    }
    if (tags !== undefined) {
      await db.execute({ sql: 'DELETE FROM image_tags WHERE image_id = ?', args: [id] });
      const rows = Object.entries(tags).flatMap(([category, values]) =>
        Array.isArray(values) ? values.map((v) => [id, category, v]) : []
      );
      if (rows.length) {
        const placeholders = rows.map(() => '(?, ?, ?)').join(', ');
        await db.execute({
          sql: `INSERT INTO image_tags (image_id, category, value) VALUES ${placeholders}`,
          args: rows.flat(),
        });
      }
    }

    res.json(await getImageWithTags(id));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/images/:id
router.delete('/images/:id', async (req, res) => {
  try {
    const imgRes = await db.execute({
      sql: 'SELECT * FROM images WHERE id = ?',
      args: [req.params.id],
    });
    if (!imgRes.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });

    const image = imgRes.rows[0];
    const filename = image.filename ?? image[2];
    try {
      fs.unlinkSync(path.join(UPLOADS_PATH, filename));
    } catch (e) {
      // file may already be gone
    }

    await db.execute({ sql: 'DELETE FROM images WHERE id = ?', args: [req.params.id] });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
