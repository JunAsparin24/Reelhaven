// Title screen (menu over the animated sunset diorama in title-scene.js) and
// new-game character creation.
import { h, button, confirmModal, modal } from './dom.js';
import * as Save from '../save.js';
import { initAudio, sfx, startMusic, setMood, tryAutoStart } from '../audio.js';
import { buildFullPreview, SKIN_TONES, HAIR_COLORS, SHIRT_COLORS, HAIR_STYLES, PANTS_COLORS, SHOE_COLORS, OUTFITS, BOTTOMS, ACCESSORIES } from '../art/characters.js';
import { scaleUp } from '../art/pixel.js';
import { STARTING_HATS, HATS } from '../../data/item-data.js';
import { GAME_VERSION, GAME_NAME } from '../state.js';
import { PANELS } from './panels/index.js';
import { enterLandscape } from './device.js';
import { spriteUrl } from '../art/sprites.js';
import { registry, lastPersonal, newSlotId, notePersonal, forgetPersonal, personalName, MAX_WORLDS } from '../worlds.js';
import { toast } from '../events.js';
import { friendlyError } from '../online/auth.js';
import { icon } from './dom.js';

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
    // "Continue" opens the world you played last.
    this.slot = lastPersonal() || 'main';
    Save.setSlot(this.slot);
    this.ui.online?.cloud?.setSlot?.({ id: this.slot });
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
        hasSave ? button('Worlds', () => this.worldsMenu(), { cls: 'title-btn primary', iconName: 'island', sound: null }) : button('New World', () => this.createWorld(), { cls: 'title-btn primary', sound: null }),
        button('Friends', () => this.ui.open('friends'), { cls: 'title-btn', iconName: 'friends' }),
        button(account?.signedIn ? 'Account' : 'Sign In', () => this.ui.openAccount(), { cls: 'title-btn', iconName: 'home' }),
        button('Settings', () => this.settings(), { cls: 'title-btn', iconName: 'gear' }),
        button('Credits', () => this.credits(), { cls: 'title-btn', iconName: 'sparkle' })),
      h('div.title-foot',
        h('span.title-status', account ? [h('span.dot' + (account.signedIn ? '.on' : '')), account.text] : [h('span.dot'), 'Playing offline']),
        hasSave ? h('span.title-save', `${personalName(this.slot)} · ${name} · Lv ${loaded.state.player.level}`) : null,
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
    if (state) { this.ui.game.usePersonalSlot(this.slot); this.ui.game.continueGame(state); }
  }

  /** Open one of your own worlds. */
  async playWorld(slot) {
    initAudio(); sfx('quest'); enterLandscape();
    Save.setSlot(slot);
    this.ui.online?.cloud?.setSlot?.({ id: slot });
    let state = Save.load().state;
    if (this.ui.cloud) state = await this.ui.cloud.resolveBeforePlay(state);
    if (!state) { toast('That world has no save yet.', 'island', 'error'); return; }
    this.ui.game.usePersonalSlot(slot);
    this.ui.game.continueGame(state);
  }

  /** A brand-new world: its own save, character and progress. */
  createWorld() {
    initAudio(); sfx('click');
    const reg = registry();
    if (reg.personal.length >= MAX_WORLDS) { toast(`You can have up to ${MAX_WORLDS} worlds. Delete one first.`, 'island', 'error'); return; }
    const first = !reg.personal.length && !Save.hasSlot('main');
    let close;
    const input = h('input.field', { type: 'text', maxlength: '24', value: first ? 'My Island' : `Island ${reg.personal.length + 1}`, 'aria-label': 'World name' });
    const go = () => {
      const worldName = input.value.trim() || 'My Island';
      close();
      this.creator({
        title: `Create your islander for “${worldName}”`,
        onDone: profile => {
          const slot = first ? 'main' : newSlotId();
          Save.setSlot(slot);
          this.ui.online?.cloud?.setSlot?.({ id: slot });
          notePersonal(slot, { name: worldName, createdAt: Date.now() });
          if (this.ui.online?.auth.signedIn && slot !== 'main') this.ui.online.auth.net.request('world_create', { world: slot, name: worldName }).catch(err => console.warn('world_create', err));
          enterLandscape();
          this.ui.game.newGame(profile, { worldName });
        },
      });
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    close = modal(h('div.confirm',
      h('h3', 'New world'),
      h('p', 'Every world is a separate save with its own character, bag, coins and progress.'),
      h('label.form-row', h('span', 'World name'), input),
      h('div.row.end', button('Cancel', () => close(), { cls: 'ghost' }), button('Next', go, { cls: 'primary' }))));
    setTimeout(() => input.select(), 50);
  }

  /** World selection: my worlds, friends' open worlds, worlds I've joined, invite code. */
  async worldsMenu() {
    initAudio();
    const online = this.ui.online;
    const signedIn = !!online?.auth.signedIn;
    if (signedIn) await online.refreshWorlds();
    let open = [];
    if (signedIn) { try { open = await online.social.joinable(); } catch { open = []; } }
    const reg = registry();
    let close;
    const when = t => (t ? new Date(t).toLocaleDateString() : 'never');
    const mine = h('div.list', reg.personal.filter(w => Save.hasSlot(w.slot) || w.cloud).map(w => h('div.item-row.world-row',
      icon('island', 'item-icon'),
      h('div.item-main', h('div.item-name', w.name || 'My Island'), h('div.item-sub', `${w.charName || 'No character yet'}${w.level ? ' · Lv ' + w.level : ''} · last played ${when(w.lastPlayed)}`)),
      button('Play', () => { close(); this.playWorld(w.slot); }, { cls: 'small primary' }),
      w.slot !== 'main' ? button('Delete', () => confirmModal('Delete this world?', `“${w.name}” and its character will be removed from this device${signedIn ? ' and your account' : ''}. This can’t be undone.`, 'Delete', () => {
        forgetPersonal(w.slot);
        if (signedIn) online.auth.net.request('world_delete', { world: w.slot }).catch(() => {});
        close(); this.worldsMenu();
      }, { danger: true }), { cls: 'small ghost' }) : null)));
    const joinBtn = (label, fn) => button(label, async () => { try { close(); this.ui.joinHosted(await fn()); } catch (err) { toast(friendlyError(err), null, 'error'); } }, { cls: 'small primary', iconName: 'boat' });
    const openList = open.length ? h('div.list', open.map(o => h('div.item-row.world-row', icon('friends', 'item-icon'),
      h('div.item-main', h('div.item-name', o.worldName), h('div.item-sub', `${o.name} is hosting · ${o.players} playing · ${o.joined ? 'you have a character here' : 'you’ll create a new character'}`)),
      joinBtn(o.joined ? 'Join' : 'Join (new character)', () => online.social.joinFriend(o.host)))))
      : h('p.muted', signedIn ? 'No friends are hosting a world right now.' : 'Sign in to join friends’ worlds.');
    const joined = reg.joined.length ? h('div.list', reg.joined.map(j => h('div.item-row.world-row', icon('boat', 'item-icon'),
      h('div.item-main', h('div.item-name', j.worldName || 'A friend’s world'), h('div.item-sub', `${j.ownerName || j.owner}’s world · you play ${j.charName || '—'}${j.level ? ' (Lv ' + j.level + ')' : ''}`)),
      open.some(o => o.world === j.world) || j.open ? joinBtn('Join', () => online.social.joinFriend(j.owner)) : h('span.tag', 'Host offline'))))
      : null;
    const code = h('input.field.code-input', { type: 'text', maxlength: '6', placeholder: 'INVITE CODE', 'aria-label': 'Invite code', on: { input: e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); } } });
    const codeBtn = button('Join', async () => {
      if (code.value.length !== 6) { toast('Invite codes have 6 letters and numbers.', null, 'error'); return; }
      try { const res = await online.social.joinCode(code.value); close(); this.ui.joinHosted(res); } catch (err) { toast(friendlyError(err), null, 'error'); }
    }, { cls: 'small primary', disabled: !signedIn });
    close = modal(h('div.worlds-menu',
      h('h3', icon('island'), ' Worlds'),
      h('h4.section', 'My worlds'), mine,
      button('Create new world', () => { close(); this.createWorld(); }, { cls: 'ghost wide', iconName: 'build' }),
      h('h4.section', 'Join a friend'), openList,
      joined ? h('h4.section', 'Worlds you’ve joined') : null, joined,
      h('h4.section', 'Enter an invite code'),
      h('div.add-friend', code, codeBtn),
      h('div.row.end', button('Close', () => close(), { cls: 'primary' }))), { cls: 'worlds-modal' });
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
        h('dt', 'Music & sound'), h('dd', 'Music: “1 Hour Video Game Ambient Music”. Sound effects synthesized with Web Audio; grass, sand, wood and mud footsteps from Epidemic Sound; other footsteps generated by tools/generate_footsteps.py.'),
        h('dt', 'Font'), h('dd', 'Jersey 15 by Sarah Cadigan-Fried and Pixelify Sans (logo) by Stefie Justprince, both SIL Open Font License.'),
        h('dt', 'Online services'), h('dd', 'Accounts, cloud saves, friends and shared worlds run on the game’s own server (server.py).')),
      h('p.muted', 'Thank you for playing!'),
      h('div.row.end', button('Close', () => close(), { cls: 'primary' }))));
  }

  /**
   * Character creation: name first, then body, top, bottoms and extras.
   * Used for new worlds, your character in a friend's world, and the
   * wardrobe (edit = { name, look } to change an existing character).
   */
  creator({ title = 'Create your islander', note = null, cta = 'Start adventure', onDone = null, onCancel = null, edit = null, hats = STARTING_HATS } = {}) {
    const look = { skin: SKIN_TONES[2], hair: HAIR_COLORS[0], hairStyle: 'short', shirt: SHIRT_COLORS[5], outfit: 'tee', pants: PANTS_COLORS[0], bottoms: 'pants', shoes: SHOE_COLORS[0], hat: 'straw', acc: 'none', ...(edit?.look || {}) };
    const preview = h('img.creator-preview', { alt: 'Your character' });
    const refresh = () => { preview.src = scaleUp(buildFullPreview(look), 5).toDataURL(); };
    const nameInput = h('input.name-input', { type: 'text', maxlength: '16', placeholder: 'Type your name', value: edit?.name || '', 'aria-label': 'Your name', autocomplete: 'off' });
    const nameMsg = h('small.name-msg');
    const mark = (b, sel) => { b.parentNode.querySelectorAll(sel).forEach(x => x.classList.remove('on')); b.classList.add('on'); };
    const swatches = (label, list, key) => h('div.swatch-row', h('span.sw-label', label),
      h('div.swatches', list.map(c => {
        const b = h('button.swatch' + (look[key] === c ? '.on' : ''), { type: 'button', style: { background: c }, 'aria-label': label + ' ' + c, on: { click: () => { look[key] = c; sfx('click'); mark(b, '.swatch'); refresh(); } } });
        return b;
      })));
    const options = (label, list, key, names = null) => h('div.swatch-row', h('span.sw-label', label),
      h('div.opts', list.map(v => {
        const b = h('button.opt' + (look[key] === v ? '.on' : ''), { type: 'button', on: { click: () => { look[key] = v; sfx('click'); mark(b, '.opt'); refresh(); } } }, names ? names(v) : v);
        return b;
      })));
    const cap = v => v[0].toUpperCase() + v.slice(1);
    const pages = {
      body: () => [swatches('Skin', SKIN_TONES, 'skin'), swatches('Hair', HAIR_COLORS, 'hair'), options('Style', HAIR_STYLES, 'hairStyle', cap)],
      top: () => [options('Top', Object.keys(OUTFITS), 'outfit', v => OUTFITS[v]), swatches('Colour', SHIRT_COLORS, 'shirt')],
      bottoms: () => [options('Bottoms', Object.keys(BOTTOMS), 'bottoms', v => BOTTOMS[v]), swatches('Colour', PANTS_COLORS, 'pants'), swatches('Shoes', SHOE_COLORS, 'shoes')],
      extras: () => [options('Hat', hats.filter(id => HATS[id]), 'hat', v => HATS[v].name), options('Face', Object.keys(ACCESSORIES), 'acc', v => ACCESSORIES[v])],
    };
    const optsEl = h('div.creator-opts');
    let page = 'body';
    const tabRow = h('div.tabs.creator-tabs');
    const showPage = id => {
      page = id;
      tabRow.replaceChildren(...[['body', 'Body'], ['top', 'Top'], ['bottoms', 'Bottoms'], ['extras', 'Hat & face']].map(([k, label]) =>
        h('button.tab' + (k === page ? '.active' : ''), { type: 'button', on: { click: () => { sfx('click'); showPage(k); } } }, label)));
      optsEl.replaceChildren(...pages[id]());
    };
    let close;
    const start = () => {
      const name = nameInput.value.trim();
      if (name.length < 2) { nameMsg.textContent = 'Give your islander a name first (2–16 letters).'; nameInput.focus(); sfx('error'); return; }
      close();
      if (!edit) enterLandscape();
      if (onDone) onDone({ name, look: { ...look } });
      else this.ui.game.newGame({ name, look: { ...look } });
    };
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
    nameInput.addEventListener('input', () => { nameMsg.textContent = ''; });
    showPage('body');
    close = modal(h('div.creator',
      h('h3', title),
      note ? h('p.muted.creator-note', note) : null,
      h('div.creator-name.big', h('label', 'Name'), nameInput, nameMsg),
      h('div.creator-cols',
        h('div.creator-top', h('div.preview-frame', preview)),
        h('div.creator-side', tabRow, optsEl)),
      h('div.row.end', button(edit ? 'Cancel' : 'Back', () => { close(); onCancel?.(); }, { cls: 'ghost' }), button(cta, start, { cls: 'primary', sound: null }))), { dismissable: false, cls: 'creator-modal' });
    refresh();
    setTimeout(() => nameInput.focus(), 60);
  }
}
