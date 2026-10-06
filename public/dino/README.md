# Chromium Dino

`runner.js`, both sprite sheets and the three MP3 sounds come from Chromium
90.0.4430.212, `components/neterror/resources/`:
https://github.com/chromium/chromium/tree/90.0.4430.212/components/neterror/resources

The original engine is unmodified and distributed under Chromium's BSD license
(included as `LICENSE`). It supplies the original physics, animation, collision
boxes, cactus and pterodactyl obstacles, day/night cycle and score conversion.

`index.html` and `bridge.js` are Studde's integration. A separate iframe confines
the engine's global input listeners, singleton and canvas styles to this tab.
The bridge gates new rounds on an authenticated server-created run ID and sends
the original distance meter's final score. It only adapts resource loading,
account high scores and the parent-frame messages; no physics is changed.

Scores use the existing persistent SQLite database. The boot-time setup adds
only the `DinoRun` table and indexes with `IF NOT EXISTS`. The existing tables
and seed behavior are unchanged. Names are read from the account on the server
and captured when the round completes. The top five lists rounds (the same
player may appear more than once); the class list shows one best per account.

Basic ownership, replay and elapsed-time checks reject invalid submissions.
This browser game does not claim to provide tamper-proof competitive scoring.

Validation: `npm run build && npm run test:dino`. The integration test starts a
temporary server with its own temporary database and deletes both afterwards.
It never uses or writes to the deployment database.
