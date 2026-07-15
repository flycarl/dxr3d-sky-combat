# Economy and Aircraft Customization Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a saved coin economy, airborne coin pickups, AI kill rewards, and a homepage aircraft customization shop for body, left wing, right wing, and propeller styles.

**Architecture:** Keep persistent player data in focused systems instead of growing `Game.ts`. Add profile/economy/customization modules, expose aircraft part materials from `Player`, and let `Game` wire reward events to HUD/menu updates. This plan covers Phase 1 only; three-player LAN combat gets a separate plan after this is stable.

**Tech Stack:** TypeScript, Vite, Three.js, browser `localStorage`, Playwright visual smoke tests.

## Global Constraints

- Coin rewards are exact: coin pickup `+5`, AI plane kill `+25`, future LAN player kill `+100`.
- Saved progress uses browser `localStorage`; no accounts or backend in Phase 1.
- Customizable parts are exact: body/fuselage, left wing, right wing, propeller/nose accent.
- Styles are exact first set: Standard blue free, Red `80`, Gold `180`, Black stealth `320`, Teal glow `260`.
- Changing a part costs coins each time unless selecting the free default.
- Coin pickups are separate from repair pickups and respawn far away after collection.
- Existing build command must pass: `npm run build`.
- Existing visual smoke command must pass: `npm run verify:visual -- --project=desktop-chrome`.

---

## File Structure

- Create `src/systems/ProfileStore.ts`
  - Owns saved profile shape, defaults, `loadProfile()`, `saveProfile()`, `awardCoins()`, and `spendForCustomization()`.
- Create `src/systems/Customization.ts`
  - Owns part IDs, style IDs, style costs/colors/material values, and material application helpers.
- Modify `src/entities/Player.ts`
  - Split wing meshes into left/right meshes and expose `applyCustomization(customization)`.
- Modify `src/systems/Hud.ts`
  - Add coin display and reward flash methods.
- Modify `index.html`
  - Add coin balance and customization shop controls on the start screen.
- Modify `src/styles.css`
  - Style homepage economy/shop and compact HUD coin metric.
- Modify `src/game/Game.ts`
  - Load/save profile, create coin pickups, award coins for pickups and AI kills, apply customization, wire shop buttons.
- Modify `src/vite-env.d.ts`
  - Add `coins` and pickup counts to diagnostics for tests.
- Modify `tests/visual.spec.ts`
  - Extend smoke coverage for coin balance/shop visibility and localStorage persistence.

---

### Task 1: Profile Store and Customization Definitions

**Files:**
- Create: `src/systems/ProfileStore.ts`
- Create: `src/systems/Customization.ts`

**Interfaces:**
- Produces: `type AircraftPartId = 'body' | 'leftWing' | 'rightWing' | 'propeller'`
- Produces: `type AircraftStyleId = 'standard' | 'red' | 'gold' | 'stealth' | 'teal'`
- Produces: `type AircraftCustomization = Record<AircraftPartId, AircraftStyleId>`
- Produces: `type PlayerProfile = { coins: number; customization: AircraftCustomization }`
- Produces: `const AIRCRAFT_STYLES: Record<AircraftStyleId, AircraftStyle>`
- Produces: `const COIN_REWARDS = { pickup: 5, aiKill: 25, playerKill: 100 }`
- Produces: `loadProfile(storage?: Storage): PlayerProfile`
- Produces: `saveProfile(profile: PlayerProfile, storage?: Storage): void`
- Produces: `awardCoins(profile: PlayerProfile, amount: number): PlayerProfile`
- Produces: `spendForCustomization(profile: PlayerProfile, part: AircraftPartId, style: AircraftStyleId): { profile: PlayerProfile; ok: boolean; reason: 'applied' | 'insufficient-coins' | 'invalid-style' }`

- [ ] **Step 1: Create customization definitions**

Create `src/systems/Customization.ts`:

