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
  return Promise.all(
    images.map(async (img) => {
      const tagRes = await db.execute({
        sql: 'SELECT category, value FROM image_tags WHERE image_id = ?',
        args: [img.id],
      });
      const tags = {};
      tagRes.rows.forEach((r) => {
        const cat = r.category ?? r[0];
        const val = r.value ?? r[1];
        if (!tags[cat]) tags[cat] = [];
        tags[cat].push(val);
      });
      return { ...img, tags };
    })
  );
}

function toPlain(rows) {
  return rows.map((row) => {
    if (row && typeof row === 'object' && !Array.isArray(row)) return row;
    return row;
  });
}

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
    const inboxRes = await db.execute(
      `SELECT COUNT(*) as count FROM images
       WHERE id NOT IN (SELECT DISTINCT image_id FROM image_tags WHERE category = 'art')`
    );
    const inbox = Number(inboxRes.rows[0]?.count ?? inboxRes.rows[0]?.[0] ?? 0);

    const getCatCount = async (val) => {
      const r = await db.execute({
        sql: `SELECT COUNT(*) as count FROM image_tags WHERE category = 'art' AND value = ?`,
        args: [val],
      });
      return Number(r.rows[0]?.count ?? r.rows[0]?.[0] ?? 0);
    };

    res.json({
      inbox,
      paare: await getCatCount('Paare'),
      familie: await getCatCount('Familie'),
      business: await getCatCount('Business'),
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
      for (const [category, values] of Object.entries(tags)) {
        if (Array.isArray(values)) {
          for (const v of values) {
            await db.execute({
              sql: 'INSERT INTO image_tags (image_id, category, value) VALUES (?, ?, ?)',
              args: [id, category, v],
            });
          }
        }
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
