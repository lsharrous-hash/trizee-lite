const { createClient } = require('@supabase/supabase-js');
const config = require('./env');

// Client avec clé service (accès admin complet)
const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Client avec clé anon (pour les opérations côté client si nécessaire)
const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey
);

module.exports = {
  supabase,
  supabaseAdmin,
};
