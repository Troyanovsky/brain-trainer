import { GAMES } from './catalog';
import {
  createStoreEnvelope,
  CURRENT_SCHEMA_VERSION,
  createInitializationMarker,
  decodeInitializationMarker,
  decodeRecoverySnapshot,
  decodeStoreEnvelope,
  fingerprintRaw,
  LEGACY_STORAGE_KEY,
  LEGACY_RECOVERY_KEY,
  LOCK_NAME,
  MAX_RECOVERY_CHARACTERS,
  MARKER_KEY,
  RECOVERY_KEY,
  serializeInitializationMarker,
  serializeRecoverySnapshot,
  serializeStoreEnvelope,
  STORAGE_KEY,
  type InitializationMarker,
  type RecoveryReason,
  type RecoverySnapshot,
  type RecoverySource,
} from './migrations';
import type { GameId, Plan, Profile, Result, Store } from './types';

export {
  CURRENT_SCHEMA_VERSION,
  LEGACY_STORAGE_KEY,
  LEGACY_RECOVERY_KEY,
  LOCK_NAME,
  MARKER_KEY,
  RECOVERY_KEY,
  STORAGE_KEY,
} from './migrations';

export type OpenStoreStatus = 'ready' | 'recovered' | 'unsupported' | 'corrupt' | 'unavailable';

export interface OpenStoreResult {
  status: OpenStoreStatus;
  store: Store;
  revision: number | null;
  raw: string | null;
  warning: string | null;
  canPersist: boolean;
}

export interface StoreTransactionResult {
  ok: boolean;
  saved: boolean;
  store: Store;
  revision: number | null;
  rollback?: boolean;
  error?: string;
  warning?: string;
}

export interface StoreActionResult {
  ok: boolean;
  error?: string;
}

export type StoreMutation = (store: Store) => Store | Promise<Store>;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface StoreRuntime {
  storage: StorageLike;
  locks: Pick<LockManager, 'request'> | null;
  now?: () => Date;
}

