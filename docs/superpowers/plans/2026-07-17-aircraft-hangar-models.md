# Aircraft Hangar Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace five color-only skins with an eight-aircraft hangar whose entries render distinct procedural airframes for local and LAN players.

**Architecture:** Keep stable profile IDs in `Customization.ts`, add aircraft metadata and model recipe IDs, and centralize all visible aircraft assembly in a new `AircraftModelFactory.ts`. `Player` owns movement and swaps the factory-created visual child; `Game` uses the same factory for AI and remote peers. Existing storage and network field names remain compatible.

**Tech Stack:** TypeScript 6, Three.js 0.184, Vite 8, Playwright 1.60.

## Global Constraints

- Render exactly eight aircraft cards.
- Preserve the legacy `standard`, `red`, `gold`, `stealth`, and `teal` IDs and add `warbird`, `jet`, and `heavy`.
- Preserve `selectedSkin` and `ownedSkins` storage fields.
- Keep all aircraft gameplay tuning and collision behavior identical.
- Use procedural Three.js geometry only; no external GLB or texture assets.
- Use the shared model factory for the local player and LAN remote players.
- Unknown recipe and network IDs fall back to `standard`.

---

### Task 1: Aircraft definitions and backward-compatible profile IDs

**Files:**
- Modify: `src/systems/Customization.ts`
- Modify: `tests/visual.spec.ts`

**Interfaces:**
- Produces: `AircraftSkinId`, `AircraftRecipeId`, `AircraftSkin`, `AIRCRAFT_SKINS`, `resolveAircraftSkin(value)`.
- Preserves: `isAircraftSkinId(value: string): value is AircraftSkinId` and all five old IDs.

- [ ] **Step 1: Write the failing hangar roster test**

Update the first Playwright test to expect eight cards, and add assertions for category labels and the three new IDs:

```ts
await expect(page.locator('#customization-grid .style-button')).toHaveCount(8);
await expect(page.locator('[data-skin="warbird"]')).toContainText('二战');
await expect(page.locator('[data-skin="jet"]')).toContainText('喷气');
await expect(page.locator('[data-skin="heavy"]')).toContainText('攻击');
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npx playwright test tests/visual.spec.ts --grep "renders a nonblank" --project=chromium`

Expected: FAIL because only five cards exist and the new IDs are absent.

- [ ] **Step 3: Expand the aircraft definition type and roster**

Add the exact IDs and metadata shape:

```ts
export type AircraftSkinId = 'standard' | 'red' | 'warbird' | 'jet' | 'stealth' | 'heavy' | 'gold' | 'teal';
export type AircraftRecipeId = 'classic-biplane' | 'ace-biplane' | 'warbird' | 'modern-jet' | 'stealth-delta' | 'heavy-attack' | 'gold-racer' | 'future-fighter';

export type AircraftSkin = {
  id: AircraftSkinId;
  label: string;
  category: string;
  description: string;
  recipe: AircraftRecipeId;
  cost: number;
  body: MaterialStyle;
  wing: MaterialStyle;
  canopy: MaterialStyle;
  trim: MaterialStyle;
  propeller: MaterialStyle;
};
```

Set legacy mappings exactly: `standard → classic-biplane`, `red → ace-biplane`, `gold → gold-racer`, `stealth → stealth-delta`, `teal → future-fighter`. Add `warbird`, `jet`, and `heavy` with distinct prices and palettes. Implement `isAircraftSkinId` using own-property lookup and `resolveAircraftSkin` with a default fallback.

- [ ] **Step 4: Run typecheck/build**

Run: `npm run build`

Expected: PASS after all definitions include the new required metadata.

- [ ] **Step 5: Commit the roster**

```bash
git add src/systems/Customization.ts tests/visual.spec.ts
git commit -m "feat: expand aircraft hangar roster"
```

### Task 2: Shared procedural aircraft model factory

**Files:**
- Create: `src/entities/AircraftModelFactory.ts`
- Create: `tests/aircraft-models.spec.ts`

**Interfaces:**
- Consumes: `AircraftSkin`, `AircraftSkinId`, `AircraftRecipeId`, `resolveAircraftSkin`.
- Produces:

```ts
export type AircraftModel = {
  group: THREE.Group;
  propellers: THREE.Group[];
  exhausts: THREE.Mesh[];
  dispose(): void;
};

export function createAircraftModel(id: AircraftSkinId): AircraftModel;
export function createAircraftModelFromDefinition(definition: AircraftSkin): AircraftModel;
```

- [ ] **Step 1: Write the failing model smoke test**

