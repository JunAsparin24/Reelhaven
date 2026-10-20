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
    net.on('relay', m => {
      if (this.room && m.host === this.room.host && m.island === this.room.island) this.room.handlers.onRelay?.(m);
    });
    net.on('pos', m => {
      if (this.room) this.room.handlers.onMove?.(m.user, m);
    });
    // Co-op building (host's game is the authority for its island).
    net.on('coop_edit', m => this.room?.handlers.onCoopEdit?.(m));
    net.on('coop_layout', m => { if (this.room && m.host === this.room.host && m.island === this.room.island) this.room.handlers.onCoopLayout?.(m); });
    net.on('coop_result', m => {
      const p = this.coopPending.get(m.req);
      if (!p) return;
      this.coopPending.delete(m.req);
      clearTimeout(p.timer);
      p.resolve(m);
    });
    this.coopPending = new Map();
    // Hosted multiplayer games.
    this.hosting = null;            // { code, members: [{user, name}] } while I host
    this.joined = null;             // { host, name } while I'm in someone's game
    this.handlers = {};             // set by the UI: onInvite, onJoined, onSessionEnd, onSessionMove
    net.on('session', m => { this.hosting = { code: m.code, members: m.members || [] }; this.emit('session'); });
    net.on('session_joined', m => this.handlers.onJoined?.(m));
    net.on('invite', m => this.handlers.onInvite?.(m));
    net.on('session_end', m => {
      if (this.joined && this.joined.host === m.host) { this.joined = null; this.handlers.onSessionEnd?.(m); }
      this.emit('session');
    });
    net.on('session_move', m => { if (this.joined && this.joined.host === m.host) this.handlers.onSessionMove?.(m); });
  }

  // ------------------------------------------------------------ hosted games
  async hostStart() { const r = await this.net.request('host_start'); this.hosting = r; this.emit('session'); return r; }
  async hostStop() { await this.net.request('host_stop'); this.hosting = null; this.emit('session'); }
  async hostStatus() { const r = await this.net.request('host_status'); this.hosting = r.code ? r : null; this.emit('session'); return this.hosting; }
  async kick(user) { await this.net.request('host_kick', { user }); }
  async invite(user) { const r = await this.net.request('invite', { user }); this.hosting = r; this.emit('session'); return r; }
  /** Join by invite code or by an invite from a friend. Resolves { host, name, island }. */
  async joinCode(code) { const r = await this.net.request('join_code', { code }); this.joined = { host: r.host, name: r.name }; this.emit('session'); return r; }
  async joinInvite(host) { const r = await this.net.request('join_invite', { host }); this.joined = { host: r.host, name: r.name }; this.emit('session'); return r; }
  async leaveSession() {
    const j = this.joined; this.joined = null; this.emit('session');
    if (j) { try { await this.net.request('session_leave', { host: j.host }); } catch { /* offline */ } }
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

  clear() { this.online = new Map(); this.room = null; this.hosting = null; this.joined = null; this.emit(); }

  // ------------------------------------------------------------ co-op
  /** Visitor → host: ask to place / move something. Resolves { ok, error }. */
  async coopEdit(edit) {
    const req = Math.random().toString(36).slice(2, 10);
    const reply = new Promise(resolve => {
      const timer = setTimeout(() => { this.coopPending.delete(req); resolve({ ok: false, error: 'The host didn’t answer — try again.' }); }, 8000);
      this.coopPending.set(req, { resolve, timer });
    });
    try { await this.net.request('coop_edit', { ...edit, req }); }
    catch (err) { const p = this.coopPending.get(req); if (p) { clearTimeout(p.timer); this.coopPending.delete(req); } return { ok: false, error: err.server ? err.message : 'You seem to be offline.' }; }
    return reply;
  }
  coopResult(to, req, ok, error = '') { this.net.send('coop_result', { to, req, ok, error }); }
  shareLayout(flags, placements) { this.net.send('coop_layout', { flags, placements }); }
  /** Tell everyone on this island something small (sleep / wake / clock). */
  relay(kind, data) { this.net.send('room_relay', { kind, data }); }

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
