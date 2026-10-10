// Phase 1 acceptance test: mobile nav + logo deduplication
// Run: npx playwright test tests/mobile-layout.spec.js
const { test, expect } = require('@playwright/test');

const VIEWPORTS = [
  { width: 375, height: 667, name: 'iPhone SE' },
  { width: 390, height: 844, name: 'iPhone 14' },
];

for (const vp of VIEWPORTS) {
  test(`mobile layout at ${vp.name} (${vp.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('https://cumulativeweb.com/index.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // let JS render tabbar

    // 1. Exactly ONE visible logo
    const logos = await page.locator('img[src*="cwi-logo"]').all();
    let visibleCount = 0;
    for (const logo of logos) {
      if (await logo.isVisible()) visibleCount++;
    }
    expect(visibleCount, `Expected 1 visible logo at ${vp.width}px, found ${visibleCount}`).toBe(1);

    // 2. Tabbar nav items: icon and label bounding boxes must not overlap
    const tabItems = await page.locator('.tabbar a').all();
    expect(tabItems.length).toBeGreaterThan(0);

    for (const item of tabItems) {
      const icon = item.locator('svg');
      const label = item.locator('.tab-label');
      if (await icon.count() === 0 || await label.count() === 0) continue;

      const iconBox = await icon.boundingBox();
      const labelBox = await label.boundingBox();
      if (!iconBox || !labelBox) continue;

      const overlapX = Math.max(0, Math.min(iconBox.x + iconBox.width, labelBox.x + labelBox.width) - Math.max(iconBox.x, labelBox.x));
      const overlapY = Math.max(0, Math.min(iconBox.y + iconBox.height, labelBox.y + labelBox.height) - Math.max(iconBox.y, labelBox.y));
      const overlapArea = overlapX * overlapY;
      expect(overlapArea, `Icon/label overlap in tabbar at ${vp.width}px`).toBe(0);

      // 3. Tap target >= 44px
      const itemBox = await item.boundingBox();
      expect(itemBox.height, `Tap target height at ${vp.width}px`).toBeGreaterThanOrEqual(44);
    }
  });
}

test('desktop layout unchanged at 1280px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('https://cumulativeweb.com/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Tabbar hidden on desktop, sidebar visible
  const tabbar = page.locator('.tabbar');
  await expect(tabbar).toBeHidden();
  const sidebar = page.locator('.sidebar');
  await expect(sidebar).toBeVisible();
});
