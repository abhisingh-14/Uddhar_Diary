const { createClient } = require("@supabase/supabase-js");

/**
 * Factory function that returns a FRESH Supabase client each time it's called.
 * 
 * This client uses the anon key for password verification operations, ensuring
 * that we use the correct authentication flow (signInWithPassword) rather than
 * admin operations. The client is created fresh each time to avoid any session
 * persistence issues.
 * 
 * @returns {Object} A new Supabase client instance
 * @throws {Error} If SUPABASE_URL or SUPABASE_ANON_KEY environment variables are missing
 */
const createVerifierClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variable");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};

module.exports = { createVerifierClient };
