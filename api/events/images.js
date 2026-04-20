// GET /api/events/images?slug=annaundtom
// Liefert die Bilder eines aktiven Events. Öffentlich lesbar (für Slideshow).

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

    const result = await cloudinary.search
      .expression(`folder:"${eventPhotoFolder(ev.id)}" AND resource_type:image`)
      .sort_by('created_at', 'desc')
      .with_field('context')
      .max_results(200)
      .execute();

    const images = (result.resources || []).map((r) => ({
      id: r.public_id,
      url: cloudinary.url(r.public_id, {
        quality: 'auto',
        fetch_format: 'auto',
        width: 1920,
        height: 1920,
        crop: 'limit',
      }),
      createdAt: r.created_at,
      name: r.context?.alt || '',
      message: r.context?.caption || '',
    }));

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).json({ images });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bilder konnten nicht geladen werden' });
  }
};