export interface StoreGateway {
  openStore(): Promise<OpenStoreResult>;
  transactStore(mutation: StoreMutation): Promise<StoreTransactionResult>;
  readRecoverySnapshot(): RecoverySnapshot | null;
  clearRecoverySnapshot(): Promise<StoreActionResult>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isGame = (value: unknown): value is GameId => GAMES.some((game) => game.id === value);
const isDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day, 12);
  return (
    parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
  );
};
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

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
    const history = rawHistory.filter(validResult).filter((result) => {
      if (seen.has(result.id)) return false;
      seen.add(result.id);
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
  const activeProfileId = profiles.some((profile) => profile.id === data.activeProfileId)
    ? (data.activeProfileId as string)
    : profiles[0].id;
  return {
    store: { version: 1, activeProfileId, profiles },
    warning: repaired ? '部分记录无法读取，已保留其余有效数据。' : null,
  };
}

function assertExactStoreShape(value: unknown): asserts value is Store {
  if (
    !isObject(value) ||
    !hasExactKeys(value, ['version', 'activeProfileId', 'profiles']) ||
    value.version !== 1 ||
    typeof value.activeProfileId !== 'string' ||
    !Array.isArray(value.profiles)
  )
    throw new Error('档案外壳无效');
  for (const profile of value.profiles) {
    if (
      !isObject(profile) ||
      !hasExactKeys(profile, ['id', 'name', 'avatar', 'settings', 'history', 'plans']) ||
      !isObject(profile.settings) ||
      !hasExactKeys(profile.settings, ['sound', 'reducedMotion']) ||
      !Array.isArray(profile.history) ||
      !isObject(profile.plans)
    )
      throw new Error('档案结构无效');
    for (const result of profile.history) {
      if (!isObject(result)) throw new Error('练习结构无效');
      const required = [
        'id',
        'gameId',
        'level',
        'score',
        'correct',
        'rounds',
        'completedAt',
        'duration',
        'mode',
      ];
      const optional = ['planDate', 'rulesVersion'];
      if (Object.keys(result).some((key) => !required.includes(key) && !optional.includes(key)))
        throw new Error('练习包含未知字段');
    }
    for (const plan of Object.values(profile.plans)) {
      if (!isObject(plan) || !hasExactKeys(plan, ['date', 'gameIds', 'completedIds']))
        throw new Error('训练计划结构无效');
    }
  }
}

/**
 * Strict validation is used at every persistence boundary. Unlike parseStore(), repair is not
 * allowed here because dropping an unknown result before writing would make data loss permanent.
 */
export function parseStrictStore(raw: string): Store {
  const parsed = parseStore(raw);
  const value: unknown = JSON.parse(raw);
  assertExactStoreShape(value);
  if (parsed.warning) throw new Error(parsed.warning);
  return parsed.store;
}

function validateStoreValue(value: unknown): Store {
  return parseStrictStore(JSON.stringify(value));
}

function now(runtime: StoreRuntime): Date {
  return runtime.now?.() ?? new Date();
}

function temporaryStore(): Store {
  return createStore();
}

function defaultStore(
  raw: string | null,
  status: OpenStoreStatus,
  warning: string,
): OpenStoreResult {
  return {
    status,
    store: temporaryStore(),
    revision: null,
    raw,
    warning,
    canPersist: false,
  };
}

function readRecovery(runtime: StoreRuntime): RecoverySnapshot | null {
  try {
    const raw = runtime.storage.getItem(RECOVERY_KEY);
    return raw ? decodeRecoverySnapshot(raw) : null;
  } catch {
    return null;
  }
}

function removeStorageKeys(runtime: StoreRuntime, keys: readonly string[]): StoreActionResult {
  const failed: string[] = [];
  for (const key of keys) {
    try {
      runtime.storage.removeItem(key);
      if (runtime.storage.getItem(key) !== null) failed.push(key);
    } catch {
      failed.push(key);
    }
  }
  return failed.length
    ? { ok: false, error: `以下本地副本未能删除：${failed.join('、')}` }
    : { ok: true };
}

function captureRecovery(
  runtime: StoreRuntime,
  raw: string,
  source: RecoverySource,
  reason: RecoveryReason,
): StoreActionResult {
  if (raw.length > MAX_RECOVERY_CHARACTERS)
    return { ok: false, error: '原始记录过大，无法在当前浏览器中建立已校验的快照。' };
  try {
    const existingRaw = runtime.storage.getItem(RECOVERY_KEY);
    if (existingRaw) {
      const existing = decodeRecoverySnapshot(existingRaw);
      if (existing?.raw === raw) return { ok: true };
      return {
        ok: false,
        error: '已有另一份未清除的恢复快照。请先下载或清除它，再重新尝试。',
      };
    }
    const snapshot: RecoverySnapshot = {
      format: 'brain-garden-recovery',
      version: 1,
      capturedAt: now(runtime).toISOString(),
      source,
      reason,
      raw,
    };
    const serialized = serializeRecoverySnapshot(snapshot);
    runtime.storage.setItem(RECOVERY_KEY, serialized);
    const persisted = runtime.storage.getItem(RECOVERY_KEY);
    const verified = persisted ? decodeRecoverySnapshot(persisted) : null;
    if (persisted !== serialized || verified?.raw !== raw)
      return { ok: false, error: '恢复快照写入后校验失败，未修改主记录。' };
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: '无法保存恢复快照；主记录保持不变。请检查浏览器存储空间。',
    };
  }
}

function readCanonical(
  runtime: StoreRuntime,
): ReturnType<typeof decodeStoreEnvelope> | { kind: 'absent' } {
  const raw = runtime.storage.getItem(STORAGE_KEY);
  return raw === null ? { kind: 'absent' } : decodeStoreEnvelope(raw, validateStoreValue);
}

function writeCanonicalVerified(runtime: StoreRuntime, serialized: string): boolean {
  runtime.storage.setItem(STORAGE_KEY, serialized);
  const persisted = runtime.storage.getItem(STORAGE_KEY);
  if (persisted !== serialized) return false;
  return decodeStoreEnvelope(serialized, validateStoreValue).kind === 'ready';
}

function readInitializationMarker(
  runtime: StoreRuntime,
): ReturnType<typeof decodeInitializationMarker> | { kind: 'absent' } {
  const raw = runtime.storage.getItem(MARKER_KEY);
  return raw === null ? { kind: 'absent' } : decodeInitializationMarker(raw);
}

