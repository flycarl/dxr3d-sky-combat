# Economy, Aircraft Customization, and LAN Multiplayer Design

## Goal

Build the game toward multiplayer in two safe phases:

1. Add a homepage economy and aircraft customization system that works in the current single-player game.
2. Add three-player LAN air combat after the economy foundation is stable.

The player should be able to earn coins, spend coins on aircraft appearance changes, and later earn much larger rewards by defeating real players in LAN combat.

## Phase 1: Coins and Aircraft Customization

### Player Economy

- The game stores coins in browser `localStorage` so progress stays after refresh.
- Coin rewards:
  - Collect coin pickup: `+5`
  - Shoot down AI plane: `+25`
  - Shoot down player later in LAN mode: `+100`
- Coin pickups spawn in the air like repair pickups.
- When a coin pickup is collected, it respawns far away from the player.
- Repair pickups remain separate from coin pickups.

### Homepage UI

The start screen becomes a small game menu with:

- Start single-player
- Aircraft customization
- Coin balance
- Later: LAN multiplayer buttons

The menu should stay readable and compact, not become a marketing page. The player should see their current coin total and selected aircraft style before starting.

### Aircraft Customization

Instead of only buying whole skins, the player can customize aircraft parts:

- Body / fuselage
- Left wing
- Right wing
- Propeller / nose accent

Each part has a small set of purchasable styles. A practical first set:

- Standard blue: free
- Red: `80` coins
- Gold: `180` coins
- Black stealth: `320` coins
- Teal glow: `260` coins

Changing a part costs coins each time unless the selected style is the free default. This matches the requested “每改一次也要付金币” behavior.

Example: if the player changes the left wing from blue to gold, they pay `180`. If they later change it from gold to black, they pay `320`.

The selected customization is saved in `localStorage` and applied to the player plane when a mission starts.

### Single-Player Rewards

Single-player keeps AI enemies for now. Shooting down an AI enemy:

- Adds `25` coins.
- Shows the current crosshair hit feedback.
- Shows an on-HUD reward flash such as `+25 金币`.

Coin pickup collection:

- Adds `5` coins.
- Plays pickup audio.
- Shows a short HUD reward flash.

## Phase 2: Three-Player LAN Air Combat

### Server Model

Add a local Node/WebSocket server. One computer runs the server and serves the game over LAN. Other players on the same Wi-Fi join by opening:

```text
http://主机IP:端口
```

The first LAN version supports up to three players in one room.

### Multiplayer Game Rules

- LAN air combat removes AI planes.
- Players fight each other.
- Each player has health equivalent to 10 hits.
- When a player is hit, a health bar appears above that player’s aircraft.
- When a player is destroyed:
  - Their aircraft explodes.
  - The aircraft body disappears.
  - The attacker receives `+100` coins.
  - The destroyed player respawns automatically after `3` seconds.

### Network Sync

The client sends:

- Player position
- Rotation
- Velocity or forward direction
- Fire intent
- Selected aircraft customization

The server validates and broadcasts:

- Connected players
- Player transforms
- Bullet spawn events
- Hit events
- Death events
- Coin rewards from player kills

The first version should prioritize simple LAN reliability over anti-cheat. Since this is same-Wi-Fi play, trust can be light.

## Data Model

Local saved profile:

```ts
type PlayerProfile = {
  coins: number;
  customization: {
    body: AircraftStyleId;
    leftWing: AircraftStyleId;
    rightWing: AircraftStyleId;
    propeller: AircraftStyleId;
  };
};
```

Style definition:

```ts
type AircraftStyle = {
  id: string;
  label: string;
  cost: number;
  bodyColor?: string;
  wingColor?: string;
  accentColor?: string;
  metalness?: number;
  emissive?: string;
};
```

## Architecture

Phase 1 should add small modules instead of growing `Game.ts` further:

- `src/systems/ProfileStore.ts`: load/save coins and customization.
- `src/systems/Economy.ts`: reward constants and spend logic.
- `src/systems/Customization.ts`: style definitions and material application.
- `src/entities/CoinPickup.ts` or a factory in `Game.ts` if simpler.
- `src/systems/Hud.ts`: coin display and reward flash.
- `index.html` and `src/styles.css`: menu/shop UI.

Phase 2 should add:

- `server/lan-server.ts` or `server/lan-server.mjs`
- `src/net/LanClient.ts`
- `src/entities/RemotePlayer.ts`
- Dedicated multiplayer mode state in `Game.ts`

## Error Handling

Phase 1:

- If `localStorage` data is missing or corrupted, reset to default profile.
- If the player cannot afford a customization, keep the current style and show a short “金币不足” message.
- Coin rewards should never make the balance negative.

Phase 2:

- If the WebSocket disconnects, show a LAN disconnect overlay and return to the menu.
- If the room is full, show “房间已满”.
- If a player leaves, remove their remote plane and health bar.

## Testing and Verification

Phase 1:

- Build passes with `npm run build`.
- Existing visual test passes.
- Manual browser check:
  - coin balance appears on homepage
  - coin pickup increases coins
  - AI kill increases coins
  - customization spends coins
  - customization persists after refresh
  - insufficient coins prevents purchase

Phase 2:

- Start LAN server locally.
- Open three browser clients.
- Confirm three players can join.
- Confirm AI is removed in LAN mode.
- Confirm remote planes move.
- Confirm shooting a remote player reduces health.
- Confirm destroying a player grants `+100` coins.

## Scope Decisions

- Phase 1 does not require online accounts; all coins and customization are local browser data.
- Phase 1 does not require generated 3D models; use color/material variants on the current procedural aircraft.
- Phase 2 is LAN-only, not internet matchmaking.
- Phase 2 supports three players first; larger rooms can come later.
- Anti-cheat is out of scope for the first LAN version.

## Open Implementation Notes

- The current player plane model is created inside `Player`, so customization may require exposing part meshes or moving plane model creation into a shared aircraft factory.
- `Game.ts` is already large; new economy/customization code should be kept out of it where possible.
- The HUD currently uses compact top metrics; coin balance should fit as another compact stat without blocking the center view.
