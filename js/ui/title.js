// Title screen (menu over the animated sunset diorama in title-scene.js) and
// new-game character creation.
import { h, button, confirmModal, modal } from './dom.js';
import * as Save from '../save.js';
import { initAudio, sfx, startMusic, setMood, tryAutoStart } from '../audio.js';
import { buildPortrait, SKIN_TONES, HAIR_COLORS, SHIRT_COLORS, HAIR_STYLES } from '../art/characters.js';
import { scaleUp } from '../art/pixel.js';
import { STARTING_HATS, HATS } from '../../data/item-data.js';
import { GAME_VERSION, GAME_NAME } from '../state.js';
import { PANELS } from './panels/index.js';
import { enterLandscape } from './device.js';
import { spriteUrl } from '../art/sprites.js';

export class TitleUI {
  constructor(ui) {
    this.ui = ui;
    this.root = document.getElementById('title-screen');
    this.visible = false;
    // The first tap anywhere on the title wakes the audio (browsers require a gesture).
    this.root.addEventListener('pointerup', () => { initAudio(); setMood('night'); startMusic(); });
  }

  show() {
    this.visible = true;
    this.ui.app.classList.add('on-title');
    const loaded = Save.load();
    this.loaded = loaded;
    const hasSave = !!loaded.state;
    const name = loaded.state?.player.name;
    const account = this.ui.cloud?.statusLabel?.() || null;
    this.root.replaceChildren(...[
      h('div.title-top',
        h('h1.logo', { 'aria-label': GAME_NAME },
          h('img.logo-fish', { src: spriteUrl('fish_golden_koi', 3), alt: '' }),
          h('span.logo-reel', 'Reel'), h('span.logo-haven', 'haven')),
        h('p.tagline', 'A cozy island fishing tale')),
      h('nav.title-menu', { 'aria-label': 'Main menu' },
        hasSave ? button('Continue', () => this.continueGame(), { cls: 'title-btn primary', sound: null, title: name ? `Continue as ${name}` : 'Continue' }) : null,
        button('New Game', () => this.newGame(hasSave), { cls: 'title-btn' + (hasSave ? '' : ' primary'), sound: null }),
        button('Friends', () => this.ui.open('friends'), { cls: 'title-btn', iconName: 'friends' }),
        button(account?.signedIn ? 'Account' : 'Sign In', () => this.ui.openAccount(), { cls: 'title-btn', iconName: 'home' }),
        button('Settings', () => this.settings(), { cls: 'title-btn', iconName: 'gear' }),
        button('Credits', () => this.credits(), { cls: 'title-btn', iconName: 'sparkle' })),
      h('div.title-foot',
        h('span.title-status', account ? [h('span.dot' + (account.signedIn ? '.on' : '')), account.text] : [h('span.dot'), 'Playing offline']),
        hasSave ? h('span.title-save', `${name} · Lv ${loaded.state.player.level}`) : null,
        h('span.version', 'v' + GAME_VERSION)),
      loaded.error ? h('p.title-warn', { role: 'alert' }, loaded.error) : null,
      !Save.canPersist ? h('p.title-warn', 'Saving is unavailable in this browser mode (private window?). Progress will be lost when you close the tab.') : null,
    ].filter(Boolean));
    this.root.classList.remove('show');
    void this.root.offsetWidth;   // restart the entrance animation
    this.root.classList.add('show');
    this.maybeTapToStart();
    setTimeout(() => this.root.querySelector('.title-btn')?.focus({ preventScroll: true }), 900);
  }

  /**
   * Browsers block sound until the first tap/click. On first load we try to
   * start anyway; if that's blocked, a "Tap anywhere to start" screen turns the
   * first touch into the moment the music begins.
   */
  async maybeTapToStart() {
    if (this.started) return;
    if (await tryAutoStart()) { this.begin(); return; }
    if (this.started || this.root.querySelector('.tap-start')) return;
    this.root.classList.add('awaiting-tap');
    const overlay = h('button.tap-start', { type: 'button', 'aria-label': 'Tap anywhere to start' }, h('span', 'Tap anywhere to start'));
    const go = () => {
      initAudio();
      this.begin();
      overlay.remove();
      this.root.classList.remove('awaiting-tap');
      setTimeout(() => this.root.querySelector('.title-btn')?.focus({ preventScroll: true }), 100);
    };
    overlay.addEventListener('click', go);
    window.addEventListener('keydown', function once(e) { if (!overlay.isConnected) { window.removeEventListener('keydown', once); return; } if (['Enter', ' ', 'Spacebar'].includes(e.key)) { window.removeEventListener('keydown', once); go(); } });
    this.root.append(overlay);
  }

  begin() {
    this.started = true;
    setMood('night');
    startMusic();
  }

  /** Re-render if the save or account status changed while the title is up. */
  refresh() { if (this.visible) this.show(); }

  hide() {
    this.visible = false;
    this.root.classList.remove('show');
  }

