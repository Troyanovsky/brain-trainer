import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const KEY = 'brain-garden-store';
const LEGACY_KEY = 'brain-garden-v1';
const names: Record<string, string> = {
  tiles: '记忆闪格',
  sequence: '星光顺序',
  pattern: '图形接龙',
  numbers: '点点规律',
  odd: '火眼金睛',
  stroop: '缤纷找色',
  compare: '大小速判',
  schulte: '图案追踪',
  math: '点点合合',
  flip: '反向指令',
};
async function seed(
  page: Page,
  {
    daily = false,
    level = 1,
    sound = false,
  }: { daily?: boolean; level?: number; sound?: boolean } = {},
) {
  await page.addInitScript(
    ({ key, daily, level, sound }) => {
      if (localStorage.getItem(key)) return;
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const ids = [
        'tiles',
        'sequence',
        'pattern',
        'numbers',
        'odd',
        'stroop',
        'compare',
        'schulte',
        'math',
        'flip',
      ];
      const history =
        level > 1
          ? ids.map((gameId) => ({
              id: `old-${gameId}`,
              gameId,
              level: level - 1,
              rulesVersion: ['numbers', 'stroop', 'compare', 'schulte', 'math', 'flip'].includes(
                gameId,
              )
                ? 2
                : 1,
              score: 100,
              correct: 6,
              rounds: 6,
              completedAt: new Date(now.getTime() - 86400000 * 10).toISOString(),
              duration: 1000,
              mode: 'free',
            }))
          : [];
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          activeProfileId: 'test-profile',
          profiles: [
            {
              id: 'test-profile',
              name: '小花',
              avatar: 0,
              settings: { sound, reducedMotion: true },
              history,
              plans: daily
                ? {
                    [date]: {
                      date,
                      gameIds: ['tiles', 'pattern', 'odd', 'compare'],
                      completedIds: [],
                    },
                  }
                : {},
            },
          ],
        }),
      );
    },
    { key: LEGACY_KEY, daily, level, sound },
  );
}
async function installSequenceObserver(page: Page) {
  await page.evaluate(() => {
    (window as any).__flashes = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const el = record.target as HTMLElement;
        if (el.matches?.('.sequence-pad.flashing'))
          (window as any).__flashes.push(
            Array.from(document.querySelectorAll('.sequence-pad')).indexOf(el),
          );
      }
    });
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  });
}
async function solveGame(page: Page, id: string, wrong = false, capture = false) {
  if (id === 'sequence') await installSequenceObserver(page);
  await page.getByRole('button', { name: '开始挑战', exact: true }).click();
  if (capture) {
    await mkdir('docs/screenshots/literacy', { recursive: true });
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `docs/screenshots/literacy/${id}.png`, fullPage: true });
  }
  const rounds = id === 'schulte' ? 3 : 6;
  expect((await page.locator('.game-board').innerText()).replace(/\s/g, '')).not.toMatch(
    /[\p{Script=Han}0-9]/u,
  );
  for (let round = 0; round < rounds; round++) {
    await expect(page.locator('.round-top>span').first()).toHaveText(
      `第 ${round + 1} / ${rounds} 轮`,
    );
    if (id === 'tiles') {
      await expect(page.locator('.tile.revealed').first()).toBeVisible();
      const targets = await page
        .locator('.tile.revealed')
        .evaluateAll((els) => els.map((el) => Array.from(el.parentElement!.children).indexOf(el)));
      await expect(page.locator('.tile').first()).toBeEnabled();
      for (const i of targets) await page.locator('.tile').nth(i).click();
    } else if (id === 'sequence') {
      await expect(page.locator('.sequence-pad').first()).toBeEnabled();
      const sequence = await page.evaluate(() => (window as any).__flashes as number[]);
      expect(sequence.length).toBeGreaterThanOrEqual(2);
      for (const index of sequence) await page.locator('.sequence-pad').nth(index).click();
      await page.evaluate(() => {
        (window as any).__flashes = [];
      });
    } else if (id === 'odd') {
      const items = await page
        .locator('.odd-cell .shape')
        .evaluateAll((els) =>
          els.map((el) => `${el.innerHTML}:${(el as HTMLElement).style.transform}`),
        );
      const answer = items.findIndex((item) => items.filter((v) => v === item).length === 1);
      await page
        .locator('.odd-cell')
        .nth(wrong ? (answer + 1) % items.length : answer)
        .click();
    } else if (id === 'schulte') {
      const count = await page.locator('.number-cell').count();
      for (let n = 0; n < count; n++) {
        const target = await page.locator('.tracking-target .tracking-glyph').innerHTML();
        const remaining = page.locator('.number-cell:not(:disabled)');
        const pictures = await remaining
          .locator('.tracking-glyph')
          .evaluateAll((els) => els.map((el) => el.innerHTML));
        expect(pictures.indexOf(target)).toBeGreaterThanOrEqual(0);
        await remaining.nth(pictures.indexOf(target)).click();
      }
    } else {
      let answer = 0;
      const options = await page.locator('.answer-option').allTextContents();
      const quantities = await page
        .locator('.answer-option')
        .evaluateAll((els) => els.map((el) => el.querySelectorAll('.quantity-object').length));
      if (id === 'pattern') {
        const first = await page.locator('.question-pattern .shape').first().innerHTML();
        const shapes = await page
          .locator('.answer-option .shape')
          .evaluateAll((els) => els.map((el) => el.innerHTML));
        answer = shapes.indexOf(first);
      } else if (id === 'numbers') {
        const counts = await page
          .locator('.question-pattern>span:has(.pip-group)')
          .evaluateAll((els) => els.map((el) => el.querySelectorAll('.quantity-object').length));
        const delta = counts[3] - counts[2],
          increment = delta - (counts[2] - counts[1]);
        answer = quantities.indexOf(counts[3] + delta + increment);
      } else if (id === 'math')
        answer = quantities.indexOf(await page.locator('.source-groups .quantity-object').count());
      else if (id === 'compare') answer = quantities[0] > quantities[1] ? 0 : 1;
      else if (id === 'stroop') {
        const color = await page.locator('.color-target .shape').getAttribute('fill');
        const colors = await page
          .locator('.answer-option .shape')
          .evaluateAll((els) => els.map((el) => el.getAttribute('fill')));
        answer = colors.indexOf(color);
      } else if (id === 'flip') {
        const arrow = await page.locator('.question-prompt').innerText();
        const rule = await page.locator('.active-rule .rule-badge g path').last().getAttribute('d');
        const opposite: Record<string, string> = {
          '←': '→',
          '→': '←',
          '↑': '↓',
          '↓': '↑',
          '↖': '↘',
          '↘': '↖',
          '↗': '↙',
          '↙': '↗',
        };
        answer = options.indexOf(rule?.startsWith('M51 25') ? opposite[arrow] : arrow);
      }
      expect(answer, `solvable ${id}`).toBeGreaterThanOrEqual(0);
      await page
        .locator('.answer-option')
        .nth(wrong ? (answer + 1) % options.length : answer)
        .click();
    }
    const continueButton = page.getByRole('button', { name: /^(继续下一轮|查看本场结果)$/ });
    if (await continueButton.isVisible()) await continueButton.click();
    if (round < rounds - 1)
      await expect(page.locator('.round-top>span').first()).toHaveText(
        `第 ${round + 2} / ${rounds} 轮`,
      );
  }
  await expect(page.locator('.game-result')).toBeVisible();
  await expect(page.locator('.result-details>div').first()).toContainText(wrong ? '0' : '100');
}

