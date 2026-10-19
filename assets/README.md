# Assets

All game art is currently generated in code (see `js/art/`) so the game runs
with no image downloads. This folder is where hand-made replacements go.

- `icons/` — PWA icons, generated from the game's own pixel art by
  `tools/generate-icons.html`.
- `sprites/`, `tiles/`, `characters/`, `fish/`, `buildings/`, `backgrounds/` —
  drop PNG replacements here (keep the same pixel scale: tiles are 16×16).
- `audio/` — sound effects and music.

## Replacing a sprite

Register the file in `SPRITE_OVERRIDES` in `js/art/sprites.js`:

```js
export const SPRITE_OVERRIDES = {
  cottage: 'assets/buildings/cottage.png',
  fish_golden_koi: 'assets/fish/golden_koi.png',
};
```

Sprite ids are listed in `buildAllSprites()` in the same file. Images are drawn
bottom-centre on their footprint, so keep the same canvas size as the generated
version (or adjust the footprint in `data/building-data.js`).

## Replacing a sound

Add the file to `AUDIO_FILES` in `js/audio.js`, keyed by effect name
(`cast`, `bite`, `catch`, `coin`, `buy`, `quest`, `unlock`, `click`, …).
Loaded files take priority over the built-in synthesized sounds.
