// Cloud save synchronisation.
//
// Ownership of data:
//   * The local save (save.js) is always what the game plays from — the game
//     works offline and as a guest with no account.
//   * When signed in, the account's row in `saves` is the cloud copy. Each
//     write carries the revision we last saw; the server only accepts
//     revision + 1, so two devices can never silently overwrite each other.
//   * Local sync metadata (which account the local save belongs to, the last
//     synced revision, whether there are unsynced changes) lives under
//     SYNC_KEY.
//
// Nothing is ever deleted automatically: whenever a copy would be replaced,
// it is archived first (Settings → Save data lists archives).
import * as Save from '../save.js';
import { SAVE_VERSION } from '../state.js';
import { islandSnapshot } from '../multiplayer.js';

const SYNC_KEY = 'tidetown.sync';
const PUSH_DELAY = 12_000;           // batch frequent local saves into one upload
const RETRY = [10, 30, 60, 120, 300]; // seconds

/** Short summary used to compare two saves and to show them to the player. */
export function summarize(state) {
  if (!state) return null;
  return {
    name: state.player?.name,
    level: state.player?.level,
    xp: state.player?.xp,
    coins: state.player?.coins,
    species: Object.keys(state.collection || {}).length,
    fishCaught: state.stats?.fishCaught || 0,
    quests: state.quests?.index || 0,
    builds: Object.values(state.islands || {}).reduce((n, i) => n + (i.placements?.length || 0), 0),
    savedAt: state.savedAt || 0,
  };
}

/** True when two saves represent meaningfully different progress. */
export function differs(a, b) {
  const x = summarize(a), y = summarize(b);
  if (!x || !y) return true;
  return ['name', 'level', 'xp', 'coins', 'species', 'fishCaught', 'quests', 'builds'].some(k => x[k] !== y[k]);
}

export function deviceLabel() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Device';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${os} · ${br}`;
}

/** Supabase implementation of the save backend (tests use an in-memory one). */
export class SupabaseSaveBackend {
  constructor(sb, userId) { this.sb = sb; this.userId = userId; }

  async fetch() {
    const { data, error } = await this.sb.from('saves')
      .select('data, revision, save_version, updated_at, client_saved_at, device_label')
      .eq('user_id', this.userId).maybeSingle();
    if (error) throw error;
    return data;
  }

  async insert(row) {
    const { data, error } = await this.sb.from('saves')
      .insert({ user_id: this.userId, ...row }).select('revision, updated_at').single();
    if (error) {
      if (error.code === '23505') return null;   // someone created it first → conflict
      throw error;
    }
    return data;
  }

  async update(row, expectedRevision) {
    const { data, error } = await this.sb.from('saves')
      .update({ ...row, revision: expectedRevision + 1 })
      .eq('user_id', this.userId).eq('revision', expectedRevision)
      .select('revision, updated_at');
    if (error) throw error;
    return data && data.length ? data[0] : null;   // no row → another device wrote first
  }

  async publishSnapshot(snapshot, profileFields) {
    const a = await this.sb.from('island_snapshots').upsert({ user_id: this.userId, data: snapshot });
    if (a.error) throw a.error;
    if (profileFields) {
      const b = await this.sb.from('profiles').update(profileFields).eq('id', this.userId);
      if (b.error) throw b.error;
    }
  }
}

export class CloudSync {
  /**
   * opts.auth            AuthService
   * opts.makeBackend     (auth) => backend
   * opts.prompt          { chooseSave(local, cloud, why), confirmUpload(local) } → Promise<'local'|'cloud'|'later'|'upload'>
   * opts.onStateReplaced (state) called when the playing state was swapped for the cloud copy
   * opts.now             clock (tests)
   */
  constructor(opts) {
    this.auth = opts.auth;
    this.makeBackend = opts.makeBackend;
    this.prompt = opts.prompt;
    this.onStateReplaced = opts.onStateReplaced || (() => {});
    this.now = opts.now || (() => Date.now());
    this.status = 'off';          // off | local | syncing | synced | offline | failed | conflict | paused
    this.lastSyncedAt = null;
    this.listeners = new Set();
    this.pushTimer = null;
    this.retryIndex = 0;
    this.applying = false;        // true while we write the local save ourselves
    this.paused = false;          // player chose "not now" for this session
    this.reconciling = null;
    this.meta = this.loadMeta();
    if (typeof window !== 'undefined') window.addEventListener?.('online', () => { if (this.status === 'offline') this.schedulePush(500); });
  }

