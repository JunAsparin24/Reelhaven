// Friends hub (real friends when online; an honest offline state otherwise),
// island postcards, and the player profile / wardrobe.
import { h, icon, spriteImg, button, refreshSheet, fmt, confirmModal, sheetOpen, closeSheet } from '../dom.js';
import { friendlyError } from '../../online/auth.js';
import { scaleUp } from '../../art/pixel.js';
import { buildPortrait } from '../../art/characters.js';
import { getState, commit } from '../../state.js';
import { toast } from '../../events.js';
import { onlineStatus, PLANNED_FEATURES, islandSnapshot } from '../../multiplayer.js';
import { setPlayerSprites, clearUrlCache } from '../../art/sprites.js';
import { HATS } from '../../../data/item-data.js';
import { ISLANDS } from '../../../data/island-data.js';
import { FISH } from '../../../data/fish-data.js';
import { xpToNext, speciesDiscovered } from '../../progression.js';

// Friends data is fetched from the server and cached here between renders.
const social = { list: null, loading: false, error: null, loadedAt: 0, found: null, finding: false, code: '' };

let watching = false;
function loadFriends(online, force = false) {
  if (!watching) {
    // Requests and presence are pushed by the server: refresh while the panel is open.
    watching = true;
    online.social.on(what => {
      if (sheetOpen() !== 'friends') return;
      if (what === 'friends') loadFriends(online, true);
      else if (what === 'session') refreshSheet();
      else refreshSheet();
    });
  }
  if (social.loading) return;
  if (!force && social.list && Date.now() - social.loadedAt < 15000) return;
  social.loading = true;
  online.social.list()
    .then(list => { social.list = list; social.error = null; social.loadedAt = Date.now(); })
    .catch(err => { social.error = friendlyError(err); })
    .finally(() => { social.loading = false; refreshSheet(); });
}

function lookMini(look) {
  if (!look || !look.skin) return spriteImg('icon_friends', 2, 'friend-avatar');
  return h('img.friend-avatar', { src: scaleUp(buildPortrait(look), 3).toDataURL(), alt: '' });
}

