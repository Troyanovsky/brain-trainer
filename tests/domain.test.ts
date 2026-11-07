import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GAMES, SKILLS } from '../src/domain/catalog';
import {
  createProfile,
  createStore,
  loadStore,
  parseStore,
  saveStore,
  STORAGE_KEY,
} from '../src/domain/storage';
import {
  createPlan,
  dateKey,
  getAchievements,
  getLevel,
  getSkillCoverage,
  getStreak,
  getWeekActivity,
  recordResult,
  scoreRound,
  shiftDate,
} from '../src/domain/training';
import type { GameId, Result } from '../src/domain/types';
function result(gameId: GameId = 'tiles', overrides: Partial<Result> = {}): Result {
  return {
    id: crypto.randomUUID(),
    gameId,
    level: 1,
    score: 700,
    correct: 5,
    rounds: 6,
    completedAt: '2026-11-06T12:00:00',
    duration: 20000,
    mode: 'free',
    ...overrides,
  };
}
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
describe('daily recommendations', () => {
  it('gives four distinct skills, is stable, and honors saved plans', () => {
    const p = createProfile('小花');
    const plan = createPlan(p, '2026-11-06');
    expect(plan.gameIds).toHaveLength(4);
    expect(new Set(plan.gameIds).size).toBe(4);
    expect(new Set(plan.gameIds.map((id) => GAMES.find((g) => g.id === id)!.skill)).size).toBe(4);
    expect(createPlan(p, '2026-11-06')).toEqual(plan);
    p.plans[plan.date] = plan;
    p.history.push(result());
    expect(createPlan(p, plan.date)).toBe(plan);
  });
  it('avoids all yesterday games when alternatives in their skill exist', () => {
    const p = createProfile('测试');
    p.plans['2026-11-05'] = createPlan(p, '2026-11-05');
    const next = createPlan(p, '2026-11-06');
    expect(next.gameIds.filter((id) => p.plans['2026-11-05'].gameIds.includes(id))).toHaveLength(0);
  });
  it('prioritizes under-covered skills and less frequent games', () => {
    const p = createProfile('测试');
    p.history = Array.from({ length: 8 }, () =>
      result('tiles', { completedAt: '2026-11-05T12:00:00' }),
    );
    const plan = createPlan(p, '2026-11-06');
    expect(plan.gameIds.some((id) => GAMES.find((g) => g.id === id)!.skill === 'memory')).toBe(
      false,
    );
    p.history = Array.from({ length: 5 }, () =>
      result('stroop', { completedAt: '2026-11-05T12:00:00' }),
    );
    const plan2 = createPlan(p, '2026-11-06');
    expect(plan2.gameIds.includes('stroop')).toBe(false);
  });
  it('covers all skills over a week and rotates games', () => {
    const p = createProfile('轮换');
    const chosen = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const date = shiftDate('2026-11-01', i);
      const plan = createPlan(p, date);
      p.plans[date] = plan;
      plan.gameIds.forEach((id) => chosen.add(id));
    }
    expect(chosen.size).toBe(10);
  });
});
describe('scores and activity', () => {
  it('adapts within bounds and preserves a new player entry level', () => {
    const p = createProfile('测试');
    expect(getLevel(p, 'tiles')).toBe(1);
    p.history = [result('tiles', { level: 5, correct: 6 })];
    expect(getLevel(p, 'tiles')).toBe(5);
    p.history = [result('tiles', { level: 2, correct: 0 })];
    expect(getLevel(p, 'tiles')).toBe(1);
    expect(getLevel(p, 'math')).toBe(1);
  });
  it('rewards correctness, actual speed and difficulty without penalizing a wrong answer', () => {
    expect(scoreRound(false, 5, 10)).toBe(0);
    expect(scoreRound(true, 1, 0)).toBe(150);
    expect(scoreRound(true, 3, 20000)).toBe(300);
    expect(scoreRound(true, 2, 200)).toBeGreaterThan(scoreRound(true, 2, 3000));
  });
  it('records a daily result once and does not let free play complete a plan', () => {
    let p = createProfile('测试');
    const plan = createPlan(p, '2026-11-06');
    p.plans[plan.date] = plan;
    const r = result(plan.gameIds[0], { mode: 'daily', planDate: plan.date });
    p = recordResult(p, r);
    p = recordResult(p, r);
    expect(p.history).toHaveLength(1);
    expect(p.plans[plan.date].completedIds).toEqual([r.gameId]);
    p = recordResult(p, result(plan.gameIds[1]));
    expect(p.plans[plan.date].completedIds).toHaveLength(1);
    p = recordResult(p, result(plan.gameIds[2], { mode: 'daily', planDate: '2026-11-05' }));
    expect(p.plans[plan.date].completedIds).toHaveLength(1);
  });
  it('handles local dates, month/year boundaries and streaks ending yesterday', () => {
    expect(dateKey(new Date(2026, 0, 2, 0, 1))).toBe('2026-01-02');
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
    const history = ['2026-11-03', '2026-11-04', '2026-11-05'].map((d) =>
      result('tiles', { completedAt: `${d}T12:00:00` }),
    );
    expect(getStreak(history, '2026-11-06')).toBe(3);
    expect(getStreak(history, '2026-11-07')).toBe(0);
    expect(getWeekActivity(history, '2026-11-06').map((d) => d.count)).toEqual([
      0, 0, 0, 1, 1, 1, 0,
    ]);
  });
  it('keeps empty statistics truthful and earns achievements from records', () => {
    const p = createProfile('测试');
    expect(getSkillCoverage(p.history).map((c) => c.count)).toEqual([0, 0, 0, 0, 0]);
    expect(getAchievements(p).some((a) => a.unlocked)).toBe(false);
    p.history = GAMES.map((g) => result(g.id, { correct: 6 }));
    expect(
      getAchievements(p)
        .filter((a) => a.unlocked)
        .map((a) => a.id),
    ).toEqual(['first', 'explore', 'all', 'perfect']);
    expect(Object.keys(SKILLS)).toHaveLength(5);
  });
});
describe('local profiles and validation', () => {
  it('round-trips independent profile histories, plans and settings', () => {
    const store = createStore(),
      second = createProfile('第二朵花', 2);
    second.settings.sound = false;
    store.profiles.push(second);
    store.profiles[0] = recordResult(store.profiles[0], result());
    expect(saveStore(store).ok).toBe(true);
    const restored = loadStore().store;
    expect(restored.profiles[0].history).toHaveLength(1);
    expect(restored.profiles[1].history).toHaveLength(0);
    expect(restored.profiles[1].settings.sound).toBe(false);
    expect(restored.profiles[0].settings.sound).toBe(true);
    expect(restored.profiles[0].plans).not.toBe(restored.profiles[1].plans);
  });
  it('recovers from invalid JSON without crashing and reports failed saves', () => {
    localStorage.setItem(STORAGE_KEY, 'broken');
    expect(loadStore().warning).toBeTruthy();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    expect(saveStore(createStore())).toMatchObject({ ok: false });
  });
  it('isolates bad records, duplicate ids and invalid plan completion', () => {
    const store = createStore(),
      p = store.profiles[0];
    p.history = [result(), result('math', { score: NaN })];
    p.plans['2026-11-06'] = {
      date: '2026-11-06',
      gameIds: ['tiles', 'math', 'odd', 'compare'],
      completedIds: ['flip'],
    };
    const restored = parseStore(JSON.stringify(store));
    expect(restored.warning).toBeTruthy();
    expect(restored.store.profiles[0].history).toHaveLength(1);
    expect(restored.store.profiles[0].plans).toEqual({});
  });
});

it('keeps a recovery copy of corrupt data before writing a fresh profile', () => {
  const raw = '{damaged but worth preserving';
  localStorage.setItem(STORAGE_KEY, raw);
  const loaded = loadStore();
  expect(loaded.warning).toBeTruthy();
  expect(saveStore(loaded.store).ok).toBe(true);
  expect(localStorage.getItem('brain-garden-recovery-v1')).toBe(raw);
});
