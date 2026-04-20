// GET /api/auth/session
// Liefert den aktuell eingeloggten User (oder 401) inkl. Super-Admin-Flag.

const { getUser, isSuperAdmin } = require('../_lib/auth');

module.exports = async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ user: null });
  res.status(200).json({
    user: {
      id: user.id,
      email: user.email,
      superAdmin: isSuperAdmin(user.email),
    },
  });
};
