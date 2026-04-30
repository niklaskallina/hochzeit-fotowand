// /api/images.js
// GET    → Liste aller Gäste-Bilder aus dem Hochzeitsordner (neueste zuerst).
// DELETE → Löscht ein einzelnes Bild aus Cloudinary (Admin-Auth erforderlich).
//          Body: { publicId: "hochzeit/..." }

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = async (req, res) => {
  try {
    if (req.method === 'DELETE') {
      const adminPw = process.env.ADMIN_PASSWORD;
      if (adminPw && req.headers['x-admin-password'] !== adminPw) {
        return res.status(401).json({ error: 'Falsches Admin-Passwort' });
      }
      // publicId darf aus Query oder Body kommen — Body-Parsing auf DELETE
      // ist bei manchen Proxies/Runtimes uneinheitlich, deshalb beides stützen.
      const publicId =
        (req.query && req.query.publicId) ||
        (req.body && req.body.publicId) ||
        null;
      if (!publicId || typeof publicId !== 'string' || !publicId.startsWith('hochzeit/')) {
        return res.status(400).json({ error: 'Ungültige publicId' });
      }
      const result = await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
        resource_type: 'image',
      });
      if (result.result !== 'ok' && result.result !== 'not found') {
        return res.status(500).json({ error: 'Bild konnte nicht gelöscht werden', detail: result.result });
      }
      return res.status(200).json({ ok: true, publicId, result: result.result });
    }

    if (req.method === 'GET') {
      const result = await cloudinary.search
        .expression('folder:hochzeit AND resource_type:image')
        .sort_by('created_at', 'desc')
        .with_field('context')
        .max_results(200)
        .execute();

      const images = (result.resources || []).map((r) => ({
        id: r.public_id,
        url: cloudinary.url(r.public_id, {
          quality: 'auto:eco',
          fetch_format: 'auto',
          width: 1920,
          height: 1920,
          crop: 'limit',
        }),
        thumbUrl: cloudinary.url(r.public_id, {
          quality: 'auto',
          fetch_format: 'auto',
          width: 240,
          height: 240,
          crop: 'fill',
          gravity: 'auto',
        }),
        downloadUrl: cloudinary.url(r.public_id, {
          flags: 'attachment',
          secure: true,
          resource_type: 'image',
          format: r.format,
        }),
        createdAt: r.created_at,
        name: r.context?.alt || '',
        message: r.context?.caption || '',
      }));

      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(200).json({ images });
    }

    res.setHeader('Allow', 'GET, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('images error:', err);
    res.status(500).json({ error: 'Bilder konnten nicht verarbeitet werden', detail: String(err.message || err) });
  }
};
