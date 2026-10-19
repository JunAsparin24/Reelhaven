# Tide & Town

A cozy pixel-art fishing and island-building game for mobile browsers (and desktop).
Catch fish, sell your haul, upgrade your rod, build up your island, sail to new
islands and fill out the fish encyclopedia.

Built with plain HTML, CSS and JavaScript ES modules plus HTML Canvas. There is
**no build step and no runtime dependencies**. All pixel art and sound effects
are generated in code, so the game loads instantly.

## Running it locally

ES modules need to be served over HTTP (opening `index.html` as a file won't work).
Use any static server from the project folder:

| Option | Command / steps |
| --- | --- |
| VS Code Live Server | Right-click `index.html` → **Open with Live Server** |
| Python 3 | `python -m http.server 5173` (Windows: `py -m http.server 5173`) |
| Node.js | `npm start` (runs `npx serve` on port 5173) |

Then open <http://localhost:5173>.

**Playing on your phone:** run the server on your computer, make sure the phone
is on the same Wi-Fi, and open `http://<your-computer's-LAN-IP>:5173`.
Tip: in the phone browser use "Add to Home Screen" to install it as an app (PWA).
Installed or offline play needs HTTPS or localhost for the service worker.

Add `?nosw` to the URL to skip the service worker while developing.

## Play anywhere: free hosting on Render

The game is a static site, so it runs on Render's **free Static Site** plan
(no server, no sleeping, HTTPS included). `render.yaml` is already set up.

1. Push this project to GitHub (it's linked to `JunAsparin24/Tide-Town`).
2. Sign in at <https://render.com> with GitHub.
3. Click **New +** → **Blueprint**, pick the `Tide-Town` repository, and click **Apply**.
   (Or use **New +** → **Static Site** with build command
   `mkdir -p dist && cp -r index.html manifest.json service-worker.js css js data assets dist/`
   and publish directory `dist`.)
4. When the deploy finishes you get a link like `https://tide-and-town.onrender.com`.
   Open it on any phone or computer. On your phone, use **Add to Home Screen**
   to install it like an app. After the first visit it also works offline.

Every push to `main` redeploys automatically. Progress is saved in each
browser, so a phone and a laptop keep separate saves. Use **Settings → Export /
Import save** to move a save between devices.

## Building for production

There is nothing to compile. The Render build just copies the game files into
`dist/`. Any other static host works too (GitHub Pages, Netlify, Cloudflare
Pages, itch.io HTML5 upload).

## Tests

Start a server and open <http://localhost:5173/tests/test.html>. The page runs
26 logic tests against the real game modules: economy, inventory capacity,
fish spawn rules, saves (migrations, corruption fallback), map reachability,
building placement, shop, quests, orders, gardens, levels and travel.

## How to play

- **Move:** drag anywhere on the island (a joystick appears under your thumb),
  tap a spot to walk there, or use WASD / arrow keys.
- **Interact:** walk up to things and tap the round **A** button (or press E / Space).
  Tapping a tree, NPC or fishing spot walks you there and uses it.
- **Fish:** at a dock or shore spot, hold the button and release in the gold
  zone for a perfect cast. When the bobber splashes, tap fast. Then hold and
  release to keep the fish inside the green zone until the bar fills.
- **Bag / Quests / Build:** buttons on the right. **Fish / Map / Friends:**
  bottom tabs. Rest in your cottage to skip to morning, evening or night.

## Project structure

```
index.html            app shell
manifest.json         PWA manifest
service-worker.js     offline cache (network-first)
css/                  style (tokens, buttons), game (HUD, fishing), ui (menus), mobile (responsive)
data/                 all content and balance numbers
  fish-data.js        22 species
  item-data.js        rods, bait, resources, hats
  building-data.js    6 buildings + 15 decorations
  quest-data.js       story quests, daily goals, achievements, XP curve, orders
  island-data.js      4 islands (map scripts, spots, NPC placement, unlock rules)
  npc-data.js         NPC looks and dialogue
js/
  main.js             entry point
  game.js             loop, modes, input routing, island loading
  state.js            authoritative save-able state
  save.js             versioned localStorage saves, backup, migrations, import/export
  world-gen.js        deterministic map builder
  world.js            runtime world: collision, placement rules, pathfinding
  renderer.js         canvas renderer (water, lighting, weather, particles)
  camera.js, player.js, controls.js
  fishing.js          casting / bite / reeling simulation
  fish.js             spawn tables and odds
  inventory.js, economy.js, shop.js, building.js, building-count.js
  quests.js           story quests, daily goals, Fish Market orders
  progression.js      XP, levels, achievements, encyclopedia milestones
  islands.js          unlocks and travel
  weather.js          clock, weather, lighting
  world-events.js     local calendar events
  dialogue.js, interactions.js, audio.js, events.js
  multiplayer.js      online-service boundary (offline in this release)
  art/                procedural pixel-art sprites, tiles, icons, palette
  ui/                 HUD, panels, fishing UI, dialogue box, build bar, title
assets/               icons + place for hand-made art and audio (see assets/README.md)
tests/                browser test page
tools/                icon generator
```

The simulation modules (`state`, `economy`, `inventory`, `fishing`, `quests`…)
never touch the DOM. The UI listens to events from `events.js` and re-renders
panels when state changes. It does not re-render every frame.

## Adding content

### A new fish
Append an entry to `FISH` in `data/fish-data.js`:

```js
{
  id: 'lemon_shark', name: 'Lemon Shark', rarity: 'epic', price: 280,
  zones: ['ocean'], times: ['night'], weather: null, size: [80, 200],
  difficulty: 7, behavior: 'sprinter',
  desc: 'Surprisingly sweet. Not actually lemon flavoured.',
  art: { len: 22, h: 8, body: '#d8c87a', fin: '#b0a050' },
}
```

It automatically appears in the encyclopedia, spawn tables, orders and the bag.
`zones` must match a fishing-spot `zone` on some island. `behavior` is one of
`smooth, darter, lazy, floater, puffer, erratic, sprinter, eel, trickster`
(defined in `js/fishing.js`). Optional fields: `islands`, `bait` (required bait),
`likesBait`, `minLevel`, `release` (photo-and-release creatures), `weight`.
For non-fish shapes add a painter to `SPECIAL` in `js/art/fish-art.js` and set
`art: { special: 'yourPainter', ... }`.

### A new island
Add an entry to `ISLANDS` and its id to `ISLAND_ORDER` in `data/island-data.js`.
The `build(m)` script uses the builder from `js/world-gen.js`:

- `m.fill(t)`, `m.blob(cx, cy, rx, ry, t, wobble, seed)`, `m.rect(x, y, w, h, t)`, `m.path(points, t, width)`
- `m.obj(type, x, y)` for trees, rocks, resource nodes and props (types in `OBJECT_TYPES`, `js/world.js`)
- `m.spot(id, zone, x, y, facing, name, { hidden, luck })` for fishing spots (snapped to the shoreline automatically)
- `m.place(buildingType, x, y)` for pre-built structures

Set `unlock` (level / flag / building requirements plus `cost`), `spawn`,
`mapPos` (0..1 on the world map), `theme` (water/ground styles) and `npcs`.
Optional flags: `fog`, `alwaysNight`, `fishingMod`. Island state (placements,
resource timers, flags) is created and saved automatically.

### Buildings and decorations
Add to `BUILDINGS` or `DECOR` in `data/building-data.js` (price, `cost`, `footprint`,
`solid`, `rotations`, `lights`, `minLevel`, `maxCount`), then add a sprite with
the same id in `buildAllSprites()` (`js/art/sprites.js`). Rotated variants use
`id + '_r1'`, and night-lit variants use `id + '_lit'`. Building interactions are
in `UI.building()` (`js/ui/index.js`) and `findInteractable()`.

### Quests
Append to `MAIN_QUESTS` in `data/quest-data.js`. Objective types are measured
in `measure()` in `js/quests.js`. Add a case there for a new type.

## Saving

- State lives in one JSON object (`js/state.js`) saved to `localStorage`
  under `tidetown.save`. It saves automatically about a second after meaningful
  actions, every ~30s for the clock, and when the tab is hidden or closed. The
  HUD dot shows saving (orange) and saved (green).
- Saves are versioned (`SAVE_VERSION`). `MIGRATIONS` in `js/save.js` upgrade
  older saves step by step.
- The previous good save is rotated into `tidetown.save.backup`. If the main
  save is unreadable, the backup is restored. If both fail, the damaged data is
  copied to `tidetown.save.corrupt.<timestamp>` and never overwritten silently.
- **Settings → Save data** has Save now, Export (download a `.json`), Import, and
  a two-step Reset.

## Multiplayer: implemented vs planned

**Implemented now (single-player, offline):**
- The Friends tab shows an honest **Offline mode** status, your real island
  profile, and a **Save postcard** button that exports a PNG of your island to
  share anywhere.
- `js/multiplayer.js` defines the online-service boundary (`onlineStatus()`) and
  the public island snapshot format (`islandSnapshot()`) a server would store.
- Weekend Market / Full Moon events are **local** calendar events
  (`js/world-events.js`). They are clearly labelled and not synchronised between players.

**Planned (needs a backend, not built):** accounts, cloud saves, friend lists,
island visits, trading, competitions and community goals. The recommended path is
Supabase (auth + Postgres + Realtime) or similar. Currency, inventory, trades and
rewards must then be validated server-side. Never trust the client. Daily goals
should use server time once a backend exists.

## Credits

All code, pixel art (procedural), sounds (Web Audio synthesis) and writing are
original to this project. Font: [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans)
(SIL Open Font License) via Google Fonts, with a system fallback.
