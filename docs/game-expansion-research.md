# Game expansion research — 2026-11-08

> Historical research record: this document captures the pre-implementation recommendation.
> Three first-wave games were implemented and reviewed in code commit `ce60acd`; current behavior
> is documented in [game-expansion/design.md](game-expansion/design.md) and
> [game-expansion/verification.md](game-expansion/verification.md). Statements below about a
> ten-game library count, legacy-only storage or work still required describe the research-time
> repository, not the current implementation.

## Scope and provenance

Research was delegated to `ccs-opencode-2/deepseek-v4.1-flash` with `high` effort. The agent completed its review and reported model/browsing availability. It surveyed the seven public categories in [Lumosity's game library](https://www.lumosity.com/en/brain-games/), compared candidates with our ten games, and proposed eight additions. The main agent checked the eight shortlisted official descriptions and reviewed the proposals against our literacy and implementation contracts.

This is public-description research, not a hands-on gameplay review. Login-gated controls, exact scoring, timers, adaptation and accessibility behavior were not tested. All Chinese names, interaction designs and difficulty/scoring suggestions below are our proposed adaptations. They are not descriptions of Lumosity's implementation or claims of cognitive/clinical efficacy. Use original artwork, names and presentation.

Selection criteria: independent play after caregiver teaching; no reading, numeral recognition or required audio; useful distinction from current games; large touch controls; progressive difficulty; offline feasibility; and low motor/visual burden. Our largest mechanic gaps are route planning, spatial transformation and continuously updating working memory. These are product observations, not a diagnosis of users' abilities.

## Recommended shortlist

Effort is relative to this repository, not a delivery estimate: small = existing round/choice structure; medium = additional state or generation; large = new temporal interaction and accessibility work.

| Candidate / official source                                                                    | Publicly described mechanic                                           | Proposed adaptation and value                                                                                                                                                                                                                                              | Effort / disposition                                                     |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **中央方向** — [Lost in Migration](https://www.lumosity.com/en/brain-games/lost-in-migration/) | Report the lead bird's direction despite distractors.                 | Pointing motifs surround a clearly anchored center target; tap its direction using large, spatially arranged arrow controls. Adds spatial interference filtering; unlike `odd`, the goal is not finding an exception, and unlike `flip`, the response rule stays the same. | **Small; first wave.**                                                   |
| **送物路线** — [Pet Detective](https://www.lumosity.com/en/brain-games/pet-detective/)         | Find an efficient route to rescue all targets.                        | Collect pictured objects and reach an exit on a small grid, with adjacent-cell taps and undo. Adds multi-step planning, currently absent from the library. Start with fixed obstacles; changing doors are unnecessary initial complexity.                                  | **Medium; first wave.**                                                  |
| **拼块空位** — [Masterpiece](https://www.lumosity.com/en/brain-games/masterpiece/)             | Rotate/flip shapes mentally to fit a design.                          | Choose and orient a large piece to fill a silhouette. Tap to select, use large rotation/mirror controls, then tap to place; no precision dragging. Unlike rotated odd-one-out, the task is transformation and fit.                                                         | **Medium–large; first wave if resources allow.**                         |
| **图形回声** — [Memory Match](https://www.lumosity.com/en/brain-games/memory-match/)           | Compare the current symbol with the symbol two presentations earlier. | A self-paced shape stream with visual same/different controls. Adds updating/discarding, unlike replaying a memorized sequence. Begin with one-back; two-back is conditional on comprehension testing.                                                                     | **Small–medium technically, substantial teaching risk; validate early.** |
| **反弹出口** — [Pinball Recall](https://www.lumosity.com/en/brain-games/pinball-recall/)       | Remember hidden bumpers and predict the ball's route.                 | Show simple angled reflectors, hide them, then choose the predicted exit. Reveal the ball's actual path only after the answer. Adds memory-based spatial prediction beyond `tiles`.                                                                                        | **Large; later wave.**                                                   |
| **规则风车** — [Ebb and Flow](https://www.lumosity.com/en/brain-games/ebb-and-flow/)           | Switch between an object's pointing direction and movement direction. | An icon badge selects orientation or displacement; answer with arrows. Current `flip` already switches same/opposite rules, so the novelty is switching the relevant visual feature, not introducing task switching itself.                                                | **Medium–large; later wave.**                                            |
| **群游一次** — [Playing Koi](https://www.lumosity.com/en/brain-games/playing-koi/)             | Track moving targets and feed each only once.                         | Slowly moving, large original tokens; interact once with each while remembering earlier interactions. Adds dynamic tracking beyond static `schulte`.                                                                                                                       | **Large; later wave with motion/motor testing.**                         |
| **双单服务站** — [Trouble Brewing](https://www.lumosity.com/en/brain-games/trouble-brewing/)   | Fill simultaneous orders and monitor multiple stations.               | Two visible pictorial orders and large stations with picture-based progress/readiness. Adds task coordination only if both stations actually require monitoring; sequential icon matching alone would not preserve that mechanic.                                          | **Large; hold until phone usability is demonstrated.**                   |

## First-wave design conditions

### 中央方向

- Teach with an isolated target, then the same target among conflicting motifs. A finger points at the corresponding response arrow. The center anchor and direction controls remain visible; no mid-round written rule changes.
- Progress from two to four directions, then increase distractor count and disagreement. Keep the target large rather than making visual acuity the difficulty mechanism.
- Use correct trials and a capped response-time bonus, compatible with the current scoring structure. Separate congruent and conflicting trials during balancing so one generated session is not arbitrarily harder.
- Risk: players may follow the majority or choose the outlier. Practice must demonstrate that the anchored target matters whether or not it matches its neighbors.

### 送物路线

- Demonstrate collecting a pictured object, filling its collection slot and reaching a visibly marked exit. Keep the full board visible, use tap-to-step, and provide pictorial undo/restart controls.
- Increase from a few cells and one object to larger grids, multiple objects and alternative routes. Generate only solvable boards with a known legal optimal route; accept every valid solution, not just one stored path.
- Reward completion first, with route efficiency as a small secondary reward. Show a pictorial path comparison after play; no numerical move limit, forced countdown or written optimization instruction is necessary.
- Risk: undo, blocked cells and exit prerequisites must be understandable without text. Wrong moves should explain the obstruction visually instead of resetting the puzzle.

### 拼块空位

- Demonstrate a single rotation and snap into a large gap. Introduce reflection separately, only after successful practice. Provide a selected-piece preview and persistent destination outline.
- Increase edge complexity, distractor similarity and required transformations. Ensure choices remain distinguishable after allowed rotations/reflections; symmetry must not create multiple supposedly different correct answers.
- Score successful fits and difficulty. Avoid punishing exploratory rotation or undo; success should remain satisfying for players learning the controls. Prefer choosing among oriented pieces at beginner levels.
- Risk: visual fit and small controls can become acuity or dexterity tests. Maintain large silhouettes and tap targets at 360px width, and verify reduced-motion snap feedback.

## Review adjustments to the sub-agent proposals

The agent's first three were **中央方向 → 两张回声 → 送物路线**. The final product recommendation is **中央方向 + 送物路线 + 拼块空位**, with **图形回声** as an early teaching study or a lower-code-cost substitute if comprehension is demonstrated. This prioritizes clearly demonstrable new mechanics over the technical simplicity of n-back.

- **Working-memory teaching:** use actual pictures such as flower → leaf → flower, not letter placeholders. Same/different buttons need solved paired-picture examples and corrective practice. A persistent rule example must use separate example symbols; showing the actual historical comparison card during scored play removes the memory demand. Do not switch one-back/two-back unexpectedly mid-session or assume counting back is obvious to an illiterate player.
- **Tracking integrity:** the agent suggested permanent checkmarks on already-tapped moving tokens. That removes much of the remembered-interaction task. Use such marks in guided practice; formal play may give brief confirmation, then require tracking. A persistent-mark mode is an explicitly easier variant, not equivalent evidence of memory performance. Freezing all motion also changes the task; it needs a distinct adaptation/comparability decision.
- **Prediction integrity:** showing the ball traverse hidden obstacles before an answer can reveal the answer. Solved path animation belongs in teaching and post-answer correction. Begin with one deterministic reflection; avoid arbitrary physics or time-critical interception.
- **Motion switching:** two-position still frames may support a reduced-motion variant, but have different perceptual/timing demands from continuous motion. Test and version comparisons accordingly. Encode rules by distinct icons and frame shapes, not color alone.
- **Divided attention:** removing all readiness changes and allowing one order to be finished before considering another reduces the task to sequential matching. Prototype the actual coordination challenge and comprehension together before recommending it for daily training.

## Lower-priority or unsuitable directions

The [Word category](https://www.lumosity.com/en/brain-games/#word-games) explicitly targets vocabulary and reading. Translating spelling, synonyms or root-building into Mandarin would preserve the literacy barrier, so these are unsuitable for the app's core audience. Likewise, avoid written arithmetic and letter/number classification as primary tasks; visual quantity exercises already exist here. This does not imply every mathematical idea is unsuitable for a nonreading adaptation.

Other low-value additions are close duplicates of existing location memory, symbol sequences, odd-one-out search and shape/color matching. Another visual rule-switching game needs more justification than a new theme. The eight-game shortlist is a selection, not an exhaustive rejection of every other public title.

## Repository integration implications

- Keep the four-game balanced daily plan stable once saved. New games can enter future plans through existing skill-based selection; route and fitting tasks can initially use `logic`, and updating memory can use `memory`. Do not add skill axes just to accommodate more games.
- The current generator/board/player split supports discrete choices. Routes, mutable pieces and continuous tasks need focused adapters and session state; do not disguise every interaction as a multiple-choice prompt or scatter new game branches across the application shell.
- `Library.tsx` displays a hardcoded ten-game count. The “全能园丁” achievement promises all ten and uses `games >= 10`. Adding games must update the displayed catalog count and explicitly preserve that badge's existing meaning; silently moving an earned threshold would violate the compatibility policy.
- A new ID also changes the stored record validator's accepted game set. An older client can discard unknown game records when it saves. Follow [data compatibility](data-compatibility/design.md) and implement unknown-record preservation/downgrade protection before treating expanded-library deployment as data-safe. No migration protection was added by this research.
- Validate candidate teaching with the actual caregiver/player setup, then hide auxiliary text and mute audio for formal play. Include solved examples, correctable practice, keyboard access, large targets, persistent wrong-answer feedback, hidden-tab pausing and offline reload.
- Test generated puzzles across levels/seeds, unique answer or valid-path semantics, profile isolation and result idempotence. Route efficiency, transformations and tracking errors need an explicit mapping to `correct`/`rounds`; do not compare incompatible scores merely because they share the same numeric range.

No game implementation, runtime data changes or deployment is included in this research.