test('complete all ten games without reading or sound and persist distinct real scores', async ({
  page,
}) => {
  test.setTimeout(240000);
  await seed(page);
  await page.goto('/');
  await maskReading(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [id, name] of Object.entries(names)) {
    await page.getByRole('button', { name: '游戏乐园', exact: true }).first().click();
    await page.getByRole('button', { name: `开始${name}`, exact: true }).click();
    await solveGame(page, id);
    await page.getByRole('button', { name: '返回花园', exact: true }).click();
  }
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).store, KEY);
  expect(stored.profiles[0].history).toHaveLength(10);
  expect(new Set(stored.profiles[0].history.map((r: any) => r.gameId)).size).toBe(10);
  expect(stored.profiles[0].history.every((r: any) => r.score > 0 && r.correct === r.rounds)).toBe(
    true,
  );
  await page.reload();
  await page.getByRole('button', { name: '成长足迹', exact: true }).first().click();
  await expect(page.locator('.summary-card').first()).toContainText('10');
  await expect(page.locator('.achievement.unlocked')).toHaveCount(4);
  expect(errors).toEqual([]);
});

test('daily journey resumes after refresh, completes four skills and celebrates', async ({
  page,
}) => {
  test.setTimeout(150000);
  await seed(page, { daily: true });
  await page.goto('/');
  await maskReading(page);
  await page.getByRole('button', { name: '开始今日训练', exact: true }).click();
  await solveGame(page, 'tiles');
  await page.getByRole('button', { name: '返回花园', exact: true }).click();
  await expect(page.locator('.hero-progress')).toHaveText('1 / 4 已完成');
  await page.reload();
  await expect(page.locator('.hero-progress')).toHaveText('1 / 4 已完成');
  await page.getByRole('button', { name: '继续今日训练', exact: true }).click();
  for (const id of ['pattern', 'odd', 'compare']) {
    await solveGame(page, id);
    await page
      .getByRole('button', { name: id === 'compare' ? '完成今日训练' : '下一项训练', exact: true })
      .click();
  }
  await expect(page.getByRole('dialog')).toContainText('四项训练，全部完成');
  await page.getByRole('button', { name: '看看我的成长' }).click();
  await expect(page.locator('.summary-card').first()).toContainText('4');
  const history = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).store.profiles[0].history,
    KEY,
  );
  expect(history.every((r: any) => r.mode === 'daily')).toBe(true);
});

