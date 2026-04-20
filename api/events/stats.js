// GET /api/events/stats?slug=annaundtom
// Liefert Event-Statistik (Leaderboard, Timeline, Grüße). Öffentlich bei aktivem Event.
// Wird per Pagination durch alle Bilder iteriert.

const { getAdmin } = require('../_lib/supabase');
const { cloudinary, eventPhotoFolder } = require('../_lib/cloudinary');

module.exports = async (req, res) => {
  try {
    const slug = (req.query.slug || '').toString().toLowerCase();
    if (!slug) return res.status(400).json({ error: 'Slug fehlt' });
    const admin = getAdmin();
    const { data: ev, error } = await admin
      .from('events')
      .select('id, status')
      .eq('slug', slug)
      .single();
    if (error || !ev) return res.status(404).json({ error: 'Nicht gefunden' });
    if (ev.status !== 'active') return res.status(403).json({ error: 'Event nicht aktiv' });

    let all = [];
    let next_cursor = undefined;
    for (let i = 0; i < 4; i++) {
      const q = cloudinary.search
        .expression(`folder:"${eventPhotoFolder(ev.id)}" AND resource_type:image`)
        .sort_by('created_at', 'desc')
        .with_field('context')
        .max_results(500);
      if (next_cursor) q.next_cursor(next_cursor);
      const result = await q.execute();
      all = all.concat(result.resources || []);
      next_cursor = result.next_cursor;
      if (!next_cursor) break;
    }

    const byUploader = new Map();
    const byHour = new Map();
    const messages = [];
    let firstTs = null;
    let lastTs = null;

    for (const r of all) {
      const name = (r.context?.alt || '').trim();
      const message = (r.context?.caption || '').trim();
      const key = name || 'Anonym';
      const ts = new Date(r.created_at);

      const entry = byUploader.get(key) || { name: key, count: 0, lastAt: null, firstAt: null };
      entry.count += 1;
      if (!entry.lastAt || ts > new Date(entry.lastAt)) entry.lastAt = r.created_at;
      if (!entry.firstAt || ts < new Date(entry.firstAt)) entry.firstAt = r.created_at;
      byUploader.set(key, entry);

      const hourKey = ts.toISOString().slice(0, 13);
      byHour.set(hourKey, (byHour.get(hourKey) || 0) + 1);

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
    const hours = Array.from(byHour.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hour, count]) => ({ hour, count }));
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
