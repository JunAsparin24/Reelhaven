// Accounts (Supabase Auth): email + password, email magic link, password
// reset, optional Google sign-in, and the player's public profile.
//
// status: 'disabled'  online services not configured for this build
//         'loading'   starting up
//         'offline'   configured, but the service couldn't be reached
//         'signedOut' / 'signedIn'
import { loadOnlineConfig } from './config.js';
import { getSupabase } from './supabase.js';

const NAME_RE = /^[\p{L}\p{N} _.'-]{2,20}$/u;

export function validDisplayName(name) {
  const n = (name || '').trim();
  if (n.length < 2) return 'Names need at least 2 characters.';
  if (n.length > 20) return 'Names can be at most 20 characters.';
  if (!NAME_RE.test(n)) return 'Use letters, numbers, spaces, and . _ \' - only.';
  return null;
}

export function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || '').trim()) ? null : 'Please enter a valid email address.';
}

export function validPassword(pw) {
  return (pw || '').length >= 8 ? null : 'Passwords need at least 8 characters.';
}

/** Turn library / network errors into friendly sentences (no raw internals). */
export function friendlyError(err) {
  const msg = String(err?.message || err || '');
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg) || err?.name === 'TypeError') return 'You seem to be offline. Your island is still saved on this device.';
  if (/invalid login credentials/i.test(msg)) return "That email and password don't match.";
  if (/already registered|already been registered|user already exists/i.test(msg)) return 'An account with that email already exists — try signing in instead.';
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email first — check your inbox for the link.';
  if (/rate limit|too many|429/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.';
  if (/password should be|weak password|at least/i.test(msg)) return 'Please choose a stronger password (at least 8 characters).';
  if (/no player has that friend code/i.test(msg)) return 'No islander has that friend code.';
  if (/your own friend code/i.test(msg)) return "That's your own friend code!";
  if (/too many pending/i.test(msg)) return 'You have too many pending requests. Cancel some first.';
  if (/request not found/i.test(msg)) return 'That request is no longer available.';
  if (/jwt|not signed in|session/i.test(msg)) return 'Your session expired. Please sign in again.';
  return 'Something went wrong. Please try again.';
}

export class AuthService {
  constructor() {
    this.status = 'loading';
    this.user = null;
    this.profile = null;
    this.config = null;
    this.sb = null;
    this.error = null;
    this.listeners = new Set();
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, data) { for (const fn of [...this.listeners]) { try { fn(type, data); } catch (e) { console.error(e); } } }
  set(patch) { Object.assign(this, patch); this.emit('change', this); }

  get enabled() { return this.status !== 'disabled'; }
  get signedIn() { return this.status === 'signedIn' && !!this.user; }

  async init() {
    this.config = await loadOnlineConfig();
    if (!this.config) { this.set({ status: 'disabled' }); return; }
    try {
      this.sb = await getSupabase(this.config);
    } catch (err) {
      console.warn('Online services unavailable', err);
      this.set({ status: 'offline', error: 'Online services could not be reached. You can keep playing offline.' });
      return;
    }
    // Supabase recommends not awaiting other calls inside this callback.
    this.sb.auth.onAuthStateChange((event, session) => { setTimeout(() => this.handle(event, session), 0); });
    try {
      const { data } = await this.sb.auth.getSession();
      await this.handle('INITIAL', data.session);
    } catch (err) {
      this.set({ status: 'offline', error: friendlyError(err) });
    }
  }

  async handle(event, session) {
    if (event === 'PASSWORD_RECOVERY') this.emit('recovery');
    const user = session?.user || null;
    if (!user) {
      const was = this.user;
      this.set({ status: 'signedOut', user: null, profile: null });
      if (was) this.emit('signedOut', was);
      return;
    }
    const changed = this.user?.id !== user.id;
    this.user = user;
    if (changed || !this.profile) await this.loadProfile();
    this.set({ status: 'signedIn', error: null });
    if (changed) this.emit('signedIn', user);
  }

  async loadProfile() {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await this.sb.from('profiles').select('*').eq('id', this.user.id).maybeSingle();
      if (!error && data) { this.profile = data; return data; }
      // The profile is created by a database trigger right after sign-up.
      await new Promise(r => setTimeout(r, 600));
    }
    this.profile = null;
    return null;
  }

  redirectUrl() { return location.origin + location.pathname; }

  // ------------------------------------------------------------ auth actions
  async signUp(email, password, displayName) {
    const { data, error } = await this.sb.auth.signUp({
      email: email.trim(), password,
      options: { data: { display_name: displayName.trim() }, emailRedirectTo: this.redirectUrl() },
    });
    if (error) throw error;
    // With email confirmation on, there is no session until the link is used.
    // Supabase also returns a user with no identities for an existing email.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('User already registered');
    }
    return { needsConfirmation: !data.session };
  }

  async signIn(email, password) {
    const { error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }

  async sendMagicLink(email) {
    const { error } = await this.sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: this.redirectUrl(), shouldCreateUser: true } });
    if (error) throw error;
  }

  async resetPassword(email) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: this.redirectUrl() });
    if (error) throw error;
  }

  async updatePassword(password) {
    const { error } = await this.sb.auth.updateUser({ password });
    if (error) throw error;
  }

  async signInWithGoogle() {
    const { error } = await this.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: this.redirectUrl() } });
    if (error) throw error;
  }

  async signOut() {
    const { error } = await this.sb.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }

  // ------------------------------------------------------------ profile
  /** fields: { display_name?, island_name?, look?, level?, allow_visits? } */
  async updateProfile(fields) {
    if (fields.display_name !== undefined) {
      const bad = validDisplayName(fields.display_name);
      if (bad) throw new Error(bad);
      fields.display_name = fields.display_name.trim();
    }
    const { data, error } = await this.sb.from('profiles').update(fields).eq('id', this.user.id).select().single();
    if (error) throw error;
    this.set({ profile: data });
    return data;
  }
}