test('profiles create edit switch delete and isolate history and settings', async ({ page }) => {
  await seed(page, { sound: true });
  await page.goto('/');
  await page.getByRole('button', { name: '管理用户档案' }).first().click();
  await page.getByRole('button', { name: '添加新档案' }).click();
  await page.getByRole('textbox', { name: '怎么称呼你？' }).fill('小树');
  await page.getByRole('button', { name: '紫丁香' }).click();
  await page.getByRole('button', { name: '开启新花园' }).click();
  await page.getByRole('button', { name: '编辑小树' }).click();
  await page.getByRole('textbox', { name: '怎么称呼你？' }).fill('大树');
  await page.getByRole('button', { name: '保存修改' }).click();
  await page.getByRole('button', { name: '当前档案的偏好设置' }).click();
  await page.getByRole('button', { name: '轻快音效' }).click();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '游戏乐园', exact: true }).first().click();
  await page.getByRole('button', { name: '开始大小速判', exact: true }).click();
  await solveGame(page, 'compare');
  await page.getByRole('button', { name: '返回花园' }).click();
  await page.getByRole('button', { name: '管理用户档案' }).first().click();
  await page.getByRole('button', { name: '切换到小花', exact: true }).click();
  await page.getByRole('button', { name: '成长足迹', exact: true }).first().click();
  await expect(page.locator('.summary-card').first()).toContainText('0');
  let data = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).store, KEY);
  expect(data.profiles[0].history).toHaveLength(0);
  expect(data.profiles[1].history).toHaveLength(1);
  expect(data.profiles[1].settings.sound).toBe(false);
  expect(data.profiles[0].settings.sound).toBe(true);
  await page.getByRole('button', { name: '管理用户档案' }).first().click();
  await page.getByRole('button', { name: '编辑大树' }).click();
  await page.getByRole('button', { name: '删除这个档案' }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.reload();
  data = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).store, KEY);
  expect(data.profiles).toHaveLength(1);
  expect(data.profiles[0].name).toBe('小花');
});

