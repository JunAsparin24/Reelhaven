// World map: island thumbnails rendered from real terrain, unlock
// requirements, and travel.
import { h, icon, button, costView, refreshSheet, confirmModal } from '../dom.js';
import { getState } from '../../state.js';
import { toast } from '../../events.js';
import { islandList, unlockRequirements, unlockIsland, canUnlock } from '../../islands.js';
import { buildIslandMap, T } from '../../world-gen.js';
import { makeCanvas, scaleUp } from '../../art/pixel.js';
import { activeEvents } from '../../world-events.js';

const thumbs = new Map();
const COLORS = {
  [T.W]: null, [T.S]: '#f4dead', [T.G]: '#8cc78a', [T.P]: '#d7b98a', [T.D]: '#b9794f', [T.B]: '#b9794f', [T.X]: '#744631',
  [T.O]: '#5fb5b0', [T.M]: '#9c8a63', [T.K]: '#6aa47a', [T.N]: '#8ab89a', [T.R]: '#5cc3c0',
};

function thumb(id, locked) {
  const key = id + locked;
  if (thumbs.has(key)) return thumbs.get(key);
  const m = buildIslandMap(id);
  const c = makeCanvas(m.w, m.h);
  const g = c.getContext('2d');
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const col = COLORS[m.terrain[y * m.w + x]];
    if (!col) continue;
    g.fillStyle = locked ? '#8f9ba3' : col;
    g.fillRect(x, y, 1, 1);
  }
  const url = scaleUp(c, 2).toDataURL();
  thumbs.set(key, url);
  return url;
}

export const mapPanel = {
  title: 'World Map', icon: 'map', wide: true,
  render(body, ctx) {
    const list = islandList();
    const board = h('div.map-board');
    // dotted routes from Sunny Shores
    const home = list[0].def.mapPos;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.classList.add('routes');
    for (const it of list.slice(1)) {
      const l = document.createElementNS(svgNS, 'line');
      l.setAttribute('x1', home.x * 100); l.setAttribute('y1', home.y * 100);
      l.setAttribute('x2', it.def.mapPos.x * 100); l.setAttribute('y2', it.def.mapPos.y * 100);
      l.setAttribute('class', it.state.unlocked ? 'open' : 'closed');
      svg.append(l);
    }
    board.append(svg);
    for (const it of list) {
      const locked = !it.state.unlocked;
      board.append(h('button.map-node' + (locked ? '.locked' : '') + (it.current ? '.here' : ''), {
        type: 'button', style: { left: it.def.mapPos.x * 100 + '%', top: it.def.mapPos.y * 100 + '%' },
        on: { click: () => document.getElementById('isl-' + it.def.id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) },
      }, h('img.map-thumb', { src: thumb(it.def.id, locked), alt: '' }), h('span', it.def.name), it.current ? h('span.here-tag', 'You are here') : null, locked ? icon('lock', 'lock') : null));
    }
    body.append(board);

    const evs = activeEvents();
    if (evs.length) body.append(h('div.events', evs.map(e => h('div.event', icon(e.icon), h('div', h('b', e.name), h('span', e.text))))));

    const cards = h('div.island-cards');
    const s = getState();
    const have = id => id === 'coins' ? s.player.coins : (s.inventory.items[id] || 0);
    for (const it of list) {
      const d = it.def, st = it.state;
      const reqs = unlockRequirements(d.id);
      let action;
      if (it.current) action = h('span.tag', 'Current island');
      else if (st.unlocked) action = button('Sail here', () => ctx.game.travel(d.id), { cls: 'primary', iconName: 'boat', sound: null });
      else {
        const can = canUnlock(d.id);
        action = h('div.unlock-box',
          h('ul.reqs', reqs.map(r => h('li' + (r.met ? '.met' : ''), icon(r.met ? 'check' : 'lock'), r.text))),
          costView(d.unlock.cost, have),
          button(d.unlock.action, () => {
            // Stay tappable when locked so players learn exactly what's missing.
            if (!can.ok) { toast(can.message, 'lock', 'error'); return; }
            confirmModal(d.unlock.action + '?', `Unlock ${d.name} for travel?`, 'Unlock', () => {
              const r = unlockIsland(d.id);
              toast(r.message, r.ok ? 'boat' : null, r.ok ? 'gold' : 'error');
              refreshSheet();
            });
          }, { cls: can.ok ? 'primary' : 'locked-btn' }));
      }
      cards.append(h('article.island-card' + (st.unlocked ? '' : '.locked'), { id: 'isl-' + d.id },
        h('img.card-thumb', { src: thumb(d.id, !st.unlocked), alt: '' }),
        h('div.card-main',
          h('h4', d.name, st.visited ? null : st.unlocked ? h('span.tag.new', 'New') : null),
          h('p', d.tagline),
          h('ul.features', d.features.map(f => h('li', f))),
          action)));
    }
    body.append(cards);
  },
};
