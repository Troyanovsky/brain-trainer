import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GAMES, SKILLS } from '../src/domain/catalog';
import {
  createStoreGateway,
  createProfile,
  createStore,
  LEGACY_STORAGE_KEY,
  LEGACY_RECOVERY_KEY,
  MARKER_KEY,
  parseStore,
  RECOVERY_KEY,
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
import releasedV1 from './fixtures/storage/released-v1.json';
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
function testLocks(): Pick<LockManager, 'request'> {
  let pending = Promise.resolve();
  return {
    request: (<T>(
      _name: string,
      _options: LockOptions,
      callback: (lock: Lock | null) => T | PromiseLike<T>,
    ) => {
      const current = pending.then(() => callback(null));
      pending = current.then(
        () => undefined,
        () => undefined,
      );
      return current as Promise<T>;
    }) as LockManager['request'],
  };
}
function gateway(locks: Pick<LockManager, 'request'> | null = testLocks()) {
  return createStoreGateway({
    storage: localStorage,
    locks,
    now: () => new Date('2026-11-08T10:00:00.000Z'),
  });
}
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
    p.id = 'weekly-rotation-profile';
    const chosen = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const date = shiftDate('2026-11-01', i);
      const plan = createPlan(p, date);
      p.plans[date] = plan;
      plan.gameIds.forEach((id) => chosen.add(id));
    }
    expect(chosen.size).toBeGreaterThanOrEqual(10);
    expect(new Set([...chosen].map((id) => GAMES.find((game) => game.id === id)!.skill)).size).toBe(
      5,
    );
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
  it('does not replace unsupported future data with a temporary store', async () => {
    const raw = JSON.stringify({
      format: 'brain-garden-store',
      schemaVersion: 2,
      revision: 4,
      store: createStore(),
    });
    localStorage.setItem(STORAGE_KEY, raw);
    const persistence = gateway();
    const loaded = await persistence.openStore();
    expect(loaded).toMatchObject({ status: 'unsupported', canPersist: false, raw });
    expect(loaded.warning).toBeTruthy();
    const write = await persistence.transactStore((store) => ({
      ...store,
      activeProfileId: 'replacement',
    }));
    expect(write.saved).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it('does not drop an unknown game result during a guarded import', async () => {
    const store = createStore();
    store.profiles[0].history = [
      {
        ...result(),
        gameId: 'future-unknown-game',
      } as unknown as Result,
    ];
    const raw = JSON.stringify(store);
    localStorage.setItem(LEGACY_STORAGE_KEY, raw);
    const persistence = gateway();
    const loaded = await persistence.openStore();
    expect(loaded).toMatchObject({ status: 'corrupt', canPersist: false, raw });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBe(raw);
    expect(persistence.readRecoverySnapshot()?.raw).toBe(raw);
  });
  it('round-trips independent profile histories, plans and settings', async () => {
    const persistence = gateway();
    const loaded = await persistence.openStore();
    const store = createStore(),
      second = createProfile('第二朵花', 2);
    second.settings.sound = false;
    store.profiles.push(second);
    store.profiles[0] = recordResult(store.profiles[0], result());
    const saved = await persistence.transactStore(() => store);
    expect(saved.saved).toBe(true);
    expect(saved.revision).toBeGreaterThan(loaded.revision!);
    const restored = (await gateway().openStore()).store;
    expect(restored.profiles[0].history).toHaveLength(1);
    expect(restored.profiles[1].history).toHaveLength(0);
    expect(restored.profiles[1].settings.sound).toBe(false);
    expect(restored.profiles[0].settings.sound).toBe(true);
    expect(restored.profiles[0].plans).not.toBe(restored.profiles[1].plans);
  });
  it('retains the original bytes and reports a quota failure', async () => {
    const persistence = gateway();
    await persistence.openStore();
    const original = localStorage.getItem(STORAGE_KEY);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    const saved = await persistence.transactStore((store) => ({
      ...store,
      profiles: store.profiles.map((profile) => ({
        ...profile,
        settings: { ...profile.settings, sound: false },
      })),
    }));
    expect(saved).toMatchObject({ ok: false, saved: false });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
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

it('keeps corrupt data and a verified recovery snapshot without creating canonical data', async () => {
  const raw = '{damaged but worth preserving';
  localStorage.setItem(LEGACY_STORAGE_KEY, raw);
  const persistence = gateway();
  const loaded = await persistence.openStore();
  expect(loaded.status).toBe('corrupt');
  expect(loaded.warning).toBeTruthy();
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  expect(persistence.readRecoverySnapshot()).toMatchObject({
    source: LEGACY_STORAGE_KEY,
    reason: 'corrupt',
    raw,
  });
  expect(JSON.parse(localStorage.getItem(RECOVERY_KEY)!).raw).toBe(raw);
});

describe('guarded storage generation', () => {
  it('imports the released v1 fixture once and survives restart', async () => {
    const legacy = JSON.stringify(releasedV1);
    localStorage.setItem(LEGACY_STORAGE_KEY, legacy);
    const first = await gateway().openStore();
    expect(first).toMatchObject({ status: 'recovered', revision: 1, canPersist: true });
    expect(first.store.profiles.map((profile) => profile.id)).toEqual([
      'fixture-profile-a',
      'fixture-profile-b',
    ]);
    const canonical = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(canonical).toMatchObject({
      format: 'brain-garden-store',
      schemaVersion: 1,
      revision: 1,
    });
    expect(canonical.store).toEqual(first.store);
    expect(JSON.parse(localStorage.getItem(RECOVERY_KEY)!).raw).toBe(legacy);

    const restarted = await gateway().openStore();
    expect(restarted).toMatchObject({ status: 'ready', revision: 1 });
    expect(restarted.store).toEqual(first.store);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(canonical));
  });

  it('blocks legacy import when the recovery snapshot cannot be written', async () => {
    const legacy = JSON.stringify(releasedV1);
    localStorage.setItem(LEGACY_STORAGE_KEY, legacy);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    const loaded = await gateway().openStore();
    expect(loaded).toMatchObject({
      status: 'unavailable',
      canPersist: false,
      raw: legacy,
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBe(legacy);
  });

  it('resumes a pending import after a canonical commit failure without duplicating data', async () => {
    const legacy = JSON.stringify(releasedV1);
    localStorage.setItem(LEGACY_STORAGE_KEY, legacy);
    const interrupted = createStoreGateway({
      storage: {
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => {
          if (key === STORAGE_KEY) throw new Error('commit blocked');
          localStorage.setItem(key, value);
        },
        removeItem: (key) => localStorage.removeItem(key),
      },
      locks: testLocks(),
      now: () => new Date('2026-11-08T10:00:00.000Z'),
    });
    const failed = await interrupted.openStore();
    expect(failed).toMatchObject({
      status: 'unavailable',
      canPersist: false,
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBe(legacy);
    expect(JSON.parse(localStorage.getItem(MARKER_KEY)!)).toMatchObject({
      state: 'pending',
      source: 'legacy',
    });

    const resumed = await gateway().openStore();
    expect(resumed).toMatchObject({ status: 'recovered', canPersist: true });
    expect(resumed.store.profiles.map((profile) => profile.id)).toEqual([
      'fixture-profile-a',
      'fixture-profile-b',
    ]);
    expect(JSON.parse(localStorage.getItem(MARKER_KEY)!)).toMatchObject({
      state: 'committed',
      source: 'legacy',
    });
  });

  it('never reimports stale legacy data after a profile deletion', async () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(releasedV1));
    const persistence = gateway();
    await persistence.openStore();
    const deleted = await persistence.transactStore((store) => ({
      ...store,
      activeProfileId: 'fixture-profile-a',
      profiles: store.profiles.filter((profile) => profile.id !== 'fixture-profile-b'),
    }));
    expect(deleted.saved).toBe(true);
    expect(localStorage.getItem(RECOVERY_KEY)).toBeNull();

    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        ...releasedV1,
        activeProfileId: 'fixture-profile-b',
      }),
    );
    const restarted = await gateway().openStore();
    expect(restarted.status).toBe('ready');
    expect(restarted.store.profiles.map((profile) => profile.id)).toEqual(['fixture-profile-a']);
    expect(restarted.store.activeProfileId).toBe('fixture-profile-a');
  });

  it('does not reimport legacy data when a committed canonical key disappears', async () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(releasedV1));
    await gateway().openStore();
    expect(JSON.parse(localStorage.getItem(MARKER_KEY)!)).toMatchObject({
      state: 'committed',
      source: 'legacy',
    });
    localStorage.removeItem(STORAGE_KEY);

    const missing = await gateway().openStore();
    expect(missing).toMatchObject({ status: 'unavailable', canPersist: false });
    expect(missing.warning).toContain('已经初始化');
    expect(missing.store.profiles).toHaveLength(1);
    expect(missing.store.profiles[0].name).toBe('小花');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('cleans all app-managed legacy and recovery copies when a profile is deleted', async () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(releasedV1));
    localStorage.setItem(LEGACY_RECOVERY_KEY, 'old recovery bytes');
    const persistence = gateway();
    await persistence.openStore();
    expect(localStorage.getItem(RECOVERY_KEY)).not.toBeNull();
    const deleted = await persistence.transactStore((store) => ({
      ...store,
      profiles: store.profiles.filter((profile) => profile.id !== 'fixture-profile-b'),
    }));
    expect(deleted).toMatchObject({ saved: true });
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(RECOVERY_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_RECOVERY_KEY)).toBeNull();
  });

  it('does not commit a profile deletion before every app-managed copy is cleaned', async () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(releasedV1));
    localStorage.setItem(LEGACY_RECOVERY_KEY, 'old recovery bytes');
    const persistence = createStoreGateway({
      storage: {
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => localStorage.setItem(key, value),
        removeItem: (key) => {
          if (key === LEGACY_RECOVERY_KEY) throw new Error('blocked');
          localStorage.removeItem(key);
        },
      },
      locks: testLocks(),
      now: () => new Date('2026-11-08T10:00:00.000Z'),
    });
    await persistence.openStore();
    const deleted = await persistence.transactStore((store) => ({
      ...store,
      profiles: store.profiles.filter((profile) => profile.id !== 'fixture-profile-b'),
    }));
    expect(deleted).toMatchObject({ ok: false, saved: false, rollback: true });
    expect(deleted.error).toContain('未能删除');
    expect(deleted.store.profiles.map((profile) => profile.id)).toEqual([
      'fixture-profile-a',
      'fixture-profile-b',
    ]);
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(RECOVERY_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_RECOVERY_KEY)).toBe('old recovery bytes');
    const canonical = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(canonical.store.profiles).toHaveLength(2);
  });

  it('keeps the canonical profile when deletion cleanup succeeds but commit fails', async () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(releasedV1));
    localStorage.setItem(LEGACY_RECOVERY_KEY, 'old recovery bytes');
    let failCanonicalWrite = false;
    const persistence = createStoreGateway({
      storage: {
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => {
          if (failCanonicalWrite && key === STORAGE_KEY)
            throw new DOMException('Quota exceeded', 'QuotaExceededError');
          localStorage.setItem(key, value);
        },
        removeItem: (key) => localStorage.removeItem(key),
      },
      locks: testLocks(),
      now: () => new Date('2026-11-08T10:00:00.000Z'),
    });
    await persistence.openStore();
    const before = localStorage.getItem(STORAGE_KEY);
    failCanonicalWrite = true;
    const deleted = await persistence.transactStore((store) => ({
      ...store,
      profiles: store.profiles.filter((profile) => profile.id !== 'fixture-profile-b'),
    }));
    expect(deleted).toMatchObject({ ok: false, saved: false, rollback: true });
    expect(deleted.error).toContain('档案删除未完成');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
    const canonical = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(canonical.store.profiles).toHaveLength(2);
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(RECOVERY_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_RECOVERY_KEY)).toBeNull();
  });

  it('serializes mixed clients and applies both writes to the latest revision', async () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(releasedV1));
    const locks = testLocks();
    const first = gateway(locks);
    const second = gateway(locks);
    const opened = await Promise.all([first.openStore(), second.openStore()]);
    expect(opened.map((result) => result.status).sort()).toEqual(['ready', 'recovered']);

    const [soundSaved, avatarSaved] = await Promise.all([
      first.transactStore((store) => ({
        ...store,
        profiles: store.profiles.map((profile) =>
          profile.id === 'fixture-profile-a'
            ? { ...profile, settings: { ...profile.settings, sound: false } }
            : profile,
        ),
      })),
      second.transactStore((store) => ({
        ...store,
        profiles: store.profiles.map((profile) =>
          profile.id === 'fixture-profile-b' ? { ...profile, avatar: 3 } : profile,
        ),
      })),
    ]);
    expect([soundSaved.revision, avatarSaved.revision]).toEqual([2, 3]);
    const restarted = await gateway(locks).openStore();
    expect(restarted.revision).toBe(3);
    expect(restarted.store.profiles[0].settings.sound).toBe(false);
    expect(restarted.store.profiles[1].avatar).toBe(3);
  });

  it('fails closed when no reliable cross-tab lock is available', async () => {
    const persistence = gateway(null);
    const opened = await persistence.openStore();
    expect(opened).toMatchObject({ status: 'unavailable', canPersist: false });
    const write = await persistence.transactStore((store) => ({
      ...store,
      activeProfileId: 'must-not-save',
    }));
    expect(write.saved).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
