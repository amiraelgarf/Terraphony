/**
 * End-to-end journeys for Earth Records (brief sections 12, 15 and 16):
 * invitation -> library -> studio -> listen -> inspect -> draw -> press -> reveal -> export,
 * the land year dial, keyboard use, persistence, deep links, reduced motion,
 * responsive layout and no console errors.
 */
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});
test.afterEach(() => expect(errors, errors.join('\n')).toEqual([]));

async function openOceanStudio(page: Page) {
  await page.goto('/#/studio/ocean');
  await expect(page.locator('.score__mark')).toHaveCount(24, { timeout: 20_000 });
}

test('invitation: editorial copy, no sound until a gesture, two real actions', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /A world of sound\. Yours\./ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Make my Earth Record' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take the short tour' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sound off/ })).toBeVisible();
});

test('no audio context exists until the visitor asks for sound', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __ctx: number; AudioContext: typeof AudioContext };
    w.__ctx = 0;
    const Orig = w.AudioContext;
    w.AudioContext = class extends Orig {
      constructor(o?: AudioContextOptions) {
        super(o);
        w.__ctx++;
      }
    } as typeof AudioContext;
  });
  await page.goto('/#/studio/ocean');
  await page.reload(); // a hash change alone does not reload, and the counter is installed on load
  await expect(page.locator('.score__mark')).toHaveCount(24, { timeout: 20_000 });
  await page.locator('.score__mark').nth(3).focus();
  expect(await page.evaluate(() => (window as unknown as { __ctx: number }).__ctx)).toBe(0);
  await page.getByRole('button', { name: /Hear this journey/ }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ctx: number }).__ctx)).toBeGreaterThan(0);
});

test('three decisive actions reach a playing record, with score and caption in sync', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Make my Earth Record' }).click();
  await page.locator('.choice--ocean').click();
  await expect(page.locator('.score__mark')).toHaveCount(24, { timeout: 20_000 });
  await page.getByRole('button', { name: /Hear this journey/ }).click();
  await expect(page.locator('.score__mark.is-active')).toHaveCount(1);
  await expect(page.locator('.score__caption')).toContainText(/Stop \d+\/24/);
  await expect(page.locator('.score__caption')).toContainText('°C');
  await page.getByRole('button', { name: /^Pause/ }).click();
});

test('library: planned record is honest and its dialog is keyboard-safe', async ({ page }) => {
  await page.goto('/#/library');
  await expect(page.locator('.choice')).toHaveCount(3);
  const fire = page.locator('.choice--fire');
  await expect(fire).toContainText('not playable yet');
  await fire.click();
  await expect(page.getByRole('dialog')).toContainText('Not pressed yet');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(fire).toBeFocused();
});

test('inspecting a note shows value, unit, place, note and the formula', async ({ page }) => {
  await openOceanStudio(page);
  await page.locator('.score__mark').nth(9).click();
  const insp = page.locator('.inspector');
  await expect(insp).toContainText('Stop 10 of 24');
  await expect(insp).toContainText('°C');
  await expect(insp).toContainText(/\d+\.\d°[NS] \d+\.\d°[EW]/);
  await insp.getByText('Technical details').click();
  await expect(insp.locator('code').first()).toContainText('u = clamp(');
  await expect(insp).toContainText('MUR');
});

test('keyboard: arrows walk the score; coordinates edit the route', async ({ page }) => {
  await openOceanStudio(page);
  await page.locator('.score__mark').first().focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.score__mark').nth(2)).toBeFocused();
  await expect(page.locator('.inspector')).toContainText('Stop 3 of 24');
  await page.keyboard.press('Escape');
  const before = await page.locator('.score__mark').first().getAttribute('aria-label');
  await page.getByRole('button', { name: 'Edit the route by coordinates' }).click();
  await page.getByRole('button', { name: 'Edit a copy of this route' }).click();
  await page.getByRole('button', { name: 'Remove waypoint 1' }).click();
  await expect.poll(() => page.locator('.score__mark').first().getAttribute('aria-label')).not.toBe(before);
});

test('drawing a line over the sea makes a new 24-stop route', async ({ page }) => {
  await openOceanStudio(page);
  const before = await page.locator('.score__mark').nth(12).getAttribute('aria-label');
  await page.getByRole('button', { name: 'Draw a route' }).click();
  const box = (await page.locator('.atlas__svg').boundingBox())!;
  const y = box.y + box.height * 0.72;
  await page.mouse.move(box.x + box.width * 0.2, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + box.width * (0.2 + i * 0.04), y - i * 3);
  await page.mouse.up();
  await expect(page.locator('.score__mark')).toHaveCount(24);
  await expect.poll(() => page.locator('.score__mark').nth(12).getAttribute('aria-label')).not.toBe(before);
});