Expose a development-only browser diagnostic `window.__AIRCRAFT_MODEL_CATALOG__` containing each ID, recipe, mesh count, propeller count, and exhaust count. Test all eight IDs and propulsion rules:

```ts
expect(catalog).toHaveLength(8);
expect(catalog.find((item) => item.id === 'standard')?.propellers).toBeGreaterThan(0);
expect(catalog.find((item) => item.id === 'jet')?.propellers).toBe(0);
expect(catalog.find((item) => item.id === 'jet')?.exhausts).toBeGreaterThan(0);
expect(new Set(catalog.map((item) => item.recipe)).size).toBe(8);
```

- [ ] **Step 2: Run the model test and confirm failure**

Run: `npx playwright test tests/aircraft-models.spec.ts --project=chromium`

Expected: FAIL because the factory and catalog do not exist.

- [ ] **Step 3: Implement focused geometry helpers**

Implement local helpers `mesh`, `box`, `cylinder`, `cone`, `sphere`, `wingShape`, `makeMaterials`, `addPropeller`, and `addExhaust`. Every created geometry/material is registered in sets owned by the returned model; `dispose()` disposes each exactly once.

- [ ] **Step 4: Implement all eight recipe assemblers**

Add one assembler per recipe with these mandatory silhouette parts:

```ts
const recipes: Record<AircraftRecipeId, RecipeBuilder> = {
  'classic-biplane': buildClassicBiplane,
  'ace-biplane': buildAceBiplane,
  warbird: buildWarbird,
  'modern-jet': buildModernJet,
  'stealth-delta': buildStealthDelta,
  'heavy-attack': buildHeavyAttack,
  'gold-racer': buildGoldRacer,
  'future-fighter': buildFutureFighter,
};
```

Classic/ace biplanes get two wing decks and struts; warbird/racer get propellers; jet/stealth/heavy/future get exhausts and no propeller. Use shaped `BufferGeometry` for swept/delta wings where boxes cannot communicate the silhouette.

- [ ] **Step 5: Publish catalog diagnostics without retaining eight live models**

Build each model once during diagnostic creation, count meshes and propulsion parts, dispose it immediately, and store only plain objects on `window.__AIRCRAFT_MODEL_CATALOG__`.

- [ ] **Step 6: Run the focused model test**

Run: `npx playwright test tests/aircraft-models.spec.ts --project=chromium`

Expected: PASS for eight recipes and propulsion metadata.

- [ ] **Step 7: Commit the model factory**

```bash
git add src/entities/AircraftModelFactory.ts tests/aircraft-models.spec.ts src/vite-env.d.ts
git commit -m "feat: build distinct procedural aircraft models"
```

### Task 3: Local player model integration

**Files:**
- Modify: `src/entities/Player.ts`
- Modify: `src/game/Game.ts`
- Modify: `tests/aircraft-models.spec.ts`

**Interfaces:**
- Consumes: `createAircraftModel(id)` and `AircraftModel`.
- Produces: `Player.applySkin(id)` rebuilding only the visual child, `Player.getAircraftId()`, and propulsion animation across propeller/exhaust aircraft.

- [ ] **Step 1: Write a failing switching test**

Seed all eight IDs as owned, click every hangar card, start the game for representative propeller and jet aircraft, and assert diagnostics report the active recipe and propulsion type.

- [ ] **Step 2: Confirm the focused test fails**

Run: `npx playwright test tests/aircraft-models.spec.ts --grep "switches local airframes" --project=chromium`

Expected: FAIL because `Player` still has one fixed mesh hierarchy.

- [ ] **Step 3: Replace fixed `Player` geometry with factory visuals**

Keep `Player.group` as the motion root. Add `private aircraft: AircraftModel`, remove the old geometry/material members, and implement:

```ts
applySkin(id: AircraftSkinId): void {
  if (id === this.aircraftId) return;
  this.group.remove(this.aircraft.group);
  this.aircraft.dispose();
  this.aircraft = createAircraftModel(id);
  this.aircraftId = id;
  this.group.add(this.aircraft.group);
}
```

Spin every `propellers` group during update and pulse exhaust emissive intensity/scale for every `exhausts` mesh. Keep impact feedback on the visual root with a short non-destructive scale/color-independent pulse so every palette remains intact.

- [ ] **Step 4: Publish selected ID/recipe in game diagnostics**

Extend existing diagnostics with `aircraftId` and `aircraftRecipe` so browser tests can verify the live model.

- [ ] **Step 5: Run focused tests and build**

