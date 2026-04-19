// /api/settings.js
// Liest und schreibt die Event-Einstellungen (Brautpaar-Bild, Willkommenstext, Brautpaar-Namen).
// Wird als JSON-"raw file" in Cloudinary gespeichert — keine separate Datenbank nötig.

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const SETTINGS_PUBLIC_ID = 'hochzeit-meta/settings';

async function loadSettings() {
  try {
    const result = await cloudinary.api.resource(SETTINGS_PUBLIC_ID, {
      resource_type: 'raw',
    });
    // secure_url liefert die aktuelle JSON-Datei
    const res = await fetch(result.secure_url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Fetch failed');
    return await res.json();
  } catch (err) {
    // Existiert noch nicht → Defaults zurückgeben
    return {
      coupleNames: '',
      welcomeText: '',
      couplePhotoUrl: '',
    };
  }
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const settings = await loadSettings();
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(200).json(settings);
    }

    // HEAD: reine Passwort-Prüfung ohne Datenänderung
    if (req.method === 'HEAD') {
      const adminPw = process.env.ADMIN_PASSWORD;
      if (adminPw && req.headers['x-admin-password'] !== adminPw) {
        return res.status(401).end();
      }
      return res.status(200).end();
    }

    if (req.method === 'POST') {
      // Schutz per einfachem Admin-Passwort (in ENV)
      const adminPw = process.env.ADMIN_PASSWORD;
      if (adminPw && req.headers['x-admin-password'] !== adminPw) {
        return res.status(401).json({ error: 'Falsches Admin-Passwort' });
      }

      const { coupleNames = '', welcomeText = '', couplePhotoUrl = '' } = req.body || {};
      const payload = {
        coupleNames: String(coupleNames).slice(0, 100),
        welcomeText: String(welcomeText).slice(0, 500),
        couplePhotoUrl: String(couplePhotoUrl).slice(0, 500),
        updatedAt: new Date().toISOString(),
      };

      // JSON als Buffer hochladen, Public-ID überschreiben
      const buffer = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');
      await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            public_id: SETTINGS_PUBLIC_ID,
            overwrite: true,
            format: 'json',
          },
          (err, result) => (err ? reject(err) : resolve(result))
        );
        stream.end(buffer);
      });

      return res.status(200).json({ ok: true, settings: payload });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Einstellungen konnten nicht verarbeitet werden' });
  }
};
