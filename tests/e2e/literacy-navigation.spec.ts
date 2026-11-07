import { expect, test } from '@playwright/test';

test('an incorrect answer stays on screen until the pictorial next control is pressed', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: '游戏乐园', exact: true }).first().click();
  await page.getByRole('button', { name: '开始火眼金睛' }).click();
  await page.getByRole('button', { name: '开始挑战', exact: true }).click();
  const shapes = await page
    .locator('.odd-cell .shape')
    .evaluateAll((els) => els.map((el) => el.innerHTML));
  const common = shapes.find((shape) => shapes.filter((other) => other === shape).length > 1)!;
  await page.locator('.odd-cell').nth(shapes.indexOf(common)).click();
  await page.clock.runFor(5000);
  await expect(page.locator('.round-top>span').first()).toHaveText('第 1 / 6 轮');
  const next = page.getByRole('button', { name: '继续下一轮', exact: true });
  await expect(next.locator('svg')).toBeVisible();
  await next.click();
  await expect(page.locator('.round-top>span').first()).toHaveText('第 2 / 6 轮');
});

test('a caregiver selecting a daily picture starts that exact game', async ({ page }) => {
  await page.goto('/');
  const selected = page.locator('.daily-game').last();
  const name = await selected.locator('h3').innerText();
  await selected.click();
  await expect(page.locator('.player-header strong')).toHaveText(name);
});
