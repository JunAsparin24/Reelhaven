// Online coordinator: owns the auth service, cloud sync and social services
// and connects them to the game. Everything here is optional — when the page
// isn't served by server.py the game simply plays offline with local saves.
import { AuthService } from './auth.js';
import { CloudSync, ServerSaveBackend } from './cloud-sync.js';
import { Social } from './social.js';
import { on } from '../events.js';
import { mergeServer } from '../worlds.js';

export class Online {
  constructor() {
    this.auth = new AuthService();
    this.social = new Social(this.auth);
    this.cloud = null;
    this.game = null;
    this.ui = null;
  }

  /** prompt: { chooseSave, confirmUpload } implemented by the UI. */
  async start(game, ui, prompt) {
    this.game = game;
    this.ui = ui;
    this.cloud = new CloudSync({
      auth: this.auth,
      makeBackend: (auth, slot) => new ServerSaveBackend(auth.net, slot),
      prompt,
      onStateReplaced: state => this.applyState(state),
    });
    on('saved', () => this.cloud.noteLocalSave());
    this.cloud.on(() => ui.refreshSync?.());
    this.auth.on(async (type) => {
      if (type === 'reconnected') {
        // The server forgot our status and island channel when we dropped.
        this.social.resync();
        this.game.leaveChannel?.();
        if (this.cloud.meta.dirty) this.cloud.schedulePush(1000);
      }
      if (type === 'signedIn') {
        this.social.resync();
        // Work out which copy of the island to use (may ask the player).
        // In someone else's world the playing state is your character there; it
        // was reconciled when you joined, so leave it alone.
        if (this.game.visit) return;
        const res = await this.cloud.reconcile();
        if (this.game.mode === 'play') { if (res.state) this.applyState(res.state); }
        else this.ui.title?.refresh();
        this.refreshWorlds();
      }
      if (type === 'signedOut') { this.social.clear(); this.game.leaveChannel?.(); }
    });
    await this.auth.init();
  }

  /** Swap the running game to a different copy of the save (e.g. newer cloud). */
  applyState(state) {
    if (!state || this.game.mode !== 'play' || this.game.visit) return;
    const cur = this.game.currentState?.();
    if (cur && cur === state) return;
    this.game.continueGame(state);
  }

  /** Pull the list of my worlds and joined worlds from the server. */
  async refreshWorlds() {
    if (!this.auth.signedIn) return null;
    try {
      const list = await this.auth.net.request('world_list');
      mergeServer(list);
      this.ui.title?.refresh?.();
      return list;
    } catch (err) { console.warn('world list failed', err); return null; }
  }

  /** Called before Continue on the title screen. */
  async resolveBeforePlay(localState) {
    if (!this.auth.signedIn) return localState;
    const res = await this.cloud.reconcile();
    return res.state || localState;
  }
}
