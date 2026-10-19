// Online coordinator: owns the auth service, cloud sync and social services
// and connects them to the game. Everything here is optional — when no
// backend is configured the game simply plays offline with local saves.
import { AuthService } from './auth.js';
import { CloudSync, SupabaseSaveBackend } from './cloud-sync.js';
import { Social } from './social.js';
import { on } from '../events.js';

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
      makeBackend: auth => new SupabaseSaveBackend(auth.sb, auth.user.id),
      prompt,
      onStateReplaced: state => this.applyState(state),
    });
    on('saved', () => this.cloud.noteLocalSave());
    this.auth.on(async (type) => {
      if (type === 'signedIn') {
        this.social.joinPresence();
        // Work out which copy of the island to use (may ask the player).
        const res = await this.cloud.reconcile();
        if (this.game.mode === 'play') { if (res.state) this.applyState(res.state); }
        else this.ui.title?.refresh();
      }
      if (type === 'signedOut') this.social.leavePresence();
    });
    await this.auth.init();
  }

  /** Swap the running game to a different copy of the save (e.g. newer cloud). */
  applyState(state) {
    if (!state || this.game.mode !== 'play') return;
    const cur = this.game.currentState?.();
    if (cur && cur === state) return;
    this.game.continueGame(state);
  }

  /** Called before Continue on the title screen. */
  async resolveBeforePlay(localState) {
    if (!this.auth.signedIn) return localState;
    const res = await this.cloud.reconcile();
    return res.state || localState;
  }
}
