# Aircraft Hangar and Distinct Airframe Models

## Goal

Upgrade the current aircraft skin shop into an eight-aircraft hangar. Every aircraft must have a visibly distinct 3D silhouette and construction; a label such as “biplane” or “stealth fighter” must describe the model that is actually rendered, not only its colors.

The change must work in single-player and LAN multiplayer while preserving existing profiles and purchases.

## Current State

- The player model is built directly inside `Player` from one procedural single-wing propeller aircraft.
- All five current skins only change materials on that shared geometry.
- The remote multiplayer model is constructed separately inside `Game`, so it does not currently share the player's full aircraft geometry.
- Profiles persist a selected skin ID and a list of owned skin IDs in `localStorage`.
- Existing uncommitted workspace changes are unrelated and must be preserved.

## Chosen Approach

Use a shared procedural aircraft model factory built with Three.js geometry. This keeps loading immediate, matches the existing stylized art direction, avoids adding large network assets, and lets local and remote players use the same model definitions.

External GLB models are out of scope for this iteration. The visual requirement is recognizable aircraft construction and silhouette, not photorealism.

## Aircraft Roster

The hangar contains eight aircraft:

1. **Classic Blue Biplane** — two full wing decks, interplane struts, open cockpit, fixed landing gear hints, radial nose, and front propeller.
2. **Red Ace Biplane** — a sportier biplane with staggered wings, shorter fuselage, red-and-cream ace markings, and front propeller. It must not be only a recolor of the classic biplane.
3. **Warbird Fighter** — long piston-engine nose, low single wing, enclosed bubble canopy, conventional tail, and front propeller.
4. **Modern Jet Fighter** — pointed nose, swept wings, twin vertical tails, twin exhausts, and small under-wing hardpoint details; no propeller.
5. **Stealth Delta** — broad flattened blended body, angular delta wing, recessed dark exhaust area, and no exposed propeller.
6. **Heavy Attack Aircraft** — wide armored fuselage, straight short wings, twin rear-mounted jet engine pods, twin exhausts, and a heavier stance than the fighters; no propeller.
7. **Golden Racer** — narrow streamlined fuselage, clipped wings, compact canopy, prominent spinner, and a fast visual stance.
8. **Teal Future Fighter** — forward-looking angular body, split or forward-swept wing treatment, luminous trim, compact canopy, and clearly visible futuristic propulsion details.

All eight use the project's stylized low-poly/procedural language. They may share materials and low-level geometry helpers, but they must not share an indistinguishable assembled silhouette.

## Architecture

### Aircraft definitions

Replace the skin-only concept with an aircraft definition that contains:

- Stable aircraft ID.
- Display name and category.
- Coin price.
- Model recipe ID.
- Material palette for body, wings, canopy, trim, propeller, exhaust, and accents as applicable.
- Optional short description shown in the hangar.

The existing IDs remain valid so saved profiles keep every purchase. The legacy `standard`, `red`, `gold`, `stealth`, and `teal` IDs become the classic blue biplane, red ace biplane, golden racer, stealth delta, and teal future fighter respectively. Three new stable IDs—`warbird`, `jet`, and `heavy`—represent the warbird, modern jet, and heavy attack aircraft.

### Shared model factory

Create a dedicated aircraft model factory outside `Player` and `Game`. It accepts an aircraft definition and returns:

- A root `THREE.Group`.
- References to animated parts such as propellers or exhaust effects.
- A disposal function or owned resource list.
- Optional model metadata needed for animation.

The factory owns reusable geometry-building helpers for fuselages, wings, fins, canopies, struts, engine pods, propellers, and exhausts. Each model recipe assembles those parts differently.

`Player` remains responsible for movement, damage feedback, and propulsion animation. It delegates visible aircraft construction to the factory and can rebuild the visual child group when the selected aircraft changes.

Remote multiplayer planes use the same factory, ensuring that peers see the actual selected airframe instead of a simplified recolor.

### Profile compatibility

