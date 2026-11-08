# Local data compatibility and release policy

Status as of 2026-11-08: the guarded storage-generation cutover is implemented in
`ce60acd`. The current envelope remains schema 1. Full core/feature separation, a general
migration system, portable backup/restore/merge and explicit scoring/algorithm/core version
fields are **not implemented**.

## Goal and scope

An app update must preserve a person's identity and practice history even when a game changes.
Old scores may become incomparable; completed practice must not disappear. A future major
release may replace training features, but must migrate supported core data and retain records
that the active engine cannot interpret.

Keep localStorage for now. The cutover provides an explicit boundary, strict validation, one
legacy adapter, transactional locking and fail-closed states. It is not yet a general-purpose
migration platform or backup product. Browser deletion, device loss and origin changes still
require a future portable transfer facility.

## Implemented storage generation

| Boundary                 | Current behavior                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inner store              | `src/domain/types.ts` retains one `Store` with `version: 1`, active profile, profiles, settings, history and plans. The game expansion did not change this inner contract.                                                                                                                                                                                                                              |
| Canonical envelope       | `brain-garden-store` contains exactly `{format:'brain-garden-store', schemaVersion:1, revision, store}`. `schemaVersion` is 1 and `revision` is a positive safe integer.                                                                                                                                                                                                                                |
| Legacy import            | Only when canonical storage has not been initialized, `brain-garden-v1` is strictly validated and imported once. `brain-garden-store-initialized` records `pending` or `committed`, source (`fresh`, `legacy` or `existing`), timestamp and a legacy fingerprint. A missing canonical record after initialization is not permission to re-import stale legacy data.                                     |
| Transactions and locking | `openStore` and `transactStore` have replaced `loadStore` and `saveStore`. Mutations use `navigator.locks` with lock `brain-garden-store-write`. Inside the lock, the app rereads the latest envelope, applies the updater to latest state, validates the full next store, increments revision, writes and verifies the exact result.                                                                   |
| Pure updater contract    | A `transactStore` updater receives the latest locked `Store`, must not mutate that snapshot in place, and must return a fresh `Store`. The transaction serializes current and next stores to detect changes, so in-place mutation breaks both change detection and latest-state semantics.                                                                                                              |
| Recovery                 | One app-managed raw snapshot may exist at `brain-garden-recovery`; source, reason, timestamp and raw text are validated. The raw text limit is 1,000,000 characters. A different existing snapshot is not overwritten. The app can download protected current raw data ahead of an older snapshot. Downloaded files are outside app control. `brain-garden-recovery-v1` is an old app-managed copy key. |
| Unknown/future data      | Strict validation rejects unknown games, records or fields, malformed data and future schema versions. The original canonical bytes remain in place and writes are refused. There is no opaque archive, normalization, downgrade adapter or general migration registry.                                                                                                                                 |
| No Web Locks             | The app may read safely available data and play in memory, but `canPersist` is false and mutations fail with a visible explanation. There is no racing-write fallback.                                                                                                                                                                                                                                  |
| Profile deletion         | Before deleting a profile, the app removes the whole local `brain-garden-v1`, `brain-garden-recovery` and `brain-garden-recovery-v1` copy set. It then commits removal while preserving other current profiles. Cleanup failure blocks deletion and remains visible; if cleanup succeeds but the canonical write fails, current profiles remain and the failed deletion is reported.                    |
| Old clients and rollback | Released v1 clients do not understand the canonical envelope or new game IDs. Rolling back to the previously deployed client is not a compatible data rollback after cutover. Prefer a compatible forward fix or a rollback build that reads the guarded store.                                                                                                                                         |

The public read state is `ready | recovered | unsupported | corrupt | unavailable`.
`OpenStoreResult` includes the store to use, revision, raw source, warning and `canPersist`.
Raw downloads are troubleshooting material, not a portable restore format.

`src/pages/Progress.tsx` still averages practice accuracy across the selected day's results,
including different games and rule versions. Treat it as a practice summary, not a comparable
longitudinal ability measure.

## Future version axes

