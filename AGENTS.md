# Repository engineering rules

## Product contract

- This is 脑力花园: a mobile-first, Simplified Chinese, frontend-only brain-training app. Use the existing React, TypeScript and Vite stack. No backend, authentication, external AI, tracking or remote runtime assets are required.
- A caregiver may explain or start a game, but the player must be able to finish it independently without reading characters, numerals or formulas. Preserve visual demonstrations and pictorial instructions. Never encode a rule only in text, color or sound; pair color with shape, position or direction where possible. Document games whose cognitive task itself requires color discrimination.
- Keep controls large, keyboard accessible and usable on phones and tablets. Preserve focus handling, reduced motion, hidden-tab timer pausing and persistent wrong-answer feedback.
- Daily training is the primary journey: one start action, a balanced saved plan, stable recommendations for that day, progressive difficulty and correct completion tracking. Individual replay must not accidentally advance daily progress.
- Profiles isolate history, plans and settings. These are local device profiles, not authenticated or confidential accounts. Practice results are not medical assessments.

## Start here and plan proportionately

- Read the relevant code and documentation before editing: [product](docs/brain-garden/spec.md), [game mechanics](docs/brain-garden/games.md), [architecture](docs/brain-garden/design.md), [literacy review](docs/brain-garden/literacy-review.md), [data compatibility](docs/data-compatibility/design.md), [deployment](docs/deployment.md).
- Establish scope, assumptions, success criteria and verification before implementation. Resolve routine decisions from existing conventions; ask only when remaining ambiguity materially affects the result. Explain a materially better alternative and its tradeoffs; seek a decision if the requested approach risks serious harm or wasted work.
- Scale planning and verification to risk. Do not create a large planning framework for a small change. Keep every edit tied to the requested task and preserve unrelated behavior.
- For a bug fix, write and run a failing regression test before changing implementation. Fix the cause, remove code made obsolete by the fix, and rerun relevant checks.

## Architecture and code quality

- `src/domain/`: storage boundaries, data contracts, catalog, recommendations and statistics. Keep these independently testable and free of presentation concerns.
- `src/games/engine.ts`: question generation and answer contracts. `GameBoard`, `Visuals`, `GameDemo`, `ExpansionPractice`, focused board adapters and `GamePlayer` handle rendering, teaching and session lifecycle. Pages and boards must not write localStorage directly; coordinate persistence through the storage boundary.
- Use descriptive names, strict TypeScript, small focused functions and the simplest design that meets the requirement. Apply DRY, KISS, YAGNI and SOLID pragmatically. Avoid unrelated refactoring, speculative abstractions and duplicate sources of truth.
- Follow existing formatting: single quotes, trailing commas, 100-column Prettier configuration. Comments explain reasoning; document non-obvious contracts. Keep affected product, game and technical docs current.
- Never reuse a game ID for a different exercise. Mechanics or difficulty changes must assess `rulesVersion`; scoring changes must assess score comparability under the compatibility policy. Retiring a game must not delete its history.
- Preserve the expanded library and daily-plan rules together: thirteen playable game IDs, four distinct skills per generated plan, and no scenario where both `route` and `fit` occupy the same plan because both use the `logic` skill. Existing saved plans are authoritative.
- Keep the mandatory, correctable and unscored practice for `focus`, `route` and `fit`. Preserve route completion plus bounded path-efficiency scoring, fit correctness scoring, focus's standard accuracy and speed scoring, and the six/three/four round counts respectively. Pictorial teaching and formal play with auxiliary text hidden and sound off are product requirements.

## Persistence and compatibility gates

