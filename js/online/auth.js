// Accounts on the Reelhaven server (server.py): username + password. A device
// keeps a sign-in token (never the password) so it reconnects automatically.
//
// status: 'disabled'  no server behind this page (e.g. a plain static host)
//         'loading'   connecting
//         'offline'   the server was reachable before but isn't right now
//         'signedOut' / 'signedIn'
import { Net } from './net.js';

const SESSION_KEY = 'reelhaven.session';
const SEEN_SERVER_KEY = 'reelhaven.server';

const USERNAME_RE = /^[a-z0-9_-]{3,16}$/;
const NAME_RE = /^[\p{L}\p{N} _.'-]{2,20}$/u;

export function validUsername(u) {
  return USERNAME_RE.test((u || '').trim().toLowerCase()) ? null : 'Usernames are 3–16 letters, numbers, _ or -.';
}
export function validDisplayName(name) {
  const n = (name || '').trim();
  if (n.length < 2) return 'Names need at least 2 characters.';
  if (n.length > 20) return 'Names can be at most 20 characters.';
  if (!NAME_RE.test(n)) return 'Use letters, numbers, spaces, and . _ \' - only.';
  return null;
}
export function validPassword(pw) {
  return (pw || '').length >= 6 ? null : 'Passwords need at least 6 characters.';
}

/** Server errors are already player-friendly; network errors get a kind message. */
export function friendlyError(err) {
  if (err?.server) return err.message;
  if (err?.code === 'offline' || /failed to fetch|network|connection/i.test(String(err?.message || ''))) return 'You seem to be offline. Your island is still saved on this device.';
  return 'Something went wrong. Please try again.';
}

export class AuthService {
  constructor() {
    this.net = new Net();
    this.status = 'loading';
    this.user = null;          // { id: username }
    this.profile = null;       // { username, name, code, allowVisits, level, look }
    this.error = null;
    this.listeners = new Set();
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, data) { for (const fn of [...this.listeners]) { try { fn(type, data); } catch (e) { console.error(e); } } }
  set(patch) { Object.assign(this, patch); this.emit('change', this); }

  get enabled() { return this.status !== 'disabled'; }
  get signedIn() { return this.status === 'signedIn' && !!this.user; }

  session() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch { return null; } }
  storeSession(s) { try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch { /* private mode */ } }

  init() {
    return new Promise(resolve => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(); } };
      this.net.onUnavailable = () => {
        // No server: either this copy is hosted as plain files, or it's down.
        const seen = localStorage.getItem(SEEN_SERVER_KEY);
        this.set({ status: seen ? 'offline' : 'disabled', error: seen ? 'The Reelhaven server can’t be reached right now.' : null });
        done();
        if (seen) setTimeout(() => this.net.connect(), 5000);
      };
      this.net.onOpen = async () => {
        try { localStorage.setItem(SEEN_SERVER_KEY, '1'); } catch { /* ignore */ }
        await this.resume();
        done();
      };
      this.net.onClose = () => { if (this.signedIn) this.set({ status: 'offline', error: 'Lost connection — reconnecting…' }); };
      this.net.connect();
    });
  }

  /** Re-use this device's sign-in token after (re)connecting. */
  async resume() {
    const s = this.session();
    if (!s) { this.set({ status: 'signedOut', error: null }); return; }
    try {
      const res = await this.net.request('resume', { username: s.username, token: s.token });
      this.applySignIn(res, false);
    } catch (err) {
      if (err.server) { this.storeSession(null); const was = this.user; this.set({ status: 'signedOut', user: null, profile: null }); if (was) this.emit('signedOut', was); }
      else this.set({ status: 'offline', error: friendlyError(err) });
    }
  }

  applySignIn(res, fresh) {
    const changed = this.user?.id !== res.account.username;
    this.storeSession({ username: res.account.username, token: res.token });
    this.user = { id: res.account.username };
    this.set({ status: 'signedIn', profile: res.account, error: null });
    if (changed || fresh) this.emit('signedIn', this.user);
    else this.emit('reconnected', this.user);
  }

  /** Accounts are just a username and password; friends see the username. */
  async signUp(username, password) {
    const user = username.trim().toLowerCase();
    const res = await this.net.request('signup', { username: user, password, name: user });
    this.applySignIn(res, true);
  }

  async signIn(username, password) {
    const res = await this.net.request('login', { username: username.trim().toLowerCase(), password });
    this.applySignIn(res, true);
  }

  async changePassword(oldPw, newPw) {
    const res = await this.net.request('password', { old: oldPw, new: newPw });
    this.applySignIn(res, false);
  }

  async signOut() {
    const s = this.session();
    try { await this.net.request('logout', { token: s?.token }); } catch { /* offline: forget locally anyway */ }
    this.storeSession(null);
    const was = this.user;
    this.set({ status: this.net.connected ? 'signedOut' : 'offline', user: null, profile: null });
    if (was) this.emit('signedOut', was);
  }

  /** fields: { name?, allowVisits? } */
  async updateProfile(fields) {
    if (fields.name !== undefined) {
      const bad = validDisplayName(fields.name);
      if (bad) { const e = new Error(bad); e.server = true; throw e; }
    }
    const res = await this.net.request('profile', fields);
    this.set({ profile: res.account });
    return res.account;
  }
}
