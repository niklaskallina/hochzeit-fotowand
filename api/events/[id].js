// /api/events/:id
// GET    → Einzelnes Event (nur Besitzer, via RLS)
// PATCH  → Event-Felder aktualisieren (couple_names, welcome_text, couple_photo_url, event_date)
// DELETE → Event samt Fotos löschen

const { requireUser, readAccessToken } = require('../_lib/auth');
const { getAnon, getAdmin } = require('../_lib/supabase');
const { cloudinary, eventPhotoFolder } = require('../_lib/cloudinary');

module.exports = async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Event-ID fehlt' });
  const sb = getAnon(readAccessToken(req));

  if (req.method === 'GET') {
    const { data, error } = await sb.from('events').select('*').eq('id', id).single();
    if (error) return res.status(404).json({ error: 'Nicht gefunden' });
    return res.status(200).json({ event: data });
  }

  if (req.method === 'PATCH') {
    const allowed = ['couple_names', 'welcome_text', 'couple_photo_url', 'event_date'];
    const patch = {};
    for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Keine Felder' });

    const { data, error } = await sb.from('events').update(patch).eq('id', id).select('*').single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ event: data });
  }

  if (req.method === 'DELETE') {
    // Erst Event über RLS prüfen, dann Cloudinary + DB bereinigen
    const { data: ev, error: evErr } = await sb.from('events').select('id').eq('id', id).single();
    if (evErr || !ev) return res.status(404).json({ error: 'Nicht gefunden' });
    try {
      await cloudinary.api.delete_resources_by_prefix(`events/${id}/`);
      await cloudinary.api.delete_folder(`events/${id}`).catch(() => {});
    } catch (e) {
      console.warn('Cloudinary-Bereinigung:', e.message);
    }
    const admin = getAdmin();
    await admin.from('events').delete().eq('id', id);
    return res.status(204).end();
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE');
  res.status(405).json({ error: 'Method not allowed' });
};