```ts
import * as THREE from 'three';

export type AircraftPartId = 'body' | 'leftWing' | 'rightWing' | 'propeller';
export type AircraftStyleId = 'standard' | 'red' | 'gold' | 'stealth' | 'teal';

export type AircraftCustomization = Record<AircraftPartId, AircraftStyleId>;

export type AircraftStyle = {
  id: AircraftStyleId;
  label: string;
  cost: number;
  color: string;
  metalness: number;
  roughness: number;
  emissive: string;
  emissiveIntensity: number;
};

export const AIRCRAFT_PART_LABELS: Record<AircraftPartId, string> = {
  body: '机身',
  leftWing: '左翼',
  rightWing: '右翼',
  propeller: '螺旋桨',
};

export const AIRCRAFT_STYLES: Record<AircraftStyleId, AircraftStyle> = {
  standard: {
    id: 'standard',
    label: '标准蓝',
    cost: 0,
    color: '#48d6c5',
    metalness: 0.26,
    roughness: 0.28,
    emissive: '#0d4f49',
    emissiveIntensity: 0.32,
  },
  red: {
    id: 'red',
    label: '赤红',
    cost: 80,
    color: '#f05b3f',
    metalness: 0.24,
    roughness: 0.32,
    emissive: '#5b120c',
    emissiveIntensity: 0.18,
  },
  gold: {
    id: 'gold',
    label: '金色',
    cost: 180,
    color: '#f1d97a',
    metalness: 0.46,
    roughness: 0.22,
    emissive: '#6a4f08',
    emissiveIntensity: 0.22,
  },
  stealth: {
    id: 'stealth',
    label: '黑色隐形',
    cost: 320,
    color: '#17191b',
    metalness: 0.34,
    roughness: 0.5,
    emissive: '#000000',
    emissiveIntensity: 0,
  },
  teal: {
    id: 'teal',
    label: '青色辉光',
    cost: 260,
    color: '#35ffe2',
    metalness: 0.38,
    roughness: 0.2,
    emissive: '#0d4f49',
    emissiveIntensity: 0.52,
  },
};

export const DEFAULT_CUSTOMIZATION: AircraftCustomization = {
  body: 'red',
  leftWing: 'standard',
  rightWing: 'standard',
  propeller: 'stealth',
};

export function isAircraftPartId(value: string): value is AircraftPartId {
  return value === 'body' || value === 'leftWing' || value === 'rightWing' || value === 'propeller';
}

export function isAircraftStyleId(value: string): value is AircraftStyleId {
  return value === 'standard' || value === 'red' || value === 'gold' || value === 'stealth' || value === 'teal';
}

export function applyStyleToMaterial(material: THREE.MeshStandardMaterial, styleId: AircraftStyleId): void {
  const style = AIRCRAFT_STYLES[styleId];
  material.color.set(style.color);
  material.metalness = style.metalness;
  material.roughness = style.roughness;
  material.emissive.set(style.emissive);
  material.emissiveIntensity = style.emissiveIntensity;
}
```

- [ ] **Step 2: Create profile store**

Create `src/systems/ProfileStore.ts`:

```ts
import {
  AIRCRAFT_STYLES,
  DEFAULT_CUSTOMIZATION,
  type AircraftCustomization,
  type AircraftPartId,
  type AircraftStyleId,
  isAircraftStyleId,
} from './Customization';

export type PlayerProfile = {
  coins: number;
  customization: AircraftCustomization;
};

export const PROFILE_STORAGE_KEY = 'dxr3d-player-profile-v1';

export const COIN_REWARDS = {
  pickup: 5,
  aiKill: 25,
  playerKill: 100,
} as const;

export const DEFAULT_PROFILE: PlayerProfile = {
  coins: 0,
  customization: { ...DEFAULT_CUSTOMIZATION },
};

function cloneProfile(profile: PlayerProfile): PlayerProfile {
  return {
    coins: Math.max(0, Math.floor(profile.coins)),
    customization: { ...profile.customization },
  };
}

function normalizeProfile(value: unknown): PlayerProfile {
  if (!value || typeof value !== 'object') return cloneProfile(DEFAULT_PROFILE);
  const candidate = value as Partial<PlayerProfile>;
  const customization = { ...DEFAULT_CUSTOMIZATION };
  const rawCustomization = candidate.customization;
  if (rawCustomization && typeof rawCustomization === 'object') {
    for (const part of Object.keys(customization) as AircraftPartId[]) {
      const rawStyle = (rawCustomization as Record<string, unknown>)[part];
      if (typeof rawStyle === 'string' && isAircraftStyleId(rawStyle)) customization[part] = rawStyle;
    }
  }
  return {
    coins: typeof candidate.coins === 'number' && Number.isFinite(candidate.coins) ? Math.max(0, Math.floor(candidate.coins)) : 0,
    customization,
  };
}

export function loadProfile(storage: Storage = window.localStorage): PlayerProfile {
  try {
    const raw = storage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return cloneProfile(DEFAULT_PROFILE);
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return cloneProfile(DEFAULT_PROFILE);
  }
}

export function saveProfile(profile: PlayerProfile, storage: Storage = window.localStorage): void {
  storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(cloneProfile(profile)));
}

export function awardCoins(profile: PlayerProfile, amount: number): PlayerProfile {
  return {
    ...profile,
    coins: Math.max(0, Math.floor(profile.coins + Math.max(0, amount))),
  };
}

export function spendForCustomization(
  profile: PlayerProfile,
  part: AircraftPartId,
  style: AircraftStyleId,
): { profile: PlayerProfile; ok: boolean; reason: 'applied' | 'insufficient-coins' | 'invalid-style' } {
  const styleDefinition = AIRCRAFT_STYLES[style];
  if (!styleDefinition) return { profile, ok: false, reason: 'invalid-style' };
  const cost = styleDefinition.cost;
  if (profile.coins < cost) return { profile, ok: false, reason: 'insufficient-coins' };
  return {
    profile: {
      coins: profile.coins - cost,
      customization: {
        ...profile.customization,
        [part]: style,
      },
    },
    ok: true,
    reason: 'applied',
  };
}
```