test('wrong answers do not score, double taps cannot award extra rounds, and quitting saves nothing', async ({
  page,
}) => {
  await seed(page);
  await page.goto('/');
  await page.getByRole('button', { name: '游戏乐园', exact: true }).first().click();
  await page.getByRole('button', { name: '开始火眼金睛', exact: true }).click();
  await solveGame(page, 'odd', true);
  await expect(page.locator('.result-score strong')).toHaveText('0');
  await page.getByRole('button', { name: '再玩一局' }).click();
  await page.getByRole('button', { name: '开始挑战', exact: true }).click();
  const pictures = await page
    .locator('.odd-cell .shape')
    .evaluateAll((els) => els.map((el) => el.innerHTML));
  const different = pictures.findIndex(
    (picture) => pictures.filter((other) => other === picture).length === 1,
  );
  await page.locator('.odd-cell').nth(different).dblclick();
  await expect(page.locator('.round-top>span').first()).toHaveText('第 2 / 6 轮');
  expect(parseInt(await page.locator('.round-top>span').nth(1).innerText())).toBeLessThanOrEqual(
    150,
  );
  await page.getByRole('button', { name: '退出游戏' }).click();
  await page.getByRole('button', { name: '退出本场', exact: true }).click();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).store.profiles[0].history.length,
      KEY,
    ),
  ).toBe(1);
});

