// Account screens: sign in / create account / email link / password reset,
// the signed-in account card, and the save-choice prompts used by cloud sync.
import { h, button, modal, icon, spriteImg, fmt } from './dom.js';
import { toast } from '../events.js';
import { friendlyError, validUsername, validPassword, validDisplayName } from '../online/auth.js';
import { summarize } from '../online/cloud-sync.js';
import { getState } from '../state.js';
import * as Save from '../save.js';
import { scaleUp } from '../art/pixel.js';
import { buildPortrait } from '../art/characters.js';

function field(label, attrs) {
  const input = h('input.field', { autocomplete: 'off', ...attrs });
  return { input, el: h('label.form-row', h('span', label), input) };
}

/** Disable a button and show progress while an async action runs. */
async function busy(btn, msgEl, fn) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.querySelector('span') ? (btn.querySelector('span').textContent = 'Please wait…') : (btn.textContent = 'Please wait…');
  msgEl.className = 'form-msg';
  msgEl.textContent = '';
  try { return await fn(); }
  catch (err) {
    msgEl.className = 'form-msg error';
    msgEl.textContent = err?.userMessage || friendlyError(err);
    return undefined;
  } finally {
    btn.disabled = false;
    btn.querySelector('span') ? (btn.querySelector('span').textContent = label) : (btn.textContent = label);
  }
}

function userError(msg) { const e = new Error(msg); e.userMessage = msg; return e; }

export class AccountUI {
  constructor(ui, online) {
    this.ui = ui;
    this.online = online;
    online.auth.on(type => {
      if (type === 'change') this.ui.refreshSync?.();
    });
  }

  get auth() { return this.online.auth; }
  get cloud() { return this.online.cloud; }

  open() {
    const a = this.auth;
    if (a.status === 'disabled') return this.notConfigured();
    if (a.status === 'loading') { toast('Connecting to online services…', 'friends'); return; }
    if (a.status === 'offline') return this.offline();
    if (a.signedIn) return this.accountCard();
    return this.signIn();
  }

  notConfigured() {
    let close;
    close = modal(h('div.confirm',
      h('h3', 'Playing offline'),
      h('p', 'This copy of Reelhaven is running without its game server, so accounts and friends aren’t available. Your island is saved on this device.'),
      h('p.muted', 'For the game’s owner: run server.py (or deploy it to Render as described in the README) and online play turns on automatically.'),
      h('div.row.end', button('OK', () => close(), { cls: 'primary' }))));
  }

  offline() {
    let close;
    close = modal(h('div.confirm',
      h('h3', 'Can’t reach the Reelhaven server'),
      h('p', this.auth.error || 'Online services are unavailable right now.'),
      h('p.muted', 'You can keep playing — everything is saved on this device and will sync once you’re back online and signed in.'),
      h('div.row.end',
        button('Keep playing', () => close(), { cls: 'ghost' }),
        button('Try again', () => { close(); this.auth.net.connect(); setTimeout(() => this.open(), 1500); }, { cls: 'primary' }))));
  }

  // ------------------------------------------------------------ sign in / up
  signIn(mode = 'signin') {
    let close;
    const msg = h('p.form-msg', { role: 'status', 'aria-live': 'polite' });
    const body = h('div.auth-body');
    const tabsEl = h('div.tabs.auth-tabs');
    const render = m => {
      tabsEl.replaceChildren(...[['signin', 'Sign in'], ['signup', 'Create account']].map(([id, label]) =>
        h('button.tab' + (id === m ? '.active' : ''), { type: 'button', on: { click: () => render(id) } }, label)));
      msg.textContent = ''; msg.className = 'form-msg';
      body.replaceChildren(...this.form(m, msg, () => close()));
      setTimeout(() => body.querySelector('input')?.focus(), 30);
    };
    close = modal(h('div.auth',
      h('h3', 'Your Reelhaven account'),
      h('p.muted', 'Sign in to keep your island safe on the server, play on any device, and visit friends.'),
      tabsEl, body, msg,
      h('div.row.end', button('Not now', () => close(), { cls: 'ghost' }))), { cls: 'auth-modal' });
    render(mode);
  }

