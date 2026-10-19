// Title screen and new-game character creation. The animated island behind
// it is the real game renderer panning over Sunny Shores.
import { h, button, confirmModal, modal } from './dom.js';
import * as Save from '../save.js';
import { initAudio, sfx } from '../audio.js';
import { buildPortrait, SKIN_TONES, HAIR_COLORS, SHIRT_COLORS, HAIR_STYLES } from '../art/characters.js';
import { scaleUp } from '../art/pixel.js';
import { STARTING_HATS, HATS } from '../../data/item-data.js';
import { GAME_VERSION } from '../state.js';
import { PANELS } from './panels/index.js';

export class TitleUI {
  constructor(ui) {
    this.ui = ui;
    this.root = document.getElementById('title-screen');
    this.visible = false;
  }

  show() {
    this.visible = true;
    this.ui.app.classList.add('on-title');
    const loaded = Save.load();
    this.loaded = loaded;
    const hasSave = !!loaded.state;
    const name = loaded.state?.player.name;
    this.root.replaceChildren(
      h('div.title-inner',
        h('div.logo', h('span.logo-tide', 'Tide'), h('span.logo-amp', '&'), h('span.logo-town', 'Town')),
        h('p.tagline', 'Catch fish. Grow your island. Make it home.'),
        h('div.title-buttons',
          hasSave ? button(`Continue${name ? ' as ' + name : ''}`, () => this.continueGame(), { cls: 'primary big', sound: null }) : null,
          button(hasSave ? 'New Game' : 'Play', () => this.newGame(hasSave), { cls: hasSave ? 'big' : 'primary big', sound: null }),
          button('Settings', () => this.settings(), { cls: 'ghost' })),
        loaded.error ? h('p.title-warn', { role: 'alert' }, loaded.error) : null,
        !Save.canPersist ? h('p.title-warn', 'Saving is unavailable in this browser mode (private window?). Progress will be lost when you close the tab.') : null,
        h('p.version', 'v' + GAME_VERSION)));
    this.root.classList.add('show');
    setTimeout(() => this.root.querySelector('button')?.focus({ preventScroll: true }), 100);
  }

  hide() {
    this.visible = false;
    this.root.classList.remove('show');
  }

  continueGame() {
    initAudio(); sfx('quest');
    this.ui.game.continueGame(this.loaded.state);
  }

  newGame(hasSave) {
    initAudio(); sfx('click');
    if (hasSave) {
      confirmModal('Start over?', 'Starting a new game will replace your current island and progress on this device. You can export a backup from Settings first.', 'Start new game', () => this.creator(), { danger: true });
    } else this.creator();
  }

  settings() {
    initAudio();
    let close;
    const body = h('div.sheet-body.in-modal');
    PANELS.settings.render(body, { game: this.ui.game, ui: this.ui, opts: { fromTitle: true, titleSave: this.loaded.state } });
    close = modal(h('div.title-settings', h('h3', 'Settings'), body, h('div.row.end', button('Close', () => close(), { cls: 'primary' }))));
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
      this.ui.game.newGame({ name, look: { ...look } });
    };
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
    close = modal(h('div.creator',
      h('h3', 'Create your islander'),
      h('div.creator-top', h('div.preview-frame', preview), h('div.creator-name', h('label', 'Name'), nameInput)),
      swatches('Skin', SKIN_TONES, 'skin'),
      swatches('Hair', HAIR_COLORS, 'hair'),
      options('Style', HAIR_STYLES, 'hairStyle', v => v[0].toUpperCase() + v.slice(1)),
      swatches('Outfit', SHIRT_COLORS, 'shirt'),
      options('Hat', STARTING_HATS, 'hat', v => HATS[v].name),
      h('div.row.end', button('Back', () => close(), { cls: 'ghost' }), button('Start adventure', start, { cls: 'primary', sound: null }))), { dismissable: false, cls: 'creator-modal' });
    refresh();
    setTimeout(() => nameInput.focus(), 60);
  }
}
