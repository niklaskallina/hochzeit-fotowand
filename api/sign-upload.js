// /api/sign-upload.js
// Generiert eine signierte Upload-URL für Cloudinary.
// Unterstützt zwei Modi:
//   - "guest"  (Standard): Gäste-Fotos in Ordner "hochzeit"
//   - "couple" (Admin):   Brautpaar-Bild in Ordner "hochzeit-meta", geschützt per Admin-Passwort

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name = '', message = '', mode = 'guest' } = req.body || {};

    const timestamp = Math.round(Date.now() / 1000);

    if (mode === 'couple') {
      // Admin-Upload: Brautpaar-Bild
      const adminPw = process.env.ADMIN_PASSWORD;
      if (adminPw && req.headers['x-admin-password'] !== adminPw) {
        return res.status(401).json({ error: 'Falsches Admin-Passwort' });
      }

      const paramsToSign = {
        timestamp,
        folder: 'hochzeit-meta',
        public_id: 'couple-photo',
        overwrite: true,
        invalidate: true,
      };
      const signature = cloudinary.utils.api_sign_request(
        paramsToSign,
        process.env.CLOUDINARY_API_SECRET
      );
      return res.status(200).json({
        mode: 'couple',
        signature,
        timestamp,
        folder: 'hochzeit-meta',
        publicId: 'couple-photo',
        overwrite: true,
        invalidate: true,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      });
    }

    // Gast-Upload: Fotos in den Hochzeitsordner
    const folder = 'hochzeit';
    const safeName = String(name).replace(/[|=]/g, ' ').slice(0, 60);
    const safeMessage = String(message).replace(/[|=]/g, ' ').slice(0, 200);
    const context = `caption=${safeMessage}|alt=${safeName}`;

    const paramsToSign = {
      timestamp,
      folder,
      context,
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    res.status(200).json({
      mode: 'guest',
      signature,
      timestamp,
      folder,
      context,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Signatur konnte nicht erstellt werden' });
  }
};
