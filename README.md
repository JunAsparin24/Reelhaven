# Reelhaven

*(formerly “Tide & Town”)* — a cozy pixel-art island fishing game for mobile browsers and desktop, designed for **landscape** play.
Catch fish, sell your haul, upgrade your rod, build up your island, sail to new
islands and fill out the fish encyclopedia.

Built with plain HTML, CSS and JavaScript ES modules plus HTML Canvas. There is
**no build step and no runtime dependencies**. All pixel art and sound effects
are generated in code, so the game loads instantly.

## Running it locally

Needs Python 3.9+ and nothing else (no `pip install`, no npm):

```sh
python server.py          # or: py server.py   on Windows
```

Open <http://localhost:8000>. The server also prints a LAN address you can open
on your phone (same Wi-Fi). Set `PORT=3000` to change the port. Accounts and
cloud saves are stored in `server-data/reelhaven.json` (never served to players).

You can also open the game with any plain static server (VS Code Live Server,
`py -m http.server`) — it then simply runs offline with local saves, because
accounts and friends need `server.py`.

## Play anywhere: Render (same setup as FriendZone)

`server.py` runs as a Render **web service** using the included `Dockerfile`
(`render.yaml` is ready to use).

1. Push this project to GitHub (linked to `JunAsparin24/Tide-Town`).
2. In Render: **New +** → **Blueprint** → pick `Tide-Town` → **Apply**.
   (Or **New +** → **Web Service** → this repo → Runtime **Docker**.)
3. When it's live you get a link like `https://reelhaven.onrender.com` —
   open it on any phone or computer. Accounts, cloud saves, friends and island
   visits all work through that link.

**Keeping accounts on Render (important):** free web services have no
persistent disk, so `reelhaven.json` is wiped whenever the service restarts,
redeploys, or sleeps after ~15 minutes without visitors. Islands stay safe on
each player's own device and re-upload when they sign in, but **accounts and
friend lists would reset**. To keep them permanently, set the service to the
*Starter* plan and add a **Disk** mounted at `/data` (uncomment the `disk:`
lines in `render.yaml`). The server stores everything at `/data/reelhaven.json`.

Free services also take ~30–50 seconds to wake up after sleeping; the game
shows "Can't reach the server" until it's up and then reconnects by itself.

## Building for production

There is nothing to compile. The `Dockerfile` copies the game and `server.py`
into a small Python image. The game files alone also work on any static host
(GitHub Pages, Netlify, itch.io) — online features are then simply off.

## Tests

Start a server and open <http://localhost:5173/tests/test.html>. The page runs
26 logic tests against the real game modules: economy, inventory capacity,
fish spawn rules, saves (migrations, corruption fallback), map reachability,
building placement, shop, quests, orders, gardens, levels and travel.

## How to play

- **Hold your phone sideways** — the game is built for landscape (portrait works too).
- **Move:** drag anywhere on the island (a joystick appears under your thumb),
  tap a spot to walk there, or use WASD / arrow keys.
- **Interact:** walk up to things — the action buttons in the bottom-right show
  only what's nearby (Fish, Talk, Shop…). Press E / Space on a keyboard.
  Tapping a tree, NPC or fishing spot walks you there and uses it.
- **Fish:** at a dock or shore spot, hold the button and release in the gold
  zone for a perfect cast. When the bobber splashes, tap fast. Then hold and
  release to keep the fish inside the green zone until the bar fills.
- **Menu (top-right):** Bag, Quests, Build, Fish, Map, Friends, Settings.
  Rest in your cottage to skip to morning, evening or night.
- **Sound:** footsteps change with the ground (grass, sand, wood, stone, mud,
  shallow water); master / music / effects / footsteps / ambience volumes in Settings.

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
  multiplayer.js      island snapshot format, offline status text
  online/             net.js (WebSocket), auth.js, cloud-sync.js, social.js, index.js
  art/                procedural pixel-art sprites, tiles, icons, palette
  ui/                 HUD, panels, fishing UI, dialogue box, build bar, title
assets/               icons + place for hand-made art and audio (see assets/README.md)
server.py             game server: accounts, cloud saves, friends, presence, visits
Dockerfile            container for Render (or any Docker host)
tests/                browser test page
tools/                icon generator, footstep sound generator
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

## Online features (accounts, cloud saves, friends, island visits)

Everything runs on the game's own server, `server.py` (Python standard library,
one WebSocket at `/ws`) — no third-party services.

| Feature | Status |
| --- | --- |
| Accounts: username + password (PBKDF2-hashed), stay signed in per device, change password | Implemented |
| Cloud saves with revision checks, conflict choice, offline retry | Implemented |
| Friend codes; send / accept / decline / cancel requests; remove friends | Implemented |
| Online status of friends (online / visiting) | Implemented |
| Visit a friend's island (read-only) and see each other move live | Implemented |
| Trading, competitions, community goals | Planned — not built yet |

**Testing with two accounts:** run `python server.py`, open
<http://localhost:8000> in a normal window and a private window, create an
account in each (Friends → Sign in → Create account), copy one friend code,
add it from the other account, accept, then tap **Visit**.

**How saves stay safe:** the local save is always what you play. When signed in,
each upload says which cloud revision it was based on; the server only accepts
it if that's still the latest, so two devices can't silently overwrite each
other — you're asked which island to keep, and the other is archived on the
device (*Settings → Save data*). Switching accounts never mixes islands.

**Security:** passwords are salted and hashed (PBKDF2-SHA256); devices keep a
random sign-in token (stored hashed on the server), never the password; sign-in
attempts are rate-limited. The server checks every friend action (you can only
touch your own requests and friendships), only friends can load your island or
join its live channel, and visits can be switched off. Island snapshots are
cleaned on the server to public layout data only (no coins or inventory). The
server only serves the game files — never `server.py` or the data file.
Single-player progress is client-side by nature; future trading must be
validated by the server.

**Verified:** 44 end-to-end server checks with real WebSocket clients (accounts,
conflicts, permissions, presence, movement relay, restart persistence), and a
two-browser test through the real game UI: sign up, upload, add friend,
accept, see each other online, visit, see each other walk, leave, reload and
stay signed in. There is no email, so there is no password reset — players can
change their password while signed in.

## Credits

All code, pixel art (procedural), sounds (Web Audio synthesis) and writing are
original to this project (footsteps: `tools/generate_footsteps.py`). Font: [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans)
(SIL Open Font License) via Google Fonts, with a system fallback.
