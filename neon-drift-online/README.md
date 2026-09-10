# Neon Drift online preview

Separate work-in-progress build. The original ../neon-drift folder is unchanged.

Implemented: Google OAuth login, sign-out, account creation/read with RLS, and isolated practice gameplay. No local saves are imported. Auth session tokens may be stored in the browser; balances are read from the server.

NOT IMPLEMENTED: validated online runs, online earning, account shop, cloud achievements or other OAuth providers. Practice gameplay cannot award online points. Do not replace the live game with this preview until these features are ready and login is tested.

## Database setup

In your Supabase project's SQL Editor, open a new query, paste setup.sql and Run. The SQL grants authenticated users read access to their own profile and a no-argument profile-creation RPC. It grants no balance mutation rights. Do not relax these policies to fix frontend errors.

## Auth setup

Google OAuth must be enabled. The production Site URL and allowed redirect URL are https://albertino21gorilla.github.io/Neon-Drift/. If Google remains in testing mode, add your account to its test users. Publish Google OAuth before inviting the public. The publishable key in online.js is public; never add service_role or Google secrets to this folder.

## Next implementation requirement

Add a server-validated run protocol before enabling rewards. Reject arbitrary score/energy submissions, replayed runs, invalid inputs, and unowned abilities. Use transactional server-side purchases at fixed prices. Bounds/time checks alone are not proof that a client actually survived; robust validation needs authoritative simulation or deterministic replay. Full OAuth and database integration tests require the owner's dashboard setup and interactive Google login.

## Separate login test

Add https://albertino21gorilla.github.io/Neon-Drift/neon-drift-online/ to Supabase Authentication > URL Configuration > Redirect URLs. Leave the main Site URL unchanged. Upload this entire neon-drift-online folder into the existing GitHub repository, preserving the folder name. Open the same preview URL after Pages deploys. This does not replace the root game. Only Google login, profile reads, and practice are ready to test. Do not move these preview files to the repository root.

## Preview files

index.html, online.css, online.js, practice.html, practice-memory.js, game.js. setup.sql is run in Supabase, not the browser. Keep this folder separate from the current GitHub upload until the online implementation is complete.
