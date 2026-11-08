import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const STORAGE_KEY = 'brain-garden-store';
const LEGACY_KEY = 'brain-garden-v1';
const RECOVERY_KEY = 'brain-garden-recovery';
const LEGACY_RECOVERY_KEY = 'brain-garden-recovery-v1';
const fixturePath = fileURLToPath(new URL('../fixtures/storage/released-v1.json', import.meta.url));

async function loadFixture() {
  return readFile(fixturePath, 'utf8');
}

async function seedLegacy(page: Page, raw: string) {
  await page.addInitScript(
    ({ storageKey, legacyKey, legacyRaw }) => {
      if (localStorage.getItem(storageKey) === null && localStorage.getItem(legacyKey) === null)
        localStorage.setItem(legacyKey, legacyRaw);
    },
    { storageKey: STORAGE_KEY, legacyKey: LEGACY_KEY, legacyRaw: raw },
  );
}

async function waitForGarden(page: Page) {
  await page.goto('/');
  await expect(page.locator('.hero-progress')).toBeVisible();
}

test('imports legacy data once and never reimports stale legacy writes', async ({ page }) => {
  const legacy = await loadFixture();
  await seedLegacy(page, legacy);
  await waitForGarden(page);

  await expect
    .poll(() =>
      page.evaluate(
        ({ storageKey, recoveryKey }) => {
          const canonical = localStorage.getItem(storageKey);
          const recovery = localStorage.getItem(recoveryKey);
          if (!canonical || !recovery) return null;
          const envelope = JSON.parse(canonical);
          const snapshot = JSON.parse(recovery);
          return {
            format: envelope.format,
            schemaVersion: envelope.schemaVersion,
            revision: envelope.revision,
            historyId: envelope.store.profiles[0].history[0].id,
            snapshotRaw: snapshot.raw,
          };
        },
        { storageKey: STORAGE_KEY, recoveryKey: RECOVERY_KEY },
      ),
    )
    .toMatchObject({
      format: 'brain-garden-store',
      schemaVersion: 1,
      historyId: 'fixture-result-a',
      snapshotRaw: legacy,
    });

  await page.evaluate((legacyKey) => {
    const stale = JSON.parse(localStorage.getItem(legacyKey)!);
    stale.activeProfileId = 'fixture-profile-b';
    stale.profiles[0].history = [];
    localStorage.setItem(legacyKey, JSON.stringify(stale));
  }, LEGACY_KEY);
  const beforeReload = await page.evaluate(
    (storageKey) => localStorage.getItem(storageKey),
    STORAGE_KEY,
  );
  await page.reload();
  await expect(page.locator('.hero-progress')).toBeVisible();
  const afterReload = await page.evaluate(
    (storageKey) => JSON.parse(localStorage.getItem(storageKey)!),
    STORAGE_KEY,
  );
  expect(afterReload.store.profiles[0].history[0].id).toBe('fixture-result-a');
  expect(afterReload.store.activeProfileId).toBe('fixture-profile-a');
  expect(JSON.parse(beforeReload!).format).toBe('brain-garden-store');
});

test('blocks future canonical data and downloads it ahead of an older recovery snapshot', async ({
  page,
}) => {
  const raw = JSON.stringify({
    format: 'brain-garden-store',
    schemaVersion: 99,
    revision: 7,
    store: {
      version: 1,
      activeProfileId: 'future-profile',
      profiles: [],
    },
  });
  const olderSnapshotRaw = '{"older":"recovery-copy"}';
  const olderSnapshot = JSON.stringify({
    format: 'brain-garden-recovery',
    version: 1,
    capturedAt: '2026-11-07T10:00:00.000Z',
    source: STORAGE_KEY,
    reason: 'corrupt',
    raw: olderSnapshotRaw,
  });
  await page.addInitScript(
    ({ storageKey, recoveryKey, canonicalRaw, snapshotRaw }) => {
      localStorage.setItem(storageKey, canonicalRaw);
      localStorage.setItem(recoveryKey, snapshotRaw);
    },
    {
      storageKey: STORAGE_KEY,
      recoveryKey: RECOVERY_KEY,
      canonicalRaw: raw,
      snapshotRaw: olderSnapshot,
    },
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('更新版本');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载原始数据' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^brain-garden-raw-\d{4}-\d{2}-\d{2}\.txt$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  expect(await readFile(path!, 'utf8')).toBe(raw);
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), STORAGE_KEY)).toBe(
    raw,
  );

  await page.getByRole('button', { name: '删除恢复快照' }).click();
  await expect
    .poll(() => page.evaluate((recoveryKey) => localStorage.getItem(recoveryKey), RECOVERY_KEY))
    .toBeNull();
  const protectedDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载原始数据' }).click();
  const protectedDownload = await protectedDownloadPromise;
  const protectedPath = await protectedDownload.path();
  expect(protectedPath).toBeTruthy();
  expect(await readFile(protectedPath!, 'utf8')).toBe(raw);
});