test('mobile and tablet fit, touch targets are large, modal focus stays trapped, save screenshots', async ({
  page,
}) => {
  await seed(page);
  await page.goto('/');
  await mkdir('docs/screenshots', { recursive: true });
  await page.screenshot({ path: 'docs/screenshots/desktop.png', fullPage: true });
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page
      .getByRole('button', { name: '游戏乐园', exact: true })
      .filter({ visible: true })
      .click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page
      .getByRole('button', { name: '今日训练', exact: true })
      .filter({ visible: true })
      .click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/screenshots/mobile.png', fullPage: true });
  await page.getByRole('button', { name: '管理用户档案' }).filter({ visible: true }).click();
  for (let i = 0; i < 14; i++) await page.keyboard.press('Tab');
  expect(await page.getByRole('dialog').evaluate((el) => el.contains(document.activeElement))).toBe(
    true,
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page
    .getByRole('button', { name: '游戏乐园', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('button', { name: '开始记忆闪格' }).click();
  await page.getByRole('button', { name: '开始挑战', exact: true }).click();
  const rect = await page.locator('.tile').first().boundingBox();
  expect(rect!.width).toBeGreaterThanOrEqual(48);
  expect(rect!.height).toBeGreaterThanOrEqual(48);
  await page.screenshot({ path: 'docs/screenshots/game.png', fullPage: true });
});

test('production shell and all games open after a fully offline reload', async ({
  page,
  context,
}) => {
  await seed(page);
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) =>
    errors.push(`${request.url()} ${request.failure()?.errorText}`),
  );
  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('button', { name: '开始今日训练', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '游戏乐园', exact: true }).first().click();
  await expect(page.locator('.game-card')).toHaveCount(13);
  await page.getByRole('button', { name: '开始点点合合' }).click();
  await solveGame(page, 'math');
  expect(errors).toEqual([]);
  await context.setOffline(false);
});

test('a second tab switches profiles without leaking an in-flight game', async ({
  page,
  context,
}) => {
  await seed(page);
  await page.goto('/');
  await page.getByRole('button', { name: '游戏乐园', exact: true }).first().click();
  await page.getByRole('button', { name: '开始点点合合' }).click();
  await page.getByRole('button', { name: '开始挑战', exact: true }).click();
  const other = await context.newPage();
  await other.goto('/');
  await other.getByRole('button', { name: '管理用户档案' }).first().click();
  await other.getByRole('button', { name: '添加新档案' }).click();
  await other.getByRole('textbox', { name: '怎么称呼你？' }).fill('另一朵花');
  await other.getByRole('button', { name: '开启新花园' }).click();
  await expect(page.locator('.player-shell')).not.toBeVisible();
  await page.getByRole('button', { name: '今日训练', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('另一朵花');
  const data = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).store, KEY);
  expect(data.profiles).toHaveLength(2);
  expect(data.profiles.every((profile: any) => profile.history.length === 0)).toBe(true);
});

test('highest difficulty remains playable on a 360px phone', async ({ page }) => {
  await seed(page, { level: 5 });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await page
    .getByRole('button', { name: '游戏乐园', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('button', { name: '开始记忆闪格' }).click();
  await page.getByRole('button', { name: '开始挑战', exact: true }).click();
  await expect(page.locator('.tile')).toHaveCount(25);
  const bounds = await page.locator('.tile').evaluateAll((els) =>
    els.map((el) => ({
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
    })),
  );
  expect(bounds.every((box) => box.width >= 48 && box.height >= 48)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.tile').first()).toBeEnabled();
  await page.getByRole('button', { name: '暂停游戏' }).click();
  await expect(page.getByRole('dialog')).toContainText('歇一小会儿');
  await page.getByRole('button', { name: '继续挑战', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('all six revised mechanics can be completed at level five on mobile', async ({ page }) => {
  await seed(page, { level: 5 });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await maskReading(page);
  for (const [id, name] of [
    ['numbers', '点点规律'],
    ['compare', '大小速判'],
    ['math', '点点合合'],
    ['schulte', '图案追踪'],
    ['stroop', '缤纷找色'],
    ['flip', '反向指令'],
  ]) {
    await page
      .getByRole('button', { name: '游戏乐园', exact: true })
      .filter({ visible: true })
      .click();
    await page.getByRole('button', { name: `开始${name}`, exact: true }).click();
    await solveGame(page, id, false, true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: '返回花园', exact: true }).click();
  }
});

async function maskReading(page: Page) {
  await page.addStyleTag({
    content: `.player-shell .reader-help,.player-header>div,.round-top>span,.game-result h1,.game-result>p,.result-score,.result-details,.best-pill,.game-feedback strong,.modal-copy,.pause-content p,.modal-heading h2 {visibility:hidden!important}`,
  });
}

test('same/opposite and color rehearsals can be corrected and completed without text or scored history', async ({
  page,
}) => {
  await seed(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await maskReading(page);
  for (const name of ['反向指令', '缤纷找色']) {
    await page
      .getByRole('button', { name: '游戏乐园', exact: true })
      .filter({ visible: true })
      .click();
    await page.getByRole('button', { name: `开始${name}`, exact: true }).click();
    await page.getByRole('button', { name: '先试一试 · 不计分', exact: true }).click();
    const practice = page.getByRole('dialog');
    await practice.locator('.answer-option').nth(1).click();
    await expect(practice.locator('.practice-status .lucide-rotate-ccw')).toBeVisible();
    await practice.locator('.answer-option').nth(0).click();
    await practice.getByRole('button', { name: '下一步', exact: true }).click();
    await practice.locator('.answer-option').nth(1).click();
    await practice.getByRole('button', { name: '开始挑战', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('.game-board')).toBeVisible();
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).store.profiles[0].history.length,
        KEY,
      ),
    ).toBe(0);
    await page.getByRole('button', { name: '退出游戏' }).click();
    await page.getByRole('button', { name: '退出本场', exact: true }).click();
  }
});

test('replaying a completed daily picture is free practice and does not advance daily progress', async ({
  page,
}) => {
  await seed(page, { daily: true });
  await page.goto('/');
  await page.evaluate((key) => {
    const data = JSON.parse(localStorage.getItem(key)!);
    const plans = data.store.profiles[0].plans;
    const today = Object.keys(plans)[0];
    plans[today].completedIds = ['compare'];
    data.revision += 1;
    localStorage.setItem(key, JSON.stringify(data));
  }, KEY);
  await page.reload();
  await page.locator('.daily-game.completed').click();
  await expect(page.locator('.player-header>div>span')).toContainText('自由练习');
  await solveGame(page, 'compare');
  await page.getByRole('button', { name: '返回花园', exact: true }).click();
  await expect(page.locator('.hero-progress')).toHaveText('1 / 4 已完成');
  const data = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).store, KEY);
  expect(data.profiles[0].history.at(-1).mode).toBe('free');
});
