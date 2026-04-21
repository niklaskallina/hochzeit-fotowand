// POST /api/stats-reset
// Setzt den Statistik-Zähler zurück, indem ein Zeitstempel (statsResetAt) in die
// Event-Einstellungen geschrieben wird. /api/stats wertet nur Uploads danach aus.

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
    if (!res.ok) throw new Error('Fetch failed');
    return JSON.parse(await res.text());
  } catch (err) {
    if (err && err.error && err.error.http_code === 404) return {};
    throw err;
  }
}

function saveSettings(payload) {
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
  if (req.method !== 'POST') return res.status(405).end();

  const adminPw = process.env.ADMIN_PASSWORD;
  if (adminPw && req.headers['x-admin-password'] !== adminPw) {
    return res.status(401).json({ error: 'Falsches Admin-Passwort' });
  }

  try {
    const current = await loadSettings();
    const statsResetAt = new Date().toISOString();
    await saveSettings({ ...current, statsResetAt });
    res.status(200).json({ ok: true, statsResetAt });
  } catch (err) {
    console.error('stats-reset error:', err);
    res.status(500).json({ error: 'Reset fehlgeschlagen', detail: String(err.message || err) });
  }
};
