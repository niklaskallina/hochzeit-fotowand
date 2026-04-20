// /api/images.js
// Liefert die Liste aller Bilder aus dem Hochzeitsordner, sortiert nach Upload-Zeit (neueste zuerst).
 
const cloudinary = require('cloudinary').v2;
 
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
 
module.exports = async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression('folder:hochzeit AND resource_type:image')
      .sort_by('created_at', 'desc')
      .with_field('context')
      .max_results(200)
      .execute();
 
    const images = (result.resources || []).map((r) => ({
      id: r.public_id,
      url: cloudinary.url(r.public_id, {
        quality: 'auto',
        fetch_format: 'auto',
        width: 1920,
        height: 1920,
        crop: 'limit',
      }),
      createdAt: r.created_at,
      name: r.context?.alt || '',
      message: r.context?.caption || '',
    }));
 
    // Kein Caching, damit neue Bilder sofort erscheinen
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).json({ images });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bilder konnten nicht geladen werden' });
  }
};
