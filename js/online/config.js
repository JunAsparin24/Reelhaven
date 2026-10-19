// Online configuration. The game reads config.json (next to index.html) at
// startup. It is NOT committed: copy config.example.json for local
// development, or let the Render build write it from environment variables.
// Only the public "anon" key belongs here — row-level security protects data.
// Never put a service-role key in the client.

let cached;

/** Returns { supabaseUrl, supabaseAnonKey, googleAuth } or null (offline build). */
export async function loadOnlineConfig() {
  if (cached !== undefined) return cached;
  try {
    const res = await fetch('config.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('no config');
    const c = await res.json();
    const ok = c && typeof c.supabaseUrl === 'string' && /^https:\/\//.test(c.supabaseUrl) && typeof c.supabaseAnonKey === 'string' && c.supabaseAnonKey.length > 20;
    cached = ok ? { supabaseUrl: c.supabaseUrl.replace(/\/$/, ''), supabaseAnonKey: c.supabaseAnonKey, googleAuth: c.googleAuth === true } : null;
  } catch {
    cached = null;
  }
  return cached;
}
