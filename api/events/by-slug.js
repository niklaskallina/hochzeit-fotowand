// GET /api/events/by-slug?slug=annaundtom
// Öffentlich: liefert nur die Anzeige-Daten eines Events (für Gast-Upload-Seite).
// Ein Event wird NUR ausgeliefert, wenn Status = 'active'.

const { getAdmin } = require('../_lib/supabase');

module.exports = async (req, res) => {
  const slug = (req.query.slug || '').toString().toLowerCase();
  if (!slug || !/^[a-z0-9][a-z0-9-]{2,60}$/.test(slug)) {
    return res.status(400).json({ error: 'Ungültiger Slug' });
  }
  try {
    const admin = getAdmin();
    const { data, error } = await admin
      .from('events')
      .select('id, slug, couple_names, welcome_text, couple_photo_url, status, plan, expires_at')
      .eq('slug', slug)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Event nicht gefunden' });
    if (data.status !== 'active') {
      return res.status(403).json({ error: 'Dieses Event ist (noch) nicht aktiv' });
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      event: {
        id: data.id,
        slug: data.slug,
        couple_names: data.couple_names,
        welcome_text: data.welcome_text,
        couple_photo_url: data.couple_photo_url,
        plan: data.plan,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler' });
  }
};