  async continueGame() {
    initAudio(); sfx('quest'); enterLandscape();
    // When signed in, make sure we continue from the right copy (local vs cloud).
    const state = this.ui.cloud ? await this.ui.cloud.resolveBeforePlay(this.loaded.state) : this.loaded.state;
    if (state) this.ui.game.continueGame(state);
  }

  newGame(hasSave) {
    initAudio(); sfx('click');
    if (!hasSave) { this.creator(); return; }
    const s = this.loaded.state;
    const cloudNote = this.ui.cloud?.signedIn?.()
      ? ' You are signed in, so your cloud save will also switch to the new island the next time it syncs.'
      : '';
    confirmModal('Start a new island?',
      `Your current island (${s.player.name}, level ${s.player.level}) will be kept as a backup on this device — you can restore it any time from Settings → Save data.${cloudNote}`,
      'Start fresh', () => {
        Save.archiveSave(s, 'new-game');
        this.creator();
      }, { danger: true });
  }

  settings() {
    initAudio();
    let close;
    const body = h('div.sheet-body.in-modal');
    PANELS.settings.render(body, { game: this.ui.game, ui: this.ui, opts: { fromTitle: true, titleSave: this.loaded.state } });
    close = modal(h('div.title-settings', h('h3', 'Settings'), body, h('div.row.end', button('Close', () => close(), { cls: 'primary' }))));
  }

  credits() {
    let close;
    close = modal(h('div.credits',
      h('h3', GAME_NAME),
      h('p', 'A cozy island fishing tale.'),
      h('dl.facts',
        h('dt', 'Game design, code & art'), h('dd', 'Original work for this project — every sprite is drawn in code as pixel art.'),
        h('dt', 'Music & sound'), h('dd', 'Original: synthesized with Web Audio; footsteps generated by tools/generate_footsteps.py.'),
        h('dt', 'Font'), h('dd', 'Pixelify Sans by Stefie Justprince (SIL Open Font License).'),
        h('dt', 'Online services'), h('dd', 'Accounts, cloud saves, friends and visits run on the game’s own server (server.py).')),
      h('p.muted', 'Thank you for playing!'),
      h('div.row.end', button('Close', () => close(), { cls: 'primary' }))));
  }

  /** Character creation: name, skin, hair, outfit, hat. */
  creator() {
    const look = { skin: SKIN_TONES[1], hair: HAIR_COLORS[0], hairStyle: 'short', shirt: SHIRT_COLORS[0], pants: '#4f5f86', hat: 'straw' };
    const preview = h('img.creator-preview', { alt: 'Your character' });
    const refresh = () => { preview.src = scaleUp(buildPortrait(look), 6).toDataURL(); };
    const nameInput = h('input.name-input', { type: 'text', maxlength: '16', placeholder: 'Your name', value: '', 'aria-label': 'Your name', autocomplete: 'off' });
    const swatches = (label, list, key) => h('div.swatch-row', h('span.sw-label', label),
      h('div.swatches', list.map(c => {
        const b = h('button.swatch' + (look[key] === c ? '.on' : ''), { type: 'button', style: { background: c }, 'aria-label': label + ' ' + c, on: { click: () => { look[key] = c; sfx('click'); b.parentNode.querySelectorAll('.swatch').forEach(x => x.classList.remove('on')); b.classList.add('on'); refresh(); } } });
        return b;
      })));
    const options = (label, list, key, names = null) => h('div.swatch-row', h('span.sw-label', label),
      h('div.opts', list.map(v => {
        const b = h('button.opt' + (look[key] === v ? '.on' : ''), { type: 'button', on: { click: () => { look[key] = v; sfx('click'); b.parentNode.querySelectorAll('.opt').forEach(x => x.classList.remove('on')); b.classList.add('on'); refresh(); } } }, names ? names(v) : v);
        return b;
      })));
    let close;
    const start = () => {
      const name = nameInput.value.trim() || 'Islander';
      close();
      enterLandscape();
      this.ui.game.newGame({ name, look: { ...look } });
    };
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
    close = modal(h('div.creator',
      h('h3', 'Create your islander'),
      h('div.creator-cols',
        h('div.creator-top', h('div.preview-frame', preview), h('div.creator-name', h('label', 'Name'), nameInput)),
        h('div.creator-opts',
          swatches('Skin', SKIN_TONES, 'skin'),
          swatches('Hair', HAIR_COLORS, 'hair'),
          options('Style', HAIR_STYLES, 'hairStyle', v => v[0].toUpperCase() + v.slice(1)),
          swatches('Outfit', SHIRT_COLORS, 'shirt'),
          options('Hat', STARTING_HATS, 'hat', v => HATS[v].name))),
      h('div.row.end', button('Back', () => close(), { cls: 'ghost' }), button('Start adventure', start, { cls: 'primary', sound: null }))), { dismissable: false, cls: 'creator-modal' });
    refresh();
    setTimeout(() => nameInput.focus(), 60);
  }
}