The persisted field names remain `selectedSkin` and `ownedSkins` in this iteration to preserve compatibility with existing browser saves and network code. UI copy and type documentation may call the values aircraft IDs. The loader guarantees that:

- Existing profiles load without reset.
- Existing ownership remains owned.
- Invalid or removed IDs fall back to the classic blue biplane.
- The profile is normalized before it is used by gameplay or multiplayer networking.

### Multiplayer data

The existing skin/aircraft ID sent across LAN remains a compact string. On receipt, unknown IDs fall back to the classic blue biplane. Remote aircraft visuals are rebuilt only when the peer's selected ID changes, not on every position update.

## Hangar UI

- Rename the section from “飞机皮肤” to “飞机机库”.
- Render eight aircraft cards.
- Each card shows color swatch, aircraft name, category, and price or ownership state.
- Selected, owned, affordable, and insufficient-funds states retain the current purchase behavior.
- The explanatory text makes clear that purchases unlock complete aircraft appearances.
- The layout remains usable on desktop and narrow mobile screens.
- A full interactive 3D preview is out of scope; the live player model after selection is the authoritative preview.

## Gameplay and Fairness

- All aircraft retain the same speed, acceleration, turning, boost, health, collision behavior, and weapon capability in this iteration.
- Prices represent visual rarity only.
- Collision continues to use the existing gameplay proxy instead of exact visual geometry, preventing larger-looking aircraft from receiving a gameplay disadvantage.
- Propeller aircraft animate propellers. Jet and stealth aircraft animate exhaust effects instead and must not display a front propeller.

## Resource and Performance Constraints

- Reuse cached geometry and materials where safe.
- Avoid per-frame geometry or material creation.
- Dispose model-owned resources when local or remote aircraft are removed or rebuilt.
- Keep shadows on major silhouette parts; minor struts, marks, and tiny hardpoint details may omit shadow casting if needed for performance.
- Eight hangar definitions do not mean eight models must remain instantiated simultaneously; instantiate the selected local plane and active remote peers only.

## Error Handling

- Unknown persisted or network aircraft IDs fall back safely to the default biplane.
- A failed purchase leaves the current aircraft selected and shows the existing short error message.
- Model construction must return a valid fallback group if a recipe ID is invalid.
- Missing optional animated parts are treated as intentional; animation code checks capability metadata rather than assuming a propeller exists.

## Testing and Acceptance Criteria

### Automated

- Typecheck and production build pass.
- Profile tests prove old five-skin saves migrate without losing coins, ownership, or current selection.
- Hangar UI renders exactly eight aircraft cards.
- Purchase, insufficient-funds, selection, refresh persistence, and shared single-player/multiplayer profile flows pass.
- Each aircraft definition resolves to a valid model recipe.
- Model factory smoke tests verify that every airframe has meshes and that propeller versus jet animation metadata is correct.
- Multiplayer tests verify that the transmitted aircraft ID selects the matching remote model and unknown IDs fall back safely.

### Visual and browser QA

- All eight aircraft can be selected and launched without console errors.
- Side, rear, and gameplay-camera views make the biplane, warbird, modern jet, stealth delta, heavy attack plane, racer, and future fighter distinguishable by silhouette.
- The two biplanes are visibly different in wing stagger, proportions, and markings.
- Modern jet, stealth delta, and future fighter have no front propeller.
- Local and remote versions of the same aircraft agree visually.
- Desktop and mobile hangar layouts fit without clipped text or inaccessible cards.
- Renderer diagnostics show no continuous growth in geometries or materials after repeatedly switching aircraft or peers joining/leaving.

## Out of Scope

- Different handling statistics or combat advantages by aircraft.
- Photorealistic licensed aircraft replicas or real-world military markings.
- External GLB downloads, generated 3D assets, or texture packs.
- A rotatable 3D hangar preview.
- Aircraft-specific weapons, damage models, sounds, or cockpits.

## Delivery Boundary

Implementation is complete when the eight distinct airframes are selectable, purchasable, persisted, rendered for local and remote players through one shared model factory, and verified in desktop/mobile browser tests without regressions to the current economy or LAN flows.
