// Friends hub (honest offline state + local island profile & postcard) and
// the player profile / wardrobe.
import { h, icon, spriteImg, button, refreshSheet, fmt } from '../dom.js';
import { getState, commit } from '../../state.js';
import { toast } from '../../events.js';
import { onlineStatus, PLANNED_FEATURES, islandSnapshot } from '../../multiplayer.js';
import { setPlayerSprites, clearUrlCache } from '../../art/sprites.js';
import { HATS } from '../../../data/item-data.js';
import { ISLANDS } from '../../../data/island-data.js';
import { FISH } from '../../../data/fish-data.js';
import { xpToNext, speciesDiscovered } from '../../progression.js';

export const friendsPanel = {
  title: 'Friends', icon: 'friends',
  render(body, ctx) {
    const st = onlineStatus();
    const s = getState();
    const snap = islandSnapshot(s);
    body.append(h('div.offline-card',
      h('div.status-dot' + (st.connected ? '.on' : '')),
      h('div', h('b', st.connected ? 'Online' : 'Offline mode'), h('p', st.message))));
    body.append(h('h4.section', 'Your island profile'));
    body.append(h('article.profile-card',
      spriteImg('portrait_player', 4),
      h('div',
        h('h4', snap.name),
        h('p', `Level ${snap.level} · ${snap.species}/${snap.speciesTotal} species · ${snap.islands.length} island${snap.islands.length === 1 ? '' : 's'}`),
        h('p.muted', `${snap.islands.reduce((n, i) => n + i.placements.length, 0)} things built`)),
      button('Save postcard', () => savePostcard(ctx.game), { iconName: 'postcard', cls: 'small' })));
    body.append(h('p.muted', 'Postcards are images of your island you can share anywhere — no account needed.'));
    body.append(h('h4.section', 'Coming with online play'));
    body.append(h('div.list', PLANNED_FEATURES.map(f => h('div.item-row.planned', icon(f.icon, 'item-icon'), h('div.item-main', h('div.item-name', f.title, h('span.tag.soon', 'Planned')), h('div.item-sub', f.text))))));
  },
};

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
  bg.fillText(`${getState().player.name}'s ${ISLANDS[w.id].name} — Tide & Town`, pad * 2, big.height - 18);
  big.toBlob(blob => {
    if (!blob) { toast('Could not create the postcard.', null, 'error'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tide-and-town-${w.id}-postcard.png`;
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