export const friendsPanel = {
  title: 'Friends', icon: 'friends',
  render(body, ctx) {
    const online = ctx.ui.online;
    const auth = online?.auth;
    const s = getState();
    // ---- not configured / offline / signed out: explain honestly
    if (!auth || auth.status === 'disabled' || auth.status === 'offline' || !auth.signedIn) {
      const st = !auth || auth.status === 'disabled' ? onlineStatus()
        : auth.status === 'offline' ? { message: auth.error || 'Online services are unreachable right now.' }
        : { message: 'Sign in to save your island to your account, add friends, see who is online and visit their islands.' };
      body.append(h('div.offline-card',
        h('div.status-dot'),
        h('div', h('b', auth?.status === 'signedOut' ? 'Not signed in' : 'Offline mode'), h('p', st.message),
          auth && auth.status !== 'disabled' ? button(auth.status === 'offline' ? 'Try again' : 'Sign in', () => ctx.ui.openAccount(), { cls: 'small primary' }) : null)));
      profileCard(body, ctx, s);
      body.append(h('h4.section', 'With an account'));
      body.append(h('div.list', PLANNED_FEATURES.map(f => h('div.item-row.planned', icon(f.icon, 'item-icon'), h('div.item-main', h('div.item-name', f.title, f.live ? null : h('span.tag.soon', 'Planned')), h('div.item-sub', f.text))))));
      return;
    }
    // ---- signed in
    loadFriends(online);
    const me = auth.profile || {};
    body.append(h('div.my-code',
      h('div', h('small', 'Your friend code'), h('b', me.code || '—')),
      button('Copy', async () => {
        try { await navigator.clipboard.writeText(me.code); toast('Friend code copied!', 'check', 'good'); }
        catch { toast('Your code is ' + me.code, 'friends'); }
      }, { cls: 'small' }),
      button('Account', () => ctx.ui.openAccount(), { cls: 'small ghost' })));

    multiplayerSection(body, ctx, online);

    // add friend
    body.append(h('h4.section', 'Add a friend'));
    const input = h('input.field.code-input', { type: 'text', maxlength: '8', placeholder: 'FRIEND CODE', value: social.code, 'aria-label': 'Friend code',
      on: { input: e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); social.code = e.target.value; } } });
    const findBtn = button('Find', async () => {
      const code = input.value.trim();
      if (code.length !== 8) { toast('Friend codes have 8 letters and numbers.', null, 'error'); return; }
      social.finding = true; social.found = null; refreshSheet();
      try {
        const p = await online.social.find(code);
        social.found = p || { none: true };
      } catch (err) { toast(friendlyError(err), null, 'error'); }
      social.finding = false; refreshSheet();
    }, { cls: 'small primary' });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') findBtn.click(); });
    body.append(h('div.add-friend', input, findBtn));
    if (social.finding) body.append(h('p.muted', 'Looking for that islander…'));
    const f = social.found;
    if (f && f.none) body.append(h('p.muted', 'No islander has that code. Check it and try again.'));
    else if (f) {
      const rel = { self: 'This is you!', friend: 'Already friends', outgoing: 'Request sent', incoming: 'They asked to be your friend' }[f.relation];
      body.append(h('div.item-row.found', lookMini(f.look),
        h('div.item-main', h('div.item-name', f.name), h('div.item-sub', `Level ${f.level}${rel ? ' · ' + rel : ''}`)),
        f.relation === 'none' || f.relation === 'incoming'
          ? button(f.relation === 'incoming' ? 'Accept' : 'Add friend', async () => {
            try {
              const r = await online.social.request(f.code);
              toast(r === 'accepted' ? `You and ${f.name} are now friends!` : r === 'sent' ? 'Friend request sent!' : r === 'already_friends' ? 'You are already friends.' : 'Request already sent.', 'friends', 'good');
              social.found = null; social.code = '';
              loadFriends(online, true);
            } catch (err) { toast(friendlyError(err), null, 'error'); }
          }, { cls: 'small primary' })
          : null));
    }

    if (social.error) body.append(h('p.form-msg.error', social.error, ' ', button('Retry', () => loadFriends(online, true), { cls: 'small ghost' })));
    if (!social.list) { body.append(h('p.muted', 'Loading your friends…')); return; }
    const incoming = social.list.filter(x => x.direction === 'incoming');
    const outgoing = social.list.filter(x => x.direction === 'outgoing');
    const friends = social.list.filter(x => x.direction === 'friend')
      .sort((a, b) => (online.social.isOnline(b.user) - online.social.isOnline(a.user)) || a.name.localeCompare(b.name));
    const act = (fn, okMsg) => async () => { try { await fn(); if (okMsg) toast(okMsg, 'friends', 'good'); loadFriends(online, true); } catch (err) { toast(friendlyError(err), null, 'error'); } };

    if (incoming.length) {
      body.append(h('h4.section', `Friend requests (${incoming.length})`));
      body.append(h('div.list', incoming.map(r => h('div.item-row', lookMini(r.look),
        h('div.item-main', h('div.item-name', r.name), h('div.item-sub', 'Level ' + r.level)),
        button('Accept', act(() => online.social.respond(r.id, true), `You and ${r.name} are now friends!`), { cls: 'small primary' }),
        button('Decline', act(() => online.social.respond(r.id, false)), { cls: 'small ghost' })))));
    }
    body.append(h('h4.section', `Friends (${friends.length})`));
    if (!friends.length) body.append(h('div.empty', icon('friends', 'big'), h('p', 'No friends yet. Share your friend code, or enter someone else’s above.')));
    else body.append(h('div.list', friends.map(fr => {
      const on = online.social.isOnline(fr.user);
      const pres = online.social.online.get(fr.user);
      const where = !on ? 'Offline' : pres?.status === 'visiting' ? 'Online · visiting an island' : 'Online';
      return h('div.item-row.friend', h('span.presence' + (on ? '.on' : ''), { title: where }), lookMini(fr.look),
        h('div.item-main', h('div.item-name', fr.name), h('div.item-sub', `${where} · Level ${fr.level}`)),
        on ? button('Invite', act(() => online.social.invite(fr.user), `Invite sent to ${fr.name}!`), { cls: 'small primary', iconName: 'friends', title: 'Invite them to join your game' }) : null,
        button('Visit', () => ctx.ui.visitFriend(fr), { cls: 'small', iconName: 'boat', disabled: !fr.allowVisits, title: fr.allowVisits ? 'Look around their island' : 'They have island visits turned off' }),
        button('Remove', () => {
          confirmModal('Remove friend?', `Remove ${fr.name} from your friends?`, 'Remove', act(() => online.social.remove(fr.id), 'Friend removed.'), { danger: true });
        }, { cls: 'small ghost' }));
    })));
    if (outgoing.length) {
      body.append(h('h4.section', 'Sent requests'));
      body.append(h('div.list', outgoing.map(r => h('div.item-row', lookMini(r.look),
        h('div.item-main', h('div.item-name', r.name), h('div.item-sub', 'Waiting for them to accept')),
        button('Cancel', act(() => online.social.remove(r.id), 'Request cancelled.'), { cls: 'small ghost' })))));
    }
    profileCard(body, ctx, s);
  },
};

