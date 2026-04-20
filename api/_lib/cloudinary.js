// Cloudinary-Helper mit Event-Scoping.
// Alle Pfade liegen unterhalb von `events/<eventId>/`, damit ein Upload niemals
// versehentlich in einem anderen Event landet. Der alte `hochzeit/`-Ordner bleibt
// für Legacy-Betrieb bestehen (siehe api/images.js etc.).

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function eventPhotoFolder(eventId) {
  return `events/${eventId}/photos`;
}
function eventCouplePhotoPublicId(eventId) {
  return `events/${eventId}/meta/couple-photo`;
}
function eventSettingsPublicId(eventId) {
  return `events/${eventId}/meta/settings`;
}

module.exports = {
  cloudinary,
  eventPhotoFolder,
  eventCouplePhotoPublicId,
  eventSettingsPublicId,
};