  form(mode, msg, close) {
    const user = field('Username', { type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', maxlength: '16', placeholder: '3–16 letters or numbers' });
    const pw = field('Password', { type: 'password', autocomplete: mode === 'signup' ? 'new-password' : 'current-password', placeholder: mode === 'signup' ? 'At least 6 characters' : '' });
    if (mode === 'signup') {
      const name = field('Display name', { type: 'text', maxlength: '20', placeholder: 'What friends will see', value: getState()?.player.name || this.ui.title?.loaded?.state?.player.name || '' });
      const go = button('Create account', () => busy(go, msg, async () => {
        const bad = validUsername(user.input.value) || validPassword(pw.input.value) || validDisplayName(name.input.value);
        if (bad) throw userError(bad);
        await this.auth.signUp(user.input.value, pw.input.value, name.input.value);
        toast('Welcome to Reelhaven!', 'check', 'good');
        close();
      }), { cls: 'primary wide', sound: null });
      pw.input.addEventListener('keydown', e => { if (e.key === 'Enter') go.click(); });
      return [user.el, pw.el, name.el, h('p.muted.small-note', 'Remember your password — there’s no email reset. You can change it later in your account.'), go];
    }
    const go = button('Sign in', () => busy(go, msg, async () => {
      const bad = validUsername(user.input.value) || (pw.input.value ? null : 'Please enter your password.');
      if (bad) throw userError(bad);
      await this.auth.signIn(user.input.value, pw.input.value);
      toast('Signed in!', 'check', 'good');
      close();
    }), { cls: 'primary wide', sound: null });
    pw.input.addEventListener('keydown', e => { if (e.key === 'Enter') go.click(); });
    return [user.el, pw.el, go];
  }

  changePassword() {
    let close;
    const msg = h('p.form-msg');
    const old = field('Current password', { type: 'password', autocomplete: 'current-password' });
    const pw = field('New password', { type: 'password', autocomplete: 'new-password', placeholder: 'At least 6 characters' });
    const go = button('Change password', () => busy(go, msg, async () => {
      const bad = validPassword(pw.input.value);
      if (bad) throw userError(bad);
      await this.auth.changePassword(old.input.value, pw.input.value);
      toast('Password changed. Other devices were signed out.', 'check', 'good');
      close();
    }), { cls: 'primary wide', sound: null });
    close = modal(h('div.auth', h('h3', 'Change password'), old.el, pw.el, go, msg, h('div.row.end', button('Cancel', () => close(), { cls: 'ghost' }))));
  }

  // ------------------------------------------------------------ account card
  accountCard() {
    let close;
    const a = this.auth, p = a.profile || {};
    const msg = h('p.form-msg');
    const look = getState()?.player.look || p.look;
    const avatar = look && look.skin ? h('img.acct-avatar', { src: scaleUp(buildPortrait(look), 4).toDataURL(), alt: '' }) : spriteImg('icon_friends', 3, 'acct-avatar');
    const name = field('Display name', { type: 'text', maxlength: '20', value: p.name || '' });
    const saveName = button('Save', () => busy(saveName, msg, async () => {
      const bad = validDisplayName(name.input.value);
      if (bad) throw userError(bad);
      await a.updateProfile({ name: name.input.value });
      msg.className = 'form-msg ok'; msg.textContent = 'Name saved.';
    }), { cls: 'small', sound: null });
    const visits = h('input', { type: 'checkbox', checked: p.allowVisits !== false, on: { change: async e => {
      try { await a.updateProfile({ allowVisits: e.target.checked }); toast(e.target.checked ? 'Friends can visit your island.' : 'Island visits turned off.', 'island'); }
      catch (err) { e.target.checked = !e.target.checked; toast(friendlyError(err), null, 'error'); }
    } } });
    const syncBtn = button('Sync now', () => busy(syncBtn, msg, async () => {
      const res = await this.cloud.reconcile();
      if (res.state && this.ui.game.mode === 'play') this.online.applyState(res.state);
      msg.className = 'form-msg ok'; msg.textContent = 'Cloud save is up to date.';
    }), { cls: 'ghost', iconName: 'check' });
    const status = this.cloud.statusLabel();
    const synced = this.cloud.lastSyncedAt || this.cloud.meta.syncedAt;
    close = modal(h('div.account',
      h('div.acct-head', avatar, h('div',
        h('h3', p.name || 'Islander'),
        h('p.muted', '@' + (p.username || '')))),
      h('div.acct-code', h('span', 'Friend code'), h('b', p.code || '—'),
        button('Copy', async () => {
          try { await navigator.clipboard.writeText(p.code); toast('Friend code copied!', 'check', 'good'); }
          catch { toast('Copy not available — your code is ' + p.code, 'friends'); }
        }, { cls: 'small ghost' })),
      h('div.form-inline', name.el, saveName),
      h('label.setting.toggle', h('span', 'Let friends visit my island', h('small', 'Friends can look around your island (to play together, host a game from Friends).')), visits),
      h('div.acct-sync', icon('island'), h('div', h('b', status?.text || 'Cloud save'), h('small', synced ? 'Last synced ' + new Date(synced).toLocaleString() : 'Not synced yet'))),
      msg,
      h('div.row.wrap.end',
        syncBtn,
        button('Change password', () => { close(); this.changePassword(); }, { cls: 'ghost' }),
        button('Sign out', () => { close(); this.signOutFlow(); }, { cls: 'danger' }),
        button('Close', () => close(), { cls: 'primary' }))), { cls: 'account-modal' });
  }

  async signOutFlow() {
    const synced = await this.cloud.flush();
    const local = Save.load().state;
    const finish = async keep => {
      await this.auth.signOut();
      this.cloud.afterSignOut(keep);
      toast('Signed out.', 'friends');
      if (!keep && this.ui.game.mode === 'play') location.reload();
      else this.ui.title?.refresh();
    };
    if (!local) { finish(true); return; }
    let close;
    close = modal(h('div.confirm',
      h('h3', 'Sign out'),
      h('p', synced
        ? 'Your island is safely saved to your account. Keep a copy on this device so you can keep playing as a guest, or remove it (handy on shared devices).'
        : 'Some recent progress hasn’t reached the server yet (you may be offline). It will stay on this device so nothing is lost.'),
      h('div.row.end',
        button('Cancel', () => close(), { cls: 'ghost' }),
        synced ? button('Remove from device', () => { close(); finish(false); }, { cls: 'ghost' }) : null,
        button('Keep on device', () => { close(); finish(true); }, { cls: 'primary' }))));
  }

  // ------------------------------------------------------------ sync prompts
  /** Ask which copy to keep. Resolves 'local' | 'cloud' | 'later'. */
  chooseSave(local, cloud, why) {
    return new Promise(resolve => {
      let close;
      const card = (title, s, extra) => h('div.save-card',
        h('b', title),
        h('div.save-name', `${s.name} · Level ${s.level}`),
        h('ul', h('li', `${fmt(s.coins)} coins`), h('li', `${s.species} species · ${s.fishCaught} fish caught`), h('li', `${s.builds} things built · quest ${s.quests + 1}`)),
        h('small', extra));
      const ls = summarize(local), cs = summarize(cloud.data);
      const pick = v => { close(); resolve(v); };
      close = modal(h('div.choose-save',
        h('h3', why === 'guest' ? 'Which island should your account use?' : 'Your island changed in two places'),
        h('p', why === 'guest'
          ? 'This device has an island that isn’t linked to your account, and your account already has one in the cloud.'
          : 'This device and your cloud save both have progress the other doesn’t. Choose which to keep — the other is kept as a backup on this device.'),
        h('div.save-cards',
          card('This device', ls, ls.savedAt ? 'Saved ' + new Date(ls.savedAt).toLocaleString() : ''),
          card('Cloud', cs, `Saved ${new Date(cloud.updated_at || cs.savedAt).toLocaleString()}${cloud.device_label ? ' on ' + cloud.device_label : ''}`)),
        h('div.row.wrap.end',
          button('Decide later', () => pick('later'), { cls: 'ghost' }),
          button('Use cloud island', () => pick('cloud'), {}),
          button('Use this device', () => pick('local'), { cls: 'primary' }))), { dismissable: false, cls: 'choose-modal' });
    });
  }

  /** Guest progress + empty account. Resolves 'upload' | 'later'. */
  confirmUpload(local) {
    return new Promise(resolve => {
      let close;
      const s = summarize(local);
      close = modal(h('div.confirm',
        h('h3', 'Save this island to your account?'),
        h('p', `Upload ${s.name}’s island (level ${s.level}, ${s.species} species) so it’s safe in the cloud and you can play it on other devices.`),
        h('div.row.end',
          button('Not now', () => { close(); resolve('later'); }, { cls: 'ghost' }),
          button('Upload my island', () => { close(); resolve('upload'); }, { cls: 'primary' }))), { dismissable: false });
    });
  }
}
