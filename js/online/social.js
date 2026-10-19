// Friends, online presence and island visits on the Reelhaven server.
//
//   * Friend requests, accepting and removing are validated by server.py
//     (you can only touch friendships you're part of, codes must exist...).
//   * Presence is pushed by the server: you only ever learn whether your
//     *friends* are online / visiting. It disappears when a tab closes.
//   * Island channels relay positions between people on the same island; the
//     server checks that visitors are friends of the host. Nothing here can
//     change anyone's saved data.
export class Social {
  constructor(auth) {
    this.auth = auth;
    this.online = new Map();        // username -> { status }
    this.listeners = new Set();
    this.room = null;               // { host, island, handlers }
    this.status = { status: 'home' };
    const net = auth.net;
    net.on('presence', m => {
      this.online = new Map(Object.entries(m.online || {}).map(([u, st]) => [u, { status: st }]));
      this.emit();
    });
    net.on('friends_changed', () => this.emit('friends'));
    net.on('peers', m => {
      const r = this.room;
      if (!r || m.host !== r.host || m.island !== r.island) return;
      r.handlers.onPeers?.((m.list || []).map(p => ({ id: p.user, ...p })));
    });
    net.on('pos', m => {
      if (this.room) this.room.handlers.onMove?.(m.user, m);
    });
  }

  get net() { return this.auth.net; }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(what = 'presence') { for (const fn of [...this.listeners]) { try { fn(what, this); } catch (e) { console.error(e); } } }

  // ------------------------------------------------------------ friends
  async list() { return (await this.net.request('friends')).list; }
  async find(code) { return (await this.net.request('find', { code })).player; }
  /** Returns 'sent' | 'accepted' | 'already_friends' | 'already_requested'. */
  async request(code) { return (await this.net.request('friend_request', { code })).status; }
  async respond(fid, accept) { await this.net.request('friend_respond', { fid, accept }); }
  /** Cancel a sent request, or remove a friend. */
  async remove(fid) { await this.net.request('friend_remove', { fid }); }
  async snapshotOf(user) { return (await this.net.request('visit_get', { user })).snapshot; }

  // ------------------------------------------------------------ presence
  isOnline(user) { return this.online.has(user); }

  async setStatus(status) {
    this.status = status;
    if (this.auth.signedIn) { try { await this.net.request('presence', status); } catch { /* offline */ } }
  }

  /** After (re)connecting: tell the server our status again. */
  resync() { this.setStatus(this.status); }

  clear() { this.online = new Map(); this.room = null; this.emit(); }

  // ------------------------------------------------------------ islands
  /**
   * Join the live channel for someone's island (host or visitor).
   * handlers.onPeers(list), handlers.onMove(id, pos). Returns { send, leave }.
   */
  joinIsland(host, island, me, handlers) {
    this.room = { host, island, handlers };
    this.net.request('island_join', { host, island, x: Math.round(me.x), y: Math.round(me.y), f: me.f })
      .catch(err => { console.warn('Could not join island channel', err.message); });
    return {
      send: pos => this.net.send('pos', pos),
      leave: () => {
        if (this.room && this.room.host === host && this.room.island === island) this.room = null;
        this.net.send('island_leave');
      },
    };
  }
}