- Follow [the data compatibility policy](docs/data-compatibility/design.md). It separates the implemented guarded storage cutover from future migration and product features that do not exist.
- Before changing persisted fields, validation, game rules, scoring, recommendation algorithms, dates or achievements, explicitly assess compatibility and update the policy/status as needed.
- Never solve a compatibility failure by clearing localStorage, silently creating a replacement store, incrementing the storage key on every release, or dropping unknown records. Preserve profile identity, settings, completion facts and raw legacy records as specified by the policy.
- The current cutover uses the canonical `brain-garden-store` envelope `{format:'brain-garden-store', schemaVersion:1, revision, store:<inner Store version 1>}`, a one-time validated import from `brain-garden-v1`, an initialization marker and fingerprint, one raw recovery snapshot, and pending-to-committed initialization. Preserve these contracts.
- Route reads and writes through `openStore` and `transactStore`; do not reintroduce `loadStore`, `saveStore` or direct localStorage reads/writes in application code. Mutations must lock with `navigator.locks` (`brain-garden-store-write`), reread the latest schema/revision, apply against latest state and verify the write.
- Treat every `transactStore` updater as pure. It must return a fresh `Store` and must not mutate the supplied latest snapshot in place. The transaction compares serialized current and next stores, so in-place mutation destroys change detection and latest-state semantics.
- Without Web Locks, allow temporary in-memory play but disable persistence and explain it. Do not silently fall back to racing writes.
- Fail closed on unknown, corrupt or future canonical data and preserve its exact raw representation. Current strict validation refuses unknown records and writes; no opaque-record archive exists. Do not claim that version migration registries, general backup/restore/merge, `coreVersion`, `scoringVersion`, `algorithmVersion` or full downgrade compatibility are implemented.
- Treat stored and imported JSON as untrusted input. Validate structure, finite values, IDs, dates and bounds. Preserve profile ownership and result idempotence. Do not render stored content as HTML.
- Keep exactly one bounded raw recovery snapshot. Downloading it is a raw troubleshooting aid outside gameplay, not a portable user restore format. Prioritize protected current raw data over an older snapshot. Downloaded files are outside app control.
- Profile deletion must clear the whole app-managed local legacy/recovery copy set before committing deletion, preserve other current profiles, and keep cleanup failures visible. Do not imply that downloaded copies can be removed by the app.
- Never present an in-memory result as successfully persisted when storage failed.

## Verification

Use Node.js from `.node-version` and the committed lockfile:

```sh
npm ci
npm test
npm run build
```

- `npm run build` includes TypeScript checking and generates the offline asset manifest. `npm run check` is available for a faster type-only check.
- For gameplay, navigation, profile/storage integration, accessibility or service-worker changes, run relevant Playwright tests after building: `npm run test:e2e -- tests/e2e/<file>.spec.ts`. Run the full suite for broad changes. Browser installation and `BRAIN_GARDEN_BROWSER` setup are documented in README.
- Game changes need generator checks across difficulty levels and seeds plus actual playable browser coverage. Preserve one unambiguous correct answer, touch layouts, pictorial teaching and playability with auxiliary text hidden and sound disabled.
- Persistence changes need released-schema fixtures, cutover/migration/failure cases, cross-tab serialization, raw-recovery precedence, deletion cleanup/rollback and profile isolation tests. Offline changes need production-build online-to-offline reload and update coverage. See the compatibility design for implemented gates and the future migration matrix.
- Documentation-only changes need formatting, link/path and factual checks; do not claim new runtime guarantees from documentation. Report checks actually run and any material gaps, including unavailable review agents.
- Remove temporary build/test directories created for the task, including those under `/private/tmp`, or explain why retained. Do not remove unrelated sessions' artifacts. `dist/` and dependencies are ignored local build outputs.

## Git, security and deployment

- For every future code change, update affected documentation to match the implemented contracts, tests, data compatibility, UX, limitations and deployment state, then check the documentation against source before the code commit unless the user explicitly orders otherwise. If the user requests separate code and documentation commits, follow the user's specified order and ensure the docs are source-aligned and factually checked before their commit. Never leave documentation claiming a plan is implemented or describing removed behavior as current.
- Use focused commits: `<type>(<scope>): <message>`, with concise intent/context/impact bullets in the body where useful. Review the diff for accidental data or unrelated changes.
- Never read or commit secrets, tokens, credentials, secret-bearing `.env` files, exported user histories or personal browser data. Authenticated `gh`/`cf` may manage their own credentials; do not print or copy those credentials. Keep generated output, dependencies, local backups and test traces out of Git.
- Source: `https://github.com/Troyanovsky/brain-trainer`; production: `https://brain-trainer-ezz.pages.dev`; Cloudflare Pages project: `brain-trainer`.
- Do not describe local work, a local commit or a preview as production-live. Verify the exact commit reached a successful production deployment before claiming the site is updated.
- Native Git integration deploys `main` automatically using `npm test && npm run build`, output `dist`, repository root, Node `22.16.0`. Other branches have preview deployments. No frontend secrets or GitHub Actions deploy tokens are needed.
- A push to `main` publishes the site. Work within the user's existing authorization; editing files alone does not request a production push. Do not switch to direct uploads, add a second deployment pipeline or change domains/accounts without task justification.
- For an authorized deployment, run appropriate checks, push, wait for the deployment of the exact commit to succeed, and verify the canonical site and offline assets. A successful local build or accepted push alone is not deployment verification.
- A frontend rollback does not roll back browser data. After the guarded cutover, the previously deployed v1 client does not understand the canonical `brain-garden-store` envelope or the new game IDs, so rolling back to it is not a compatible data rollback. Prefer a forward fix or a rollback build that explicitly reads the guarded store. Keep the domain root and stable production origin unless an explicit data-transfer plan accompanies the change.
