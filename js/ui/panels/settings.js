// Settings: audio, motion, controls, save management, reset, version.
import { h, button, confirmModal, refreshSheet, modal } from '../dom.js';
import { getState, commit, GAME_VERSION, SAVE_VERSION, defaultSettings } from '../../state.js';
import { emit, toast } from '../../events.js';
import * as Save from '../../save.js';
import { setVolumes, sfx, initAudio } from '../../audio.js';

/** Settings chosen on the title screen before a game exists. */
export const pendingSettings = defaultSettings();

export const settingsPanel = {
  title: 'Settings', icon: 'gear',
  render(body, ctx) {
    const s = getState();
    // On the title screen we edit the stored save's settings (or the defaults
    // for a brand-new game) before any game state is active.
    const titleSave = ctx.opts?.titleSave || null;
    const set = s ? s.settings : titleSave ? titleSave.settings : pendingSettings;
    const apply = () => {
      setVolumes(set);
      if (s) commit('settings');
      else if (titleSave) Save.save(titleSave);
      emit('settings');
      document.documentElement.classList.toggle('reduced-motion', !!set.reducedMotion);
    };
    const slider = (label, key) => {
      const out = h('output', Math.round(set[key] * 100) + '%');
      return h('label.setting',
        h('span', label),
        h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(set[key] * 100)), 'aria-label': label,
          on: { input: e => { set[key] = Number(e.target.value) / 100; out.textContent = e.target.value + '%'; apply(); }, change: () => { initAudio(); sfx('coin'); } } }),
        out);
    };
    const toggle = (label, key, help) => h('label.setting.toggle',
      h('span', label, help ? h('small', help) : null),
      h('input', { type: 'checkbox', checked: !!set[key], on: { change: e => { set[key] = e.target.checked; apply(); } } }));

    if (!ctx.opts?.fromTitle && s && ctx.game.mode === 'play') {
      body.append(button('Return to main menu', () => ctx.game.returnToTitle(), { cls: 'wide', iconName: 'home' }));
    }
    body.append(h('h4.section', 'Audio'), slider('Master', 'master'), slider('Music', 'music'), slider('Sound effects', 'sfx'), slider('Footsteps', 'footsteps'), slider('Ambience', 'ambience'));
    body.append(h('h4.section', 'Accessibility & controls'),
      toggle('Reduced motion', 'reducedMotion', 'Calmer water, no screen flashes or bouncing.'),
      toggle('Vibration', 'haptics', 'Buzz on bites (phones that support it).'));
    body.append(h('div.controls-help',
      h('b', 'Controls'),
      h('p', 'Touch: drag anywhere to steer. Tap the island to use what you’re holding. The buttons at the bottom right talk, open, fish and more.'),
      h('p', 'PC: WASD / arrows to move. Left click uses the item in your hand, right click (or E / Space) talks, opens and fishes. 1–0, -, = pick a hotbar slot. R rotates in Build mode, Esc closes.')));

    if (!ctx.opts?.fromTitle && s) {
      const saved = s.savedAt ? new Date(s.savedAt).toLocaleString() : 'never';
      body.append(h('h4.section', 'Save data'),
        h('p.muted', `Progress saves automatically on this device. Last saved: ${saved}.`),
        h('div.row.wrap',
          button('Save now', () => { ctx.game.persistNow(); toast('Game saved.', 'check', 'good'); refreshSheet(); }, { iconName: 'check' }),
          button('Export save', () => { ctx.game.persistNow(); Save.exportSave(getState()); toast('Save file downloaded.', 'bag', 'good'); }, { iconName: 'bag' }),
          button('Import save', () => importFlow(), { iconName: 'quest' })),
        h('h4.section', 'Danger zone'),
        button('Reset all progress', () => resetFlow(), { cls: 'danger', iconName: 'close' }));
    }
    body.append(h('p.version', `Reelhaven v${GAME_VERSION} · save format v${SAVE_VERSION}${Save.canPersist ? '' : ' (storage unavailable)'}`));
  },
};

function importFlow() {
  const input = h('input', { type: 'file', accept: 'application/json,.json' });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = Save.importSave(text);
      confirmModal('Import this save?', `This replaces your current progress with ${imported.player.name}'s island (level ${imported.player.level}).`, 'Import', () => {
        Save.save(imported);
        location.reload();
      }, { danger: true });
    } catch (err) {
      toast(err.message || 'That file is not a valid Reelhaven save.', null, 'error');
    }
  });
  input.click();
}

function resetFlow() {
  confirmModal('Reset all progress?', 'This permanently deletes your island, fish, coins and quests on this device. Consider exporting a save first.', 'Continue', () => {
    let close;
    const field = h('input.name-input', { type: 'text', placeholder: 'RESET', 'aria-label': 'Type RESET to confirm' });
    close = modal(h('div.confirm',
      h('h3', 'Are you absolutely sure?'),
      h('p', 'Type RESET to confirm.'),
      field,
      h('div.row.end',
        button('Keep my island', () => close(), { cls: 'ghost' }),
        button('Delete everything', () => {
          if (field.value.trim().toUpperCase() !== 'RESET') { toast('Type RESET to confirm.', null, 'error'); return; }
          Save.wipe();
          location.reload();
        }, { cls: 'danger' }))));
  }, { danger: true });
}