  // ------------------------------------------------------------ meta & status
  loadMeta() {
    try { return { userId: null, revision: 0, dirty: false, syncedAt: null, ...(JSON.parse(localStorage.getItem(SYNC_KEY)) || {}) }; }
    catch { return { userId: null, revision: 0, dirty: false, syncedAt: null }; }
  }
  saveMeta() { try { localStorage.setItem(SYNC_KEY, JSON.stringify(this.meta)); } catch { /* storage full */ } }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  setStatus(status, detail = null) {
    this.status = status; this.detail = detail;
    for (const fn of [...this.listeners]) { try { fn(this); } catch (e) { console.error(e); } }
  }

  signedIn() { return this.auth.signedIn; }
  get userId() { return this.auth.user?.id || null; }

  statusLabel() {
    const a = this.auth;
    if (!a.enabled) return null;
    if (a.status === 'offline') return { signedIn: false, text: 'Online services unreachable — playing offline' };
    if (!a.signedIn) return { signedIn: false, text: 'Not signed in — saves stay on this device' };
    const name = a.profile?.display_name || 'Signed in';
    const s = { synced: 'cloud save up to date', syncing: 'syncing…', offline: 'offline — will sync later', failed: 'sync failed — will retry', conflict: 'needs your choice', paused: 'cloud sync paused', local: 'saved on device' }[this.status] || '';
    return { signedIn: true, text: `${name}${s ? ' · ' + s : ''}` };
  }

  // ------------------------------------------------------------ local saves
  /** Called whenever the game wrote the local save. */
  noteLocalSave() {
    if (this.applying) return;
    this.meta.dirty = true;
    this.saveMeta();
    if (this.signedIn() && this.meta.userId === this.userId && !this.paused) {
      if (this.status !== 'syncing') this.setStatus('local');
      this.schedulePush(PUSH_DELAY);
    }
  }

  writeLocal(state) {
    this.applying = true;
    try { Save.save(state); } finally { this.applying = false; }
  }

  // ------------------------------------------------------------ reconcile
  /**
   * Decide which copy to play from after sign-in (or before Continue).
   * Returns { state } — the save to play — or { state: null } if there is
   * nothing yet. Never throws: failures fall back to the local save.
   */
  reconcile() {
    if (!this.reconciling) this.reconciling = this._reconcile().finally(() => { this.reconciling = null; });
    return this.reconciling;
  }

  async _reconcile() {
    const local = Save.load().state;
    if (!this.signedIn()) return { state: local };
    const uid = this.userId;
    this.backend = this.makeBackend(this.auth);
    this.paused = false;
    this.setStatus('syncing');

    // A save that belongs to a different account is never mixed in. If it has
    // progress that never reached that account's cloud, it is archived on the
    // device; otherwise it's already safe in their cloud and is removed here so
    // the next person on this device can't see it.
    let localState = local;
    if (localState && this.meta.userId && this.meta.userId !== uid) {
      if (this.meta.dirty) Save.archiveSave(localState, 'other-account-unsynced');
      Save.wipe();
      localState = null;
      this.meta = { userId: null, revision: 0, dirty: false, syncedAt: null };
    }

    let cloud;
    try {
      cloud = await this.backend.fetch();
    } catch (err) {
      this.failed(err);
      return { state: localState };   // play locally; we'll retry
    }

    // 1. Nothing anywhere: a brand-new account. The first local save uploads.
    if (!cloud && !localState) {
      this.meta = { userId: uid, revision: 0, dirty: false, syncedAt: null };
      this.saveMeta();
      this.setStatus('synced');
      return { state: null };
    }

    // 2. New device / fresh browser: take the cloud copy.
    if (cloud && !localState) {
      this.adoptCloud(cloud);
      return { state: cloud.data };
    }

    // 3. Guest progress and an empty account: offer to upload it.
    if (!cloud && localState) {
      const linked = this.meta.userId === uid;
      const choice = linked ? 'upload' : await this.prompt.confirmUpload(localState);
      if (choice === 'upload') {
        this.meta = { userId: uid, revision: 0, dirty: true, syncedAt: null };
        this.saveMeta();
        await this.push();
      } else {
        this.paused = true;
        this.setStatus('paused');
      }
      return { state: localState };
    }

    // 4. Both exist.
    const linked = this.meta.userId === uid;
    const sameData = !differs(localState, cloud.data);
    if (linked && cloud.revision === this.meta.revision) {
      // Cloud hasn't moved since our last sync: we're ahead or equal.
      if (this.meta.dirty && !sameData) await this.push();
      else this.markSynced(cloud.revision);
      return { state: localState };
    }
    if (sameData) {
      // Same progress (e.g. just timestamps differ): link up quietly.
      this.markSynced(cloud.revision);
      return { state: localState };
    }
    if (linked && cloud.revision > this.meta.revision && !this.meta.dirty) {
      // Another device moved on and this one has nothing new: take theirs.
      this.adoptCloud(cloud);
      return { state: cloud.data };
    }
    // Real conflict: guest progress vs account, or both devices changed.
    this.setStatus('conflict');
    const why = linked ? 'both' : 'guest';
    const choice = await this.prompt.chooseSave(localState, cloud, why);
    if (choice === 'cloud') {
      Save.archiveSave(localState, 'replaced-by-cloud');
      this.adoptCloud(cloud);
      return { state: cloud.data };
    }
    if (choice === 'local') {
      Save.archiveSave(cloud.data, 'cloud-replaced-by-device');
      this.meta = { userId: uid, revision: cloud.revision, dirty: true, syncedAt: this.meta.syncedAt };
      this.saveMeta();
      await this.push();
      return { state: localState };
    }
    // 'later': play this device's copy without syncing for now.
    this.paused = true;
    this.setStatus('paused');
    return { state: localState };
  }

