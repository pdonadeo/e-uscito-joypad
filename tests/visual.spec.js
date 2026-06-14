// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const screenshotsDir = path.join(__dirname, '..', 'screenshots');

test.beforeAll(() => {
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
});

test('homepage screenshot e verifica search bar', async ({ page, browserName }, testInfo) => {
  const deviceName = testInfo.project.name.replace(/\s+/g, '-');

  await page.goto('/', { waitUntil: 'networkidle' });

  // Screenshot full-page
  await page.screenshot({
    path: path.join(screenshotsDir, `${deviceName}.png`),
    fullPage: true,
  });

  // Screenshot viewport-only (quello che l'utente vede realmente)
  await page.screenshot({
    path: path.join(screenshotsDir, `${deviceName}-viewport.png`),
    fullPage: false,
  });

  // La search bar deve essere visibile
  const searchBar = page.locator('[class*="searchBar"]').first();
  await expect(searchBar).toBeVisible({ timeout: 10000 });

  // Su mobile: la larghezza della search bar deve coprire (quasi) tutta la larghezza del viewport
  const viewport = page.viewportSize();
  if (viewport && viewport.width < 920) {
    const box = await searchBar.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const coverage = box.width / viewport.width;
      expect(coverage).toBeGreaterThanOrEqual(0.95);
    }
  }
});
