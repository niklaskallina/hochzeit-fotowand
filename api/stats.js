// /api/stats.js
// Aggregiert Statistiken aus dem Hochzeitsordner: Gesamtanzahl, Uploads pro Gast,
// Uploads nach Stunde, sowie alle Grüße für die Gruß-Wall.
// Im Gegensatz zu /api/images wird hier per Pagination durch ALLE Bilder iteriert,
// damit auch bei größeren Hochzeiten (> 200 Fotos) die Statistik vollständig ist.

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const SETTINGS_PUBLIC_ID = 'hochzeit-meta/settings';

async function loadSettings() {
  try {
    const resource = await cloudinary.api.resource(SETTINGS_PUBLIC_ID, { resource_type: 'raw' });
    const url = cloudinary.url(SETTINGS_PUBLIC_ID, {
      resource_type: 'raw',
      version: resource.version,
      sign_url: false,
    });
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return {};
    return JSON.parse(await res.text());
  } catch (e) {
    return {};
  }
}

async function saveSettings(payload) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        public_id: SETTINGS_PUBLIC_ID,
        overwrite: true,
        invalidate: true,
        use_filename: false,
        unique_filename: false,
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(Buffer.from(JSON.stringify(payload, null, 2), 'utf-8'));
  });
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'DELETE') {
      const adminPw = process.env.ADMIN_PASSWORD;
      if (adminPw && req.headers['x-admin-password'] !== adminPw) {
        return res.status(401).json({ error: 'Falsches Admin-Passwort' });
      }
      const current = await loadSettings();
      const payload = { ...current, statsResetAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await saveSettings(payload);
      return res.status(200).json({ ok: true, statsResetAt: payload.statsResetAt });
    }

    const current = await loadSettings();
    const statsResetAt = current.statsResetAt || null;
    const resetCutoff = statsResetAt ? new Date(statsResetAt) : null;

    let all = [];
    let next_cursor = undefined;
    // Cloudinary Search API liefert max. 500 Resultate pro Call
    // Wir paginieren bis maximal 2000 Bilder (reicht für jede Hochzeit)
    for (let i = 0; i < 4; i++) {
      const q = cloudinary.search
        .expression('folder:hochzeit AND resource_type:image')
        .sort_by('created_at', 'desc')
        .with_field('context')
        .max_results(500);
      if (next_cursor) q.next_cursor(next_cursor);
      const result = await q.execute();
      all = all.concat(result.resources || []);
      next_cursor = result.next_cursor;
      if (!next_cursor) break;
    }

    // Bilder vor dem Reset-Zeitstempel ausblenden
    if (resetCutoff) {
      all = all.filter((r) => new Date(r.created_at) > resetCutoff);
    }

    // ---- Aggregation ----
    const byUploader = new Map();
    const byHour = new Map();
    const byDay = new Map();
    const messages = [];
    let firstTs = null;
    let lastTs = null;

    for (const r of all) {
      const name = (r.context?.alt || '').trim();
      const message = (r.context?.caption || '').trim();
      const key = name || 'Anonym';

      const entry = byUploader.get(key) || { name: key, count: 0, lastAt: null, firstAt: null };
      entry.count += 1;
      const ts = new Date(r.created_at);
      if (!entry.lastAt || ts > new Date(entry.lastAt)) entry.lastAt = r.created_at;
      if (!entry.firstAt || ts < new Date(entry.firstAt)) entry.firstAt = r.created_at;
      byUploader.set(key, entry);

      const hourKey = ts.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      byHour.set(hourKey, (byHour.get(hourKey) || 0) + 1);

      const dayKey = ts.toISOString().slice(0, 10);
      byDay.set(dayKey, (byDay.get(dayKey) || 0) + 1);

      if (message) {
        messages.push({
          name: name || 'Anonym',
          message,
          createdAt: r.created_at,
          thumbUrl: cloudinary.url(r.public_id, {
            quality: 'auto',
            fetch_format: 'auto',
            width: 200,
            height: 200,
            crop: 'fill',
            gravity: 'auto',
          }),
        });
      }

      if (!firstTs || ts < new Date(firstTs)) firstTs = r.created_at;
      if (!lastTs || ts > new Date(lastTs)) lastTs = r.created_at;
    }

    const uploaders = Array.from(byUploader.values()).sort((a, b) => b.count - a.count);

    // Stunden in chronologische Reihenfolge
    const hours = Array.from(byHour.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hour, count]) => ({ hour, count }));

    // Grüße, neueste zuerst
    messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).json({
      totalCount: all.length,
      uniqueUploaders: uploaders.length,
      firstUploadAt: firstTs,
      lastUploadAt: lastTs,
      uploaders,
      hours,
      messages,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Statistiken konnten nicht geladen werden' });
  }
};