- [ ] **Step 3: Run typecheck build**

Run: `npm run build`

Expected: PASS. No code uses the new modules yet, but TypeScript should compile them.

- [ ] **Step 4: Commit**

```bash
git add src/systems/Customization.ts src/systems/ProfileStore.ts
git commit -m "Add profile economy models"
```

---

### Task 2: Apply Customization to Player Aircraft Parts

**Files:**
- Modify: `src/entities/Player.ts`

**Interfaces:**
- Consumes: `AircraftCustomization`, `applyStyleToMaterial()` from Task 1.
- Produces: `Player.applyCustomization(customization: AircraftCustomization): void`.

- [ ] **Step 1: Import customization helpers**

Modify the top of `src/entities/Player.ts`:

```ts
import * as THREE from 'three';
import type { InputController } from '../core/InputController';
import { applyStyleToMaterial, type AircraftCustomization } from '../systems/Customization';
```

- [ ] **Step 2: Split aircraft part materials**

Replace the single `wingMaterial` and `darkMaterial` fields with these fields:

```ts
  private readonly bodyMaterial = new THREE.MeshStandardMaterial({
    color: '#f05b3f',
    roughness: 0.34,
    metalness: 0.22,
  });
  private readonly leftWingMaterial = new THREE.MeshStandardMaterial({
    color: '#48d6c5',
    roughness: 0.28,
    metalness: 0.26,
    emissive: '#0d4f49',
    emissiveIntensity: 0.32,
  });
  private readonly rightWingMaterial = this.leftWingMaterial.clone();
  private readonly tailMaterial = this.leftWingMaterial.clone();
  private readonly propellerMaterial = new THREE.MeshStandardMaterial({
    color: '#17191b',
    roughness: 0.58,
    metalness: 0.18,
  });
```

- [ ] **Step 3: Split the main wing mesh into left and right**

In the constructor, replace the current main `wing` mesh block with:

```ts
    const leftWing = new THREE.Mesh(this.wingGeometry, this.leftWingMaterial);
    leftWing.position.set(-0.82, -0.02, -0.18);
    leftWing.scale.x = 0.5;
    leftWing.castShadow = true;
    leftWing.receiveShadow = true;
    this.group.add(leftWing);

    const rightWing = new THREE.Mesh(this.wingGeometry, this.rightWingMaterial);
    rightWing.position.set(0.82, -0.02, -0.18);
    rightWing.scale.x = 0.5;
    rightWing.castShadow = true;
    rightWing.receiveShadow = true;
    this.group.add(rightWing);
```

- [ ] **Step 4: Use tail and propeller materials**

In the constructor, change tail and fin material usage:

```ts
    const tail = new THREE.Mesh(this.tailWingGeometry, this.tailMaterial);
```

```ts
    const fin = new THREE.Mesh(this.finGeometry, this.tailMaterial);
```

Change propeller blade/hub material usage:

```ts
    const bladeA = new THREE.Mesh(this.propellerGeometry, this.propellerMaterial);
    const bladeB = new THREE.Mesh(this.propellerGeometry, this.propellerMaterial);
    bladeB.rotation.z = Math.PI / 2;
    const hub = new THREE.Mesh(this.propellerHubGeometry, this.propellerMaterial);
```

- [ ] **Step 5: Add customization method**

Add before `applyImpact()`:

```ts
  applyCustomization(customization: AircraftCustomization): void {
    applyStyleToMaterial(this.bodyMaterial, customization.body);
    applyStyleToMaterial(this.leftWingMaterial, customization.leftWing);
    applyStyleToMaterial(this.rightWingMaterial, customization.rightWing);
    applyStyleToMaterial(this.propellerMaterial, customization.propeller);
    applyStyleToMaterial(this.tailMaterial, customization.leftWing);
  }
```

- [ ] **Step 6: Dispose new materials**

Replace material disposal in `dispose()` with:

```ts
    this.bodyMaterial.dispose();
    this.leftWingMaterial.dispose();
    this.rightWingMaterial.dispose();
    this.tailMaterial.dispose();
    this.glassMaterial.dispose();
    this.propellerMaterial.dispose();
```

- [ ] **Step 7: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/entities/Player.ts
git commit -m "Support aircraft part customization"
```

---

### Task 3: Homepage Economy and Customization Shop UI

**Files:**
- Modify: `index.html`
- Modify: `src/styles.css`
- Modify: `src/systems/Hud.ts`

**Interfaces:**
- Consumes: DOM IDs used by Task 4:
  - `#coin-balance`
  - `#shop-message`
  - `#customization-grid`
  - buttons with `[data-part][data-style]`
- Produces: `Hud.setCoins(coins: number): void`
- Produces: `Hud.flashReward(text: string): void`

- [ ] **Step 1: Add homepage coin/shop markup**

In `index.html`, inside `#start-screen`, replace the current paragraph/button-only content with:

```html
        <h1>天空空战</h1>
        <p>点击开始后鼠标会像射击游戏一样锁定。移动圆圈操控飞机，用准心开火，寻找扳手维修。</p>
        <div id="menu-panel">
          <div id="coin-card">
            <span>金币</span>
            <strong id="coin-balance">0</strong>
          </div>
          <button id="start-button" type="button">开始单人</button>
          <section id="customization-shop" aria-label="飞机改装">
            <h2>飞机改装</h2>
            <p id="shop-message">选择零件和颜色，每次改装都会消耗金币。</p>
            <div id="customization-grid"></div>
          </section>
        </div>
```

- [ ] **Step 2: Add HUD coin metric**

In `index.html`, inside `#hud` after the damage meter, add:

```html
        <div class="hud-metric coin-meter">
          <span>金币</span>
          <strong id="hud-coin-value">0</strong>
        </div>
```

- [ ] **Step 3: Add reward flash markup**

In `index.html`, inside `#hud` after `#status-line`, add:

```html
        <div id="reward-flash" aria-live="polite"></div>
```

- [ ] **Step 4: Update HUD grid CSS**

In `src/styles.css`, update `#hud` grid columns to include one more compact stat:

```css
#hud {
  position: absolute;
  top: max(14px, env(safe-area-inset-top));
  right: max(112px, env(safe-area-inset-right));
  left: max(14px, env(safe-area-inset-left));
  display: grid;
  grid-template-columns: repeat(6, minmax(76px, 112px)) minmax(112px, 1fr) minmax(140px, auto);
  gap: 8px;
  align-items: start;
  pointer-events: none;
  color: #f4f0df;
  text-transform: uppercase;
  letter-spacing: 0;
}
```

- [ ] **Step 5: Add menu/shop styles**

Add after `#start-screen p` styles:

