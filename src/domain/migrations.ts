import type { Store } from './types';

export const STORAGE_KEY = 'brain-garden-store';
export const LEGACY_STORAGE_KEY = 'brain-garden-v1';
export const RECOVERY_KEY = 'brain-garden-recovery';
export const LEGACY_RECOVERY_KEY = 'brain-garden-recovery-v1';
export const MARKER_KEY = 'brain-garden-store-initialized';
export const LOCK_NAME = 'brain-garden-store-write';
export const CURRENT_SCHEMA_VERSION = 1 as const;
export const MAX_RECOVERY_CHARACTERS = 1_000_000;

export interface StoreEnvelope {
  format: 'brain-garden-store';
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  revision: number;
  store: Store;
}

export type RecoverySource = typeof STORAGE_KEY | typeof LEGACY_STORAGE_KEY;
export type RecoveryReason = 'legacy-import' | 'unsupported' | 'corrupt';

export interface RecoverySnapshot {
  format: 'brain-garden-recovery';
  version: 1;
  capturedAt: string;
  source: RecoverySource;
  reason: RecoveryReason;
  raw: string;
}

export type InitializationSource = 'fresh' | 'legacy' | 'existing';

export interface InitializationMarker {
  format: 'brain-garden-store-initialized';
  version: 1;
  state: 'pending' | 'committed';
  source: InitializationSource;
  legacyFingerprint: string | null;
  capturedAt: string;
}

export type DecodeEnvelopeResult =
  | { kind: 'ready'; envelope: StoreEnvelope }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'corrupt'; reason: string };
export type DecodeMarkerResult =
  | { kind: 'ready'; marker: InitializationMarker }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'corrupt'; reason: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function createStoreEnvelope(store: Store, revision = 1): StoreEnvelope {
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('存储修订号无效');
  return {
    format: 'brain-garden-store',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision,
    store,
  };
}

export function serializeStoreEnvelope(envelope: StoreEnvelope): string {
  return JSON.stringify(envelope);
}

export function decodeStoreEnvelope(
  raw: string,
  validateStore: (value: unknown) => Store,
): DecodeEnvelopeResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kind: 'corrupt', reason: '本地记录不是有效的 JSON。' };
  }
  if (!isObject(data)) return { kind: 'corrupt', reason: '本地记录不是对象。' };
  if (!Number.isInteger(data.schemaVersion) || (data.schemaVersion as number) < 1)
    return { kind: 'corrupt', reason: '本地记录缺少有效的存储版本。' };
  if ((data.schemaVersion as number) > CURRENT_SCHEMA_VERSION)
    return { kind: 'unsupported', reason: '本地记录来自更新版本的应用。' };
  if (
    !hasExactKeys(data, ['format', 'schemaVersion', 'revision', 'store']) ||
    data.format !== 'brain-garden-store' ||
    data.schemaVersion !== CURRENT_SCHEMA_VERSION ||
    !Number.isSafeInteger(data.revision) ||
    (data.revision as number) < 1
  )
    return { kind: 'corrupt', reason: '本地记录的存储外壳无效。' };
  try {
    const store = validateStore(data.store);
    return {
      kind: 'ready',
      envelope: createStoreEnvelope(store, data.revision as number),
    };
  } catch {
    return { kind: 'corrupt', reason: '本地记录的档案内容无效。' };
  }
}

export function serializeRecoverySnapshot(snapshot: RecoverySnapshot): string {
  return JSON.stringify(snapshot);
}

export function decodeRecoverySnapshot(raw: string): RecoverySnapshot | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !isObject(data) ||
    !hasExactKeys(data, ['format', 'version', 'capturedAt', 'source', 'reason', 'raw']) ||
    data.format !== 'brain-garden-recovery' ||
    data.version !== 1 ||
    typeof data.capturedAt !== 'string' ||
    Number.isNaN(Date.parse(data.capturedAt)) ||
    (data.source !== STORAGE_KEY && data.source !== LEGACY_STORAGE_KEY) ||
    (data.reason !== 'legacy-import' &&
      data.reason !== 'unsupported' &&
      data.reason !== 'corrupt') ||
    typeof data.raw !== 'string'
  )
    return null;
  return data as unknown as RecoverySnapshot;
}

export function fingerprintRaw(raw: string): string {
  let first = 2166136261;
  let second = 2246822519;
  for (let index = 0; index < raw.length; index++) {
    const value = raw.charCodeAt(index);
    first = Math.imul(first ^ value, 16777619);
    second = Math.imul(second ^ value, 3266489917);
  }
  return `${raw.length}:${(first >>> 0).toString(16)}:${(second >>> 0).toString(16)}`;
}

export function createInitializationMarker(
  state: InitializationMarker['state'],
  source: InitializationSource,
  legacyFingerprint: string | null,
  capturedAt: string,
): InitializationMarker {
  if (source === 'legacy' && !legacyFingerprint) throw new Error('旧版记录指纹缺失');
  if (source !== 'legacy' && legacyFingerprint !== null) throw new Error('初始化标记指纹无效');
  return {
    format: 'brain-garden-store-initialized',
    version: 1,
    state,
    source,
    legacyFingerprint,
    capturedAt,
  };
}

export function serializeInitializationMarker(marker: InitializationMarker): string {
  return JSON.stringify(marker);
}

export function decodeInitializationMarker(raw: string): DecodeMarkerResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kind: 'corrupt', reason: '初始化标记不是有效的 JSON。' };
  }
  if (!isObject(data) || !Number.isInteger(data.version) || (data.version as number) < 1)
    return { kind: 'corrupt', reason: '初始化标记缺少有效版本。' };
  if ((data.version as number) > 1)
    return { kind: 'unsupported', reason: '初始化标记来自更新版本的应用。' };
  if (
    !hasExactKeys(data, [
      'format',
      'version',
      'state',
      'source',
      'legacyFingerprint',
      'capturedAt',
    ]) ||
    data.format !== 'brain-garden-store-initialized' ||
    data.version !== 1 ||
    (data.state !== 'pending' && data.state !== 'committed') ||
    (data.source !== 'fresh' && data.source !== 'legacy' && data.source !== 'existing') ||
    (typeof data.legacyFingerprint !== 'string' && data.legacyFingerprint !== null) ||
    typeof data.capturedAt !== 'string' ||
    Number.isNaN(Date.parse(data.capturedAt)) ||
    (data.source === 'legacy'
      ? typeof data.legacyFingerprint !== 'string' || !data.legacyFingerprint
      : data.legacyFingerprint !== null)
  )
    return { kind: 'corrupt', reason: '初始化标记结构无效。' };
  return { kind: 'ready', marker: data as unknown as InitializationMarker };
}