function writeInitializationMarkerVerified(
  runtime: StoreRuntime,
  marker: InitializationMarker,
): boolean {
  const serialized = serializeInitializationMarker(marker);
  runtime.storage.setItem(MARKER_KEY, serialized);
  const persisted = runtime.storage.getItem(MARKER_KEY);
  if (persisted !== serialized) return false;
  return decodeInitializationMarker(serialized).kind === 'ready';
}

function markerForExistingCanonical(
  runtime: StoreRuntime,
  markerRead: ReturnType<typeof readInitializationMarker>,
): StoreActionResult {
  if (markerRead.kind === 'ready' && markerRead.marker.state === 'committed') return { ok: true };
  if (markerRead.kind !== 'absent' && markerRead.kind !== 'ready')
    return {
      ok: false,
      error: '本地初始化标记无法安全读取，已停止新的写入。',
    };
  const previous = markerRead.kind === 'ready' ? markerRead.marker : null;
  const marker = createInitializationMarker(
    'committed',
    previous?.source ?? 'existing',
    previous?.legacyFingerprint ?? null,
    previous?.capturedAt ?? now(runtime).toISOString(),
  );
  return writeInitializationMarkerVerified(runtime, marker)
    ? { ok: true }
    : {
        ok: false,
        error: '无法保存本地初始化标记，已停止新的写入。',
      };
}

function writeMigratedCanonical(
  runtime: StoreRuntime,
  store: Store,
  marker: InitializationMarker,
): { result: OpenStoreResult | null; recoveryRaw?: string } {
  const envelope = createStoreEnvelope(store);
  const serialized = serializeStoreEnvelope(envelope);
  try {
    if (!writeCanonicalVerified(runtime, serialized))
      throw new Error('canonical write verification failed');
  } catch {
    return {
      result: {
        status: 'unavailable',
        store,
        revision: null,
        raw: serialized,
        warning:
          '新版记录写入失败；初始化标记保持待完成状态，旧版原始记录未改动。当前练习不会自动保存。',
        canPersist: false,
      },
    };
  }
  const committed = createInitializationMarker(
    'committed',
    marker.source,
    marker.legacyFingerprint,
    marker.capturedAt,
  );
  if (!writeInitializationMarkerVerified(runtime, committed)) {
    return {
      result: {
        status: 'unavailable',
        store,
        revision: envelope.revision,
        raw: serialized,
        warning:
          '主记录已经写入，但初始化确认标记尚未保存。为避免重复导入，当前练习不会自动保存；重新载入后会继续校验。',
        canPersist: false,
      },
      recoveryRaw: serialized,
    };
  }
  return { result: null };
}