```css
#menu-panel {
  display: grid;
  justify-items: center;
  gap: 12px;
  width: min(720px, calc(100vw - 36px));
}

#coin-card {
  display: grid;
  grid-template-columns: auto auto;
  gap: 10px;
  align-items: baseline;
  min-width: 148px;
  padding: 9px 14px;
  border: 1px solid rgba(244, 240, 223, 0.24);
  background: rgba(14, 21, 24, 0.72);
}

#coin-card span,
#customization-shop h2,
#customization-shop p {
  margin: 0;
}

#coin-card span {
  color: rgba(244, 240, 223, 0.7);
  font-weight: 900;
}

#coin-card strong {
  color: #f1d97a;
  font-variant-numeric: tabular-nums;
  font-size: 1.35rem;
}

#customization-shop {
  display: grid;
  gap: 10px;
  width: 100%;
  max-height: min(44vh, 380px);
  padding: 12px;
  overflow: auto;
  border: 1px solid rgba(244, 240, 223, 0.18);
  background: rgba(14, 21, 24, 0.62);
  text-align: left;
}

#customization-shop h2 {
  font-size: 1rem;
}

#shop-message {
  color: rgba(244, 240, 223, 0.74);
  font-size: 0.78rem;
  font-weight: 800;
}

#customization-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(126px, 1fr));
  gap: 8px;
}

.shop-part {
  display: grid;
  gap: 7px;
}

.shop-part h3 {
  margin: 0;
  font-size: 0.74rem;
}

.style-button {
  display: grid;
  grid-template-columns: 18px 1fr auto;
  gap: 7px;
  align-items: center;
  min-height: 36px;
  padding: 6px 8px;
  border: 1px solid rgba(244, 240, 223, 0.18);
  color: #f4f0df;
  background: rgba(8, 12, 14, 0.52);
  font-weight: 800;
}

.style-button.is-selected {
  border-color: #f1d97a;
  box-shadow: 0 0 14px rgba(241, 217, 122, 0.2);
}

.style-button:disabled {
  opacity: 0.52;
}

.style-swatch {
  width: 18px;
  aspect-ratio: 1;
  border: 1px solid rgba(244, 240, 223, 0.42);
}

.style-cost {
  color: #f1d97a;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 6: Add HUD reward styles**

Add after `#status-line` styles:

```css
.coin-meter {
  border-left-color: #f1d97a;
}

#reward-flash {
  min-height: 58px;
  padding: 12px 13px;
  border: 1px solid rgba(241, 217, 122, 0.22);
  border-left: 3px solid #f1d97a;
  background: linear-gradient(180deg, rgba(14, 21, 24, 0.82), rgba(14, 21, 24, 0.52));
  color: #f1d97a;
  font-weight: 900;
  opacity: 0;
}
```

- [ ] **Step 7: Update responsive CSS**

Inside `@media (max-width: 900px)`, change:

```css
  #hud {
    grid-template-columns: repeat(3, minmax(78px, 1fr));
  }
```

Inside `@media (pointer: coarse), (max-width: 760px)`, add:

```css
  #customization-grid {
    grid-template-columns: repeat(2, minmax(120px, 1fr));
  }

  #customization-shop {
    max-height: 42vh;
  }
```

- [ ] **Step 8: Add HUD coin/reward methods**

In `src/systems/Hud.ts`, add fields:

```ts
  private readonly hudCoinValue = this.getElement('#hud-coin-value');
  private readonly rewardFlash = this.getElement('#reward-flash');
```

Add methods after `setTarget()`:

```ts
  setCoins(coins: number): void {
    this.hudCoinValue.textContent = String(coins);
  }

  flashReward(text: string): void {
    this.rewardFlash.textContent = text;
    this.rewardFlash.animate(
      [
        { opacity: 0, transform: 'translateY(4px)' },
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(-4px)' },
      ],
      { duration: 850, easing: 'ease-out' },
    );
  }
```

- [ ] **Step 9: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add index.html src/styles.css src/systems/Hud.ts
git commit -m "Add economy shop interface"
```

---

### Task 4: Wire Profile, Shop Buttons, and Saved Customization

**Files:**
- Modify: `src/game/Game.ts`
- Modify: `src/vite-env.d.ts`

**Interfaces:**
- Consumes: Task 1 profile/customization APIs.
- Consumes: Task 2 `player.applyCustomization()`.
- Consumes: Task 3 DOM IDs.
- Produces: current coin balance on homepage and HUD.
- Produces: customization purchase/apply behavior.

- [ ] **Step 1: Add imports**

In `src/game/Game.ts`, add:

```ts
import {
  AIRCRAFT_PART_LABELS,
  AIRCRAFT_STYLES,
  type AircraftPartId,
  type AircraftStyleId,
} from '../systems/Customization';
import {
  COIN_REWARDS,
  awardCoins,
  loadProfile,
  saveProfile,
  spendForCustomization,
  type PlayerProfile,
} from '../systems/ProfileStore';
```

- [ ] **Step 2: Add Game fields**

Add near existing button fields:

```ts
  private readonly coinBalance = this.getElement('#coin-balance');
  private readonly shopMessage = this.getElement('#shop-message');
  private readonly customizationGrid = this.getElement('#customization-grid');
  private profile: PlayerProfile = loadProfile();
