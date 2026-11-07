import { GAMES } from './catalog';
import type { GameId, Plan, Profile, Result, Store } from './types';
export const STORAGE_KEY = 'brain-garden-v1';
export function createProfile(name: string, avatar = 0): Profile {
  return {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 12) || '小花',
    avatar,
    settings: { sound: true, reducedMotion: false },
    history: [],
    plans: {},
  };
}
export function createStore(): Store {
  const profile = createProfile('小花');
  return { version: 1, activeProfileId: profile.id, profiles: [profile] };
}
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isGame = (value: unknown): value is GameId => GAMES.some((g) => g.id === value);
const isDate = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(new Date(`${v}T12:00:00`).getTime()) &&
  new Date(`${v}T12:00:00`).getDate() === Number(v.slice(8));
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
function validResult(value: unknown): value is Result {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    isGame(value.gameId) &&
    Number.isInteger(value.level) &&
    (value.level as number) >= 1 &&
    (value.level as number) <= 5 &&
    finite(value.score) &&
    value.score >= 0 &&
    Number.isInteger(value.rounds) &&
    (value.rounds as number) > 0 &&
    Number.isInteger(value.correct) &&
    (value.correct as number) >= 0 &&
    (value.correct as number) <= (value.rounds as number) &&
    finite(value.duration) &&
    value.duration >= 0 &&
    typeof value.completedAt === 'string' &&
    !Number.isNaN(Date.parse(value.completedAt)) &&
    (value.mode === 'free' || value.mode === 'daily') &&
    (value.planDate === undefined || isDate(value.planDate)) &&
    (value.rulesVersion === undefined ||
      (Number.isInteger(value.rulesVersion) && (value.rulesVersion as number) >= 1))
  );
}
function validPlan(value: unknown, key: string): value is Plan {
  if (
    !isObject(value) ||
    !isDate(key) ||
    value.date !== key ||
    !Array.isArray(value.gameIds) ||
    !Array.isArray(value.completedIds)
  )
    return false;
  return (
    value.gameIds.length === 4 &&
    new Set(value.gameIds).size === 4 &&
    value.gameIds.every(isGame) &&
    new Set(value.completedIds).size === value.completedIds.length &&
    value.completedIds.every((id) => (value.gameIds as unknown[]).includes(id))
  );
}
/** Invalid records are isolated; a damaged profile never inherits another profile's history. */
export function parseStore(raw: string): { store: Store; warning: string | null } {
  const data: unknown = JSON.parse(raw);
  if (
    !isObject(data) ||
    data.version !== 1 ||
    !Array.isArray(data.profiles) ||
    !data.profiles.length
  )
    throw new Error('不支持的数据格式');
  let repaired = false;
  const ids = new Set<string>();
  const profiles: Profile[] = [];
  for (const value of data.profiles) {
    if (
      !isObject(value) ||
      typeof value.id !== 'string' ||
      !value.id ||
      ids.has(value.id) ||
      typeof value.name !== 'string' ||
      !value.name.trim()
    ) {
      repaired = true;
      continue;
    }
    ids.add(value.id);
    const rawHistory = Array.isArray(value.history) ? value.history : [];
    const seen = new Set<string>();
    const history = rawHistory.filter(validResult).filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    const plans: Record<string, Plan> = {};
    if (isObject(value.plans))
      for (const [key, plan] of Object.entries(value.plans)) {
        if (validPlan(plan, key)) plans[key] = plan;
        else repaired = true;
      }
    if (history.length !== rawHistory.length || !Array.isArray(value.history)) repaired = true;
    profiles.push({
      id: value.id,
      name: value.name.trim().slice(0, 12),
      avatar:
        Number.isInteger(value.avatar) &&
        (value.avatar as number) >= 0 &&
        (value.avatar as number) < 4
          ? (value.avatar as number)
          : 0,
      settings: {
        sound: isObject(value.settings) ? value.settings.sound !== false : true,
        reducedMotion: isObject(value.settings) && value.settings.reducedMotion === true,
      },
      history,
      plans,
    });
  }
  if (!profiles.length) throw new Error('没有可读取的档案');
  const activeProfileId = profiles.some((p) => p.id === data.activeProfileId)
    ? (data.activeProfileId as string)
    : profiles[0].id;
  return {
    store: { version: 1, activeProfileId, profiles },
    warning: repaired ? '部分记录无法读取，已保留其余有效数据。' : null,
  };
}
export function loadStore(): { store: Store; warning: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseStore(raw) : { store: createStore(), warning: null };
  } catch {
    return {
      store: createStore(),
      warning: '本地数据暂时无法读取。当前使用临时档案，保存前请检查浏览器存储设置。',
    };
  }
}
export function saveStore(store: Store): { ok: boolean; error?: string } {
  try {
    const previous = localStorage.getItem(STORAGE_KEY);
    if (previous) {
      let needsRecovery = false;
      try {
        needsRecovery = parseStore(previous).warning !== null;
      } catch {
        needsRecovery = true;
      }
      // Preserve the original before replacing damaged or newer-version data.
      // If a recovery copy cannot be saved, do not overwrite the original.
      if (needsRecovery) localStorage.setItem('brain-garden-recovery-v1', previous);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: '记录尚未保存：设备存储空间不足或浏览器禁用了存储。请保持此页面打开。',
    };
  }
}
