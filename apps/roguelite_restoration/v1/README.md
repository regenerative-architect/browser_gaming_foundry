# Pocket Restoration — The Living Trail 🌱

An original, mobile-first, **single-player** browser roguelite. Three short restoration sectors are assembled deterministically from one world seed. Clear waste, root native sprouts, refill responsibly at springs, and choose either a **headwaters** or **canopy** mission branch. Habitat indicators change from individual decisions; resources and safe spring draws are finite. Every completed or failed trail contributes bounded field knowledge for supply training.

**Author/credit:** Foster + Navi / Planetary Restoration Archive. **License:** MIT for this original code and generated artwork. No third-party runtime packages, sound, fonts, sprites, APIs or hosted services.

## Run it

```sh
cd pocket_restoration_roguelite
python3 -m http.server 8000
# Open http://localhost:8000
npm test # Node 20+; no npm install required
```

Or upload the directory contents unchanged to the root or a subdirectory of a **GitHub Pages** branch. All URLs are relative. The site requires no backend, login, build, API keys, analytics or network requests for the game. `file://` may prevent ES module loading and **cannot** install the PWA service worker: use localhost or HTTPS. Once the service worker has successfully cached all shell files during an online visit, reloads of those cached files work offline. Offline support is **not** promised before precaching or where browser storage has been cleared/evicted.

## Controls

- Swipe map or use large arrow buttons. Desktop: WASD/arrow keys.
- Select 🧤 Clean / 🌱 Plant / 💦 Water / 🫗 Refill; keyboard `1`–`4`.
- Use RESTORE, keyboard Space or E to act on the tile occupied by your crew.
- Stand on litter to recover two supplies; planting costs two; each sprout can be watered once; the two springs each permit two draws. Walking is free; actions consume one energy. Each sector begins with 15 energy and limited fresh supplies. Every third successful field action imposes a small drought penalty. Ecology stays in the range 0–100.
- Complete active objectives **after** unlocking their prerequisite. Reach the bottom-right passage gate to choose a route or enter the next sector. The first area requires two cleanups, then two plantings. All three cleared sectors earn a victory.
- Training between runs improves starting sector supplies. A run reset retains only field mastery and saved settings; the **active** run is separately checkpointed for reload/resume.

## File tree

```text
index.html                  Accessible HTML application shell
style.css                   Responsive theme, touch sizes, print and reduced motion
manifest.webmanifest        PWA metadata
sw.js                       Versioned offline precache and deliberate update activation
assets/icon-{192,512}.png   Original generated app icons
src/main.js                 Client UI wiring and lifecycle
src/core/constants.js       Shared model contracts
src/core/engine.js          30 Hz bounded fixed-step queue + RAF renderer
src/core/game.js            Run transitions, movement, economy, metaprogression
src/world/seed.js           Deterministic string hashing and seeded PRNG
src/world/generate.js       9x9 sector generation and flood-fill reachability
src/gameplay/actions.js     Finite resource actions and bounded ecological feedback
src/progress/quests.js      Declarative prerequisite graph, branch goals and counters
src/render/canvas.js        DPR-aware Canvas 2D, performance scaler and shapes
src/ui/input.js             Keyboard, pointer capture, swipes and movement hold
src/persistence/schema.js   JSON schema validation and migration from v1
src/persistence/storage.js  Atomic IndexedDB transaction, fallback and save serialization
tests/*.test.js             Determinism, reachability, exploit, quest, victory, save tests
LICENSE                     MIT permission and attribution
```

### Data model and interfaces

`startRun(meta, seed)` returns a new run. `runCommand(state, {type:'move',direction})` and `runCommand(state, {type:'act'})` are turn-based game mutations. `chooseRoute(state,'water'|'canopy')` advances the first area once its quests are done. `generateRoom(seed,stage)` is pure and versioned. `applyAction(state,tool)` uses bounded game ecology and finite resources. `makeBackup(state,settings)` creates a strict version-2 save; `parseBackup(json)` validates or migrates it without changing any live data. `SaveStore.init/load/save/saveValidated/erase` manages a single on-device slot. `GameEngine.enqueue(command)` decouples input from the fixed-step processor. `HabitatCanvas.draw(...)` has no game logic.

**No backend:** every listed `src/` file and `sw.js` executes in the client (service worker runs in browser SW context). There are no required server services. The HTTP server in the quick-start section only serves static files.

### Persistence / privacy / conflict handling

- IndexedDB is preferred; if blocked, localStorage is attempted; if both fail, memory-only mode still plays and can export JSON. An **explicit warning** displays the fallback. Export before closing memory-only sessions. Writes that fail display a warning and do not claim success.
- Active run + metaprogression + preferences save as one validated snapshot. In IndexedDB, the snapshot and preferences commit in one transaction. Save writes are serialized in one tab. Each save carries an optimistic revision counter; if another open tab saved first, a stale write is **rejected** instead of silently replacing new progress. Export from the stale tab, then reload to reconcile manually. There is no background synchronization, automatic conflict merge or cloud transfer. JSON import requires user confirmation and replaces the local slot only after validation and a successful write. Export first if in doubt.
- Version-1 backups with the original state shape and missing settings migrate to v2 defaults. Unknown future versions, malformed/corrupt files, unknown quest IDs, invalid tile arrays and files larger than 1 MiB are rejected. In-memory game state is unchanged on rejection. Unknown object properties are stripped by whitelist reconstruction, and all save-derived text is inserted via `textContent` rather than HTML parsing.
- No cookies, telemetry, accounts, automatic uploads, location, microphone, notifications or permissions. Erase local data has an explicit confirmation; browser-level site data deletion also removes saves and cached content. Offline assets are first-party only.
- Service worker updates are **not forced** while a trail is open; when a worker is waiting, a visible Update ready button activates it and reloads the page. A successful offline install covers the static shell, not unvisited external links or browser-installed cache persistence guarantees.