function openUnderLock(runtime: StoreRuntime): OpenStoreResult {
  const canonicalRaw = runtime.storage.getItem(STORAGE_KEY);
  if (canonicalRaw !== null) {
    const marker = markerForExistingCanonical(runtime, readInitializationMarker(runtime));
    const decoded = decodeStoreEnvelope(canonicalRaw, validateStoreValue);
    if (decoded.kind === 'ready')
      return {
        status: 'ready',
        store: decoded.envelope.store,
        revision: decoded.envelope.revision,
        raw: canonicalRaw,
        warning: marker.ok ? null : (marker.error ?? '无法保存本地初始化标记。'),
        canPersist: marker.ok,
      };
    const reason =
      decoded.kind === 'unsupported'
        ? '本地记录来自更新版本的应用，当前版本不会覆盖它。请更新应用。'
        : '本地记录无法安全读取，当前版本已停止写入。';
    const recovery = captureRecovery(
      runtime,
      canonicalRaw,
      STORAGE_KEY,
      decoded.kind === 'unsupported' ? 'unsupported' : 'corrupt',
    );
    return defaultStore(
      canonicalRaw,
      decoded.kind,
      `${reason}${recovery.ok ? '原始数据快照已保留。' : recovery.error ? ` ${recovery.error}` : ''}`,
    );
  }

  const legacyRaw = runtime.storage.getItem(LEGACY_STORAGE_KEY);
  const markerRead = readInitializationMarker(runtime);
  if (markerRead.kind === 'unsupported' || markerRead.kind === 'corrupt')
    return defaultStore(
      legacyRaw,
      markerRead.kind,
      `${markerRead.reason} 为避免重复导入，当前版本不会回退到旧版记录。`,
    );
  if (markerRead.kind === 'ready' && markerRead.marker.state === 'committed')
    return defaultStore(
      legacyRaw,
      'unavailable',
      '这个花园已经初始化，但主记录当前缺失。为避免恢复已删除的档案，当前版本不会重新导入旧版数据。请下载原始数据并检查浏览器存储。',
    );
  if (markerRead.kind === 'ready' && markerRead.marker.source === 'existing')
    return defaultStore(
      legacyRaw,
      'unavailable',
      '主记录的初始化状态不完整，当前版本不会回退到旧版数据。',
    );

  const source =
    markerRead.kind === 'ready'
      ? markerRead.marker.source
      : legacyRaw === null
        ? 'fresh'
        : 'legacy';
  let store: Store;
  let pendingMarker: InitializationMarker;
  if (source === 'legacy') {
    if (legacyRaw === null)
      return defaultStore(
        null,
        'unavailable',
        '旧版导入尚未完成，但原始记录已不存在。为避免恢复不一致的数据，当前版本不会重新开始导入。',
      );
    if (markerRead.kind === 'ready') {
      if (markerRead.marker.legacyFingerprint !== fingerprintRaw(legacyRaw))
        return defaultStore(
          legacyRaw,
          'unavailable',
          '旧版记录在中断的导入期间发生了变化。为避免重复或丢失结果，当前版本不会继续自动导入。',
        );
    }
    try {
      store = parseStrictStore(legacyRaw);
    } catch {
      const recovery = captureRecovery(runtime, legacyRaw, LEGACY_STORAGE_KEY, 'corrupt');
      return defaultStore(
        legacyRaw,
        'corrupt',
        `旧版记录包含无法安全识别的数据，未执行导入或覆盖。${recovery.ok ? '原始数据快照已保留。' : recovery.error ? ` ${recovery.error}` : ''}`,
      );
    }
    const recovery = captureRecovery(runtime, legacyRaw, LEGACY_STORAGE_KEY, 'legacy-import');
    if (!recovery.ok)
      return {
        status: 'unavailable',
        store,
        revision: null,
        raw: legacyRaw,
        warning: `旧版记录已读取，但${recovery.error ?? '无法建立恢复快照。'} 当前练习不会自动保存。`,
        canPersist: false,
      };
    pendingMarker =
      markerRead.kind === 'ready'
        ? markerRead.marker
        : createInitializationMarker(
            'pending',
            'legacy',
            fingerprintRaw(legacyRaw),
            now(runtime).toISOString(),
          );
  } else {
    store = temporaryStore();
    pendingMarker =
      markerRead.kind === 'ready'
        ? markerRead.marker
        : createInitializationMarker('pending', 'fresh', null, now(runtime).toISOString());
  }

  if (markerRead.kind === 'absent') {
    try {
      if (!writeInitializationMarkerVerified(runtime, pendingMarker))
        throw new Error('marker write failed');
    } catch {
      return {
        status: 'unavailable',
        store,
        revision: null,
        raw: source === 'legacy' ? legacyRaw : null,
        warning: '无法保存初始化标记；为避免重复导入，主记录尚未创建。当前练习不会自动保存。',
        canPersist: false,
      };
    }
  }
  const migrated = writeMigratedCanonical(runtime, store, pendingMarker);
  if (migrated.result) return migrated.result;
  const envelope = createStoreEnvelope(store);
  const serialized = serializeStoreEnvelope(envelope);
  return {
    status: source === 'legacy' ? 'recovered' : 'ready',
    store,
    revision: envelope.revision,
    raw: source === 'legacy' ? legacyRaw : serialized,
    warning:
      source === 'legacy' ? '旧版记录已安全导入。恢复快照保留在本机，原始数据可下载。' : null,
    canPersist: true,
  };
}