These fields and rules describe future releases unless a row explicitly names current state.

| Version         | Rule                                                                                                                                                                           | Example                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| App release     | Use package SemVer plus the deployed Git SHA. This does not select a storage parser.                                                                                           | A visual patch need not change a data version.                           |
| Storage schema  | Positive monotonic integer. Increment when stored structure, validation, units or interpretation changes. The current schema is 1.                                             | A future schema change needs an explicit migration and released fixture. |
| Core contract   | Future field; not implemented. Change only when core encoding changes and provide a lossless core migration.                                                                   | Profile and completion facts survive a new training engine.              |
| Game rules      | Current per-game positive integer; missing legacy value means 1. Six early games use 2; the other seven use 1. Increment when stimuli, response or difficulty meaning changes. | Pictorial color/shape matching already uses rules version 2.             |
| Scoring         | Future `scoringVersion`; not implemented. Until then, a scoring change must assess whether it also needs a `rulesVersion` change and cohort separation.                        | A new timing formula cannot share an old personal-best cohort.           |
| Daily algorithm | Future `algorithmVersion`; not implemented. Existing saved plans remain authoritative across algorithm changes.                                                                | A better selection policy affects future plans only.                     |
| Backup format   | Future portable export envelope; not implemented. It must include source schema and app identification.                                                                        | Restore is not guessed from the app version.                             |

IDs are durable, not display names or array positions. Never recycle profile, game, result,
achievement or avatar identifiers. Keep retired game IDs in a historical registry. Existing
avatar indexes need an explicit stable-ID mapping if the avatar catalog is reordered.

Historical results are immutable. Do not rewrite rules versions, rescale scores or fabricate a
current difficulty. Unless a later scoring version exists, compare a score only within its game
and `rulesVersion`. Activity and practice-day counts may span versions.

## Future core/feature contract

“Version agnostic” means independent of game mechanics with its own explicit contract; it does
not mean unversioned data.

| Data                   | Future preservation contract                                                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile identity       | Preserve ID, name and avatar mapping. Never merge by name or assign another profile's history during repair.                                                                       |
| Preferences            | Preserve recognized settings, especially reduced motion and sound. Retain unknown preferences until an explicit validated migration handles them.                                  |
| Completion facts       | Preserve immutable result/session ID, owner, original game ID, completion timestamp, practice day and duration with known units. Count completion once across rule versions.       |
| Old scores and details | Retain original values and version tags when the active engine cannot use them. Historical activity remains visible without feeding incompatible results into bests or adaptation. |
| Daily completion       | Preserve saved membership, plan date and completed items. A retired item needs an explicit replacement path that preserves completed slots and cannot double-credit.               |
| Achievements           | If permanent earned badges are introduced, persist stable achievement ID, definition version and earned timestamp before changing definitions. Do not invent unlock dates.         |

The next major storage design should separate each profile's small **core** (identity,
preferences and generic completion facts) from replaceable **training** payloads (versioned game
results, plans and archives). Store these together initially with independent `coreVersion`,
storage version and revision metadata. A completion fact and score payload share an immutable
result ID and commit together. Keep aggregates derived.

For future sessions, consider UTC `completedAt`, observed local completion date, plan start-date
attribution and time-zone identifier. A session crossing midnight may have different completion
and plan dates. Use a monotonic timer for duration and the captured date for calendar grouping.
Migrate old timestamps with a documented one-time inference that is not repeatedly reinterpreted
after travel.

Never erase core data as part of a game or score reset. Profile deletion remains an explicit
action; downloaded copies are outside app control. A future restore must not silently resurrect a
deleted profile or merge profiles by name.

## Future migration and recovery gate

All future reads and writes continue through `src/domain/storage.ts`. Implement pure
version-to-version transforms in `src/domain/migrations.ts`, add synthetic released fixtures under
`tests/fixtures/storage/`, and use Vitest for adapters and failure points. Keep persisted game IDs
representable as strings independently from the playable `GameId` union.

1. Classify the schema before decoding game payloads. A missing version is corrupt or unknown
   unless a named historical adapter supports it; distinguish old supported schemas from future
   schemas.
