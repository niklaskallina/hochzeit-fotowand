// POST /api/auth/magic-link
// Body: { email }
// Schickt einen Supabase-Magic-Link an die E-Mail.
// Supabase übernimmt den Versand, wenn im Dashboard der SMTP-Provider konfiguriert
// ist — sonst landet der Link im Supabase-Log (nur Dev).

const { getAdmin } = require('../_lib/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { email } = req.body || {};
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Bitte eine gültige E-Mail angeben' });
    }
    const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
    const admin = getAdmin();

    const { error } = await admin.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${appUrl}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    if (error) {
      console.error('Magic-Link-Fehler:', error);
      return res.status(500).json({ error: 'Magic-Link konnte nicht gesendet werden' });
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler' });
  }
};
