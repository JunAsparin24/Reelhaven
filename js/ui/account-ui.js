// Account screens: sign in / create account / email link / password reset,
// the signed-in account card, and the save-choice prompts used by cloud sync.
import { h, button, modal, icon, spriteImg, fmt } from './dom.js';
import { toast } from '../events.js';
import { friendlyError, validEmail, validPassword, validDisplayName } from '../online/auth.js';
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
      if (type === 'recovery') this.passwordRecovery();
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
      h('p', 'Online accounts aren’t switched on for this copy of Reelhaven yet, so your island is saved on this device only.'),
      h('p.muted', 'For the game’s owner: connect a Supabase project as described in the README (“Online setup”) and accounts, cloud saves and friends turn on automatically.'),
      h('div.row.end', button('OK', () => close(), { cls: 'primary' }))));
  }

  offline() {
    let close;
    close = modal(h('div.confirm',
      h('h3', 'Can’t reach the island network'),
      h('p', this.auth.error || 'Online services are unavailable right now.'),
      h('p.muted', 'You can keep playing — everything is saved on this device and will sync once you’re back online and signed in.'),
      h('div.row.end',
        button('Keep playing', () => close(), { cls: 'ghost' }),
        button('Try again', async () => { close(); await this.auth.init(); this.open(); }, { cls: 'primary' }))));
  }

  // ------------------------------------------------------------ sign in / up
  signIn(mode = 'signin') {
    let close;
    const msg = h('p.form-msg', { role: 'status', 'aria-live': 'polite' });
    const body = h('div.auth-body');
    const tabsEl = h('div.tabs.auth-tabs');
    const render = m => {
      mode = m;
      tabsEl.replaceChildren(...[['signin', 'Sign in'], ['signup', 'Create account'], ['link', 'Email link']].map(([id, label]) =>
        h('button.tab' + (id === m ? '.active' : ''), { type: 'button', on: { click: () => render(id) } }, label)));
      msg.textContent = ''; msg.className = 'form-msg';
      body.replaceChildren(...this.form(m, msg, () => close()));
      setTimeout(() => body.querySelector('input')?.focus(), 30);
    };
    const google = this.auth.config?.googleAuth
      ? button('Continue with Google', () => busy(google, msg, () => this.auth.signInWithGoogle()), { cls: 'ghost wide', iconName: 'friends' })
      : null;
    close = modal(h('div.auth',
      h('h3', 'Your Reelhaven account'),
      h('p.muted', 'Sign in to keep your island safe in the cloud, play on any device, and visit friends.'),
      tabsEl, body, msg,
      this.auth.config?.googleAuth ? h('div.or', h('span', 'or')) : null,
      google,
      h('div.row.end', button('Not now', () => close(), { cls: 'ghost' }))), { cls: 'auth-modal' });
    render(mode);
  }

  form(mode, msg, close) {
    const email = field('Email', { type: 'email', inputmode: 'email', autocomplete: 'email', placeholder: 'you@example.com' });
    if (mode === 'link') {
      const go = button('Email me a sign-in link', () => busy(go, msg, async () => {
        const bad = validEmail(email.input.value);
        if (bad) throw userError(bad);
        await this.auth.sendMagicLink(email.input.value);
        msg.className = 'form-msg ok';
        msg.textContent = 'Check your inbox! Open the link on this device to sign in.';
      }), { cls: 'primary wide', sound: null });
      return [email.el, go];
    }
    const pw = field('Password', { type: 'password', autocomplete: mode === 'signup' ? 'new-password' : 'current-password', placeholder: mode === 'signup' ? 'At least 8 characters' : '' });
    if (mode === 'signup') {
      const name = field('Display name', { type: 'text', maxlength: '20', placeholder: 'What friends will see', value: getState()?.player.name || this.ui.title?.loaded?.state?.player.name || '' });
      const go = button('Create account', () => busy(go, msg, async () => {
        const bad = validDisplayName(name.input.value) || validEmail(email.input.value) || validPassword(pw.input.value);
        if (bad) throw userError(bad);
        const res = await this.auth.signUp(email.input.value, pw.input.value, name.input.value);
        msg.className = 'form-msg ok';
        if (res.needsConfirmation) msg.textContent = 'Almost there! We sent a confirmation link to your email. Open it, then sign in here.';
        else { msg.textContent = 'Welcome to Reelhaven!'; setTimeout(close, 700); }
      }), { cls: 'primary wide', sound: null });
      return [name.el, email.el, pw.el, go];
    }
    const go = button('Sign in', () => busy(go, msg, async () => {
      const bad = validEmail(email.input.value) || (pw.input.value ? null : 'Please enter your password.');
      if (bad) throw userError(bad);
      await this.auth.signIn(email.input.value, pw.input.value);
      toast('Signed in!', 'check', 'good');
      close();
    }), { cls: 'primary wide', sound: null });
    pw.input.addEventListener('keydown', e => { if (e.key === 'Enter') go.click(); });
    const forgot = h('button.linkish', { type: 'button', on: { click: () => busy(forgot, msg, async () => {
      const bad = validEmail(email.input.value);
      if (bad) throw userError('Enter your email above first, then tap “Forgot password”.');
      await this.auth.resetPassword(email.input.value);
      msg.className = 'form-msg ok';
      msg.textContent = 'If that email has an account, a reset link is on its way.';
    }) } }, 'Forgot password?');
    return [email.el, pw.el, go, forgot];
  }

  passwordRecovery() {
    let close;
    const msg = h('p.form-msg');
    const pw = field('New password', { type: 'password', autocomplete: 'new-password', placeholder: 'At least 8 characters' });
    const go = button('Save new password', () => busy(go, msg, async () => {
      const bad = validPassword(pw.input.value);
      if (bad) throw userError(bad);
      await this.auth.updatePassword(pw.input.value);
      toast('Password updated.', 'check', 'good');
      close();
    }), { cls: 'primary wide', sound: null });
    close = modal(h('div.auth', h('h3', 'Choose a new password'), pw.el, go, msg), { dismissable: false });
  }

  // ------------------------------------------------------------ account card
  accountCard() {
    let close;
    const a = this.auth, p = a.profile || {};
    const msg = h('p.form-msg');
    const look = getState()?.player.look || p.look;
    const avatar = look && look.skin ? h('img.acct-avatar', { src: scaleUp(buildPortrait(look), 4).toDataURL(), alt: '' }) : spriteImg('icon_friends', 3, 'acct-avatar');
    const name = field('Display name', { type: 'text', maxlength: '20', value: p.display_name || '' });
    const saveName = button('Save', () => busy(saveName, msg, async () => {
      const bad = validDisplayName(name.input.value);
      if (bad) throw userError(bad);
      await a.updateProfile({ display_name: name.input.value });
      msg.className = 'form-msg ok'; msg.textContent = 'Name saved.';
    }), { cls: 'small', sound: null });
    const visits = h('input', { type: 'checkbox', checked: p.allow_visits !== false, on: { change: async e => {
      try { await a.updateProfile({ allow_visits: e.target.checked }); toast(e.target.checked ? 'Friends can visit your island.' : 'Island visits turned off.', 'island'); }
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
        h('h3', p.display_name || 'Islander'),
        h('p.muted', a.user?.email || ''))),
      h('div.acct-code', h('span', 'Friend code'), h('b', p.friend_code || '—'),
        button('Copy', async () => {
          try { await navigator.clipboard.writeText(p.friend_code); toast('Friend code copied!', 'check', 'good'); }
          catch { toast('Copy not available — your code is ' + p.friend_code, 'friends'); }
        }, { cls: 'small ghost' })),
      h('div.form-inline', name.el, saveName),
      h('label.setting.toggle', h('span', 'Let friends visit my island', h('small', 'They can walk around a read-only copy of your island.')), visits),
      h('div.acct-sync', icon('island'), h('div', h('b', status?.text || 'Cloud save'), h('small', synced ? 'Last synced ' + new Date(synced).toLocaleString() : 'Not synced yet'))),
      msg,
      h('div.row.wrap.end',
        syncBtn,
        button('Sign out', () => { close(); this.signOutFlow(); }, { cls: 'danger' }),
        button('Close', () => close(), { cls: 'primary' }))), { cls: 'account-modal' });
  }

  async signOutFlow() {
    const synced = await this.cloud.flush();
    const local = Save.load().state;
    const finish = async keep => {
      try { await this.auth.signOut(); } catch (err) { toast(friendlyError(err), null, 'error'); return; }
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
        ? 'Your island is safely in the cloud. Keep a copy on this device so you can keep playing as a guest, or remove it (handy on shared devices).'
        : 'Some recent progress hasn’t reached the cloud yet (you may be offline). It will stay on this device so nothing is lost.'),
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