  adoptCloud(cloud) {
    this.writeLocal(cloud.data);
    this.markSynced(cloud.revision);
  }

  markSynced(revision) {
    this.meta = { userId: this.userId, revision, dirty: false, syncedAt: this.now() };
    this.saveMeta();
    this.lastSyncedAt = this.meta.syncedAt;
    this.retryIndex = 0;
    this.setStatus('synced');
  }

  // ------------------------------------------------------------ uploads
  schedulePush(delay = PUSH_DELAY) {
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.push(), delay);
  }

  /** Upload the local save if it has changes. Safe to call any time. */
  async push() {
    clearTimeout(this.pushTimer);
    if (!this.signedIn() || this.paused || !this.backend) return false;
    if (this.meta.userId !== this.userId) return false;
    const state = Save.load().state;
    if (!state) return false;
    if (!this.meta.dirty && this.status === 'synced') return true;
    if (this.pushing) { this.pushAgain = true; return false; }
    this.pushing = true;
    this.setStatus('syncing');
    const row = { data: state, save_version: state.version || SAVE_VERSION, client_saved_at: new Date(state.savedAt || this.now()).toISOString(), device_label: deviceLabel() };
    try {
      const res = this.meta.revision > 0 ? await this.backend.update(row, this.meta.revision) : await this.backend.insert(row);
      if (!res) {
        // Another device saved first: stop and let the player choose.
        this.pushing = false;
        await this.reconcileConflict();
        return false;
      }
      this.markSynced(res.revision);
      this.publish(state);
      return true;
    } catch (err) {
      this.failed(err);
      return false;
    } finally {
      this.pushing = false;
      if (this.pushAgain) { this.pushAgain = false; if (this.meta.dirty) this.schedulePush(1000); }
    }
  }

  async reconcileConflict() {
    const res = await this.reconcile();
    if (res.state) this.onStateReplaced(res.state);
  }

  /** Public island snapshot for friends (best effort, throttled). */
  async publish(state) {
    if (this.lastPublish && this.now() - this.lastPublish < 60_000) return;
    this.lastPublish = this.now();
    try {
      await this.backend.publishSnapshot?.(islandSnapshot(state), { level: state.player.level, look: state.player.look });
    } catch (err) {
      console.warn('Snapshot publish failed', err);
    }
  }

  failed(err) {
    const offline = (typeof navigator !== 'undefined' && navigator.onLine === false) || /fetch|network/i.test(String(err?.message || err));
    this.setStatus(offline ? 'offline' : 'failed', String(err?.message || err));
    const wait = RETRY[Math.min(this.retryIndex, RETRY.length - 1)];
    this.retryIndex++;
    // Retry a reconcile if we never managed to read the cloud, else a push.
    if (this.meta.userId === this.userId) this.schedulePush(wait * 1000);
  }

  /** Try to upload before signing out; returns true if nothing is left unsynced. */
  async flush() {
    if (!this.signedIn() || this.paused) return !this.meta.dirty;
    if (this.meta.dirty) await this.push();
    return !this.meta.dirty;
  }

  /**
   * After sign-out the local copy either stays as a guest save, or (when the
   * player explicitly chose to remove it and it is safely in the cloud) is
   * removed from this device.
   */
  afterSignOut(keepOnDevice) {
    clearTimeout(this.pushTimer);
    const local = Save.load().state;
    if (!keepOnDevice && local) {
      if (this.meta.dirty) Save.archiveSave(local, 'signed-out-unsynced');
      Save.wipe();
    }
    this.meta = { userId: null, revision: 0, dirty: false, syncedAt: null };
    this.saveMeta();
    this.backend = null;
    this.paused = false;
    this.setStatus('off');
  }
}
