# Feature Fusion Foundry · Browser Gaming

A complete, local-first, rules-based **design foundry** for composing browser game feature sets. It produces architecture blueprints, implementation prompts, QA prompts and JSON backups. It does **not** compile game source code or operate a hosted multiplayer server.

## Run

1. Open `index.html` in a modern browser for the core feature library, composition engine, prompt generation, JSON import/export and blueprint printing. No internet access or build step required.
2. Optional PWA: put all files at the same path on an HTTPS site (e.g., GitHub Pages) or serve locally with `python -m http.server 8000` and visit `http://localhost:8000/`. Once the service worker successfully caches the shell, that shell can reopen offline. Local file URLs do not support service-worker installation.
3. On mobile, use the `☰` menu. Build selections remain in IndexedDB if writable; localStorage is a limited fallback, then in-memory only. **Export JSON** before relying on persistent state.

## Navigation and workflow

- **Forge:** set target device, rendering baseline, network model, ambition and design objective.
- **Features:** search/filter ~80 categorized capabilities and equip modules.
- **Fusion:** inspect rule-based synergies, missing prerequisites, relative scope heuristics, and architectural warnings.
- **Recipes:** replace current modules or blend six starter archetypes.
- **Blueprint:** create a detailed Markdown design spec or a coding, testing or ideation prompt. Copy, download and print.
- **Vault:** save, restore, remove and import local project snapshots. Imported objects are validated and do not execute code.
- **Diagnostics:** browser API exposure checks (not hardware guarantees).

## Data and offline design

- Pure HTML/CSS/vanilla JavaScript. No CDN, dependency bundles, cookies, analytics, remote APIs, accounts, network calls or central database.
- IndexedDB stores `draft` and snapshot records (`fusion_foundry_v1.records`). If unavailable, storage falls back to browser localStorage, then volatile memory. Autosave does not constitute a guaranteed backup.
- Import schema: `browser-game-fusion-project` version 1; project fields `name`, `vision`, `target`, `engine`, `network`, `scope`, `selected`.
- App resources are cached by `sw.js` only when hosted with HTTPS/localhost and service worker registration succeeds; version changes should update `CACHE` when deploying revisions. There is no server-backed sync or offline API access.
- API diagnostics report API exposure, not benchmark results. Browser API support and storage policies vary with environment and version.
- Raw JSON from users is parsed and validated; selections are restricted to known identifiers; project text is escaped in HTML rendering. Still perform an independent security review before production use.

## Test checklist

- [ ] Equip/remove features; search and apply category/selected-only filters.
- [ ] Load and blend recipes; use fusion suggestions and add prerequisites.
- [ ] Change device target and session mode; inspect advisory changes.
- [ ] Export JSON; import valid backup; confirm malformed backup fails without destroying selection.
- [ ] Save/load/delete snapshots; verify fresh reload restores draft when browser storage permits.
- [ ] Toggle theme, check mobile menu, keyboard Escape/Tab controls and screen-reader labels.
- [ ] Download Markdown; copy all prompt modes; print clean specification.
- [ ] On HTTPS/localhost, confirm successful service worker install and offline cached-shell restart.
- [ ] Verify no requests leave the user's origin except clicked reference links.

## Extension surfaces

`FEATURES` records have `id,name,domain,effort,load,desc,impl,test,requires,gates`. `SYNERGIES` and `TENSIONS` express combinatorial design rules. Add new domains to `DOMAIN_NAMES`; update `modulePlan()` and `generation()` for richer generated specifications. Feature dependencies are warnings rather than stealth installation. The UI renderers are separate from composition logic and the vault boundary.

## Browser-specific engineering caveats

WebGPU and WebXR are not universally available; test capability and device-specific runtime behavior, retain accessible fallback. Shared-memory threading requires cross-origin isolation; authoritative multiplayer needs a hosted server, and WebRTC needs signaling and often TURN. Service workers and certain APIs require HTTPS or localhost. `navigator.onLine` is not a reliable proof of internet reachability.

References: [MDN WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API), [MDN WebXR](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API), [MDN Gamepad](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API), [MDN browser storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), [MDN COEP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy).

## Zero-Harm / Anti-Inversion

Avoid invisible analytics, dark patterns, unconsented location and coercive monetization. Make all game rules testable, and preserve equivalent alternatives to potentially exclusionary input modes. Local data remains under the user's browser control, with explicit portable export.

## Attributions & licenses

Original foundry code and text: © 2026 Foster + Navi / Planetary Restoration Archive, MIT License (see `LICENSE`). No game engine source or third-party assets are bundled. Browser API references are linked for factual documentation; these resources retain their own licenses. If extending with Phaser, Three.js or Godot, honor their separate licenses and deployment obligations.
