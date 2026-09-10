# Cloud saving v2

Run cloud-v2.sql in the Supabase SQL Editor after setup.sql. Then upload the changed online game.js and index.html, plus new play.html and cloud-game.js, into the existing neon-drift-online folder in GitHub. Do not overwrite the original game at the repository root. The local game remains unchanged.

## What saves

Completed-run points, energy, lifetime points, best score, purchased abilities/skins/trails, equipment, and both multiplier tracks. Levels and score achievements are derived from lifetime points on load. The played achievement is persisted after a completed run. Settings remain per-session in this build. Practice uses memory only and awards nothing online. Daily mission claims and advancement resets are not enabled online yet.

## Security scope

Users have no direct balance/inventory writes. RPCs use auth.uid(), locked account rows, server-owned catalog prices, ordered tiers and balance checks. Only one run per account is active. Finish is idempotent and rejects negative/non-finite/out-of-range rewards, excessive reported duration and excessive energy for the difficulty/multiplier snapshot. Purchases are blocked during active runs.

Run reports are still client-reported. Ceilings and wall-clock checks do NOT validate collisions, pickups or survival. An altered client can fabricate rewards within limits; do not advertise this as cheat-proof or use it for competitive prizes. Authoritative simulation/replay is not implemented.

## Save behavior

Runs save on death, not every frame. Failed saves remain pending in memory, show an error, offer banner-click retry and retry before starting another run. Leaving the page while a save is pending prompts a browser warning. Closing/crashing the page mid-run loses that unfinished run. Starting on another device invalidates the older unfinished run.

## Verification

Local checks: JS syntax; mocked profile hydration, failed-save retention and retry, account-change rejection. Run node check-cloud.cjs to repeat these checks. SQL has not been executed locally and OAuth/database behavior must be tested after installation:

1. Sign in, finish a short run, wait for Saved to your account, return to account and refresh: balances persist.
2. Buy an affordable skin, refresh, confirm ownership/equipment and deduction persist.
3. In a second account, confirm a fresh separate profile.
4. Disable network at death, restore it and click retry: exactly one reward should be credited.
5. In Supabase verify authenticated direct updates to nd_profiles and reads of another account are denied.

This document supersedes the initial README's preview feature list. The old practice page remains available alongside Play online.
