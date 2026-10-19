// Friends, online presence and island-visit channels (Supabase).
//
//   * Friend list / requests come from database functions that validate every
//     action on the server (see supabase/migrations).
//   * Presence: every signed-in player joins one Realtime presence channel
//     keyed by their user id; we only *display* presence for friends.
//     Presence is temporary — it disappears when the tab closes or the
//     connection drops (Realtime times out stale clients).
//   * Island channels ("reelhaven:island:<hostId>:<islandId>") carry visitor
//     and host positions as small broadcast messages. Nothing here can change
//     anyone's saved data.
export class Social {
  constructor(auth) {
    this.auth = auth;
    this.online = new Map();        // userId -> { status, island }
    this.listeners = new Set();
    this.presence = null;
    this.myStatus = { status: 'home' };
  }

  get sb() { return this.auth.sb; }
  get me() { return this.auth.user?.id; }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of [...this.listeners]) { try { fn(this); } catch (e) { console.error(e); } } }

  // ------------------------------------------------------------ friends
  async list() {
    const { data, error } = await this.sb.rpc('list_friends');
    if (error) throw error;
    return data || [];
  }

  async find(code) {
    const { data, error } = await this.sb.rpc('find_player', { p_code: code });
    if (error) throw error;
    return data?.[0] || null;
  }

  /** Returns 'sent' | 'accepted' | 'already_friends' | 'already_requested'. */
  async request(code) {
    const { data, error } = await this.sb.rpc('send_friend_request', { p_code: code });
    if (error) throw error;
    return data;
  }

  async respond(friendshipId, accept) {
    const { error } = await this.sb.rpc('respond_friend_request', { p_id: friendshipId, p_accept: accept });
    if (error) throw error;
  }

  /** Cancel an outgoing request, or remove a friend (RLS allows either party). */
  async remove(friendshipId) {
    const { error } = await this.sb.from('friendships').delete().eq('id', friendshipId);
    if (error) throw error;
  }

  async snapshotOf(userId) {
    const { data, error } = await this.sb.from('island_snapshots').select('data, updated_at').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data;
  }

  // ------------------------------------------------------------ presence
  joinPresence() {
    if (this.presence || !this.me) return;
    const ch = this.sb.channel('reelhaven:online', { config: { presence: { key: this.me } } });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      this.online = new Map(Object.entries(state).map(([id, metas]) => [id, metas[metas.length - 1] || {}]));
      this.emit();
    });
    ch.subscribe(async status => {
      if (status === 'SUBSCRIBED') await ch.track({ ...this.myStatus, at: Date.now() });
    });
    this.presence = ch;
  }

  async setStatus(status) {
    this.myStatus = status;
    if (this.presence) { try { await this.presence.track({ ...status, at: Date.now() }); } catch { /* reconnecting */ } }
  }

  leavePresence() {
    if (this.presence) { this.sb.removeChannel(this.presence); this.presence = null; }
    this.online = new Map();
    this.emit();
  }

  isOnline(userId) { return this.online.has(userId); }

  // ------------------------------------------------------------ island channels
  /**
   * Join the live channel for someone's island. handlers.onPeers(list) gets the
   * other players there; handlers.onMove(id, pos) gets position updates.
   * Returns { send(pos), leave() }.
   */
  joinIsland(hostId, islandId, me, handlers) {
    const ch = this.sb.channel(`reelhaven:island:${hostId}:${islandId}`, { config: { presence: { key: this.me }, broadcast: { self: false } } });
    const peers = () => {
      const st = ch.presenceState();
      const list = Object.entries(st).filter(([id]) => id !== this.me).map(([id, metas]) => ({ id, ...(metas[metas.length - 1] || {}) }));
      handlers.onPeers?.(list);
    };
    ch.on('presence', { event: 'sync' }, peers);
    ch.on('broadcast', { event: 'pos' }, ({ payload }) => { if (payload && payload.id !== this.me) handlers.onMove?.(payload.id, payload); });
    ch.subscribe(async status => {
      if (status === 'SUBSCRIBED') await ch.track({ name: me.name, look: me.look, host: me.host, x: me.x, y: me.y, f: me.f });
    });
    return {
      send: pos => ch.send({ type: 'broadcast', event: 'pos', payload: { id: this.me, ...pos } }),
      leave: () => this.sb.removeChannel(ch),
    };
  }
}
