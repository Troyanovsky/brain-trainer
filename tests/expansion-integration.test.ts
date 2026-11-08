import { describe, expect, it } from 'vitest';
import { GAMES } from '../src/domain/catalog';
import { createProfile } from '../src/domain/storage';
import {
  createPlan,
  getAchievements,
  getGameResults,
  getLevel,
  recordResult,
  shiftDate,
} from '../src/domain/training';
import type { GameId, Result } from '../src/domain/types';

const originalIds = [
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
] as const;
const addedIds = ['focus', 'route', 'fit'] as const;
const result = (gameId: GameId, mode: 'daily' | 'free' = 'free'): Result => ({
  id: `${gameId}-${mode}`,
  gameId,
  level: 1,
  rulesVersion: 1,
  score: 100,
  correct: 3,
  rounds: 3,
  completedAt: '2026-11-08T12:00:00+08:00',
  duration: 10000,
  mode,
  ...(mode === 'daily' ? { planDate: '2026-11-08' } : {}),
});

describe('expanded catalog integrates without rewriting existing progress', () => {
  it('contains thirteen unique games with unchanged old rules and fresh new rules', () => {
    expect(GAMES).toHaveLength(13);
    expect(new Set(GAMES.map((game) => game.id)).size).toBe(13);
    expect(GAMES.map((game) => game.id)).toEqual(
      expect.arrayContaining([...originalIds, ...addedIds]),
    );
    for (const game of GAMES) {
      const expected = ['numbers', 'stroop', 'compare', 'schulte', 'math', 'flip'].includes(game.id)
        ? 2
        : 1;
      expect(game.rulesVersion ?? 1, game.id).toBe(expected);
    }
  });

  it('keeps an already saved plan and completion unchanged after catalog expansion', () => {
    const profile = createProfile('旧花园');
    profile.plans['2026-11-08'] = {
      date: '2026-11-08',
      gameIds: ['tiles', 'pattern', 'odd', 'compare'],
      completedIds: ['tiles'],
    };
    const before = structuredClone(profile);
    expect(createPlan(profile, '2026-11-08')).toEqual(before.plans['2026-11-08']);
    expect(profile).toEqual(before);
  });

  it('makes all new games eligible while retaining four distinct daily skills', () => {
    const profile = createProfile('新花园');
    profile.id = 'stable-expansion-profile';
    const seen = new Set<GameId>();
    for (let offset = 0; offset < 90; offset++) {
      const day = shiftDate('2026-11-08', offset);
      const plan = createPlan(profile, day);
      expect(plan.gameIds).toHaveLength(4);
      expect(
        new Set(plan.gameIds.map((id) => GAMES.find((game) => game.id === id)!.skill)).size,
      ).toBe(4);
      plan.gameIds.forEach((id) => seen.add(id));
      profile.plans[day] = plan;
    }
    expect([...seen]).toEqual(expect.arrayContaining([...addedIds]));
    expect([...seen]).toEqual(expect.arrayContaining(GAMES.map((game) => game.id)));
  });

  it('keeps the ten-game badge threshold and makes its wording truthful', () => {
    const profile = createProfile('园丁');
    profile.history = originalIds.map((id) => result(id));
    const badge = getAchievements(profile).find((entry) => entry.id === 'all')!;
    expect(badge.unlocked).toBe(true);
    expect(badge.description).toBe('体验 10 款不同游戏');
  });

  it.each(addedIds)('records %s once, credits only daily sessions, and isolates profiles', (id) => {
    let profile = createProfile('玩家');
    const other = createProfile('另一个玩家');
    profile.plans['2026-11-08'] = {
      date: '2026-11-08',
      gameIds: [id, 'tiles', 'compare', id === 'focus' ? 'route' : 'odd'],
      completedIds: [],
    };
    profile = recordResult(profile, result(id));
    expect(profile.plans['2026-11-08'].completedIds).toEqual([]);
    const daily = result(id, 'daily');
    profile = recordResult(recordResult(profile, daily), daily);
    expect(profile.history).toHaveLength(2);
    expect(profile.plans['2026-11-08'].completedIds).toEqual([id]);
    expect(getGameResults(profile, id)).toHaveLength(2);
    expect(getLevel(profile, id)).toBe(2);
    expect(other.history).toEqual([]);
    expect(other.plans).toEqual({});
  });
});
