# Stable Sorting Baseline 2026-07-29 qa.26

Status: frozen as the current user-accepted sorting baseline.

This file defines the baseline that future sorting changes must preserve. It is a product and engineering guardrail, not a claim that the current code is fully refactored.

## Identity

- Extension: Media Organizer sorting and renaming
- Plugin ID: `com.max.eagle-photo-taken-sort`
- Version/API: `2.5.22-qa.26 / API103`
- Eagle host observed in qa evidence: `4.0.0 / build 20260401`
- Real library observed in qa evidence: `/Volumes/团队文件-MAX线上协作中台/引力环球.library`
- Candidate evidence: `qa-evidence/QA-SMART-FOLDER-INJECTION-QA26-2026-07-29.md`

Key SHA-256:

- `extensions/media-organizer/plugin.js`: `579d9e86e7e3546ba5a68f6d81373bb17b47cf853a33dd3f95657e0a40e95d7b`
- `extensions/media-organizer/manifest.json`: `7fe842d206f397fd8b2e96e251681840436f0622867e5d85a1545270f806813d`
- `extensions/media-organizer/package.json`: `d0f834332c7bd3d29da9b2c87165a089154231ad2bf0982de5d02882d5204c64`
- `extensions/media-organizer/package-lock.json`: `3d9fda194b0b9ae3547cc91bf860ff70cc9c9de431fd854b56de99f7177bd0db`
- `qa-evidence/QA-SMART-FOLDER-INJECTION-QA26-2026-07-29.md`: `aa6312c5f9e9a6559f268a4995a8313f9908063f412eba860c95c18fd43c97ec`

The `package.json` hash was refreshed on 2026-08-01 only because the GitHub release contract test
was added to `npm test`; qa.26 runtime code and sorting behavior were not changed.

## Baseline Behavior

The following behavior is frozen. Future features must keep it working before they can be considered installable.

- Eagle native sovereignty stays highest: selection, preview, right click, shortcuts, import/export, Finder/chat/upload drag-out, folders and smart folders must keep working.
- Normal folder sorting is stable baseline behavior and must not be changed by smart-folder work.
- Normal folder ordering stack remains: Eagle native base order, plugin automatic order, sparse manual overlay, sorting lock guard, then optional rename after the final order is established.
- Manual drag remains above automatic sorting unless sorting lock forbids the operation.
- Sorting lock freezes the current final visible order as a guard; it does not invent a new order.
- Rename/auto-numbering belongs only to normal folders. Smart folders must not show auto-numbering or auto-rename and must not enter rename planning or rename transactions.
- Smart folders may sort by taken time and multi-level rules, and may persist smart manual order for that smart collection only.
- Smart manual order must not rewrite source normal folder order, source filenames, rename state, or file paths.
- Smart folder lifecycle must tolerate temporary empty host results; a transient `0` result must not blank a previously valid view.
- Dynamic Eagle injection must compile as the final generated payload, not only as the outer `plugin.js` file.
- Injection and monitor failures must be persisted with useful stack traces and rate-limited diagnostics.

## Current Code Structure

Current implementation is usable and protected by a broad regression net, but it is not structurally ideal.

Important files and responsibilities:

- `plugin.js`: host bridge, dynamic injection payload, Eagle API calls, lifecycle, menu/settings UI, team state, metadata scanning, rename dispatch and several orchestration paths. Current size is about 9,769 lines. This is the largest risk area.
- `lib/sort-core.js`: pure automatic sorting rules.
- `lib/collection-core.js`: collection profile and normal/smart folder identity logic.
- `lib/order-coordinator-core.js`: final order composition.
- `lib/manual-move-core.js` and `lib/manual-move-application-core.js`: manual move modeling and application.
- `lib/smart-collection-lifecycle-core.js`: smart collection loading state and transient result handling.
- `lib/smart-collection-presenter.js`: smart visible-order projection.
- `lib/smart-drag-target-resolver.js`: smart drag target resolution.
- `lib/drag-feedback-controller.js`: normal/smart drag feedback projection.
- `lib/rename-core.js`, `lib/rename-batch-core.js`, `lib/rename-command-queue.js`, `lib/rename-lifecycle-core.js`: normal-folder rename safety chain.
- `lib/host-input-adapter.js`, `lib/host-adapter.js`, `lib/event-ownership.js`: host input and native-behavior boundary.
- `test/injection-source-compilation.test.js`: final generated injection payload compile gate.
- `test/injection-diagnostic-contract.test.js`: injection failure diagnostic gate.
- `test/permanent-regression-contract.test.js`: permanent R-ID contract gate.

## Structural Judgment

The current version is acceptable as a stable baseline because:

- sorting core behavior has been extracted into tested `lib/` modules;
- smart-folder rename exclusion is explicit and tested;
- smart lifecycle and presenter have dedicated tests;
- drag feedback has normal/smart strategy tests;
- permanent regression contracts now include the repeated historical failures;
- qa.26 added the missing final injection-payload compile gate that caught the qa.25 class of failure;
- qa.26 is installed as a single source and real Eagle shows the sorting controls again.

The current version still has structural risk because:

- `plugin.js` is still a large host/injection/orchestration aggregate, so small UI/injection edits can have large blast radius;
- sorting, GPS/metadata and team-state code still share the same plugin runtime even though business rules are governed as separate domains;
- part of the UI still depends on dynamically generated script strings, which requires special compile gates;
- visual drag feedback in smart folders still has a user-facing R50 acceptance item: complete blue vertical line, no gaps/jumps, correct drop result and refresh persistence;
- graphify and source inspection show `plugin.js` remains a central dependency node, which is useful for shipping quickly but fragile for long-term feature growth.

Plain-language conclusion: the user-visible sorting system can be frozen as a stable baseline now, but the codebase should be treated as guarded legacy-plus-modules. Future work should extend through existing pure modules and adapters, not by adding more business rules inside the injected UI script.

## Future Change Rules

Every future sorting task must start from this baseline and prove it has not regressed.

- Do not mix normal-folder and smart-folder changes unless the task explicitly names both.
- Do not add new business rules inside raw DOM event handlers.
- Do not add smart-folder rename or auto-numbering behavior.
- Do not change normal-folder rename behavior while fixing smart-folder sorting visuals.
- Do not change drag-out behavior to Finder, chat boxes or upload boxes while fixing internal drag.
- If `plugin.js` injection text changes, run `test/injection-source-compilation.test.js`.
- If layout/settings UI changes, prove taken-time, multi-level, manual drag and restore-auto controls still appear exactly where expected.
- If smart-folder lifecycle changes, prove transient empty results do not clear a valid smart view.
- If drag feedback changes, prove normal folder feedback stays unchanged and smart feedback does not create gaps, jumps or helper layout pollution.
- If rename code changes, prove smart folders remain rejected at plan, preview and execution levels.
- Any candidate that fails a real Eagle observation is not "done"; it remains a candidate until installed again and observed in the real UI.

## Required Gates For Future Installable Sorting Candidates

- Four identity gates from `PROJECT_MANAGER.md`.
- Model budget gate from `docs/EAGLE-TASK-DISPATCH-TEMPLATE.md`.
- Relevant R-ID lookup from `docs/SORTING-BUG-LEDGER.md`.
- Failure test first for the reported issue.
- `npm test`.
- `node --check plugin.js`.
- Final `injectionSource` payload compile gate.
- `git diff --check`.
- Candidate-to-install hash check.
- Single installed plugin source check.
- Real Eagle read-only launch health check.
- User-visible final acceptance for the reported workflow.