```

- [ ] **Step 3: Render shop in constructor**

After event listeners are registered in the constructor, call:

```ts
    this.renderCustomizationShop();
    this.applyProfile();
```

- [ ] **Step 4: Add profile helper methods**

Add methods before `render()`:

```ts
  private applyProfile(): void {
    this.player.applyCustomization(this.profile.customization);
    this.coinBalance.textContent = String(this.profile.coins);
    this.hud.setCoins(this.profile.coins);
    saveProfile(this.profile);
  }

  private addCoins(amount: number, label: string): void {
    this.profile = awardCoins(this.profile, amount);
    this.applyProfile();
    this.hud.flashReward(`+${amount} 金币 ${label}`);
  }

  private renderCustomizationShop(): void {
    this.customizationGrid.innerHTML = '';
    for (const part of Object.keys(AIRCRAFT_PART_LABELS) as AircraftPartId[]) {
      const section = document.createElement('section');
      section.className = 'shop-part';
      const title = document.createElement('h3');
      title.textContent = AIRCRAFT_PART_LABELS[part];
      section.append(title);

      for (const style of Object.values(AIRCRAFT_STYLES)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'style-button';
        button.dataset.part = part;
        button.dataset.style = style.id;
        button.innerHTML = `<span class="style-swatch"></span><span>${style.label}</span><span class="style-cost">${style.cost}</span>`;
        const swatch = button.querySelector<HTMLElement>('.style-swatch');
        if (swatch) swatch.style.background = style.color;
        button.addEventListener('click', () => this.buyCustomization(part, style.id));
        section.append(button);
      }

      this.customizationGrid.append(section);
    }
    this.syncCustomizationButtons();
  }

  private syncCustomizationButtons(): void {
    const buttons = this.customizationGrid.querySelectorAll<HTMLButtonElement>('.style-button[data-part][data-style]');
    buttons.forEach((button) => {
      const part = button.dataset.part as AircraftPartId;
      const style = button.dataset.style as AircraftStyleId;
      const selected = this.profile.customization[part] === style;
      button.classList.toggle('is-selected', selected);
      const cost = AIRCRAFT_STYLES[style].cost;
      button.disabled = cost > this.profile.coins && !selected;
    });
  }

  private buyCustomization(part: AircraftPartId, style: AircraftStyleId): void {
    const result = spendForCustomization(this.profile, part, style);
    if (!result.ok) {
      this.shopMessage.textContent = result.reason === 'insufficient-coins' ? '金币不足' : '无法应用这个改装';
      this.shopMessage.animate(
        [
          { transform: 'translateX(0)', color: 'rgba(244, 240, 223, 0.74)' },
          { transform: 'translateX(4px)', color: '#e23d2f' },
          { transform: 'translateX(0)', color: 'rgba(244, 240, 223, 0.74)' },
        ],
        { duration: 240, easing: 'ease-out' },
      );
      return;
    }
    this.profile = result.profile;
    this.shopMessage.textContent = `${AIRCRAFT_PART_LABELS[part]} 已改装为 ${AIRCRAFT_STYLES[style].label}`;
    this.applyProfile();
    this.syncCustomizationButtons();
  }
```

- [ ] **Step 5: Re-apply customization on mission reset**

In `resetMission()`, after `this.player.reset();`, add:

```ts
    this.player.applyCustomization(this.profile.customization);
```

- [ ] **Step 6: Include coins in diagnostics**

In `publishDiagnostics()`, add:

```ts
      coins: this.profile.coins,
```

In `src/vite-env.d.ts`, add to `ThreeGameDiagnostics`:

```ts
  coins: number;
```

- [ ] **Step 7: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/game/Game.ts src/vite-env.d.ts
git commit -m "Wire saved aircraft customization"
```

---

### Task 5: Coin Pickups and AI Kill Rewards

**Files:**
- Modify: `src/game/Game.ts`

