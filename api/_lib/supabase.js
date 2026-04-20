// Supabase-Clients
// - admin:   nutzt den service_role Key, umgeht RLS. NUR serverseitig verwenden.
// - anon:    für User-Kontext (mit Access-Token aus Cookie/Header)

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase nicht konfiguriert (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen)');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getAnon(accessToken) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase nicht konfiguriert (SUPABASE_URL / SUPABASE_ANON_KEY fehlen)');
  }
  const opts = {
    auth: { autoRefreshToken: false, persistSession: false },
  };
  if (accessToken) {
    opts.global = { headers: { Authorization: `Bearer ${accessToken}` } };
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
}

module.exports = { getAdmin, getAnon };
