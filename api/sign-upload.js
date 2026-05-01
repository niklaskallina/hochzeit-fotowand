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

const SETTINGS_PUBLIC_ID = 'hochzeit-meta/settings';

// Vor jedem Upload kurz checken, was der Admin als Upload-Kompression eingestellt hat.
// Mit kleinem In-Memory-Cache (60s), damit nicht jeder Upload-Request einen extra
// Cloudinary-Resource-Call kostet.
let settingsCache = null;
let settingsCacheUntil = 0;
async function getUploadCompression() {
  const now = Date.now();
  if (settingsCache && now < settingsCacheUntil) return settingsCache.uploadCompression || 'original';
  try {
    const resource = await cloudinary.api.resource(SETTINGS_PUBLIC_ID, { resource_type: 'raw' });
    const url = cloudinary.url(SETTINGS_PUBLIC_ID, { resource_type: 'raw', version: resource.version, sign_url: false });
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return 'original';
    settingsCache = JSON.parse(await r.text());
    settingsCacheUntil = now + 60_000;
    return settingsCache.uploadCompression || 'original';
  } catch (e) {
    return 'original';
  }
}

// Cloudinary-Transformation-String je nach Profil. `transformation` auf Upload ist
// destruktiv — das Original wird durch die transformierte Version ersetzt.
function uploadTransformationFor(profile) {
  switch (profile) {
    case 'high':   return 'c_limit,w_3000,h_3000,q_auto:good';
    case 'medium': return 'c_limit,w_2400,h_2400,q_auto:good';
    case 'low':    return 'c_limit,w_2000,h_2000,q_auto:eco';
    case 'original':
    default:       return null; // kein transform → Original bleibt unverändert
  }
}

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

    const compression = await getUploadCompression();
    const transformation = uploadTransformationFor(compression);

    const paramsToSign = {
      timestamp,
      folder,
      context,
    };
    if (transformation) paramsToSign.transformation = transformation;

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
      ...(transformation ? { transformation } : {}),
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Signatur konnte nicht erstellt werden' });
  }
};
