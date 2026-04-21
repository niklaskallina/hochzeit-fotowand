// /api/download.js
// Erzeugt eine ZIP-Datei aus mehreren Gäste-Bildern via Cloudinarys generate_archive-API.
// Die Zip-Erstellung läuft komplett bei Cloudinary — wir liefern nur die Download-URL zurück.
//
// POST-Body: { publicIds: ["hochzeit/abc", ...] }  → gezielte Auswahl
//            { publicIds: "all" }                   → alle Bilder im hochzeit-Ordner
// Auth:       x-admin-password Header
// Response:   { ok: true, url: "<cloudinary-zip-url>", count: <n> }

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function collectAllPublicIds() {
  let all = [];
  let next_cursor;
  for (let i = 0; i < 4; i++) {
    const q = cloudinary.search
      .expression('folder:hochzeit AND resource_type:image')
      .max_results(500);
    if (next_cursor) q.next_cursor(next_cursor);
    const result = await q.execute();
    all = all.concat(result.resources || []);
    next_cursor = result.next_cursor;
    if (!next_cursor) break;
  }
  return all.map((r) => r.public_id);
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const adminPw = process.env.ADMIN_PASSWORD;
    if (adminPw && req.headers['x-admin-password'] !== adminPw) {
      return res.status(401).json({ error: 'Falsches Admin-Passwort' });
    }

    let { publicIds } = req.body || {};

    if (publicIds === 'all') {
      publicIds = await collectAllPublicIds();
    }

    if (!Array.isArray(publicIds) || publicIds.length === 0) {
      return res.status(400).json({ error: 'Keine Bilder ausgewählt' });
    }

    publicIds = publicIds
      .filter((id) => typeof id === 'string' && id.startsWith('hochzeit/'))
      // Cloudinary-Limit pro ZIP: 1000 Ressourcen
      .slice(0, 1000);

    if (publicIds.length === 0) {
      return res.status(400).json({ error: 'Keine gültigen Bilder in der Auswahl' });
    }

    // download_zip_url liefert eine signierte URL, die Cloudinary on-the-fly
    // einen ZIP-Stream erzeugen lässt. Keine Zwischenspeicherung nötig.
    const url = cloudinary.utils.download_zip_url({
      public_ids: publicIds,
      resource_type: 'image',
      target_format: 'zip',
      flatten_folders: true,
    });

    return res.status(200).json({
      ok: true,
      url,
      count: publicIds.length,
    });
  } catch (err) {
    console.error('download error:', err);
    res.status(500).json({
      error: 'ZIP konnte nicht erstellt werden',
      detail: String(err.message || err),
    });
  }
};
