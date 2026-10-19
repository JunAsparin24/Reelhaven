// Loads the official Supabase client on demand (only when online services are
// configured), from a pinned CDN build so the game keeps zero npm dependencies.
// supabase-js v2: https://supabase.com/docs/reference/javascript
export const SUPABASE_JS_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

let client = null;
let loading = null;

export function getSupabase(config) {
  if (client) return Promise.resolve(client);
  if (!loading) {
    loading = import(SUPABASE_JS_URL).then(({ createClient }) => {
      client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,   // finishes email links / OAuth redirects
          flowType: 'pkce',
          storageKey: 'reelhaven-auth',
        },
      });
      return client;
    }).catch(err => { loading = null; throw err; });
  }
  return loading;
}
