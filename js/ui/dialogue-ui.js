// Dialogue box with portrait, typewriter text and tap-to-advance.
// Used by every NPC through dialogue.js — no per-NPC UI code.
import { h, spriteImg } from './dom.js';
import { conversation } from '../dialogue.js';
import { getState } from '../state.js';
import { sfx } from '../audio.js';

export class DialogueUI {
  constructor(ui) {
    this.ui = ui;
    this.open = false;
    this.root = document.getElementById('dialogue');
    this.root.addEventListener('click', () => this.advance());
    this.root.addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') { e.preventDefault(); this.advance(); } });
  }

  start(npcId) {
    const conv = conversation(npcId);
    this.conv = conv;
    this.i = 0;
    this.open = true;
    this.root.replaceChildren(
      h('div.dlg-portrait', spriteImg('portrait_' + npcId, 5)),
      h('div.dlg-main',
        h('div.dlg-name', conv.npc.name, h('small', conv.npc.role)),
        this.textEl = h('p.dlg-text'),
        h('div.dlg-next', { 'aria-hidden': 'true' })));
    this.root.classList.add('show');
    this.root.tabIndex = 0;
    this.root.focus({ preventScroll: true });
    this.showLine();
  }

  showLine() {
    const line = this.conv.lines[this.i];
    this.full = line;
    this.shown = 0;
    clearInterval(this.typer);
    const reduced = getState()?.settings.reducedMotion;
    if (reduced) { this.textEl.textContent = line; this.shown = line.length; return; }
    this.typer = setInterval(() => {
      this.shown += 2;
      this.textEl.textContent = line.slice(0, this.shown);
      if (this.shown % 6 === 0) sfx('click');
      if (this.shown >= line.length) clearInterval(this.typer);
    }, 22);
  }

  advance() {
    if (!this.open) return;
    if (this.shown < this.full.length) { clearInterval(this.typer); this.shown = this.full.length; this.textEl.textContent = this.full; return; }
    this.i += 1;
    if (this.i < this.conv.lines.length) { this.showLine(); return; }
    const action = this.conv.action;
    this.close();
    if (action === 'shop') this.ui.open('shop');
    else if (action === 'hall') this.ui.open('hall');
    else if (action === 'map') this.ui.open('map');
    else if (action === 'bridge') this.ui.bridge();
  }

  close() {
    if (!this.open) return;
    clearInterval(this.typer);
    this.open = false;
    this.root.classList.remove('show');
  }
}
