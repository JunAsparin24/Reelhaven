// WebSocket link to server.py (same origin, path /ws): request/response calls,
// server pushes, heartbeat and automatic reconnect. If the page is served by
// a plain static host (no server.py), the first connection fails and the game
// simply stays offline.
const RECONNECT_MS = 2000;
const TIMEOUT_MS = 15000;

export class Net {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.everConnected = false;
    this.nextId = 1;
    this.pending = new Map();      // id -> { resolve, reject, timer }
    this.listeners = new Map();    // type -> Set(fn)
    this.onOpen = null;            // (firstTime) => void
    this.onClose = null;
    this.onUnavailable = null;     // no server behind this page
    this.stopped = false;
    setInterval(() => { if (this.connected) this.send('ping'); }, 25000);
  }

  connect() {
    if (this.stopped) return;
    let opened = false;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    let ws;
    try { ws = new WebSocket(`${proto}://${location.host}/ws`); }
    catch { this.onUnavailable?.(); return; }
    this.ws = ws;
    ws.onopen = () => {
      opened = true;
      const first = !this.everConnected;
      this.connected = true;
      this.everConnected = true;
      this.onOpen?.(first);
    };
    ws.onmessage = e => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'res') {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.ok) p.resolve(msg.data);
        else { const err = new Error(msg.error || 'Request failed'); err.code = msg.code; err.server = true; p.reject(err); }
        return;
      }
      this.listeners.get(msg.t)?.forEach(fn => { try { fn(msg); } catch (err) { console.error(err); } });
    };
    ws.onclose = () => {
      const was = this.connected;
      this.connected = false;
      for (const [, p] of this.pending) { clearTimeout(p.timer); const err = new Error('Connection lost'); err.code = 'offline'; p.reject(err); }
      this.pending.clear();
      if (!opened && !this.everConnected) { this.onUnavailable?.(); return; }   // nothing to talk to
      if (was) this.onClose?.();
      setTimeout(() => this.connect(), RECONNECT_MS);
    };
  }

  /** Fire-and-forget message. */
  send(t, data = {}) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t, ...data }));
  }

  /** Request with a reply; rejects with err.code ('offline', 'conflict', ...). */
  request(t, data = {}) {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState !== WebSocket.OPEN) { const err = new Error('You seem to be offline.'); err.code = 'offline'; reject(err); return; }
      const id = this.nextId++;
      const timer = setTimeout(() => { this.pending.delete(id); const err = new Error('The server took too long to answer.'); err.code = 'offline'; reject(err); }, TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ t, id, ...data }));
    });
  }

  on(t, fn) {
    if (!this.listeners.has(t)) this.listeners.set(t, new Set());
    this.listeners.get(t).add(fn);
    return () => this.listeners.get(t).delete(fn);
  }
}
