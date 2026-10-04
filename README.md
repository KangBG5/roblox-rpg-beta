# Eclipse Rift Beta

A lightweight 3D web prototype for a Solo Leveling-inspired RPG lobby and portal dungeon system.

## How to run

Because this is a static website, you can open `index.html` directly in a browser, but a local web server is recommended.

### Option 1: Python

```bash
cd /path/to/this/project
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

### Option 2: VS Code Live Server

Open the folder in VS Code and run a local static server extension such as Live Server.

## Included features

- Large lobby with city, park, neighborhood, and forest zones
- Portal-based dungeon entrances with displayed difficulty tiers (E, D, C, B, A, S)
- Randomized dungeons that despawn and respawn
- Clue markers near portals to hint at rarer dungeon locations
- Dungeon transition cutscene with theme-varying visuals
- Basic 3D movement using WASD
- Return-to-lobby flow using R during dungeon traversal

## Controls

- W / A / S / D: move
- E: interact with a nearby portal
- R: return to the lobby while in a dungeon

## Notes

This is a playable web beta for concept validation and design iteration. The next step is to translate the same gameplay structure into Roblox Studio for the full live game build.
