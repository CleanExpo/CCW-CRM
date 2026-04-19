# Scripts

This folder only holds scripts that the repo uses day to day.

| File | Purpose |
|------|---------|
| `setup.sh` | macOS/Linux dev setup (`npm run setup`) |
| `setup.ps1` | Windows dev setup (`npm run setup:windows`) |
| `verify.sh` | Environment sanity check (`npm run verify`) |
| `init-db.sql` | PostgreSQL bootstrap (presence checked by `verify.sh`) |
| `generate-intro-audio.js` | ElevenLabs audio for Remotion intros (`video/remotion` npm scripts) |

Older verification, deploy, boardroom, and one-off utilities were removed to reduce noise. Historical docs under `docs/` may still mention deleted paths.
