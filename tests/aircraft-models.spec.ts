import { expect, test } from '@playwright/test';

type AircraftCatalogEntry = {
  id: string;
  recipe: string;
  meshes: number;
  propellers: number;
  exhausts: number;
};

test('publishes eight distinct aircraft recipes with correct propulsion', async ({ page }) => {
  await page.goto('/');

  const catalog = await page.evaluate(
    () => (window as Window & { __AIRCRAFT_MODEL_CATALOG__?: AircraftCatalogEntry[] }).__AIRCRAFT_MODEL_CATALOG__,
  );

  expect(catalog).toHaveLength(8);
  expect(new Set(catalog?.map((entry) => entry.recipe)).size).toBe(8);
  expect(catalog?.every((entry) => entry.meshes >= 8)).toBe(true);

  const byId = new Map(catalog?.map((entry) => [entry.id, entry]));
  expect(byId.get('standard')?.propellers).toBeGreaterThan(0);
  expect(byId.get('red')?.propellers).toBeGreaterThan(0);
  expect(byId.get('warbird')?.propellers).toBeGreaterThan(0);
  expect(byId.get('gold')?.propellers).toBeGreaterThan(0);

  for (const id of ['jet', 'stealth', 'heavy', 'teal']) {
    expect(byId.get(id)?.propellers).toBe(0);
    expect(byId.get(id)?.exhausts).toBeGreaterThan(0);
  }
});

test('switches the local player between propeller and jet airframes', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.setItem(
      'dxr3d-player-profile-v1',
      JSON.stringify({
        coins: 2000,
        selectedSkin: 'standard',
        ownedSkins: ['standard', 'red', 'warbird', 'jet', 'stealth', 'heavy', 'gold', 'teal'],
      }),
    );
  });
  await page.reload();

  await page.locator('[data-skin="jet"]').click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const player = window.__THREE_GAME_DIAGNOSTICS__?.player as
          | (ThreeGameDiagnostics['player'] & { aircraftId?: string; aircraftRecipe?: string; propulsion?: string })
          | undefined;
        return player ? [player.aircraftId, player.aircraftRecipe, player.propulsion] : [];
      }),
    )
    .toEqual(['jet', 'modern-jet', 'jet']);

  await page.locator('[data-skin="standard"]').click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const player = window.__THREE_GAME_DIAGNOSTICS__?.player as
          | (ThreeGameDiagnostics['player'] & { aircraftId?: string; aircraftRecipe?: string; propulsion?: string })
          | undefined;
        return player ? [player.aircraftId, player.aircraftRecipe, player.propulsion] : [];
      }),
    )
    .toEqual(['standard', 'classic-biplane', 'propeller']);
});

test('presents the aircraft collection as an eight-card hangar', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#customization-shop h2')).toHaveText('飞机机库');
  await expect(page.locator('#customization-grid .style-button')).toHaveCount(8);
  await expect(page.locator('#customization-grid .aircraft-category')).toHaveCount(8);
  await expect(page.locator('[data-skin="standard"] .aircraft-category')).toHaveText('经典双翼机');
  await expect(page.locator('[data-skin="jet"] .aircraft-category')).toHaveText('现代喷气战斗机');
  await expect(page.locator('[data-skin="stealth"] .aircraft-category')).toHaveText('隐形三角翼战机');
});

test('renders representative airframes in active gameplay', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  for (const id of ['standard', 'jet', 'stealth', 'heavy']) {
    await page.goto('/');
    await page.evaluate((aircraftId) => {
      window.localStorage.setItem(
        'dxr3d-player-profile-v1',
        JSON.stringify({ coins: 2000, selectedSkin: aircraftId, ownedSkins: ['standard', aircraftId] }),
      );
    }, id);
    await page.reload();
    page.once('dialog', (dialog) => dialog.accept('试飞员'));
    await page.locator('#start-button').click();
    await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 8);
    await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.player.aircraftId)).toBe(id);
    const image = await page.locator('#game-canvas').screenshot();
    expect(image.byteLength).toBeGreaterThan(20_000);
    await testInfo.attach(`aircraft-${id}`, { body: image, contentType: 'image/png' });
  }
});

test('releases old aircraft geometry while switching the full hangar', async ({ page }) => {
  const aircraftIds = ['standard', 'red', 'warbird', 'jet', 'stealth', 'heavy', 'gold', 'teal'];
  await page.goto('/');
  await page.evaluate((ownedSkins) => {
    window.localStorage.setItem(
      'dxr3d-player-profile-v1',
      JSON.stringify({ coins: 4000, selectedSkin: 'standard', ownedSkins }),
    );
  }, aircraftIds);
  await page.reload();
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 3);
  const baseline = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.renderer.geometries ?? 0);

  for (let pass = 0; pass < 2; pass += 1) {
    for (const id of aircraftIds) {
      await page.locator(`[data-skin="${id}"]`).click();
    }
  }
  await page.locator('[data-skin="standard"]').click();
  await page.waitForFunction((startFrame) => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > startFrame + 3, await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0));

  const finalCount = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.renderer.geometries ?? 0);
  expect(finalCount).toBeLessThanOrEqual(baseline + 2);
});
