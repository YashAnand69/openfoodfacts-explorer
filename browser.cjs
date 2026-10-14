const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' });
  page.setDefaultTimeout(30000);
  const failures = [];
  page.on('pageerror', e => failures.push(e.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    let body = {};
    if (url.pathname.endsWith('/languages.json')) body = {
      'en:english': { language_code_2: { en: 'en' }, name: { en: 'English' } },
      'en:french': { language_code_2: { en: 'fr' }, name: { en: 'French', fr: 'Français' } }
    };
    if (url.pathname.endsWith('/countries.json')) body = {
      'en:world': { country_code_2: { en: 'world' }, name: { en: 'World' } },
      'en:france': { country_code_2: { en: 'fr' }, name: { en: 'France' } },
      'en:india': { country_code_2: { en: 'in' }, name: { en: 'India' } },
      'en:united-states': { country_code_2: { en: 'us' }, name: { en: 'United States' } }
    };
    if (url.pathname.includes('/api/schema')) body = { components: { schemas: { CurrencyEnum: { enum: ['USD', 'EUR', 'INR'] } } } };
    if (url.pathname.includes('attribute_groups')) body = { attribute_groups: [] };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:5193'}/settings`);
  await page.locator('label[for="tab-general"]').click();
  const selectors = page.locator('#tabpanel-general button[aria-haspopup="dialog"]');
  await selectors.first().waitFor();
  assert.equal(await selectors.count(), 3);
  assert.equal(await page.locator('#tabpanel-general dialog').count(), 3);
  assert.equal(await page.locator('#tabpanel-general dialog').evaluateAll(nodes => new Set(nodes.map(n => n.id)).size), 3);
  const prefs = () => page.evaluate(() => JSON.parse(localStorage.getItem('preferences')));

  const country = selectors.nth(1);
  await country.click();
  let dialog = page.locator('dialog[open]');
  let search = dialog.getByRole('textbox');
  assert.equal(await dialog.getByRole('button', { name: 'World - world', exact: true }).count(), 1);
  await search.press('ArrowUp');
  await search.press('ArrowDown');
  await search.press('ArrowDown');
  await search.fill('iNdIa');
  assert.equal(await dialog.getByRole('button', { name: 'India - in', exact: true }).count(), 1);
  assert.equal(await dialog.getByRole('button', { name: 'France - fr', exact: true }).count(), 0);
  await search.press('ArrowDown');
  await search.press('Enter');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('preferences')).country === 'in');
  assert.equal(await country.innerText(), 'India');

  await country.click();
  dialog = page.locator('dialog[open]');
  search = dialog.getByRole('textbox');
  await search.fill('nothing_matches_this');
  await dialog.getByText('No matching options').waitFor();
  await search.press('Enter');
  assert.equal((await prefs()).country, 'in');
  assert.equal(await page.locator('dialog[open]').count(), 1);
  await search.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  assert.equal(await country.evaluate(el => document.activeElement === el), true);
  await country.click();
  assert.equal(await page.locator('dialog[open] input').inputValue(), '');
  await page.locator('dialog[open]').getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal((await prefs()).country, 'in');

  await selectors.nth(2).click();
  dialog = page.locator('dialog[open]');
  await dialog.getByRole('textbox').fill('inr');
  await dialog.getByRole('textbox').press('Enter');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('preferences')).currency === 'INR');

  await selectors.nth(2).click();
  dialog = page.locator('dialog[open]');
  await dialog.getByRole('textbox').fill('not-a-currency');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal((await prefs()).currency, 'INR');

  await page.setViewportSize({ width: 390, height: 844 });
  await country.click();
  dialog = page.locator('dialog[open]');
  const box = await dialog.locator('.modal-box').boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 390);
  await dialog.getByRole('textbox').fill('world');
  await page.screenshot({ path: path.join(__dirname, 'mobile-country.png'), animations: 'disabled' });
  await dialog.getByRole('button', { name: 'World - world', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('preferences')).country === 'world');

  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await country.click();
  dialog = page.locator('dialog[open]');
  await dialog.getByRole('textbox').fill('in');
  await dialog.getByRole('button', { name: 'India - in', exact: true }).focus();
  await page.keyboard.press('Tab');
  assert.equal(await dialog.evaluate(d => d.contains(document.activeElement)), true);
  await page.screenshot({ path: path.join(__dirname, 'mobile-dark-country.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  assert.equal((await prefs()).country, 'world');
  await page.emulateMedia({ colorScheme: 'light' });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await selectors.first().click();
  dialog = page.locator('dialog[open]');
  await dialog.getByRole('textbox').fill('Français');
  await page.screenshot({ path: path.join(__dirname, 'desktop-language.png'), animations: 'disabled' });
  await dialog.getByRole('textbox').press('Enter');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('preferences')).locale === 'fr');
  await page.reload();
  await page.locator('label[for="tab-general"]').click();
  assert.equal((await prefs()).locale, 'fr');
  assert.equal((await prefs()).country, 'world');
  assert.equal((await prefs()).currency, 'INR');
  assert.match(await selectors.first().innerText(), /French/);
  assert.equal(await selectors.nth(2).innerText(), 'INR');
  assert.deepEqual(failures, []);
  console.log('PASS: 3 selectors; case-insensitive names/codes; duplicate world; unique dialog IDs; dark mobile; focus trapping; keyboard boundaries; no-results; cancel/Escape/focus; reopen reset; mobile fit; world; localized labels; persisted locale/country/currency; no page errors.');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
