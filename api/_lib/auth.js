// Auth-Utilities
// - readAccessToken(req):   liest den Bearer-Token aus dem Authorization-Header
//                           oder dem `sb-access-token`-Cookie
// - getUser(req):           liefert den aktuell eingeloggten User (oder null)
// - requireUser(req, res):  liefert den User oder sendet 401 und gibt null zurück
// - isSuperAdmin(email):    prüft, ob eine E-Mail in SUPER_ADMIN_EMAILS steht
// - requireSuperAdmin:      wie requireUser, aber zusätzlich Super-Admin-Check

const { getAdmin } = require('./supabase');

function readAccessToken(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookie = req.headers['cookie'] || '';
  const match = cookie.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  return null;
}

async function getUser(req) {
  const token = readAccessToken(req);
  if (!token) return null;
  try {
    const admin = getAdmin();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch (err) {
    console.error('getUser-Fehler:', err);
    return null;
  }
}

async function requireUser(req, res) {
  const user = await getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Nicht eingeloggt' });
    return null;
  }
  return user;
}

function isSuperAdmin(email) {
  if (!email) return false;
  const list = (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

async function requireSuperAdmin(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (!isSuperAdmin(user.email)) {
    res.status(403).json({ error: 'Nicht berechtigt' });
    return null;
  }
  return user;
}

module.exports = {
  readAccessToken,
  getUser,
  requireUser,
  isSuperAdmin,
  requireSuperAdmin,
};