function inspectWithoutLock(runtime: StoreRuntime): OpenStoreResult {
  const canonicalRaw = runtime.storage.getItem(STORAGE_KEY);
  if (canonicalRaw !== null) {
    const decoded = decodeStoreEnvelope(canonicalRaw, validateStoreValue);
    if (decoded.kind === 'ready')
      return {
        status: 'unavailable',
        store: decoded.envelope.store,
        revision: decoded.envelope.revision,
        raw: canonicalRaw,
        warning: '浏览器没有提供可靠的跨页面写入锁。当前练习可以继续，但不会自动保存。',
        canPersist: false,
      };
    return defaultStore(
      canonicalRaw,
      decoded.kind,
      decoded.kind === 'unsupported'
        ? '本地记录来自更新版本的应用；当前版本不会覆盖它。原始数据可以下载。'
        : '本地记录无法安全读取；当前版本不会覆盖它。原始数据可以下载。',
    );
  }
  const legacyRaw = runtime.storage.getItem(LEGACY_STORAGE_KEY);
  const markerRead = readInitializationMarker(runtime);
  if (markerRead.kind === 'unsupported' || markerRead.kind === 'corrupt')
    return defaultStore(
      legacyRaw,
      markerRead.kind,
      `${markerRead.reason} 为避免重复导入，当前版本不会回退到旧版记录。`,
    );
  if (
    markerRead.kind === 'ready' &&
    (markerRead.marker.state === 'committed' || markerRead.marker.source === 'existing')
  )
    return defaultStore(
      legacyRaw,
      'unavailable',
      '这个花园已经初始化，但主记录当前缺失。为避免恢复已删除的档案，当前版本不会重新导入旧版数据。',
    );
  if (legacyRaw !== null) {
    try {
      return {
        status: 'unavailable',
        store: parseStrictStore(legacyRaw),
        revision: null,
        raw: legacyRaw,
        warning: '浏览器没有提供可靠的跨页面写入锁，旧版记录尚未导入。当前练习不会自动保存。',
        canPersist: false,
      };
    } catch {
      return defaultStore(
        legacyRaw,
        'corrupt',
        '旧版记录包含无法安全识别的数据，未执行导入或覆盖。原始数据可以下载。',
      );
    }
  }
  return defaultStore(
    null,
    'unavailable',
    '浏览器没有提供可靠的跨页面写入锁。当前练习可以继续，但不会自动保存。',
  );
}