/** Host a game / invite code / join by code. */
function multiplayerSection(body, ctx, online) {
  const social = online.social;
  if (!social.statusChecked) { social.statusChecked = true; social.hostStatus().catch(() => {}); }
  const wrap = h('div.mp-box');
  wrap.append(h('h4.section', 'Multiplayer'));
  const err = e => toast(friendlyError(e), null, 'error');
  const joined = social.joined;
  if (joined) {
    wrap.append(h('div.mp-row', icon('boat'), h('div.item-main', h('b', `Playing on ${joined.name}’s island`), h('div.item-sub', 'You can fish, gather and build here with them.')),
      button('Leave', () => { closeSheet(true); ctx.game.leaveVisit(); }, { cls: 'small ghost' })));
  }
  const host = social.hosting;
  if (host) {
    wrap.append(h('div.mp-code', h('div', h('small', 'Your game is open · invite code'), h('b', host.code)),
      button('Copy', async () => {
        try { await navigator.clipboard.writeText(host.code); toast('Invite code copied!', 'check', 'good'); }
        catch { toast('Your invite code is ' + host.code, 'friends'); }
      }, { cls: 'small' }),
      button('Stop hosting', () => social.hostStop().then(() => toast('Your game is closed.', 'home')).catch(err), { cls: 'small ghost' })));
    if (host.members.length) {
      wrap.append(h('div.list', host.members.map(m => h('div.item-row', icon('friends', 'item-icon'),
        h('div.item-main', h('div.item-name', m.name), h('div.item-sub', 'In your game')),
        button('Remove', () => social.kick(m.user).catch(err), { cls: 'small ghost' })))));
    } else wrap.append(h('p.muted', 'Share the code, or tap Invite next to a friend. Players who join can fish, gather and build on your island while you’re here.'));
  } else if (!joined) {
    wrap.append(h('div.mp-row', h('div.item-main', h('b', 'Play together'), h('div.item-sub', 'Host a game so friends can join and build on your island with you.')),
      button('Host a game', () => social.hostStart().then(() => toast('Your game is open!', 'friends', 'good')).catch(err), { cls: 'small primary', iconName: 'home' })));
  }
  if (!host) {
    const code = h('input.field.code-input', { type: 'text', maxlength: '6', placeholder: 'INVITE CODE', 'aria-label': 'Invite code',
      on: { input: e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); } } });
    const join = button('Join', async () => {
      if (code.value.length !== 6) { toast('Invite codes have 6 letters and numbers.', null, 'error'); return; }
      try { ctx.ui.joinHosted(await social.joinCode(code.value)); } catch (e) { err(e); }
    }, { cls: 'small primary' });
    code.addEventListener('keydown', e => { if (e.key === 'Enter') join.click(); });
    wrap.append(h('label.form-row', h('span', 'Enter invite code'), h('div.add-friend', code, join)));
  }
  body.append(wrap);
}

