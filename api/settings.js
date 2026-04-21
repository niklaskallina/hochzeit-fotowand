// /api/settings.js
// Speichert die Event-Einstellungen als JSON via Upload-API mit expliziter invalidation.
// Alter Bug: upload_stream für raw-Dateien wurde von Cloudinary gecached, sodass GET alte Werte zurückgab.
// Neuer Ansatz: HTTP-Upload mit overwrite + invalidate + Version-Bust beim Lesen.

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const SETTINGS_PUBLIC_ID = 'hochzeit-meta/settings';

async function loadSettings() {
  try {
    // Frische Ressource-Info holen — gibt uns die aktuelle Version
    const resource = await cloudinary.api.resource(SETTINGS_PUBLIC_ID, {
      resource_type: 'raw',
    });

    // URL mit Version bauen → umgeht CDN-Cache komplett
    const url = cloudinary.url(SETTINGS_PUBLIC_ID, {
      resource_type: 'raw',
      version: resource.version,
      sign_url: false,
    });

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Fetch failed: ' + res.status);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('Settings-JSON defekt:', text);
      return { coupleNames: '', welcomeText: '', couplePhotoUrl: '' };
    }
  } catch (err) {
    // Existiert noch nicht → Defaults
    if (err && err.error && err.error.http_code === 404) {
      return { coupleNames: '', welcomeText: '', couplePhotoUrl: '' };
    }
    console.warn('loadSettings fallback:', err.message || err);
    return { coupleNames: '', welcomeText: '', couplePhotoUrl: '' };
  }
}

async function saveSettings(payload) {
  // Cloudinary Upload API für raw-File — mit overwrite + invalidate
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        public_id: SETTINGS_PUBLIC_ID,
        overwrite: true,
        invalidate: true, // wichtig: CDN-Cache invalidieren
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
    if (req.method === 'GET') {
      const settings = await loadSettings();
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(200).json(settings);
    }

    if (req.method === 'HEAD') {
      const adminPw = process.env.ADMIN_PASSWORD;
      if (adminPw && req.headers['x-admin-password'] !== adminPw) {
        return res.status(401).end();
      }
      return res.status(200).end();
    }

    if (req.method === 'POST') {
      const adminPw = process.env.ADMIN_PASSWORD;
      if (adminPw && req.headers['x-admin-password'] !== adminPw) {
        return res.status(401).json({ error: 'Falsches Admin-Passwort' });
      }

      const {
        coupleNames = '',
        welcomeText = '',
        couplePhotoUrl = '',
        showHearts,
        showToast,
        showMilestones,
      } = req.body || {};
      const current = await loadSettings();
      const asBool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
      const payload = {
        coupleNames: String(coupleNames).slice(0, 100),
        welcomeText: String(welcomeText).slice(0, 500),
        couplePhotoUrl: String(couplePhotoUrl).slice(0, 500),
        showHearts: asBool(showHearts, current.showHearts !== false),
        showToast: asBool(showToast, current.showToast !== false),
        showMilestones: asBool(showMilestones, current.showMilestones !== false),
        updatedAt: new Date().toISOString(),
        ...(current.statsResetAt ? { statsResetAt: current.statsResetAt } : {}),
      };

      const uploadResult = await saveSettings(payload);

      return res.status(200).json({
        ok: true,
        settings: payload,
        version: uploadResult.version,
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('settings error:', err);
    res.status(500).json({ error: 'Einstellungen konnten nicht verarbeitet werden', detail: String(err.message || err) });
  }
};