test('rejects unknown legacy games without creating canonical data', async ({ page }) => {
  const legacy = JSON.parse(await loadFixture());
  legacy.profiles[0].history[0] = {
    ...legacy.profiles[0].history[0],
    gameId: 'future-unknown-game',
  };
  const raw = JSON.stringify(legacy);
  await seedLegacy(page, raw);
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('无法安全识别');
  await expect(page.getByRole('button', { name: '下载原始数据' })).toBeVisible();
  expect(
    await page.evaluate((storageKey) => localStorage.getItem(storageKey), STORAGE_KEY),
  ).toBeNull();
  expect(await page.evaluate((legacyKey) => localStorage.getItem(legacyKey), LEGACY_KEY)).toBe(raw);
});

test('removes the downloaded recovery snapshot after import', async ({ page }) => {
  await seedLegacy(page, await loadFixture());
  await waitForGarden(page);
  const deleteSnapshot = page.getByRole('button', { name: '删除恢复快照' });
  await expect(deleteSnapshot).toBeVisible();
  await deleteSnapshot.click();
  await expect
    .poll(() => page.evaluate((recoveryKey) => localStorage.getItem(recoveryKey), RECOVERY_KEY))
    .toBeNull();
  await expect(page.getByRole('button', { name: '下载原始数据' })).toHaveCount(0);
  await expect(page.getByText('本机保留了一次已校验的原始数据快照。')).toHaveCount(0);
});

test('blocks profile deletion and keeps cleanup failure visible through the next auto save', async ({
  page,
}) => {
  const legacy = await loadFixture();
  await page.addInitScript(
    ({ storageKey, legacyKey, recoveryKey, legacyRecoveryKey, legacyRaw }) => {
      const originalRemoveItem = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (key: string) {
        if (key === legacyRecoveryKey)
          throw new DOMException('blocked for regression test', 'UnknownError');
        return originalRemoveItem.call(this, key);
      };
      if (localStorage.getItem(storageKey) === null && localStorage.getItem(legacyKey) === null)
        localStorage.setItem(legacyKey, legacyRaw);
      if (localStorage.getItem(legacyRecoveryKey) === null)
        localStorage.setItem(legacyRecoveryKey, 'old app-managed recovery bytes');
      localStorage.setItem(
        recoveryKey,
        JSON.stringify({
          format: 'brain-garden-recovery',
          version: 1,
          capturedAt: '2026-11-07T10:00:00.000Z',
          source: legacyKey,
          reason: 'legacy-import',
          raw: legacyRaw,
        }),
      );
    },
    {
      storageKey: STORAGE_KEY,
      legacyKey: LEGACY_KEY,
      recoveryKey: RECOVERY_KEY,
      legacyRecoveryKey: LEGACY_RECOVERY_KEY,
      legacyRaw: legacy,
    },
  );
  await waitForGarden(page);

  await page.getByRole('button', { name: '管理用户档案' }).first().click();
  await page.getByRole('button', { name: '编辑小花' }).click();
  await page.getByRole('button', { name: '删除这个档案' }).click();
  await expect(page.getByRole('dialog')).toContainText('其他档案的当前记录不会改变');
  await expect(page.getByRole('dialog')).toContainText('需要你自行删除');
  await page.getByRole('button', { name: '确认删除', exact: true }).click();

  await expect
    .poll(() =>
      page.evaluate((storageKey) => {
        const store = JSON.parse(localStorage.getItem(storageKey)!).store;
        return store.profiles.map((profile: { id: string }) => profile.id);
      }, STORAGE_KEY),
    )
    .toEqual(['fixture-profile-a', 'fixture-profile-b']);
  await expect(page.getByRole('alert')).toContainText('档案删除未完成');
  await expect(page.getByRole('alert')).toContainText('重试');
});

test('keeps independent tab changes when a stale editor saves', async ({ context, page }) => {
  await seedLegacy(page, await loadFixture());
  await waitForGarden(page);
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.locator('.hero-progress')).toBeVisible();

  await page.getByRole('button', { name: '管理用户档案' }).first().click();
  await page.getByRole('button', { name: '当前档案的偏好设置' }).click();
  await page.getByRole('button', { name: '轻快音效' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        (storageKey) =>
          JSON.parse(localStorage.getItem(storageKey)!).store.profiles[0].settings.sound,
        STORAGE_KEY,
      ),
    )
    .toBe(false);

  await second.getByRole('button', { name: '管理用户档案' }).first().click();
  await second.getByRole('button', { name: '当前档案的偏好设置' }).click();
  await second.getByRole('button', { name: '舒缓动画' }).click();
  await expect
    .poll(() =>
      second.evaluate((storageKey) => {
        const store = JSON.parse(localStorage.getItem(storageKey)!).store;
        return store.profiles[0].settings;
      }, STORAGE_KEY),
    )
    .toEqual({ sound: false, reducedMotion: true });
});
