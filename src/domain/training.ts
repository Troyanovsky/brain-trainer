import { GAMES, SKILLS, getGame } from './catalog';
import type { GameId, Plan, Profile, Result, Skill } from './types';

export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function shiftDate(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  return dateKey(new Date(year, month - 1, day + days, 12));
}
function hash(value: string): number {
  let h = 2166136261;
  for (const c of value) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function createPlan(profile: Profile, date = dateKey()): Plan {
  if (profile.plans[date]) return profile.plans[date];
  const recent = profile.history.filter(
    (r) =>
      dateKey(new Date(r.completedAt)) >= shiftDate(date, -7) &&
      dateKey(new Date(r.completedAt)) < date,
  );
  const yesterday = profile.plans[shiftDate(date, -1)]?.gameIds ?? [];
  const skills = Object.keys(SKILLS) as Skill[];
  const rankSkill = (skill: Skill) => {
    const records = recent.filter((r) => GAMES.find((g) => g.id === r.gameId)?.skill === skill);
    const accuracy = records.length
      ? records.reduce((sum, r) => sum + r.correct / r.rounds, 0) / records.length
      : 0.5;
    return (
      records.length * 10 + accuracy * 2 + (hash(`${profile.id}:${date}:${skill}`) % 1000) / 1000
    );
  };
  const gameIds = skills
    .sort((a, b) => rankSkill(a) - rankSkill(b))
    .slice(0, 4)
    .map((skill) => {
      const candidates = GAMES.filter((g) => g.skill === skill);
      const rank = (id: GameId) => {
        const count = recent.filter((r) => r.gameId === id).length;
        const all = profile.history.filter((r) => r.gameId === id).slice(-5);
        const accuracy = all.length
          ? all.reduce((sum, r) => sum + r.correct / r.rounds, 0) / all.length
          : 0;
        return (
          (yesterday.includes(id) ? 100 : 0) +
          count * 5 +
          (all.length ? 2 : 0) +
          accuracy +
          (hash(`${date}:${profile.id}:${id}`) % 100) / 100
        );
      };
      return candidates.sort((a, b) => rank(a.id) - rank(b.id))[0].id;
    });
  return { date, gameIds, completedIds: [] };
}
/** Old mechanics remain in activity history but do not set a new game's best or difficulty. */
export function getGameResults(profile: Profile, gameId: GameId): Result[] {
  return profile.history.filter(
    (result) =>
      result.gameId === gameId &&
      (result.rulesVersion ?? 1) === (getGame(gameId).rulesVersion ?? 1),
  );
}
export function getLevel(profile: Profile, gameId: GameId): number {
  const recent = getGameResults(profile, gameId).slice(-5);
  if (!recent.length) return 1;
  const accuracy = recent.reduce((sum, r) => sum + r.correct / r.rounds, 0) / recent.length;
  const last = recent.at(-1)!.level;
  return Math.max(1, Math.min(5, last + (accuracy >= 0.85 ? 1 : accuracy < 0.5 ? -1 : 0)));
}
export function scoreRound(correct: boolean, level: number, elapsedMs: number): number {
  return correct
    ? Math.round(
        (100 + Math.max(0, 50 - Math.max(0, elapsedMs) / 200)) * Math.max(1, Math.min(5, level)),
      )
    : 0;
}
export function recordResult(profile: Profile, result: Result): Profile {
  if (profile.history.some((r) => r.id === result.id)) return profile;
  const plans = { ...profile.plans };
  const plan = result.planDate ? plans[result.planDate] : undefined;
  if (
    result.mode === 'daily' &&
    plan &&
    plan.gameIds.includes(result.gameId) &&
    !plan.completedIds.includes(result.gameId)
  ) {
    plans[plan.date] = { ...plan, completedIds: [...plan.completedIds, result.gameId] };
  }
  return { ...profile, history: [...profile.history, result], plans };
}
export function getStreak(history: Result[], today = dateKey()): number {
  const days = new Set(history.map((r) => dateKey(new Date(r.completedAt))));
  let day = days.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  while (days.has(day)) {
    streak++;
    day = shiftDate(day, -1);
  }
  return streak;
}
export function getWeekActivity(history: Result[], today = dateKey()) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = shiftDate(today, i - 6);
    return { date, count: history.filter((r) => dateKey(new Date(r.completedAt)) === date).length };
  });
}
export function getSkillCoverage(history: Result[]) {
  return (Object.keys(SKILLS) as Skill[]).map((skill) => ({
    skill,
    count: history.filter((r) => GAMES.find((g) => g.id === r.gameId)?.skill === skill).length,
  }));
}
export function getAchievements(profile: Profile) {
  const games = new Set(profile.history.map((r) => r.gameId)).size;
  return [
    {
      id: 'first',
      name: '第一颗种子',
      description: '完成第一次练习',
      icon: 'sprout',
      unlocked: profile.history.length > 0,
    },
    {
      id: 'explore',
      name: '小小探索家',
      description: '体验 5 款不同游戏',
      icon: 'compass',
      unlocked: games >= 5,
    },
    {
      id: 'all',
      name: '全能园丁',
      description: '体验全部 10 款游戏',
      icon: 'flower',
      unlocked: games >= 10,
    },
    {
      id: 'daily',
      name: '今日盛开',
      description: '完成一整天的训练',
      icon: 'sun',
      unlocked: Object.values(profile.plans).some((p) => p.completedIds.length === 4),
    },
    {
      id: 'streak',
      name: '坚持的力量',
      description: '连续练习 3 天',
      icon: 'flame',
      unlocked: profile.history.some(
        (r) => getStreak(profile.history, dateKey(new Date(r.completedAt))) >= 3,
      ),
    },
    {
      id: 'perfect',
      name: '百发百中',
      description: '任意一场全部答对',
      icon: 'target',
      unlocked: profile.history.some((r) => r.correct === r.rounds),
    },
  ];
}
