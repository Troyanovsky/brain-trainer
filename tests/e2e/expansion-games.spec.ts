import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

const CANONICAL_KEY = 'brain-garden-store';
const GAME_NAMES = {
  focus: '中央方向',
  route: '送物路线',
  fit: '拼块空位',
} as const;

type GridCell = { x: number; y: number };

async function seedLevelFive(page: Page, dailyGame?: 'focus' | 'route' | 'fit') {
  await page.addInitScript(
    ({ key, rounds, dailyGame }) => {
      const completedAt = new Date(Date.now() - 86400000).toISOString();
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const dailyPlan =
        dailyGame === 'focus'
          ? {
              date,
              gameIds: ['tiles', 'pattern', 'focus', 'compare'],
              completedIds: ['tiles', 'pattern', 'compare'],
            }
          : dailyGame === 'route'
            ? {
                date,
                gameIds: ['tiles', 'odd', 'route', 'compare'],
                completedIds: ['tiles', 'odd', 'compare'],
              }
            : dailyGame === 'fit'
              ? {
                  date,
                  gameIds: ['tiles', 'odd', 'fit', 'compare'],
                  completedIds: ['tiles', 'odd', 'compare'],
                }
              : null;
      localStorage.setItem(
        key,
        JSON.stringify({
          format: 'brain-garden-store',
          schemaVersion: 1,
          revision: 1,
          store: {
            version: 1,
            activeProfileId: 'expansion-profile',
            profiles: [
              {
                id: 'expansion-profile',
                name: '小花',
                avatar: 0,
                settings: { sound: false, reducedMotion: true },
                history: Object.entries(rounds).map(([gameId, count]) => ({
                  id: `seed-${gameId}`,
                  gameId,
                  level: 5,
                  rulesVersion: 1,
                  score: 1000,
                  correct: count,
                  rounds: count,
                  completedAt,
                  duration: 12000,
                  mode: 'free',
                })),
                plans: dailyPlan ? { [date]: dailyPlan } : {},
              },
            ],
          },
        }),
      );
    },
    { key: CANONICAL_KEY, rounds: { focus: 6, route: 3, fit: 4 }, dailyGame },
  );
}

async function maskReading(page: Page) {
  await page.addStyleTag({
    content: `.player-shell .reader-help,.player-header>div,.round-top>span,.game-hint,.game-intro h1,.game-intro>p,.game-intro>small,.game-intro .eyebrow,.demo-note,.game-result h1,.game-result>p,.result-score,.result-details,.best-pill,.modal-heading h2,.practice-status>span:not(.practice-mode-dot):not(.practice-transform-cue) {visibility:hidden!important}`,
  });
}