### Performance and accessibility

Canvas 2D draws native primitives without external textures. DPR is capped by manual tier (low=1, medium=1.5, high=2). Auto tier begins at low when the browser reports ≤2 GB device memory or ≤2 hardware threads, and otherwise at medium. It estimates recent frame time, falling to low above ~30 ms and recovering if stable below ~18 ms. Each tier also caps its approximate Canvas color buffer to 0.64/1.1/1.8 million pixels; total browser memory usage can be higher. Low tier reduces detail and draw frequency; habitat mechanics never depend on frame rate. Reduced-motion defaults to OS preference and can be overridden. Large controls are toggleable; the game is keyboard playable, provides screen-reader announcements, accessible textual tile descriptions, color-independent tile symbols/shapes and an HTML grid fallback if Canvas 2D is unavailable. No audio or flashing effects.

## Roadmap implementation ledger

| Roadmap | Selected feature | Delivered behavior |
| --- | --- | --- |
| 1 · Playable slice | Roguelite runs | 3-sector run, loss/win, branch and metaprogression |
| 1 · Playable slice | Ecological feedback | Finite, bounded soil/water/biodiversity action effects and drought pressure |
| 1 · Playable slice | Canvas 2D renderer | Responsive DPR-aware procedural tile graphics and HTML fallback |
| 1 · Playable slice | Touchscreen controls | Pointer-captured held D-pad, swipes, tool/action buttons |
| 1 + 4 | Reduced-motion mode | OS preference, override, reduced tile animation |
| 2 · Core systems | Seeded procedural levels | Versioned PRNG generation, reachability rejection, golden gate |
| 2 · Core systems | Mission/quest graph | Prerequisites, locked progress, route-conditioned quests |
| 3 · Platform | IndexedDB saves | Transactional single slot, schema validation, fallback and conflict check |
| 3 · Platform | Offline PWA shell | Manifest, icons, precache, update-ready activation |
| 3 · Platform | Portable JSON backup | Import/export, max size, validation and v1 migration |
| 3 + 4 | Privacy-by-design settings | Local preferences, no tracking, explicit wipe |
| 3 + 4 | Performance quality scaler | Auto, manual tiers, frame time + memory hints, texture budget |

Each selected feature is present. The compact first release intentionally avoids online services and third-party assets. The advanced enhancements listed below are deferred, not silently implied.

## Tests and acceptance

Run `npm test`. The built-in Node test runner checks seeded reproducibility over 360 generated sectors, full non-rock reachability, finite resource behavior and exploit prevention, prerequisite enforcement, successful completion of both branches, carryover mastery, JSON round trips, v1 migration and malformed import rejection. There are no npm dependencies.

**Manual release matrix to repeat on target devices (not claimed as completed):**

| Case | Expected result |
| --- | --- |
| Mobile iOS Safari and Android Chrome | Board fits viewport; touch D-pad, swipe, buttons and native file picker work |
| Desktop Chrome / Firefox / Safari | Movement, 1–4 tool shortcuts, E/Space and focus order work |
| Reduced-motion OS + override | Decorative movement stops; no required information disappears |
| Small window/zoom (200%) | Board, controls and text remain readable without horizontal scrolling |
| Screen-reader and keyboard-only | Semantic menus, labels, current-tile description, quest status and focus work |
| Enable low graphics | Same gameplay state, less Canvas rendering detail |
| Backup export and import | Exactly the same active run and mastery return; invalid file leaves prior state intact |
| Deny/clear storage | Fallback is disclosed; gameplay remains playable; JSON export remains available |
| Hosted online install, then airplane mode + reload | Cached shell opens without network; no cloud features are implied |
| Hosted service-worker upgrade | Update button appears only when a new worker waits; accepted update reloads |
| Two tabs with same save | Stale-tab write rejected; export and reload before reconciling |

### Known limitations / deferred enhancements

The twelve selected systems are **present in this first release** within the intentionally small scope. Advanced additions are deferred: multiple save slots and merge UI; high-fidelity ecological and hydrological calibration; animated NPC encounters, audio and community multiplayer; localized text, cloud sync and leaderboards. These are outside the selected single-player, zero-backend brief. Ecology is explicitly a **game heuristic**, not scientific advice. The release does not claim field-calibrated ecosystem outcomes or measured performance across physical devices.

### Zero-harm & attribution

The game models restoration as stewardship rather than resource extraction. Action benefits are capped; cleaning and planting are not endlessly farmable; spring extraction has safe-draw limits. There is no covert data collection or user manipulation. MIT is the code license, and the implementation uses no third-party runtime dependencies. © 2026 Foster + Navi / Planetary Restoration Archive and contributors.

**Deployment updates:** After changing any shell asset, increment `CACHE` in `sw.js` (for example to `pocket-restoration-shell-v2`) and redeploy. This tells browsers to install a new immutable shell and expose the Update ready button. Keep prior backups when changing the world-generation algorithm or JSON save shape; increment their version contracts and add migrations/tests rather than silently changing seeded maps.

**Verification status at packaging:** Node automated tests and static shell-reference checks pass; a browser-driven smoke test was attempted, but the available managed Chromium blocks all URL navigation, including localhost. Confirm touchscreen behavior, IndexedDB transactions, service-worker offline reload, browser storage eviction, and screen-reader behavior in real browsers before a public production release. A `SHA256SUMS.txt` list provides byte-integrity checks of distributed source files; checksums do not authenticate the publisher.
