// Minimal DOM helpers shared by every UI module: element builder, pixel icons,
// bottom sheets, modals and toasts.
import { iconUrl, spriteUrl } from '../art/sprites.js';
import { sfx } from '../audio.js';

/** h('div.class#id', { attrs, on: {click} }, ...children) */
export function h(sel, props = {}, ...children) {
  const [tagAndId, ...classes] = sel.split('.');
  const [tag, id] = tagAndId.split('#');
  const el = document.createElement(tag || 'div');
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(' ');
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { children.unshift(props); props = {}; }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
    else if (k === 'class') el.className += ' ' + v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function icon(name, cls = '') {
  return h('img.px-icon' + (cls ? '.' + cls : ''), { src: iconUrl(name), alt: '', draggable: false });
}

export function spriteImg(id, scale = 3, cls = '') {
  return h('img.px-sprite' + (cls ? '.' + cls : ''), { src: spriteUrl(id, scale), alt: '', draggable: false });
}

export function fmt(n) { return Math.floor(n).toLocaleString('en-US'); }

export function button(label, onClick, { cls = '', iconName = null, disabled = false, title = null, sound = 'click' } = {}) {
  return h('button.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), {
    type: 'button', disabled, title,
    on: { click: e => { if (sound) sfx(sound); onClick(e); } },
  }, iconName ? icon(iconName) : null, label ? h('span', label) : null);
}

/** Cost pills: { coins: 100, wood: 5 } */
export function costView(cost, have = null) {
  const names = { coins: 'coin', pearls: 'pearl', wood: 'wood', stone: 'stone', shell: 'shell', seaglass: 'seaglass', flower: 'flower' };
  return h('span.cost', Object.entries(cost).filter(([, v]) => v).map(([k, v]) => {
    const short = have && have(k) < v;
    return h('span.cost-item' + (short ? '.short' : ''), icon(names[k] || 'coin'), fmt(v));
  }));
}

// ------------------------------------------------------------- sheets
let sheetLayer, modalLayer, toastLayer;
let current = null;   // { id, el, render, onClose }

export function initLayers() {
  sheetLayer = document.getElementById('sheet-layer');
  modalLayer = document.getElementById('modal-layer');
  toastLayer = document.getElementById('toasts');
  sheetLayer.addEventListener('click', e => { if (e.target === sheetLayer) closeSheet(); });
}

/**
 * Open a sheet. render(body) fills it and is re-run by refreshSheet().
 */
export function openSheet(id, title, render, { onClose = null, wide = false, iconName = null, center = false } = {}) {
  if (current && current.id === id) { refreshSheet(); return; }
  closeSheet(true);
  const body = h('div.sheet-body');
  const el = h('section.sheet' + (wide ? '.wide' : '') + (center ? '.center' : ''), { role: 'dialog', 'aria-label': title, 'aria-modal': 'true' },
    h('header.sheet-head',
      iconName ? icon(iconName, 'head-icon') : null,
      h('h2', title),
      h('button.icon-btn.close', { type: 'button', 'aria-label': 'Close', on: { click: () => closeSheet() } }, icon('close'))),
    body);
  sheetLayer.append(el);
  sheetLayer.classList.add('open');
  sheetLayer.classList.toggle('dim', !!center);
  current = { id, el, body, render, onClose };
  sfx('open');
  render(body);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => el.querySelector('button:not(.close), [tabindex]')?.focus?.({ preventScroll: true }), 50);
  document.dispatchEvent(new CustomEvent('sheet', { detail: { id } }));
}

export function refreshSheet() {
  if (!current) return;
  const scroll = current.body.scrollTop;
  current.body.replaceChildren();
  current.render(current.body);
  current.body.scrollTop = scroll;
}

export function closeSheet(silent = false) {
  if (!current) return;
  const { el, onClose } = current;
  current = null;
  el.classList.remove('in');
  el.classList.add('out');
  setTimeout(() => el.remove(), 180);
  if (!sheetLayer.querySelector('.sheet:not(.out)')) sheetLayer.classList.remove('open');
  if (!silent) sfx('close');
  onClose?.();
  document.dispatchEvent(new CustomEvent('sheet', { detail: { id: null } }));
}

export function sheetOpen() { return current ? current.id : null; }

// ------------------------------------------------------------- modals
const modalQueue = [];

/** Show a modal; with queue:true it waits until no other modal is open. */
export function modal(content, { dismissable = true, cls = '', queue = false } = {}) {
  if (queue && modalOpen()) {
    let realClose = null, cancelled = false;
    modalQueue.push(() => { if (!cancelled) realClose = modal(content, { dismissable, cls }); });
    return () => { cancelled = true; realClose?.(); };
  }
  const box = h('div.modal' + (cls ? '.' + cls : ''), { role: 'dialog', 'aria-modal': 'true' }, content);
  const wrap = h('div.modal-wrap', box);
  const close = () => {
    if (wrap.classList.contains('out')) return;
    wrap.classList.add('out');
    setTimeout(() => { wrap.remove(); if (!modalOpen() && modalQueue.length) modalQueue.shift()(); }, 160);
  };
  if (dismissable) wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  modalLayer.append(wrap);
  requestAnimationFrame(() => wrap.classList.add('in'));
  setTimeout(() => box.querySelector('button')?.focus({ preventScroll: true }), 30);
  return close;
}

export function confirmModal(title, text, okLabel, onOk, { danger = false, cancelLabel = 'Cancel' } = {}) {
  let close;
  const content = h('div.confirm',
    h('h3', title),
    h('p', text),
    h('div.row.end',
      button(cancelLabel, () => close(), { cls: 'ghost' }),
      button(okLabel, () => { close(); onOk(); }, { cls: danger ? 'danger' : 'primary' })));
  close = modal(content);
  return close;
}

export function modalOpen() { return !!modalLayer?.querySelector('.modal-wrap:not(.out)'); }

// ------------------------------------------------------------- toasts
export function showToast({ text, icon: ic, tone = 'info' }) {
  if (!toastLayer) return;
  const el = h('div.toast.' + tone, { role: 'status' }, ic ? icon(ic) : null, h('span', text));
  toastLayer.append(el);
  while (toastLayer.children.length > 2) toastLayer.firstChild.remove();
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, tone === 'error' ? 3200 : 2600);
}

export function tabs(names, active, onPick) {
  return h('div.tabs', { role: 'tablist' }, names.map(([id, label, ic]) =>
    h('button.tab' + (id === active ? '.active' : ''), { type: 'button', role: 'tab', 'aria-selected': id === active ? 'true' : 'false', on: { click: () => { sfx('click'); onPick(id); } } },
      ic ? icon(ic) : null, h('span', label))));
}

export function progressBar(value, max, cls = '') {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return h('div.bar' + (cls ? '.' + cls : ''), { role: 'progressbar', 'aria-valuenow': String(Math.floor(value)), 'aria-valuemax': String(max) }, h('div.fill', { style: { width: pct + '%' } }));
}