export function createStoreGateway(runtime: StoreRuntime): StoreGateway {
  async function openStore(): Promise<OpenStoreResult> {
    if (!runtime.locks)
      try {
        return inspectWithoutLock(runtime);
      } catch {
        return defaultStore(
          null,
          'unavailable',
          '本地数据暂时无法读取。当前使用临时档案，保存前请检查浏览器存储设置。',
        );
      }
    try {
      return await runtime.locks.request(LOCK_NAME, { mode: 'exclusive' }, () =>
        openUnderLock(runtime),
      );
    } catch {
      return defaultStore(
        null,
        'unavailable',
        '无法取得本地记录写入锁。当前使用临时档案，练习不会自动保存。',
      );
    }
  }

  async function transactStore(mutation: StoreMutation): Promise<StoreTransactionResult> {
    if (!runtime.locks) {
      let store: Store;
      try {
        const canonical = readCanonical(runtime);
        store = canonical.kind === 'ready' ? canonical.envelope.store : temporaryStore();
      } catch {
        store = temporaryStore();
      }
      return {
        ok: false,
        saved: false,
        store,
        revision: null,
        error: '浏览器没有提供可靠的跨页面写入锁，本次修改未保存。',
      };
    }
    try {
      return await runtime.locks.request(LOCK_NAME, { mode: 'exclusive' }, async () => {
        const opened = openUnderLock(runtime);
        if (!opened.canPersist)
          return {
            ok: false,
            saved: false,
            store: opened.store,
            revision: opened.revision,
            error: opened.warning ?? '本地记录处于只读保护状态。',
          };
        let currentRevision: number;
        let currentStore: Store;
        try {
          const canonicalRaw = runtime.storage.getItem(STORAGE_KEY)!;
          const decoded = decodeStoreEnvelope(canonicalRaw, validateStoreValue);
          if (decoded.kind !== 'ready') throw new Error('canonical unavailable');
          currentRevision = decoded.envelope.revision;
          currentStore = decoded.envelope.store;
        } catch {
          return {
            ok: false,
            saved: false,
            store: opened.store,
            revision: opened.revision,
            error: '本地记录在写入前发生了变化，本次修改未保存。',
          };
        }
        let nextStore: Store;
        try {
          nextStore = validateStoreValue(await mutation(currentStore));
        } catch {
          return {
            ok: false,
            saved: false,
            store: currentStore,
            revision: currentRevision,
            error: '这次修改没有通过数据校验，已保留原有记录。',
          };
        }
        if (JSON.stringify(nextStore) === JSON.stringify(currentStore))
          return {
            ok: true,
            saved: true,
            store: currentStore,
            revision: currentRevision,
          };

        const removedProfiles = currentStore.profiles.some(
          (profile) => !nextStore.profiles.some((next) => next.id === profile.id),
        );
        if (removedProfiles) {
          const cleanup = removeStorageKeys(runtime, [
            LEGACY_STORAGE_KEY,
            RECOVERY_KEY,
            LEGACY_RECOVERY_KEY,
          ]);
          if (!cleanup.ok)
            return {
              ok: false,
              saved: false,
              store: currentStore,
              revision: currentRevision,
              rollback: true,
              error: `档案删除未完成：${cleanup.error ?? '部分本地副本未能清除。'} 当前档案和其他档案的当前主记录保持不变；请在存储恢复后重新载入并重试。`,
            };
        }

        const revision = currentRevision + 1;
        const envelope = createStoreEnvelope(nextStore, revision);
        const serialized = serializeStoreEnvelope(envelope);
        try {
          if (!writeCanonicalVerified(runtime, serialized)) throw new Error('verification failed');
        } catch {
          return {
            ok: false,
            saved: false,
            store: currentStore,
            revision: currentRevision,
            ...(removedProfiles ? { rollback: true } : {}),
            error: removedProfiles
              ? '档案删除未完成：主记录写入失败，当前档案仍保留。本地旧版与恢复副本已清除；请在存储恢复后重新载入并重试。'
              : '本次修改尚未保存：浏览器存储失败。请保持页面打开并检查存储空间。',
          };
        }

        return {
          ok: true,
          saved: true,
          store: nextStore,
          revision,
        };
      });
    } catch {
      let store = temporaryStore();
      try {
        const canonical = readCanonical(runtime);
        if (canonical.kind === 'ready') store = canonical.envelope.store;
      } catch {
        // The caller will keep its temporary state and display the write error.
      }
      return {
        ok: false,
        saved: false,
        store,
        revision: null,
        error: '无法取得本地记录写入锁，本次修改未保存。',
      };
    }
  }

  async function clearRecoverySnapshot(): Promise<StoreActionResult> {
    if (!runtime.locks) return { ok: false, error: '浏览器没有提供可靠的写入锁，恢复快照未删除。' };
    try {
      return await runtime.locks.request(LOCK_NAME, { mode: 'exclusive' }, () => {
        return removeStorageKeys(runtime, [RECOVERY_KEY, LEGACY_RECOVERY_KEY]);
      });
    } catch {
      return { ok: false, error: '无法取得写入锁，恢复快照未删除。' };
    }
  }

  return {
    openStore,
    transactStore,
    readRecoverySnapshot: () => readRecovery(runtime),
    clearRecoverySnapshot,
  };
}

function defaultGateway(): StoreGateway {
  return createStoreGateway({
    storage: localStorage,
    locks:
      typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks
        ? navigator.locks
        : null,
  });
}

export function openStore(): Promise<OpenStoreResult> {
  return defaultGateway().openStore();
}

export function transactStore(mutation: StoreMutation): Promise<StoreTransactionResult> {
  return defaultGateway().transactStore(mutation);
}

export function readRecoverySnapshot(): RecoverySnapshot | null {
  return defaultGateway().readRecoverySnapshot();
}

export function clearRecoverySnapshot(): Promise<StoreActionResult> {
  return defaultGateway().clearRecoverySnapshot();
}
