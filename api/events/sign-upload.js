// POST /api/events/sign-upload
// Body: { slug, name?, message?, mode? }
//   mode = 'guest' (Default): Gäste-Upload in events/<eventId>/photos
//   mode = 'couple':          Brautpaar-Bild, nur für eingeloggten Owner erlaubt
//
// Öffentlicher Zugriff im Guest-Modus — aber der Ordner wird hart auf das Event
// gescopt, sodass niemand "rausspringen" kann.

const { getAdmin } = require('../_lib/supabase');
const { getUser } = require('../_lib/auth');
const {
  cloudinary,
  eventPhotoFolder,
  eventCouplePhotoPublicId,
} = require('../_lib/cloudinary');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { slug, name = '', message = '', mode = 'guest' } = req.body || {};
    if (!slug) return res.status(400).json({ error: 'Slug fehlt' });

    const admin = getAdmin();
    const { data: ev, error } = await admin
      .from('events')
      .select('id, slug, status, owner_id')
      .eq('slug', String(slug).toLowerCase())
      .single();
    if (error || !ev) return res.status(404).json({ error: 'Event nicht gefunden' });
    if (ev.status !== 'active') return res.status(403).json({ error: 'Event nicht aktiv' });

    const timestamp = Math.round(Date.now() / 1000);

    if (mode === 'couple') {
      const user = await getUser(req);
      if (!user || user.id !== ev.owner_id) {
        return res.status(401).json({ error: 'Nicht berechtigt' });
      }
      const publicId = eventCouplePhotoPublicId(ev.id); // "events/<id>/meta/couple-photo"
      // public_id enthält Ordner → kein "folder" nötig
      const paramsToSign = {
        timestamp,
        public_id: publicId,
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
        publicId,
        overwrite: true,
        invalidate: true,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      });
    }

    // Gast-Upload
    const folder = eventPhotoFolder(ev.id);
    const safeName = String(name).replace(/[|=]/g, ' ').slice(0, 60);
    const safeMessage = String(message).replace(/[|=]/g, ' ').slice(0, 200);
    const context = `caption=${safeMessage}|alt=${safeName}`;
    const paramsToSign = { timestamp, folder, context };
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
