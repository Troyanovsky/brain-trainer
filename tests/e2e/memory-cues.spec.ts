import { expect, test } from '@playwright/test';

test('sequence completion fills all visual progress dots and mistakes show the correct picture sequence', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '游戏乐园', exact: true }).first().click();
  await page.getByRole('button', { name: '开始星光顺序' }).click();
  await page.evaluate(() => {
    (window as any).__shown = [];
    new MutationObserver((records) => {
      for (const record of records) {
        const element = record.target as Element;
        if (element.matches('.sequence-pad.flashing'))
          (window as any).__shown.push(
            Array.from(document.querySelectorAll('.sequence-pad')).indexOf(element),
          );
      }
    }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
  });
  await page.getByRole('button', { name: '开始挑战', exact: true }).click();
  await expect(page.locator('.sequence-pad').first()).toBeEnabled();
  const sequence = await page.evaluate(() => (window as any).__shown as number[]);
  expect(sequence).toHaveLength(2);
  for (const index of sequence) await page.locator('.sequence-pad').nth(index).click();
  await expect(page.locator('.sequence-progress .done')).toHaveCount(sequence.length);
  await page.evaluate(() => {
    (window as any).__shown = [];
  });
  await expect(page.locator('.round-top>span').first()).toHaveText('第 2 / 6 轮');
  await expect(page.locator('.sequence-pad').first()).toBeEnabled();
  const next = await page.evaluate(() => (window as any).__shown as number[]);
  await page
    .locator('.sequence-pad')
    .nth((next[0] + 1) % 4)
    .click();
  await expect(page.locator('.sequence-correction .shape')).toHaveCount(next.length);
});

test('a wrong tracking target has an X, not only a different color', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '游戏乐园', exact: true }).first().click();
  await page.getByRole('button', { name: '开始图案追踪' }).click();
  await page.getByRole('button', { name: '开始挑战', exact: true }).click();
  const target = await page.locator('.tracking-target .tracking-glyph').innerHTML();
  const glyphs = await page
    .locator('.number-cell .tracking-glyph')
    .evaluateAll((els) => els.map((el) => el.innerHTML));
  await page
    .locator('.number-cell')
    .nth(glyphs.findIndex((glyph) => glyph !== target))
    .click();
  await expect(page.locator('.number-cell.wrong .wrong-mark')).toBeVisible();
  await expect(page.locator('.tracking-target .tracking-glyph')).toHaveJSProperty(
    'innerHTML',
    target,
  );
});
