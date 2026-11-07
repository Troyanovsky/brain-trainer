import { expect, test } from '@playwright/test';
test('garden illustration fits its viewBox', async ({ page }) => {
  await page.goto('/');
  const box = await page.locator('.garden-art').evaluate((el) => {
    const b = (el as SVGGraphicsElement).getBBox();
    return { x: b.x, y: b.y, right: b.x + b.width, bottom: b.y + b.height };
  });
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(480);
  expect(box.bottom).toBeLessThanOrEqual(300);
});
