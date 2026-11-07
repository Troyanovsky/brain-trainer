import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('main screens and dialogs meet automated WCAG AA checks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const name of ['今日训练', '游戏乐园', '成长足迹']) {
    await page.getByRole('button', { name, exact: true }).first().click();
    const scan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect
      .soft(
        scan.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
        name,
      )
      .toEqual([]);
  }
  await page.getByRole('button', { name: '管理用户档案' }).first().click();
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect
    .soft(
      scan.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
    )
    .toEqual([]);
});

test('game introduction, play, pause, and result meet automated WCAG AA checks', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '游戏乐园', exact: true }).first().click();
  await page.getByRole('button', { name: '开始反向指令' }).click();
  async function scan(name: string) {
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect
      .soft(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
        name,
      )
      .toEqual([]);
  }
  await scan('游戏演示');
  await page.getByRole('button', { name: '开始挑战', exact: true }).click();
  await scan('游戏棋盘');
  await page.getByRole('button', { name: '暂停游戏' }).click();
  await scan('暂停弹窗');
  await page.getByRole('button', { name: '继续挑战', exact: true }).click();
  for (let round = 0; round < 6; round++) {
    await expect(page.locator('.round-top>span').first()).toHaveText(`第 ${round + 1} / 6 轮`);
    await page.locator('.answer-option').first().click();
    const next = page.getByRole('button', { name: /^(继续下一轮|查看本场结果)$/ });
    if (await next.isVisible()) await next.click();
  }
  await expect(page.locator('.game-result')).toBeVisible();
  await scan('游戏结算');
});
