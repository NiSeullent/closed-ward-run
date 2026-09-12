# Engine and multiplayer acceptance audit

Run `npx vite --config tests/engine/vite.config.ts`, then open `/tests/engine/index.html` with Playwright CLI. Evaluate `window.runEngineAudit()` to run the real Three.js/game loop through all 400 stage entries and boundaries, branches, dash, every item, four vehicle types, car-to-car crashes, radius damage, police counts, road speed/steering, jump obstacles, capture and rival rendering.

The dedicated Vite test plugin inserts controls from `probe.txt` into the actual runner closure. These controls arrange entity positions and advance the actual `animate` loop; they do not replace game rules. Rendering is disabled while stepping and can be called explicitly using `engineProbe.render()` for screenshots. Neither production Vite config enables this plugin. Check the final package for absence of `engineProbe` before release.

For the two-player test, use an isolated backend at port 35439 with the existing `cloud-game`, player 1/2 and `cloud-test-N` fixtures. `multiplayer.html` runs the actual game UI in an opaque iframe through a copy of the real host bridge at `output/playwright/bridge.js` (transpiled from platform `lib/game-cloud-bridge.ts`). `race-browser.js` is a Playwright CLI run-code function covering two clients, start, final victory/defeat, failed score submission, persistent failure display, retry and shared ranking reads. It uses only synthetic fixture accounts. Do not point the fixture backend or these credentials at production.

Example:

```sh
bash /root/.codex/skills/playwright/scripts/playwright_cli.sh -s=closed-audit open http://127.0.0.1:35174/tests/engine/index.html --config output/playwright/config.json
bash /root/.codex/skills/playwright/scripts/playwright_cli.sh -s=closed-audit eval 'window.runEngineAudit()'
bash /root/.codex/skills/playwright/scripts/playwright_cli.sh -s=closed-audit run-code "$(cat tests/engine/race-browser.js)"
```