**Interfaces:**
- Consumes: `addCoins()` from Task 4.
- Consumes: `COIN_REWARDS.pickup` and `COIN_REWARDS.aiKill`.
- Produces: airborne coin pickups that respawn far away.

- [ ] **Step 1: Add coin pickup type**

Near `RepairPickup`, add:

```ts
type CoinPickup = {
  group: THREE.Group;
  active: boolean;
  phase: number;
};
```

- [ ] **Step 2: Add coin pickup collection**

Add class field near `repairs`:

```ts
  private readonly coins: CoinPickup[] = [];
```

- [ ] **Step 3: Create coin pickups**

In `createScene()`, after `this.createRepairPickups();`, add:

```ts
    this.createCoinPickups();
```

Add methods after `createRepairWrench()`:

```ts
  private createCoinPickups(): void {
    const positions = [
      [-18, 9, -18],
      [18, 11, -42],
      [36, 8, 28],
      [-38, 12, 42],
      [4, 14, 8],
    ];
    positions.forEach(([x, y, z], index) => {
      const group = this.createCoinModel();
      group.position.set(x, y, z);
      this.world.add(group);
      this.coins.push({ group, active: true, phase: index * 0.9 });
    });
  }

  private createCoinModel(): THREE.Group {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.045, 8, 34),
      new THREE.MeshBasicMaterial({ color: '#fff2a8' }),
    );
    group.add(ring);

    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.08, 32),
      new THREE.MeshStandardMaterial({
        color: '#f1d97a',
        roughness: 0.24,
        metalness: 0.72,
        emissive: '#6a4f08',
        emissiveIntensity: 0.22,
      }),
    );
    coin.rotation.x = Math.PI / 2;
    coin.castShadow = true;
    group.add(coin);

    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.5, 0.04),
      new THREE.MeshBasicMaterial({ color: '#fff6c8' }),
    );
    mark.position.z = 0.06;
    group.add(mark);

    return group;
  }
```

- [ ] **Step 4: Animate and collect coins**

In `update()` inside playing mode, after `this.updateRepairs(elapsed);`, add:

```ts
      this.updateCoins(elapsed);
      this.checkCoinPickups();
```

Add methods after `checkRepairPickups()`:

```ts
  private updateCoins(elapsed: number): void {
    this.coins.forEach((coin) => {
      if (!coin.active) return;
      coin.group.rotation.y += 0.036;
      coin.group.position.y += Math.sin(elapsed * 2.8 + coin.phase) * 0.0045;
    });
  }

  private checkCoinPickups(): void {
    this.coins.forEach((coin) => {
      if (!coin.active) return;
      if (coin.group.position.distanceToSquared(this.player.group.position) < 1.65 * 1.65) {
        this.addCoins(COIN_REWARDS.pickup, '拾取');
        this.audio.pickup(1);
        this.respawnCoinFarAway(coin);
      }
    });
  }

  private respawnCoinFarAway(coin: CoinPickup): void {
    const playerPosition = this.player.group.position;
    let best = new THREE.Vector3(0, 10, 0);
    let bestDistance = -1;

    for (let attempt = 0; attempt < 18; attempt += 1) {
      const x = THREE.MathUtils.randFloatSpread(ARENA.halfWidth * 1.75);
      const z = THREE.MathUtils.randFloatSpread(ARENA.halfDepth * 1.75);
      const terrain = this.getTerrainHeight(x, z);
      const y = THREE.MathUtils.randFloat(Math.max(terrain + 4.5, 6.5), ARENA.maxAltitude - 1.2);
      const candidate = new THREE.Vector3(x, y, z);
      const distance = candidate.distanceTo(playerPosition);
      if (distance > bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
      if (distance > 34) break;
    }

    coin.group.position.copy(best);
    coin.group.visible = true;
    coin.active = true;
  }
```

- [ ] **Step 5: Award AI kill coins**

In `updatePlayerShots()`, inside `if (enemy)`, after `this.hud.flashTargetHit();`, add:

```ts
        this.addCoins(COIN_REWARDS.aiKill, '击落');
```

- [ ] **Step 6: Reset coin visibility on mission reset**

In `resetMission()`, after repair reset loop, add:

```ts
    for (const coin of this.coins) {
      coin.active = true;
      coin.group.visible = true;
    }
```

- [ ] **Step 7: Include coin pickup count in diagnostics**

In `publishDiagnostics()`, add:

