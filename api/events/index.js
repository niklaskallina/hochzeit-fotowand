// /api/events
// GET   → Liste der eigenen Events
// POST  → Neues Event anlegen { slug, couple_names?, event_date?, plan? }
//
// Events sind in Supabase per RLS auf den Besitzer beschränkt; wir lesen/schreiben
// mit dem Access-Token des Users, damit die Policies greifen.

const { requireUser } = require('../_lib/auth');
const { getAnon } = require('../_lib/supabase');
const { readAccessToken } = require('../_lib/auth');

module.exports = async (req, res) => {
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