test('press -> reveal -> exports carry the real record', async ({ page }, info) => {
  await openOceanStudio(page);
  await page.getByLabel('Name your record').fill('Test pressing');
  await page.getByRole('button', { name: /Press my Earth Record/ }).click();
  await expect(page.getByRole('heading', { name: /A place becomes/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /It's yours/ })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.liner__title')).toHaveText('Test pressing');

  const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export record recipe (JSON)' }).click()]);
  const recipe = JSON.parse(readFileSync((await json.path())!, 'utf-8'));
  expect(recipe.schemaVersion).toBe('1.0');
  expect(recipe.sourceStatus).toBe('verified_observations');
  expect(recipe.events).toHaveLength(24);
  expect(recipe.source.units).toBe('°C');
  expect(recipe.title).toBe('Test pressing');

  const [png] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save sleeve (PNG)' }).click()]);
  const bytes = readFileSync((await png.path())!);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  expect(bytes.readUInt32BE(16)).toBe(2400);

  if (info.project.name === 'desktop') {
    const [wav] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), page.getByRole('button', { name: 'Save audio (WAV)' }).click()]);
    const w = readFileSync((await wav.path())!);
    expect(w.subarray(0, 4).toString()).toBe('RIFF');
    expect(w.length).toBeGreaterThan(44 + 44100 * 2 * 2 * 10);
  }

  // kept on the shelf, also after a reload
  await page.goto('/#/library');
  await page.reload();
  await expect(page.locator('.shelf-item')).toHaveCount(1);
  await page.locator('.shelf-item').click();
  await expect(page.locator('.liner__title')).toHaveText('Test pressing');
});

test('land: the year dial has one spoke per real window and rests for QA gaps', async ({ page }) => {
  await page.goto('/#/studio/land');
  await expect(page.locator('.score__mark')).toHaveCount(23, { timeout: 20_000 });
  await page.locator('.place-option', { hasText: 'Harvard Forest' }).click();
  await expect(page.locator('.dial__spoke')).toHaveCount(23);
  await expect(page.locator('.score__mark.is-rest')).toHaveCount(2);
  await page.locator('.score__mark.is-rest').first().click();
  await expect(page.locator('.inspector')).toContainText('No valid measurement here');
  await page.locator('.score__mark').nth(10).click();
  await expect(page.locator('.inspector')).toContainText('NDVI');
  await page.locator('.inspector').getByText('Technical details').click();
  await expect(page.locator('.pixels__cell')).toHaveCount(81);
});

test('the short tour waits for the visitor: hear, notice, investigate', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Take the short tour' }).click();
  const tour = page.getByRole('region', { name: 'Short tour' });
  await expect(tour).toContainText('Hear this journey', { timeout: 20_000 });
  await page.getByRole('button', { name: /Hear this journey/ }).click();
  await expect(tour.getByRole('button', { name: 'Show me' })).toBeVisible({ timeout: 25_000 });
  await tour.getByRole('button', { name: 'Show me' }).click();
  await expect(page.locator('.inspector')).toContainText('°C');
  await expect(tour).toContainText('isn’t invented');
  await tour.getByRole('button', { name: 'Skip the tour' }).click();
  await expect(tour).toHaveCount(0);
});

test('deep links and the back button keep the journey', async ({ page }) => {
  await page.goto('/#/library');
  await page.locator('.choice--land').click();
  await expect(page).toHaveURL(/#\/studio\/land$/);
  await page.goBack();
  await expect(page).toHaveURL(/#\/library$/);
  await expect(page.getByRole('heading', { name: /Where shall/ })).toBeVisible();
});

test('reduced motion: the press becomes a direct reveal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openOceanStudio(page);
  await page.getByRole('button', { name: /Press my Earth Record/ }).click();
  await expect(page.getByRole('heading', { name: /It's yours/ })).toBeVisible({ timeout: 3_000 });
});

test('no horizontal overflow on any scene', async ({ page }) => {
  for (const h of ['/', '/#/library', '/#/studio/ocean', '/#/studio/land', '/#/method']) {
    await page.goto(h);
    await page.waitForTimeout(600);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over, h).toBeLessThanOrEqual(1);
  }
});