```ts
      coinPickups: this.coins.filter((coin) => coin.active).length,
```

In `src/vite-env.d.ts`, add to `ThreeGameDiagnostics`:

```ts
  coinPickups?: number;
```

- [ ] **Step 8: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/game/Game.ts src/vite-env.d.ts
git commit -m "Add coin pickups and AI rewards"
```

---

### Task 6: Browser Verification and Release

**Files:**
- Modify: `tests/visual.spec.ts`

**Interfaces:**
- Consumes: homepage DOM from Task 3.
- Consumes: diagnostics from Tasks 4 and 5.
- Produces: smoke check for economy UI.

- [ ] **Step 1: Extend visual test setup**

In `tests/visual.spec.ts`, after `await page.goto('/');`, add:

```ts
  await expect(page.locator('#coin-balance')).toBeVisible();
  await expect(page.locator('#customization-shop')).toBeVisible();
  await expect(page.locator('#customization-grid .style-button')).toHaveCount(20);
  await expect(page.locator('#shop-message')).toContainText('金币');
```

- [ ] **Step 2: Add localStorage persistence check**

Still before clicking start, add:

```ts
  await page.evaluate(() => {
    window.localStorage.setItem(
      'dxr3d-player-profile-v1',
      JSON.stringify({
        coins: 500,
        customization: {
          body: 'gold',
          leftWing: 'red',
          rightWing: 'teal',
          propeller: 'stealth',
        },
      }),
    );
  });
  await page.reload();
  await expect(page.locator('#coin-balance')).toHaveText('500');
```

- [ ] **Step 3: Add insufficient/affordable shop click check**

Before clicking start, add:

```ts
  await page.locator('.style-button[data-part="body"][data-style="teal"]').click();
  await expect(page.locator('#coin-balance')).toHaveText('240');
  await expect(page.locator('#shop-message')).toContainText('机身 已改装为 青色辉光');
```

- [ ] **Step 4: Add runtime diagnostics checks**

After `await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10);`, add:

```ts
  await expect
    .poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.coins))
    .toBe(240);
  await expect
    .poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.coinPickups ?? 0))
    .toBeGreaterThan(0);
```

- [ ] **Step 5: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Run visual verification**

Run: `npm run verify:visual -- --project=desktop-chrome`

Expected: PASS. The screenshot should show the updated homepage if failure artifacts are inspected.

- [ ] **Step 7: Commit**

```bash
git add tests/visual.spec.ts
git commit -m "Verify economy shop smoke path"
```

- [ ] **Step 8: Deploy using existing GitHub Pages flow**

Run:

```bash
npm run build
rm -rf /tmp/dxr3d-sky-combat-pages-20260715-economy-customization
mkdir -p /tmp/dxr3d-sky-combat-pages-20260715-economy-customization
cp -R dist/. /tmp/dxr3d-sky-combat-pages-20260715-economy-customization/
```

Then run in `/tmp/dxr3d-sky-combat-pages-20260715-economy-customization`:

```bash
touch .nojekyll
git init -b gh-pages
git add .
git commit -m "Deploy economy customization"
git remote add origin https://github.com/flycarl/dxr3d-sky-combat.git
git push -f origin gh-pages
```

Expected: push succeeds and `https://flycarl.github.io/dxr3d-sky-combat/` eventually references the new JS/CSS assets.

---

## Self-Review

- Spec coverage:
  - `localStorage` coins/profile: Task 1 and Task 4.
  - Coin rewards `+5`, `+25`, future `+100`: Task 1 constants, Task 5 uses pickup and AI reward. Future player reward remains for Phase 2 by scope decision.
  - Coin pickups separate from repair pickups and respawn far away: Task 5.
  - Homepage coin balance and customization: Task 3 and Task 4.
  - Body/left wing/right wing/propeller customization: Task 1, Task 2, Task 4.
  - Each change costs coins: Task 1 `spendForCustomization()`, Task 4 button wiring.
  - Verification: Task 6.
- Placeholder scan: no incomplete placeholder markers are used.
- Type consistency:
  - `AircraftPartId`, `AircraftStyleId`, `AircraftCustomization`, and `PlayerProfile` originate in Task 1 and are consumed consistently later.
  - `applyCustomization()` is produced by Task 2 and consumed by Task 4.
  - DOM IDs introduced in Task 3 are consumed by Task 4 and Task 6.
