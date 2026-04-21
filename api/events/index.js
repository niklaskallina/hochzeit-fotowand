// /api/events
// GET  ?slug=<slug>  → öffentliches Lookup per Slug (für Gäste-Seiten), nur `status = 'active'`
// GET                → Liste der eigenen Events (Auth nötig)
// POST               → Neues Event anlegen { slug, couple_names?, event_date?, plan? } (Auth nötig)
//
// Auth-geschützte Reads/Writes laufen per Supabase-Anon-Client mit User-Token, damit RLS greift.
// Der öffentliche Slug-Lookup nutzt den Admin-Client mit expliziter `status = 'active'`-Filterung,
// damit der Gast kein gültiges Token braucht.

const { requireUser, readAccessToken } = require('../_lib/auth');
const { getAdmin, getAnon } = require('../_lib/supabase');

module.exports = async (req, res) => {
  if (req.method === 'GET' && req.query && typeof req.query.slug === 'string' && req.query.slug) {
    try {
      const sb = getAdmin();
      const { data, error } = await sb
        .from('events')
        .select('id, slug, couple_names, welcome_text, couple_photo_url, event_date, status, plan')
        .eq('slug', req.query.slug.toLowerCase())
        .eq('status', 'active')
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Event nicht gefunden' });
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(200).json({ event: data });
    } catch (err) {
      console.error('public slug lookup:', err);
      return res.status(500).json({ error: 'Event konnte nicht geladen werden' });
    }
  }

  const user = await requireUser(req, res);
  if (!user) return;
  const token = readAccessToken(req);
  const sb = getAnon(token);

  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ events: data || [] });
  }

  if (req.method === 'POST') {
    const { slug, couple_names = '', welcome_text = '', event_date = null, plan = 'basic' } = req.body || {};
    if (!slug || !/^[a-z0-9][a-z0-9-]{2,60}$/.test(slug)) {
      return res.status(400).json({ error: 'Slug: 3–60 Zeichen, nur a-z, 0-9, - (Anfang nicht -)' });
    }
    const insert = {
      owner_id: user.id,
      slug: slug.toLowerCase(),
      couple_names,
      welcome_text,
      event_date,
      plan,
    };
    const { data, error } = await sb.from('events').insert(insert).select('*').single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Dieser Slug ist bereits vergeben' });
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json({ event: data });
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: 'Method not allowed' });
};
