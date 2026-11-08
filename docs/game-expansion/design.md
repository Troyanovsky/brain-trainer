# Three-game expansion

Status: implemented and independently reviewed in code commit `ce60acd`; final automated and
documentation-alignment results are recorded in [verification.md](verification.md). Scope follows the
[research recommendation](../game-expansion-research.md),
[literacy contract](../brain-garden/literacy-review.md) and
[compatibility policy](../data-compatibility/design.md).

## Product and acceptance contract

Three original games use stable IDs `focus`, `route`, `fit`, with Simplified Chinese names
中央方向、送物路线、拼块空位. They join the library, future daily recommendations, progress and
personal bests while retaining all ten existing games and saved daily plans. A caregiver can
teach/start, but a player can finish every formal round with auxiliary text hidden and sound off.
This rollout does not include n-back or continuous-motion games.

- **focus / attention:** a permanently anchored center motif points in a direction among direction distractors. Choose the center's direction with stable, spatially arranged arrow controls. Beginner has two directions, then four; increase distractor disagreement/count rather than shrinking targets. Include both matching-majority and conflicting-majority examples so the task is not mistaken for finding the odd item. Six short rounds, accuracy plus bounded speed bonus.
- **route / logic:** tap adjacent cells to collect pictured parcels and reach a pictured exit. Full board, parcel slots, player position, collected progress and destination stay visible. Large cells, pictorial undo/restart, no drag or countdown. Begin with one pickup and simple board, then multiple pickups/obstacles/route choices. Generate solvable boards with a verified optimum; accept every legal completion. Three rounds; reward completion first and bounded route efficiency second, never speed. Blocked, nonadjacent or premature-exit actions explain themselves visually without losing progress. Undo must not farm score or collection credit.
- **fit / logic:** choose a large geometric piece, orient it if needed, and tap a clearly marked placement control/gap. Beginner can choose already oriented pieces; teach rotation and reflection before they appear in formal play. The target silhouette and selection preview stay visible. No precise dragging or deadline. Increase geometry/distractors/transforms over five levels; avoid symmetric or transform-equivalent duplicate correct choices. Four short rounds, completion/accuracy first; exploration of rotation is not an error or scoring penalty. Wrong placement shows the correct fit until acknowledged.

Each game needs a concrete solved pictorial example and correctable, unscored practice before scored play. Formal cues, goals, controls, stages and corrective feedback use pictures/geometry, not characters, numerals, formulas, audio or color-only coding. Practice must cover late-introduced transforms/rules and have a clear pictorial transition to play. Preserve pause/exit/replay/next icons, hidden-tab pausing, keyboard access, focus management, reduced motion and persistent wrong feedback.

At 360px viewport width maintain at least 44px interactive targets, no horizontal overflow, and a usable layout for the highest level. Use existing visual language and original SVG/CSS artwork; no downloaded Lumosity assets or copied presentation.

## Architecture and ownership

Game implementation owns `src/games/`, catalog and the `GameId` union, game artwork,
game-related styles, derived library count, achievement wording, generator tests and new-game
browser tests. Focused engine/board/demo modules avoid expanding the shared player with unrelated
game-specific branches. Generators use injected RNG and remain independent from React/storage.
Existing question semantics, session scoring and result idempotence remain intact.

Storage implementation owns `src/domain/storage.ts`, `src/domain/migrations.ts`, tests and
`src/App.tsx` for guarded loading, transactions and recovery UI. The gameplay `Result`,
`Profile`, `Plan` and inner `Store` shape is unchanged; the outer persistence envelope versions
the storage protocol independently. Tests cover explicit legacy import and canonical behavior.

The orchestrator owns integration, independent verification, documentation/status and review follow-through. A separate reviewer uses the requested model/effort to inspect actual code and test evidence; it does not author the implementation. Implementers address significant findings, followed by relevant tests and reviewer recheck.

## Data and release boundary

New games start at rules version 1; existing IDs, rules versions and history remain unchanged.
Existing daily plans remain authoritative; newly generated plans select four distinct skills, so
`route` and `fit` cannot both appear in one balanced plan because both use logic. The existing
ten-game achievement remains at ten, with truthful wording “体验 10 款不同游戏”; library count
derives from the catalog.

The guarded cutover uses canonical `brain-garden-store`, a versioned envelope, a one-time
strictly validated `brain-garden-v1` import, a pending-to-committed initialization marker and
fingerprint, one raw recovery snapshot, and fail-closed handling of unsupported/corrupt data.
It never continually re-imports legacy writes. Unknown schema, game or field data refuses writes
while the exact raw source remains preserved. `transactStore` serializes mutations with Web Locks,
rereads latest revision, applies a pure updater that returns a fresh store, validates and verifies
the write. Without Web Locks, play can continue in memory with persistence disabled. Preserve
profile isolation, deletion, app-managed local copy cleanup and result IDs. Raw download occurs
outside gameplay and is not a portable restore feature. In-memory success is never reported as
persisted.

This is the guarded storage-generation cutover, not core/feature separation, a migration registry,
portable backup/restore/merge or explicit scoring/algorithm/core versions. The
[compatibility policy](../data-compatibility/design.md) keeps that distinction explicit.

## Verification and completion

1. Released-v1 fixtures and failing regressions cover future/unknown data, legacy import and
   recovery. No real browser history is used in fixtures.
2. Every game is generated across five levels and at least 100 deterministic seeds. Checks cover
   bounds, answer uniqueness or legal-route semantics, independent route optimum, fallback and
   legal alternate-path acceptance.
3. Browser-play covers all new games with text masked and sound off, visible-geometry solving,
   unscored practice, mistakes/correction, route controls, fitting transforms, maximum-level mobile
   layout, pause/hidden tab, daily completion, profile isolation and offline reload.
4. Unit tests, typecheck/build and the full browser suite pass; axe and 360px/768px screenshot
   checks cover new interactive states.
5. An independent reviewer checks mechanics, nonreading UX, accessibility, scoring/difficulty,
   persistence/mixed clients, architecture and test quality. The final recheck has no remaining
   P1/P2 source findings; the reviewer did not run the full browser suite.
