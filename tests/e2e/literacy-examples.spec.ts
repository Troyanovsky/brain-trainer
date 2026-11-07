import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('the pre-play quantity example teaches crossed-out objects as well as merging', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: '游戏乐园', exact: true }).first().click();
  await page.getByRole('button', { name: '开始点点合合', exact: true }).click();
  await expect(page.locator('.game-demo .removed-object')).toHaveCount(2);
  await expect(page.locator('.removal-example .remaining-pile .quantity-object')).toHaveCount(4);
  await mkdir('docs/screenshots/literacy', { recursive: true });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: 'docs/screenshots/literacy/math-demo.png', fullPage: true });
});

test('every demonstrated hand indicates the solved answer instead of another option', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '游戏乐园', exact: true }).first().click();
  for (const name of [
    '图形接龙',
    '点点规律',
    '火眼金睛',
    '缤纷找色',
    '大小速判',
    '图案追踪',
    '点点合合',
  ]) {
    await page.getByRole('button', { name: `开始${name}`, exact: true }).click();
    const hand = page.locator('.demo-board .lucide-hand');
    await expect(hand).toHaveCount(1);
    const target = await hand.evaluate((el) => {
      const button = el.closest('button');
      if (!button) return false;
      if (button.classList.contains('selected')) return true;
      const glyph = button.querySelector('.tracking-glyph');
      const target = document.querySelector('.demo-tracking-target .tracking-glyph');
      return Boolean(glyph && target && glyph.innerHTML === target.innerHTML);
    });
    expect(target, name).toBe(true);
    await page.getByRole('button', { name: '退出游戏', exact: true }).click();
  }
});
