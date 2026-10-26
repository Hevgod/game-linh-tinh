# memaybeo — The Wilds

A mobile-friendly side-scrolling survival game in a fixed 16:9 play frame, with an endlessly streamed procedural world. Desktop and mobile use separate, single-screen HUD layouts. The game renders with `requestAnimationFrame`, displays measured FPS, and can run at up to 120 FPS when the display and device have enough headroom. Built with vanilla HTML, CSS, and JavaScript modules; no build step or third-party game engine is required.

## Run locally

Serve the project folder over HTTP so the browser can load JavaScript modules:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Controls

- **Desktop:** A/D or arrow keys to move, Space to jump, E to fire, R to reload. Hold Shift to sprint.
- **Touchscreen:** drag the left joystick to move; tap or hold Jump and Fire; tap Reload to refill.
- Weapon aim follows the mouse on desktop and targets nearby bots in front of the player when using touch or keyboard.
- Use the **VI / EN** button in the header to switch the interface language. The selection is saved locally.
- Reach 1,000 m, 1,500 m, 3,600 m, and further recurring milestones to restore one heart.

## Project modules

- `src/main.js` — game loop, camera, and module wiring.
- `src/world.js` — infinite, seeded terrain streaming, stable parallax forest, grounded trees, atmospheric sky, distant ridgelines, detailed forest, and eight distinct landmark structures.
- `src/game-audio.js` — volume toggle, original looping soundtrack, weapon and impact sounds, pickups, and movement-driven footsteps.
- `src/player-model.js` — player movement physics, 20-heart health, damage and shield handling, and character rendering.
- `src/weapon-model.js` — shared renderer for the photographic AKM reference sprite.
- `src/bot-logic.js` — enemy spawning, scout attacks, arrow physics/collisions, hit testing, and enemy rendering.
- `src/archer-ai.js` — archer spacing, strafing, and predictive shot decisions.
- `src/weapon.js` — AKM fire, compensated bullet drop, swept bot/terrain collision, long-range shots, and reloads.
- `src/supplies.js` — collectible health kits and temporary shields.
- `src/milestones.js` — distance rewards and milestone progression.
- `src/world-biomes.js` — biome palettes, transition blending, flora/structure weights, and enemy composition.
- `src/frontier-progression.js` — one-time combat and exploration contracts with permanent-in-run upgrades.
- `src/i18n.js` — English/Vietnamese interface text and saved language selection.
- `src/controls.js` — keyboard, mouse, joystick, and touch-button input.
- `src/game-ui.js` — HUD and game-screen updates.
- `src/user-data.js` — local best-distance and elimination records.

The desktop HUD includes the operative portrait, run statistics, and a larger AKM image; the mobile ammo strip and in-game character use the same reference sprite. The sprite is stored at `assets/akm-reference.png`. Original game audio is stored in `assets/audio/`: a looping ambient frontier theme, rifle fire, dirt footsteps, magazine reload, player damage, target impact, health pickup, and shield pickup. Use the speaker button in the header to mute or enable audio; the choice is saved locally.

The player starts with 20 hearts. Archer arrows remove one heart per hit, while a scout's sword removes half a heart; shields absorb either hit. Medkits and distance milestones restore one heart up to the 20-heart maximum. The infinite route cycles through four biomes—pine ridge, sunscarred reach, mistfen, and frostline—with blended terrain offsets, region-specific vegetation, structures, colors, and archer spawn rates. Discovering three regions grants a small health restoration and shield. Combat contracts unlock improved firing range after four eliminations, firing cadence after ten, and tighter spread after eighteen. The world uses layered, parallax mountain silhouettes, a glowing sun, drifting clouds, mixed forest, and seeded undergrowth with bushes, wildflowers, stones, reeds, frost, scrub, and fallen logs. Eight structure silhouettes—cabins, barns, stone houses, chapels, windmills, bunkers, lookout towers, and gate ruins—appear as distinct, sparse landmarks rather than repeated blocks. The continuous route has a worn trail, surface roots, and exposed soil strata; there are no floating plank platforms. Scout bots pursue and attack at close range. Archer bots keep a useful firing distance, strafe and retreat when approached, check terrain visibility, lead moving targets, and launch gravity-affected arrows that collide with the player and ground. Terrain and undergrowth are cached in per-chunk canvases, and individual trees are cached as sprites so extra scenery does not need to be redrawn as vector paths every frame. Mobile uses a compact status strip and touch controls so the game and its essential HUD remain visible together; HUD DOM updates are limited to 20 Hz to reduce per-frame work.
