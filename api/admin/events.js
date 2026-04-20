// /api/admin/events (Super-Admin only)
// GET                  → alle Events mit Owner-E-Mail
// POST { id, status }  → Event-Status ändern (pending/active/expired/disabled)
// POST { id, plan }    → Plan ändern (basic/plus/premium)
// POST { id, expires_at } → Ablaufdatum setzen
// Aktion gleichzeitig legt eine manuelle Order an (Audit-Trail).

const { requireSuperAdmin } = require('../_lib/auth');
const { getAdmin } = require('../_lib/supabase');

const PLAN_PRICES_CENTS = { basic: 2900, plus: 5900, premium: 9900 };

module.exports = async (req, res) => {
  const user = await requireSuperAdmin(req, res);
  if (!user) return;
  const admin = getAdmin();

  if (req.method === 'GET') {
    const { data: events, error } = await admin
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    // Owner-Emails über Auth-Admin-API
    const ownerIds = Array.from(new Set((events || []).map((e) => e.owner_id)));
    const emailMap = {};
    for (const oid of ownerIds) {
      try {
        const { data } = await admin.auth.admin.getUserById(oid);
        if (data?.user?.email) emailMap[oid] = data.user.email;
      } catch (e) { /* ignore */ }
    }
    const enriched = (events || []).map((e) => ({ ...e, owner_email: emailMap[e.owner_id] || null }));
    return res.status(200).json({ events: enriched });
  }

  if (req.method === 'POST') {
    const { id, status, plan, expires_at, note } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Event-ID fehlt' });

    const patch = {};
    if (status) patch.status = status;
    if (plan) patch.plan = plan;
    if (expires_at !== undefined) patch.expires_at = expires_at;
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Keine Änderung' });

    const { data: updated, error } = await admin
      .from('events')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });

    // Bei Aktivierung: manuelle Order anlegen
    if (status === 'active') {
      const effectivePlan = plan || updated.plan;
      await admin.from('orders').insert({
        user_id: updated.owner_id,
        event_id: updated.id,
        plan: effectivePlan,
        amount_cents: PLAN_PRICES_CENTS[effectivePlan] || 0,
        currency: 'EUR',
        provider: 'manual',
        status: 'paid',
        note: note || 'Manuell freigeschaltet',
        paid_at: new Date().toISOString(),
      });
    }
    return res.status(200).json({ event: updated });
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: 'Method not allowed' });
};