async function openGame(page: Page, id: keyof typeof GAME_NAMES) {
  await page
    .getByRole('button', { name: '游戏乐园', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('button', { name: `开始${GAME_NAMES[id]}`, exact: true }).click();
}

async function startPractice(page: Page) {
  await page.getByRole('button', { name: '开始不计分试玩', exact: true }).click();
  return page.getByRole('dialog');
}

async function focusDirection(board: Locator): Promise<'up' | 'right' | 'down' | 'left'> {
  const transform = await board
    .locator('.focus-center-motif .direction-arrow')
    .evaluate((element) => (element as HTMLElement).style.transform);
  const degrees = Number(transform.match(/rotate\((-?\d+)/)?.[1] ?? 0);
  return ({ 0: 'up', 90: 'right', 180: 'down', 270: 'left' } as const)[
    ((degrees % 360) + 360) % 360
  ] as 'up' | 'right' | 'down' | 'left';
}

async function solveFocusStep(board: Locator, wrongFirst = false, stopAfterWrong = false) {
  const direction = await focusDirection(board);
  if (wrongFirst) {
    const wrongDirection = direction === 'left' ? 'up' : 'left';
    await board.getByTestId(`focus-arrow-${wrongDirection}`).click();
    await expect(board.locator('.focus-correction')).toBeVisible();
    if (stopAfterWrong) return;
  }
  await board.getByTestId(`focus-arrow-${direction}`).click();
}

function adjacent(left: number, right: number, width: number, count: number): boolean {
  if (left < 0 || right < 0 || left >= count || right >= count) return false;
  const lx = left % width;
  const ly = Math.floor(left / width);
  const rx = right % width;
  const ry = Math.floor(right / width);
  return Math.abs(lx - rx) + Math.abs(ly - ry) === 1;
}

async function visibleRoutePlan(board: Locator): Promise<number[]> {
  const geometry = await board.locator('.route-grid').evaluate((grid) => {
    const style = (grid as HTMLElement).style.gridTemplateColumns;
    const match = style.match(/repeat\((\d+)/);
    const cells = Array.from(grid.querySelectorAll<HTMLElement>('.route-cell'));
    return {
      width: Number(match?.[1] ?? 0),
      count: cells.length,
      blocked: cells.flatMap((cell, index) =>
        cell.classList.contains('route-blocked') ? [index] : [],
      ),
      exit: cells.findIndex((cell) => cell.classList.contains('route-exit')),
      start: cells.findIndex((cell) => cell.classList.contains('route-start')),
      pickups: cells.flatMap((cell, index) => (cell.querySelector('.route-parcel') ? [index] : [])),
    };
  });
  const blocked = new Set(geometry.blocked);
  const pickupIndex = new Map(geometry.pickups.map((cell, index) => [cell, index]));
  const allCollected = (1 << geometry.pickups.length) - 1;
  const startKey = `${geometry.start}:0`;
  const queue: Array<{ cell: number; collected: number; path: number[] }> = [
    { cell: geometry.start, collected: 0, path: [geometry.start] },
  ];
  const seen = new Set([startKey]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const state = queue[cursor];
    if (state.cell === geometry.exit && state.collected === allCollected) return state.path;
    for (const delta of [-geometry.width, 1, geometry.width, -1]) {
      const next = state.cell + delta;
      if (blocked.has(next) || !adjacent(state.cell, next, geometry.width, geometry.count))
        continue;
      if (next === geometry.exit && state.collected !== allCollected) continue;
      const pickup = pickupIndex.get(next);
      const collected = pickup === undefined ? state.collected : state.collected | (1 << pickup);
      const key = `${next}:${collected}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({
        cell: next,
        collected,
        path: [...state.path, next],
      });
    }
  }
  throw new Error('Visible route has no solution');
}

async function clickRoutePlan(board: Locator, plan: number[]) {
  for (const index of plan.slice(1)) {
    await board.locator('.route-cell').nth(index).click();
  }
}

function normalizeCells(cells: GridCell[]): GridCell[] {
  const minX = Math.min(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  return cells
    .map((cell) => ({ x: cell.x - minX, y: cell.y - minY }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

function keyFor(cells: GridCell[]): string {
  return normalizeCells(cells)
    .map((cell) => `${cell.x},${cell.y}`)
    .join(';');
}

function rotateCells(cells: GridCell[]): GridCell[] {
  return normalizeCells(cells.map((cell) => ({ x: -cell.y, y: cell.x })));
}

function reflectCells(cells: GridCell[]): GridCell[] {
  return normalizeCells(cells.map((cell) => ({ x: -cell.x, y: cell.y })));
}

async function pieceCells(piece: Locator): Promise<GridCell[]> {
  return piece.locator('[data-cell-x]').evaluateAll((cells) =>
    cells.map((cell) => ({
      x: Number((cell as HTMLElement).dataset.cellX),
      y: Number((cell as HTMLElement).dataset.cellY),
    })),
  );
}

async function findFitAnswer(board: Locator): Promise<number> {
  const target = await pieceCells(board.locator('.fit-target'));
  const targetKey = keyFor(target);
  const pieces = board.locator('.fit-piece');
  const count = await pieces.count();
  for (let index = 0; index < count; index++) {
    const cells = await pieceCells(pieces.nth(index));
    const orbit = new Set(
      [
        cells,
        rotateCells(cells),
        diff(cells, 2),
        diff(cells, 3),
        reflectCells(cells),
        diff(reflectCells(cells), 1),
        diff(reflectCells(cells), 2),
        diff(reflectCells(cells), 3),
      ].map(keyFor),
    );
    if (orbit.has(targetKey)) return index;
  }
  return -1;
}

function transformPlan(start: GridCell[], target: GridCell[]): Array<'rotate' | 'reflect'> {
  const targetKey = keyFor(target);
  const queue: Array<{
    cells: GridCell[];
    plan: Array<'rotate' | 'reflect'>;
  }> = [{ cells: normalizeCells(start), plan: [] }];
  const seen = new Set([keyFor(start)]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const state = queue[cursor];
    if (keyFor(state.cells) === targetKey) return state.plan;
    for (const action of ['rotate', 'reflect'] as const) {
      const cells = action === 'rotate' ? rotateCells(state.cells) : reflectCells(state.cells);
      const key = keyFor(cells);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ cells, plan: [...state.plan, action] });
    }
  }
  throw new Error('Visible fit has no transform sequence');
}

async function solveFitBoard(board: Locator, wrongFirst = false) {
  const target = await pieceCells(board.locator('.fit-target'));
  const pieces = board.locator('.fit-piece');
  const count = await pieces.count();
  const answer = await findFitAnswer(board);
  expect(answer, 'one visible piece can form the silhouette').toBeGreaterThanOrEqual(0);
  if (wrongFirst) {
    await pieces.nth((answer + 1) % count).click();
    await board.getByTestId('fit-slot').click();
    await expect(board.locator('.correct-piece')).toBeVisible();
    return;
  }
  await pieces.nth(answer).click();
  const renderedStart = await pieceCells(board.locator('.fit-preview'));
  for (const action of transformPlan(renderedStart, target)) {
    await board.getByTestId(action === 'rotate' ? 'fit-rotate' : 'fit-reflect').click();
  }
  await board.getByTestId('fit-slot').click();
}

function diff(cells: GridCell[], rotations: number): GridCell[] {
  let result = cells;
  for (let count = 0; count < rotations; count++) result = rotateCells(result);
  return result;
}

async function completePractice(page: Page, gameId: keyof typeof GAME_NAMES) {
  const dialog = await startPractice(page);
  if (gameId === 'focus') {
    await solveFocusStep(dialog.locator('.focus-board'));
    await dialog.getByRole('button', { name: '下一步', exact: true }).click();
    await solveFocusStep(dialog.locator('.focus-board'), true);
  } else if (gameId === 'route') {
    const board = dialog.locator('.route-board');
    await board.locator('.route-blocked').click();
    await expect(board.locator('.route-error')).toBeVisible();
    const plan = await visibleRoutePlan(board);
    for (const cell of [3, 0, 1, 2]) await board.locator('.route-cell').nth(cell).click();
    await board.locator('.route-exit').click();
    await expect(board.locator('.error-exit-locked')).toBeVisible();
    await board.getByTestId('route-restart').click();
    await clickRoutePlan(board, plan);
  } else {
    const board = dialog.locator('.fit-board');
    await solveFitBoard(board, true);
    await dialog.getByTestId('fit-rotate').click();
    await solveFitBoard(board);
    await dialog.getByRole('button', { name: '下一步', exact: true }).click();
    await solveFitBoard(board);
  }
  await dialog.getByRole('button', { name: '开始挑战', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
}

async function continueRound(page: Page, required = false) {
  const next = page.getByRole('button', { name: /^(继续下一轮|查看本场结果)$/ });
  if (required) {
    await expect(next).toBeVisible();
    await next.click();
    return;
  }
  if (await next.isVisible()) await next.click();
}

async function playFocus(page: Page) {
  const board = page.locator('.game-board');
  for (let round = 0; round < 6; round++) {
    if (round === 0) {
      await solveFocusStep(board, true, true);
      await expect(page.locator('.focus-correction')).toBeVisible();
      await page.waitForTimeout(250);
      await expect(page.locator('.round-top>span').first()).toHaveText('第 1 / 6 轮');
      await continueRound(page, true);
    } else {
      await solveFocusStep(board);
      if (round < 5)
        await expect(page.locator('.round-top>span').first()).toHaveText(`第 ${round + 2} / 6 轮`);
    }
  }
  await expect(page.locator('.game-result')).toBeVisible();
}

async function playRoute(page: Page) {
  const board = page.locator('.game-board');
  for (let round = 0; round < 3; round++) {
    await expect(board.locator('.route-goals')).toBeVisible();
    const plan = await visibleRoutePlan(board);
    if (round === 0) {
      await board.locator('.route-cell').nth(plan[1]).click();
      await board.getByTestId('route-undo').click();
      await expect(board.locator('.route-start .route-walker')).toBeVisible();
      await board.locator('.route-blocked').first().click();
      await expect(board.locator('.route-error')).toBeVisible();
      await clickRoutePlan(board, plan.slice(0, 2));
      await board.locator('.route-cell').nth(plan[0]).click();
    }
    await clickRoutePlan(board, plan);
    await expect(board.locator('.route-exit .route-door')).toBeVisible();
    await continueRound(page, true);
  }
  await expect(page.locator('.game-result')).toBeVisible();
}

async function playFit(page: Page) {
  const board = page.locator('.game-board');
  for (let round = 0; round < 4; round++) {
    const target = board.locator('.fit-target');
    const preview = board.locator('.fit-preview');
    await expect(target).toBeVisible();
    await expect(preview).toBeVisible();
    if (round === 0) {
      await solveFitBoard(board, true);
      await continueRound(page, true);
    } else {
      await solveFitBoard(board);
      await continueRound(page, true);
    }
  }
  await expect(page.locator('.game-result')).toBeVisible();
}

async function expectNoA11yViolations(page: Page, label: string) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect
    .soft(
      result.violations.map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          summary: node.failureSummary,
        })),
      })),
      label,
    )
    .toEqual([]);
}

async function setPageVisibility(page: Page, state: 'visible' | 'hidden') {
  await page.evaluate((nextState) => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => nextState === 'hidden',
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => nextState,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

async function playOneKeyboardRound(page: Page, gameId: keyof typeof GAME_NAMES) {
  const board = page.locator('.game-board');
  if (gameId === 'focus') {
    const direction = await focusDirection(board);
    await board.getByTestId(`focus-arrow-${direction}`).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.round-top>span').first()).toHaveText('第 2 / 6 轮');
  } else if (gameId === 'route') {
    const plan = await visibleRoutePlan(board);
    await board.locator('.route-cell').nth(plan[1]).focus();
    await page.keyboard.press('Enter');
    await board.getByTestId('route-undo').focus();
    await page.keyboard.press('Enter');
    await expect(board.locator('.route-start .route-walker')).toBeVisible();
  } else {
    const target = await pieceCells(board.locator('.fit-target'));
    const answer = await findFitAnswer(board);
    await board.getByTestId(`fit-piece-${answer}`).focus();
    await page.keyboard.press('Enter');
    const renderedStart = await pieceCells(board.locator('.fit-preview'));
    for (const action of transformPlan(renderedStart, target)) {
      await board.getByTestId(action === 'rotate' ? 'fit-rotate' : 'fit-reflect').focus();
      await page.keyboard.press('Enter');
    }
    await board.getByTestId('fit-slot').focus();
    await page.keyboard.press('Enter');
    await expect(board.locator('.fit-success')).toBeVisible();
  }
}

async function solveOneRound(page: Page, gameId: keyof typeof GAME_NAMES) {
  const board = page.locator('.game-board');
  if (gameId === 'focus') {
    await solveFocusStep(board);
    await expect(page.locator('.round-top>span').first()).toContainText('第 2 / 6 轮');
  } else if (gameId === 'route') {
    await clickRoutePlan(board, await visibleRoutePlan(board));
    await continueRound(page, true);
    await expect(page.locator('.round-top>span').first()).toContainText('/ 3 轮');
  } else {
    await solveFitBoard(board);
    await continueRound(page, true);
    await expect(page.locator('.round-top>span').first()).toContainText('/ 4 轮');
  }
}

async function exitMidGame(page: Page) {
  await page.getByRole('button', { name: '退出游戏', exact: true }).click();
  await page.getByRole('button', { name: '退出本场', exact: true }).click();
}

test('reflecting then pressing clockwise rotates the rendered fitting piece clockwise', async ({
  page,
}) => {
  await seedLevelFive(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await openGame(page, 'fit');
  const dialog = await startPractice(page);
  const board = dialog.locator('.fit-board');
  await board.getByTestId('fit-piece-0').click();
  await board.getByTestId('fit-reflect').click();
  const reflected = await pieceCells(board.locator('.fit-preview'));
  await board.getByTestId('fit-rotate').click();
  const rotated = await pieceCells(board.locator('.fit-preview'));
  expect(keyFor(rotated)).toBe(keyFor(rotateCells(reflected)));
});

test('the route introduction has a legal arrow path and legible picture cues', async ({ page }) => {
  await seedLevelFive(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await openGame(page, 'route');
  await mkdir('docs/screenshots/expansion', { recursive: true });
  await page.screenshot({ path: 'docs/screenshots/expansion/route-intro-360.png', fullPage: true });
  const geometry = await page.locator('.route-demo-grid').evaluate((grid) => {
    const cells = Array.from(grid.querySelectorAll<HTMLElement>(':scope > i'));
    return {
      width: Math.sqrt(cells.length),
      cells: cells.map((cell) => ({
        blocked: cell.classList.contains('demo-route-block'),
        directions: Array.from(cell.querySelectorAll<SVGElement>('.direction-arrow')).map((arrow) =>
          Number(arrow.style.transform.match(/rotate\((-?\d+)/)?.[1] ?? 0),
        ),
      })),
      walker: cells.findIndex((cell) => cell.querySelector('.demo-route-walker')),
      parcel: cells.findIndex((cell) => cell.querySelector('.lucide-package')),
      exit: cells.findIndex((cell) => cell.querySelector('.lucide-door-open')),
      hand: cells.findIndex((cell) => cell.querySelector('.demo-route-hand')),
      cues: cells.flatMap((cell, cellIndex) =>
        Array.from(
          cell.querySelectorAll<HTMLElement | SVGElement>(
            '.direction-arrow, .demo-route-walker, .demo-route-hand, .lucide-package, .lucide-door-open',
          ),
        ).map((element) => {
          const box = element.getBoundingClientRect();
          return {
            cellIndex,
            arrow: element.classList.contains('direction-arrow'),
            kind: element.getAttribute('class'),
            visible:
              getComputedStyle(element).visibility === 'visible' &&
              getComputedStyle(element).display !== 'none',
            width: box.width,
            height: box.height,
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
          };
        }),
      ),
    };
  });
  const path = [geometry.walker];
  let collected = false;
  for (let steps = 0; steps < geometry.cells.length; steps++) {
    const current = path.at(-1)!;
    if (current === geometry.parcel) collected = true;
    if (current === geometry.exit) break;
    expect(geometry.cells[current].directions).toHaveLength(1);
    const degrees = geometry.cells[current].directions[0];
    const delta = (
      { 0: -geometry.width, 90: 1, 180: geometry.width, 270: -1 } as Record<number, number>
    )[degrees];
    expect(delta).toBeDefined();
    const next = current + delta;
    expect(adjacent(current, next, geometry.width, geometry.cells.length)).toBe(true);
    expect(geometry.cells[next].blocked).toBe(false);
    if (next === geometry.exit) expect(collected).toBe(true);
    expect(path).not.toContain(next);
    path.push(next);
  }
  expect(path.at(-1)).toBe(geometry.exit);
  expect(collected).toBe(true);
  expect(geometry.hand).toBe(path[1]);
  expect(geometry.cells[geometry.exit].directions).toEqual([]);
  expect(geometry.cues.filter((cue) => cue.arrow)).toHaveLength(path.length - 1);
  for (const cue of geometry.cues) {
    expect(cue.visible, cue.kind ?? 'picture cue').toBe(true);
    expect(cue.width).toBeGreaterThanOrEqual(10);
    expect(cue.height).toBeGreaterThanOrEqual(10);
    expect(cue.left).toBeGreaterThanOrEqual(0);
    expect(cue.right).toBeLessThanOrEqual(360);
  }
  for (let cueIndex = 0; cueIndex < geometry.cues.length; cueIndex++) {
    const arrow = geometry.cues[cueIndex];
    for (const picture of geometry.cues.slice(cueIndex + 1)) {
      if (!arrow.arrow && !picture.arrow) continue;
      const overlapWidth = Math.max(
        0,
        Math.min(arrow.right, picture.right) - Math.max(arrow.left, picture.left),
      );
      const overlapHeight = Math.max(
        0,
        Math.min(arrow.bottom, picture.bottom) - Math.max(arrow.top, picture.top),
      );
      expect(
        overlapWidth * overlapHeight,
        `${arrow.cellIndex} arrow overlaps ${picture.kind}`,
      ).toBeLessThanOrEqual(0.5);
    }
  }
});

test('the fit introduction shows each operation changing the asymmetric source geometry', async ({
  page,
}) => {
  await seedLevelFive(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await openGame(page, 'fit');
  const steps = page.locator('.fit-demo-step');
  await expect(steps).toHaveCount(2);
  for (let index = 0; index < 2; index++) {
    const before = await pieceCells(steps.nth(index).locator('.demo-grid-piece').nth(0));
    const after = await pieceCells(steps.nth(index).locator('.demo-grid-piece').nth(1));
    const expected = index === 0 ? rotateCells(before) : reflectCells(before);
    expect(keyFor(before)).not.toBe(keyFor(after));
    expect(keyFor(after)).toBe(keyFor(expected));
  }
});

test('focus wrong feedback keeps the correct disabled arrow visible with pictorial guidance', async ({
  page,
}) => {
  await seedLevelFive(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await maskReading(page);
  await openGame(page, 'focus');
  await completePractice(page, 'focus');
  const board = page.locator('.game-board');
  const direction = await focusDirection(board);
  const wrongDirection = direction === 'left' ? 'up' : 'left';
  await board.getByTestId(`focus-arrow-${wrongDirection}`).click();
  const correct = board.getByTestId(`focus-arrow-${direction}`);
  await expect(correct).toBeVisible();
  await expect(correct).toBeDisabled();
  await expect(correct.locator('.focus-control-check')).toBeVisible();
  await expect(correct.locator('.focus-answer-hand')).toBeVisible();
});

test('all three expansion games are learned, corrected and played from visible geometry at 360px', async ({
  page,
}) => {
  test.setTimeout(180000);
  await seedLevelFive(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await maskReading(page);

  for (const [gameIndex, gameId] of (['focus', 'route', 'fit'] as const).entries()) {
    await openGame(page, gameId);
    await expect(page.getByRole('button', { name: '开始不计分试玩' })).toBeVisible();
    await expect(page.locator('.game-demo')).toBeVisible();
    await completePractice(page, gameId);
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('brain-garden-store')!).store.profiles[0].history.length,
      ),
    ).toBe(3 + gameIndex);
    await expect(page.locator('.round-top>span').first()).toContainText('/');
    if (gameId === 'focus') await playFocus(page);
    if (gameId === 'route') await playRoute(page);
    if (gameId === 'fit') await playFit(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('button', { name: '返回花园', exact: true }).click();
  }
});

test('expansion boards retain large controls and capture 360px and 768px screenshots', async ({
  page,
}) => {
  test.setTimeout(120000);
  await seedLevelFive(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await maskReading(page);
  await mkdir('docs/screenshots/expansion', { recursive: true });

  for (const width of [360, 768]) {
    await page.setViewportSize({ width, height: 800 });
    for (const gameId of ['focus', 'route', 'fit'] as const) {
      await openGame(page, gameId);
      await page.mouse.move(0, 0);
      await page.screenshot({
        path: `docs/screenshots/expansion/${gameId}-intro-${width}.png`,
        fullPage: true,
      });
      await completePractice(page, gameId);
      const selectors =
        gameId === 'focus'
          ? '.focus-arrow:visible'
          : gameId === 'route'
            ? '.route-cell'
            : '.fit-piece, .fit-transform-tools button, .fit-slot';
      const boxes = await page.locator(selectors).evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return { width: box.width, height: box.height };
        }),
      );
      expect(boxes.length).toBeGreaterThan(0);
      expect(boxes.every((box) => box.width >= 44 && box.height >= 44)).toBe(true);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: `docs/screenshots/expansion/${gameId}-play-${width}.png`,
        fullPage: true,
      });
      await page.getByRole('button', { name: '退出游戏', exact: true }).click();
      await page.getByRole('button', { name: '退出本场', exact: true }).click();
    }
  }
});

test('expansion boards support keyboard play, axe scans and hidden-tab pausing', async ({
  page,
}) => {
  test.setTimeout(150000);
  await seedLevelFive(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await maskReading(page);

  for (const gameId of ['focus', 'route', 'fit'] as const) {
    await openGame(page, gameId);
    await completePractice(page, gameId);
    await expectNoA11yViolations(page, `${gameId} formal board`);
    await playOneKeyboardRound(page, gameId);

    await setPageVisibility(page, 'hidden');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText('歇一小会儿');
    await expectNoA11yViolations(page, `${gameId} hidden-tab pause`);
    await setPageVisibility(page, 'visible');
    await page.getByRole('button', { name: '继续挑战', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    if (gameId === 'fit') await continueRound(page, true);
    await exitMidGame(page);
  }
});

for (const gameId of ['focus', 'route', 'fit'] as const) {
  test(`${gameId} completes a balanced saved daily plan as its final game`, async ({ page }) => {
    test.setTimeout(120000);
    await seedLevelFive(page, gameId);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    await maskReading(page);
    await expect(page.locator('.hero-progress')).toHaveText('3 / 4 已完成');
    await page.getByRole('button', { name: '继续今日训练', exact: true }).click();

    await completePractice(page, gameId);
    if (gameId === 'focus') await playFocus(page);
    if (gameId === 'route') await playRoute(page);
    if (gameId === 'fit') await playFit(page);
    await page.getByRole('button', { name: '完成今日训练', exact: true }).click();

    await expect(page.getByRole('dialog')).toContainText('四项训练，全部完成');
    const saved = await page.evaluate((completedGameId) => {
      const store = JSON.parse(localStorage.getItem('brain-garden-store')!).store;
      const profile = store.profiles[0];
      const plan = Object.values(profile.plans)[0] as {
        completedIds: string[];
        gameIds: string[];
      };
      return {
        completedIds: plan.completedIds,
        gameIds: plan.gameIds,
        matchingDailyResults: profile.history.filter(
          (result: { gameId: string; mode: string }) =>
            result.gameId === completedGameId && result.mode === 'daily',
        ),
      };
    }, gameId);
    expect(saved.completedIds).toHaveLength(4);
    expect(saved.completedIds).toEqual(expect.arrayContaining(saved.gameIds));
    expect(saved.matchingDailyResults).toHaveLength(1);
  });
}

test('new-game history remains isolated between local profiles', async ({ page }) => {
  test.setTimeout(180000);
  await seedLevelFive(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await maskReading(page);

  await openGame(page, 'focus');
  await completePractice(page, 'focus');
  await playFocus(page);
  await page.getByRole('button', { name: '返回花园', exact: true }).click();

  await page.getByRole('button', { name: '管理用户档案' }).first().click();
  await page.getByRole('button', { name: '添加新档案' }).click();
  await page.getByRole('textbox', { name: '怎么称呼你？' }).fill('小树');
  await page.getByRole('button', { name: '开启新花园' }).click();
  await page.getByRole('button', { name: '关闭', exact: true }).click();

  await openGame(page, 'route');
  await completePractice(page, 'route');
  await playRoute(page);
  await page.getByRole('button', { name: '返回花园', exact: true }).click();

  const histories = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('brain-garden-store')!).store.profiles.map(
      (profile: { name: string; history: unknown[] }) => ({
        name: profile.name,
        count: profile.history.length,
      }),
    ),
  );
  expect(histories).toEqual([
    { name: '小花', count: 4 },
    { name: '小树', count: 1 },
  ]);
});

test('all three expansion games reload and play offline', async ({ page, context }) => {
  test.setTimeout(180000);
  await seedLevelFive(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.reload();
  await maskReading(page);

  for (const gameId of ['focus', 'route', 'fit'] as const) {
    await openGame(page, gameId);
    await completePractice(page, gameId);
    await solveOneRound(page, gameId);
    await exitMidGame(page);
  }
  expect(pageErrors).toEqual([]);
  await context.setOffline(false);
});
