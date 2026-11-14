/**
 * End-to-end journeys for Earth Records (brief sections 12, 15 and 16):
 * invitation -> library -> studio -> listen -> inspect -> draw -> press -> reveal -> export,
 * the land year dial, keyboard use, persistence, deep links, reduced motion,
 * responsive layout and no console errors.
 */
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const errors: string[] = [];
// a 1×1 transparent PNG stands in for NASA GIBS pictures, so tests never depend on the network
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
/** Answers the ORNL MODIS subset service from the pipeline's own raw responses for Sahel Dahra. */
function modisFixture() {
  const raw = JSON.parse(readFileSync('data-raw/modis/sahel-dahra.json', 'utf-8'));
  return (url: string) => {
    const q = new URL(url).searchParams;
    const band = raw.bands[q.get('band')!];
    const a = q.get('startDate')!, b = q.get('endDate')!;
    return { ...band.meta, subset: band.subset.filter((r: { modis_date: string }) => r.modis_date >= a && r.modis_date <= b) };
  };
}
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  await page.route('https://gibs.earthdata.nasa.gov/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  const modis = modisFixture();
  await page.route('https://modis.ornl.gov/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(modis(r.request().url())) }));
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
  await expect(page.getByRole('button', { name: /Begin the narrated journey/ })).toBeVisible();
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

test('library: two playable sides, no placeholder records', async ({ page }) => {
  await page.goto('/#/library');
  await expect(page.locator('.choice')).toHaveCount(2);
  await expect(page.getByText(/Landscape Interrupted|not playable/)).toHaveCount(0);
  await page.locator('.choice--ocean').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/studio\/ocean$/);
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
  await page.locator('.atlas__svg').scrollIntoViewIfNeeded(); // on phones the button sits below the map
  await page.evaluate(() => window.scrollTo(0, 0));
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
    const [wav] = await Promise.all([page.waitForEvent('download', { timeout: 90_000 }), page.getByRole('button', { name: 'Save audio (WAV)' }).click()]);
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

/** 'fast' = test-speed captions without voice; 'captions' = real pacing, voice off. */
async function guideMode(page: Page, mode: 'fast' | 'captions') {
  await page.evaluate((m) => {
    if (m === 'fast') localStorage.setItem('earth-records:guide-test', 'fast');
    else localStorage.setItem('earth-records:guide:v1', JSON.stringify({ voice: false, rate: 1, level: 0.9, voiceURI: null }));
  }, mode);
  await page.reload();
}

test('narrated journey: one click, then it runs by itself to the baton handover', async ({ page }) => {
  test.setTimeout(120_000);
  await guideMode(page, 'fast');
  await page.getByRole('button', { name: /Begin the narrated journey/ }).click();
  const guide = page.getByRole('region', { name: 'Narrated journey' });
  await expect(guide).toBeVisible();
  await expect(page).toHaveURL(/#\/library$/, { timeout: 20_000 });
  await expect(page).toHaveURL(/#\/studio\/ocean$/, { timeout: 20_000 });
  // the planned discovery: the music stops on the real contrast and the note is inspected
  await expect(page.locator('.score__mark.is-selected')).toHaveCount(1, { timeout: 40_000 });
  await expect(page.locator('.inspector')).toContainText('°C');
  // the performance resumes and ends, the host hands over the baton: one next action
  await expect(guide.getByRole('button', { name: /Draw your own route/ })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.score__mark')).toHaveCount(24);
  await guide.getByRole('button', { name: /Draw your own route/ }).click();
  await expect(guide.getByRole('button', { name: /Press my Earth Record/ })).toBeVisible();
});

test('narrated journey: the visitor’s choice wins, captions run with the voice off, pause holds', async ({ page }) => {
  test.setTimeout(120_000);
  await guideMode(page, 'captions');
  await page.getByRole('button', { name: /Begin the narrated journey/ }).click();
  const guide = page.getByRole('region', { name: 'Narrated journey' });
  await expect(guide).toContainText('Welcome.');
  await guide.getByRole('button', { name: 'Pause the journey' }).click();
  await expect(guide.getByRole('button', { name: 'Resume the journey' })).toBeVisible();
  await expect(guide).toContainText('paused');
  await page.waitForTimeout(2500);
  await expect(page).toHaveURL(/\/(#\/)?$/); // still on the invitation
  await guide.getByRole('button', { name: 'Resume the journey' }).click();
  await expect(page).toHaveURL(/#\/library$/, { timeout: 40_000 });
  await expect(guide).toContainText('We could begin anywhere.', { timeout: 10_000 });
  await page.locator('.choice--land').click();
  await expect(page).toHaveURL(/#\/studio\/land$/);
  // the land story begins (its acknowledgement or its first lines, depending on machine speed)
  await expect(guide).toContainText(/A year in one place\.|A fine choice\.|Now we stay in one place|move around us|Every sixteen days|Listen\./, { timeout: 15_000 });
  await page.waitForTimeout(9000); // the cancelled ocean line must never take them anywhere
  await expect(page).toHaveURL(/#\/studio\/land$/);
  await guide.getByRole('button', { name: 'End the narrated journey' }).click();
  await expect(guide).toHaveCount(0);
});

test('any place: a click on the land map fetches that point’s year and the picture follows the music', async ({ page }) => {
  await page.goto('/#/studio/land');
  await expect(page.locator('.score__mark')).toHaveCount(23, { timeout: 20_000 });
  await page.locator('.dial__spoke').first().waitFor({ state: 'attached' });
  await page.waitForTimeout(800); // let the dial settle
  // a point on the open map (not on the year dial or a label)
  const spot = await page.evaluate(() => {
    const svg = document.querySelector('.land__svg')!.getBoundingClientRect();
    for (const [fx, fy] of [[0.1, 0.5], [0.9, 0.5], [0.5, 0.1], [0.5, 0.9], [0.15, 0.85], [0.85, 0.15], [0.3, 0.35]]) {
      const x = svg.left + svg.width * fx, y = svg.top + svg.height * fy;
      const el = document.elementFromPoint(x, y);
      if (el && el.closest('.land__svg') && !el.closest('.dial, .land__place')) return { x, y };
    }
    return null;
  });
  expect(spot).not.toBeNull();
  await page.mouse.click(spot!.x, spot!.y);
  await expect(page.locator('.place-option.is-on')).toContainText('Your chosen place');
  await expect(page.locator('.place-option.is-on')).toContainText(/\d+ of 23 windows passed/, { timeout: 20_000 });
  await expect(page.locator('.score__mark')).toHaveCount(23);
  await expect(page.locator('.land__ndvi')).not.toHaveCount(0);
  const first = await page.locator('.land__picture-date').textContent();
  await page.locator('.score__mark').nth(12).click();
  await expect(page.locator('.land__picture-date')).not.toHaveText(first!);
  // keyboard path: coordinates
  await page.getByLabel('Latitude, −85 to 85').fill('15.4');
  await page.getByLabel('Longitude, −180 to 180').fill('-15.4');
  await page.getByRole('button', { name: 'Listen here' }).click();
  await expect(page.locator('.place-option.is-on')).toContainText('15.40°N', { timeout: 20_000 });
});

test('playback keeps time on a slow, busy device (4× CPU throttle) and the score is never covered', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'CPU throttling via CDP is Chromium desktop only');
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1366, height: 657 });
  await page.goto('/#/studio/land');
  await expect(page.locator('.score__mark')).toHaveCount(23, { timeout: 20_000 });
  // the map ends where the score begins (laptop-height window)
  const [stage, score] = await Promise.all([page.locator('.studio__stage').boundingBox(), page.locator('.studio__score').boundingBox()]);
  expect(stage!.y + stage!.height).toBeLessThanOrEqual(score!.y + 1);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now();
  await page.getByRole('button', { name: /Hear this journey/ }).click();
  await expect(page.getByRole('button', { name: /^Pause/ })).toBeVisible({ timeout: 30_000 });
  // every window is reached in order, through to the last one
  await expect.poll(() => page.locator('.score__mark.is-played').count(), { timeout: 25_000, intervals: [200] }).toBeGreaterThan(18);
  // 23 windows at 0.5 s + 3 beats of tail ≈ 13 s (plus unlocking sound); the page is slowed, the music is not
  await expect(page.getByRole('button', { name: /Hear this journey/ })).toBeVisible({ timeout: 40_000 });
  const seconds = (Date.now() - t0) / 1000;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  expect(seconds).toBeGreaterThan(12.5);
  expect(seconds).toBeLessThan(30);
});

/** Listen to everything that reaches the speakers: window.__peaks gets the peak of every 100 ms. */
async function listen(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __peaks: number[] };
    w.__peaks = [];
    const orig = AudioNode.prototype.connect as (...a: unknown[]) => unknown;
    (AudioNode.prototype as unknown as { connect: unknown }).connect = function (this: AudioNode, dest: unknown, ...rest: unknown[]) {
      const ctx = this.context as BaseAudioContext & { __an?: AnalyserNode };
      if (dest instanceof AudioDestinationNode && !(ctx instanceof OfflineAudioContext)) {
        if (!ctx.__an) {
          const an = ctx.createAnalyser();
          an.fftSize = 4096;
          ctx.__an = an;
          const buf = new Float32Array(4096);
          setInterval(() => {
            an.getFloatTimeDomainData(buf);
            let p = 0;
            for (const x of buf) p = Math.max(p, Math.abs(x));
            w.__peaks.push(p);
          }, 100);
        }
        orig.call(this, ctx.__an);
      }
      return orig.call(this, dest, ...rest);
    };
  });
}

test('the music is clearly audible from the first note and never clips', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one audio level check is enough');
  test.setTimeout(60_000);
  // listen to everything that reaches the speakers
  await listen(page);
  await page.goto('/#/studio/ocean');
  await page.reload();
  await expect(page.locator('.score__mark')).toHaveCount(24, { timeout: 20_000 });
  await page.getByRole('button', { name: /Hear this journey/ }).click();
  await page.waitForTimeout(2500); // the opening: the melody alone
  const opening = await page.evaluate(() => Math.max(...(window as unknown as { __peaks: number[] }).__peaks));
  await page.waitForTimeout(6000); // the full ensemble
  const all = await page.evaluate(() => Math.max(...(window as unknown as { __peaks: number[] }).__peaks));
  const db = (x: number) => 20 * Math.log10(x);
  expect(db(opening)).toBeGreaterThan(-12); // clearly audible at an ordinary volume
  expect(db(all)).toBeGreaterThan(-8);
  expect(db(all)).toBeLessThan(-0.5); // never clips
});

test('the narrated journey music is audible after "Listen."', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one audio level check is enough');
  test.setTimeout(120_000);
  await listen(page);
  await guideMode(page, 'fast');
  await page.getByRole('button', { name: /Begin the narrated journey/ }).click();
  // the studio's own play button switches to Pause when the tour starts the music
  await page.locator('.panel-actions .cta', { hasText: 'Pause' }).waitFor({ timeout: 60_000 });
  await page.evaluate(() => ((window as unknown as { __peaks: number[] }).__peaks = []));
  // (test speed: the host's lines take a fraction of a second here, so allow for the
  // record's background render; at real speaking pace it is ready long before "Listen.")
  await expect
    .poll(() => page.evaluate(() => Math.max(0, ...(window as unknown as { __peaks: number[] }).__peaks)), { timeout: 8000 })
    .toBeGreaterThan(0.18);
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