function profileCard(body, ctx, s) {
  if (!s) return;   // opened from the title screen before a game is loaded
  const snap = islandSnapshot(s);
  body.append(h('h4.section', 'Your island'));
  body.append(h('article.profile-card',
    spriteImg('portrait_player', 4),
    h('div',
      h('h4', snap.name),
      h('p', `Level ${snap.level} · ${snap.species}/${snap.speciesTotal} species · ${snap.islands.length} island${snap.islands.length === 1 ? '' : 's'}`),
      h('p.muted', `${snap.islands.reduce((n, i) => n + i.placements.length, 0)} things built`)),
    button('Save postcard', () => savePostcard(ctx.game), { iconName: 'postcard', cls: 'small' })));
}

/** Render the whole current island to a PNG and download it. */
function savePostcard(game) {
  const r = game.renderer;
  const w = game.world;
  if (!r.land) return;
  const pad = 24;
  const c = document.createElement('canvas');
  c.width = w.pxW + pad * 2; c.height = w.pxH + pad * 2 + 20;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#fff5df'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#247d91'; g.fillRect(pad, pad, w.pxW, w.pxH);
  g.drawImage(r.land, pad, pad);
  // draw objects and placements roughly (no animation)
  const items = [];
  for (const o of w.objects) { if (w.objectHidden(o)) continue; const spr = r.objectSprite(o, 0, false, w); if (spr) { const fp = o.def.footprint || { w: 1, h: 1 }; items.push({ y: (o.y + fp.h) * 16, x: o.x * 16 + fp.w * 8, spr }); } }
  for (const p of w.placed) { const spr = r.placementSprite(p, false, getState()); if (spr) items.push({ y: (p.y + p.fh) * 16, x: p.x * 16 + p.fw * 8, spr }); }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) g.drawImage(it.spr, Math.round(pad + it.x - it.spr.width / 2), Math.round(pad + it.y - it.spr.height));
  const big = document.createElement('canvas');
  big.width = c.width * 2; big.height = c.height * 2;
  const bg = big.getContext('2d');
  bg.imageSmoothingEnabled = false;
  bg.drawImage(c, 0, 0, big.width, big.height);
  bg.fillStyle = '#2c2433';
  bg.font = '28px "Pixelify Sans", monospace';
  bg.fillText(`${getState().player.name}'s ${ISLANDS[w.id].name} — Reelhaven`, pad * 2, big.height - 18);
  big.toBlob(blob => {
    if (!blob) { toast('Could not create the postcard.', null, 'error'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reelhaven-${w.id}-postcard.png`;
    document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('Postcard saved!', 'postcard', 'good');
  });
}

export const profilePanel = {
  title: 'Profile', icon: 'home',
  render(body) {
    const s = getState();
    const p = s.player;
    body.append(h('article.profile-card',
      spriteImg('portrait_player', 5),
      h('div', h('h4', p.name), h('p', `Level ${p.level} · ${fmt(p.xp)}/${fmt(xpToNext(p.level))} XP`), h('p.muted', `Day ${s.world.day} on the islands`))));
    const st = s.stats;
    body.append(h('div.stat-grid',
      [['Fish caught', st.fishCaught], ['Species', `${speciesDiscovered()}/${FISH.length}`], ['Fish sold', st.fishSold], ['Coins earned', fmt(st.coinsFromSales)],
        ['Perfect casts', st.perfectCasts], ['Treasures', st.treasures], ['Buildings', st.buildingsBuilt], ['Decorations', st.decorPlaced]]
        .map(([k, v]) => h('div.stat', h('small', k), h('b', String(v))))));
    body.append(h('h4.section', 'Wardrobe'));
    const grid = h('div.hat-grid');
    for (const id of s.inventory.hats) {
      const on = p.look.hat === id;
      grid.append(button(HATS[id].name, () => {
        p.look.hat = id;
        setPlayerSprites(p.look);
        clearUrlCache('portrait_player');
        commit('look');
        refreshSheet();
      }, { cls: on ? 'primary small' : 'small', iconName: 'hat' }));
    }
    body.append(grid);
    body.append(h('p.muted', 'Earn pearls to buy more hats at Nori’s shop.'));
  },
};
