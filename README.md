# Neon Drift

A neon arcade survival game built with HTML, CSS, JavaScript, and the Canvas and Web Audio APIs.

Dodge debris, collect energy, build combos, and unlock abilities, ship skins, and trails. Includes four difficulties, boss formations, daily missions, achievements, and 30 pilot levels.

## Play locally

With Python installed, run this command from the game folder:

```sh
python -m http.server 4173
```

Open http://localhost:4173 in your browser and choose Play local. No dependencies or build step are required for the local game.

## Controls

- WASD or arrow keys: move
- Space: activate equipped ability
- Escape: pause
- Settings: change key bindings and audio volumes

Progress and purchases are saved in your browser's local storage. Music starts after your first interaction.

## Source

- `index.html`: homepage linking to both versions
- `neon-drift-local/`: original browser-save game, including its HTML, game code and save adapter
- `neon-drift-online/`: Google login, online game and Supabase database setup

This folder is the complete repository layout to upload. The online callback URL remains `/Neon-Drift/neon-drift-online/`. Local browser saves are origin-scoped and remain available after moving the game into its subfolder on the same origin. Online settings and limitations are documented in `neon-drift-online/CLOUD-UPDATE.md`.

When updating the existing GitHub repository, upload the two folders plus this README and the root index.html. Once the local folder is uploaded, delete only the obsolete root game.js and 1sGsdG.js using GitHub; uploads do not remove old files. Those files remain in neon-drift-local and in Git history. Do not remove the root index.html or the online folder.

## Credits

Created by Albertino21Gorilla with ChatGPT.
