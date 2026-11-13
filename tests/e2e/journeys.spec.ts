/**
 * End-to-end journeys (spec 17 / 11.2): story → inspect → compare → draw,
 * keyboard-only use, honesty labels, and no console errors.
 */
import { expect, test, type Page } from '@playwright/test';

const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
});
test.afterEach(() => expect(errors, errors.join('\n')).toEqual([]));

async function mapBox(page: Page) {
  await page.locator('.map-stage').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const box = await page.locator('.map-stage').boundingBox();
  if (!box) throw new Error('map not visible');
  return box;
}
/** Screen point of a lat/lon on the unzoomed equirectangular map. */
const at = (b: { x: number; y: number; width: number; height: number }, lat: number, lon: number) => ({
  x: b.x + ((lon + 180) / 360) * b.width,
  y: b.y + ((90 - lat) / 180) * b.height,
});

test('entry is silent, credited, and offers both paths', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /more than one way to understand a moving ocean/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Begin listening' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Explore directly' })).toBeVisible();
  await expect(page.getByText(/not endorsed by NASA/)).toBeVisible();
  await expect(page.locator('.banner-warn')).toHaveCount(0); // real data, not a fixture
});

test('guided story: passage plays, microscope explains the notable note, contrast compares A/B', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin listening' }).click();
  await expect(page).toHaveURL(/#\/story\/language/);
  await expect(page.getByText(/Illustrative musical mapping/)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).first().click();

  await expect(page).toHaveURL(/#\/story\/passage/);
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.waitForTimeout(1500);
  const time = await page.locator('.transport-time').innerText();
  expect(time).not.toMatch(/^0:00/);

  await page.getByRole('button', { name: 'Skip to the microscope' }).click();
  await expect(page).toHaveURL(/#\/story\/microscope/);
  const inspector = page.locator('.inspector');
  await expect(inspector.getByRole('heading', { name: 'Route point 58 of 64' })).toBeVisible();
  await expect(inspector.getByText('Visual-frame sonification · not a temperature measurement')).toBeVisible();
  await expect(inspector.getByText('Normalized palette position').first()).toBeVisible();
  await expect(inspector.locator('.value-strong')).toHaveText(/^\d\.\d{3} normalized, not °C$/);
  await inspector.getByText('See the mapping').click();
  await expect(inspector.getByText(/index = round/)).toBeVisible();

  await page.getByRole('button', { name: 'Continue the story' }).first().click();
  await expect(page).toHaveURL(/#\/story\/contrast/);
  await expect(inspector.getByRole('heading', { name: 'Route point 58 of 64' })).toBeVisible();
  await expect(inspector.getByText(/B − A =/)).toBeVisible();
  await expect(inspector.getByText(/normalized feature units, not °C/)).toBeVisible();
  await expect(page.locator('.timeline .tick')).toHaveCount(34); // 16 A + 2 silence + 16 B
});

test('keyboard only: start, play, pause, inspect a note from the timeline', async ({ page }) => {
  await page.goto('/#/explore');
  const play = page.getByRole('button', { name: 'Play', exact: true });
  await play.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.keyboard.press('Enter'); // focus stays on the same toggle
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

  await page.locator('.tick').first().focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.locator('.inspector').getByRole('heading', { name: 'Route point 6 of 64' })).toBeVisible();
});

test('keyboard map crosshair probes an arbitrary location', async ({ page }) => {
  await page.goto('/#/explore');
  await page.locator('.map-stage').focus();
  await page.keyboard.press('ArrowDown'); // crosshair appears at 20°N 40°W, moves to 19°N
  await page.keyboard.press('Enter');
  const inspector = page.locator('.inspector');
  await expect(inspector.getByRole('heading', { name: 'Probed point' })).toBeVisible();
  await expect(inspector.getByText('19.00°N, 40.00°W')).toBeVisible();
});

test('probe: land is a rest with a reason, ocean gives a value', async ({ page }) => {
  await page.goto('/#/explore');
  const b = await mapBox(page);
  const sahara = at(b, 24, 10);
  await page.mouse.click(sahara.x, sahara.y);
  const inspector = page.locator('.inspector');
  await expect(inspector.getByText(/land in the visualization/)).toBeVisible();
  const pacific = at(b, 5, -140);
  await page.mouse.click(pacific.x, pacific.y);
  await expect(inspector.locator('.value-strong')).toContainText(/0\.\d{3}/);
});

test('draw: a drawn route becomes 64 points with play / reverse / clear', async ({ page }) => {
  await page.goto('/#/explore');
  await page.getByRole('radio', { name: 'Draw' }).click();
  const b = await mapBox(page);
  const p0 = at(b, -30, -150);
  const p1 = at(b, 30, -150);
  await page.mouse.move(p0.x, p0.y);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) await page.mouse.move(p0.x, p0.y + ((p1.y - p0.y) * i) / 30);
  await page.mouse.up();
  await expect(page.getByText('Your path is ready to hear.')).toBeVisible();
  await expect(page.locator('.timeline .tick')).toHaveCount(64);
  const before = await page.locator('.timeline').innerHTML();
  await page.getByRole('button', { name: 'Reverse' }).click();
  await expect.poll(() => page.locator('.timeline').innerHTML()).not.toBe(before);
  await page.getByRole('button', { name: 'Play this route' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByText('Your path is ready to hear.')).toHaveCount(0);
});

test('navigate never makes a selection', async ({ page }) => {
  await page.goto('/#/explore');
  await page.getByRole('radio', { name: 'Navigate' }).click();
  const b = await mapBox(page);
  const p = at(b, 5, -140);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('.inspector')).toHaveCount(0);
});

test('compare: A/B keeps the sample index; spatial fallback compares two places', async ({ page }) => {
  await page.goto('/#/compare');
  await page.locator('.tick').nth(20).click();
  const inspector = page.locator('.inspector');
  await expect(inspector.getByRole('heading', { name: 'Route point 21 of 64' })).toBeVisible();
  await page.getByRole('radio', { name: /^B/ }).click();
  await expect(inspector.getByRole('heading', { name: 'Route point 21 of 64' })).toBeVisible();
  await expect(page.locator('.frame-strip')).toContainText('Frame B: 6 Feb 2008');

  await page.getByRole('radio', { name: 'Two places' }).click();
  const b = await mapBox(page);
  for (const [lat, lon] of [[0, -140], [40, -40]] as const) {
    const p = at(b, lat, lon);
    await page.mouse.click(p.x, p.y);
  }
  await expect(inspector.getByText('Place A')).toBeVisible();
  await expect(inspector.getByText('Place B')).toBeVisible();
  await expect(inspector.getByText(/B − A =/)).toBeVisible();
});

test('method page lists sources, validation and the transcript', async ({ page }) => {
  await page.goto('/#/method');
  await expect(page.getByRole('heading', { name: 'How this sound was made' })).toBeVisible();
  await expect(page.getByText(/24\/24 landmark checks/).first()).toBeVisible();
  await expect(page.locator('.resources li')).toHaveCount(11);
  await expect(page.locator('.transcript li')).toHaveCount(7);
});

test('deep links survive refresh', async ({ page }) => {
  await page.goto('/#/story/microscope');
  await expect(page.getByRole('heading', { name: 'Where did that note come from?' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Where did that note come from?' })).toBeVisible();
});