Run: `npx playwright test tests/aircraft-models.spec.ts --project=chromium && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit local integration**

```bash
git add src/entities/Player.ts src/game/Game.ts tests/aircraft-models.spec.ts
git commit -m "feat: render selected aircraft for player"
```

### Task 4: Hangar UI and LAN remote integration

**Files:**
- Modify: `index.html`
- Modify: `multiplayer.html`
- Modify: `src/game/Game.ts`
- Modify: `src/styles.css`
- Modify: `tests/visual.spec.ts`
- Modify: `tests/aircraft-models.spec.ts`

**Interfaces:**
- Consumes: `AIRCRAFT_SKINS`, `resolveAircraftSkin`, and `createAircraftModel`.
- Produces: eight responsive hangar cards and `RemotePlayer.aircraft: AircraftModel` for correct cleanup/rebuild.

- [ ] **Step 1: Write failing copy, layout, and remote-model tests**

Assert both pages contain the “飞机机库” heading; every card contains `.aircraft-category`; and a remote peer changing from `standard` to `jet` rebuilds to the `modern-jet` recipe while preserving name/health overlays.

- [ ] **Step 2: Confirm tests fail**

Run: `npx playwright test tests/visual.spec.ts tests/aircraft-models.spec.ts --project=chromium`

Expected: FAIL on copy/category/remote recipe assertions.

- [ ] **Step 3: Render aircraft metadata in cards**

Use semantic card markup with existing `data-skin` compatibility:

```ts
button.innerHTML = `
  <span class="style-swatch"></span>
  <span class="aircraft-copy"><strong>${skin.label}</strong><small class="aircraft-category">${skin.category}</small></span>
  <span class="style-cost">${skin.cost}</span>`;
```

Update headings and descriptions in both HTML files. Adjust grid columns and card typography at desktop/mobile breakpoints without reducing touch targets below 44px.

- [ ] **Step 4: Use the factory for AI and remote players**

Replace `createPlaneModel`. AI may use one explicit warbird definition. Store `aircraft` on `RemotePlayer`, rebuild it only when `peer.skin` changes, transfer overlay children to the new group, reattach to `world`, and call the old model's `dispose()`.

- [ ] **Step 5: Verify remote cleanup**

Update remote removal and game disposal paths to call `remote.aircraft.dispose()` exactly once after removing overlays/resources that have their own disposal lifecycle.

- [ ] **Step 6: Run desktop and mobile tests**

Run: `npx playwright test tests/visual.spec.ts tests/aircraft-models.spec.ts`

Expected: PASS in configured desktop and mobile projects.

- [ ] **Step 7: Commit hangar and LAN integration**

```bash
git add index.html multiplayer.html src/game/Game.ts src/styles.css tests/visual.spec.ts tests/aircraft-models.spec.ts
git commit -m "feat: show aircraft hangar across local and LAN play"
```

### Task 5: Final browser, resource, and regression verification

**Files:**
- Modify: `tests/aircraft-models.spec.ts`
- Modify: `docs/superpowers/plans/2026-07-17-aircraft-hangar-models.md`

**Interfaces:**
- Consumes: renderer diagnostics, selected aircraft diagnostics, all eight hangar entries.
- Produces: screenshot evidence and checked plan steps.

- [ ] **Step 1: Add representative silhouette screenshots**

Capture classic biplane, modern jet, stealth delta, and heavy attack aircraft after launch in desktop gameplay. Attach screenshots to Playwright output and assert each canvas sample is nonblank.

- [ ] **Step 2: Add model-switch resource regression**

Switch through all eight aircraft twice and assert renderer geometry/material counts return within a small fixed bound after garbage-collection-independent disposal/rebuild cycles.

- [ ] **Step 3: Run complete verification**

Run:

```bash
npm run build
npx playwright test tests/visual.spec.ts tests/aircraft-models.spec.ts
npm run inspect:canvas
```

Expected: typecheck/build pass, all relevant desktop/mobile Playwright tests pass, canvas inspector reports a nonblank frame and no page/console errors.

- [ ] **Step 4: Review screenshots and diagnostics**

Visually confirm the two biplanes differ in proportions/stagger, propeller aircraft have visible propellers, jet aircraft do not, and the jet/stealth/heavy silhouettes remain distinguishable from the gameplay camera.

- [ ] **Step 5: Mark completed plan checkboxes and commit final verification**

```bash
git add tests/aircraft-models.spec.ts docs/superpowers/plans/2026-07-17-aircraft-hangar-models.md
git commit -m "test: verify distinct aircraft hangar"
```