2. Under the lock, retain exact original bytes and revision. Run supported transforms in memory and
   validate every intermediate and final store.
3. Preserve unknown records and fields in a scoped archive or keep raw data inaccessible to
   writes. The current app chooses the latter; it does not claim an archive.
4. Validate profile ownership, unique IDs, completion linkage and bounds. A damaged profile must
   not inherit another profile's history or defaults.
5. Write a verified pre-migration snapshot before a destructive transform. If snapshot, quota,
   validation or commit fails, leave canonical source untouched.
6. Verify committed content before enabling normal writes. Restart must not re-import or duplicate
   completion facts.

For future unsupported data, never downgrade, normalize or overwrite it. Show a Chinese
update/reload/recovery explanation outside gameplay, keep its raw source accessible, and block
writes. Restoring old code is not permission to overwrite newer data.

Do not rotate storage keys on every schema bump. Keep `brain-garden-store` as the stable envelope
key and put future schemas inside it. An old offline client can still write its old
`brain-garden-v1` key; do not continually merge it. Explain that it must reload and require any
stranded off-key recovery to use an explicit validated path.

Recovery snapshots and future archives need count/byte bounds, capacity errors and deletion
semantics. Before advertising user-restorable backups, add a caregiver-accessible JSON
export/import flow with preview, schema validation, size limits and explicit merge-versus-replace
behavior. It must include only app-owned data; personal names and histories still need appropriate
handling.

## Verification gate

Implemented evidence in `ce60acd`:

- A synthetic released-v1 fixture imports once and is not re-imported after stale legacy writes,
  missing canonical data or profile deletion.
- Future/unknown/corrupt data blocks writes and preserves raw source. Current protected raw
  downloads take precedence over an older recovery snapshot.
- Pending initialization resumes without duplication; quota, canonical write, marker write,
  cleanup and deletion failures retain and report a recoverable state.
- Concurrent tabs serialize through the lock and apply both edits to latest state. No-lock runtime
  fails closed. Profile deletion removes app-managed copies and preserves other current profiles.
- The browser suite includes six persistence scenarios and offline reload coverage.

Future migration work still needs the full matrix:

| Scenario             | Required evidence                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration chain      | Every released fixture reaches current schema; facts and IDs survive; rerunning is idempotent.                                                      |
| Unknown/future data  | No overwrite; unknown records round-trip or remain intact in an exportable archive.                                                                 |
| Failure recovery     | Invalid JSON, partial profiles, quota, commit and interruption at each stage leave a recoverable original.                                          |
| Mixed clients        | Concurrent transform/write is serialized; a failed lock mode blocks writes; stale legacy writes cannot overwrite or repeatedly import guarded data. |
| Game/plan changes    | Old score cohorts stay out of new bests/adaptation; activity remains; saved plan and retired items are handled; duplicate results count once.       |
| Calendar and privacy | Midnight, timezone/DST, inferred dates, restore, deletion, downloaded copies and ID collisions have explicit tests.                                 |
| Release and offline  | Cached production build, mixed-tab update, migration, offline reload and compatible rollback are verified.                                          |

## Operational considerations

- **Stable origin:** localStorage belongs to the exact scheme/host/port. Production, localhost and
  previews have separate data. A new domain needs a transfer plan.
- **App updates:** coordinate service-worker activation with sessions and schema capability.
  Asset-cache hashes, Git SHAs and storage versions are separate. Clearing caches is not migration.
- **Capacity:** full-history synchronous writes grow over time. Preserve facts before any future
  compaction; move to IndexedDB when justified.
- **Privacy:** profiles separate records on one device but provide no authentication or encryption.
  Deletion and downloads must be understandable to caregivers. No telemetry is required.
- **Accessibility:** test pictorial rules, redundant color/shape cues, motor targets, reduced
  motion, muted play and visible recovery on real devices.
- **Release discipline:** track the commit that changes data or rules and verify the exact deployed
  commit. A passing build proves neither migration safety nor usable offline updates.
