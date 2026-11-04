# Test audit — September 10, 2026

Audited the checked-in Bun, Playwright, and morph-physics Vitest suites, plus the six
failed Test workflow runs among the twelve most recent workflow runs inspected.
Local environment: macOS, Bun 1.4.0, Node 24.18.0, Chromium.
Repeated success is evidence against the reproduced failures, not proof that no
other flaky behavior exists. Linux CI and authenticated browser flows still need
verification on the updated code.

## Results

| Check | Result |
| --- | --- |
| Unit and relay contract tests | 1,153 tests pass; three shuffled repetitions with seed 2026: 3,459 pass |
| Integration tests | 108 tests pass; three shuffled repetitions with seed 2026: 324 pass |
| morph-physics | Build succeeds; 75 Vitest tests pass across 9 test projects/files |
| Public browser tests | All 8 tests pass across three repetitions; the final welcome-only run passed 12/12 |
| Authenticated browser tests | 13 tests require `E2E_CLERK_EMAIL` and `E2E_CLERK_PASSWORD`; not verified here |
| Watch mode | Unit and integration initial runs pass in separate watch processes; no Playwright/Vitest discovery |
| Missing audio fixture probe | 6 tests correctly skip; the fallback-result test passes |
| Lint | Still fails: 29 existing errors, 1,589 warnings; inventory below |

The original worktree had no installed dependencies or matching Chromium binary.
Installing the locked dependencies and the Playwright browser resolved those setup
failures. They were not application test regressions.

## Fixed in this audit

| File / area | Reproduction or risk | Change |
| --- | --- | --- |
| `unit/mem0-config.test.ts` | Second and third file executions lost the expected Authorization header: the module retained its `installed` guard after the test replaced fetch. Cleanup also ran only after successful assertions. | Import a fresh installer for each execution; restore fetch and the original environment in `afterEach`. Five targeted repetitions and the full stress run pass. |
| `unit/diagram-node-links.test.tsx` | Second and third executions found multiple `add` buttons. | Unmount the rendered DOM after each test. |
| `unit/spatial-artifacts-hooks.test.tsx` | Second and third CoalescenceGate executions found duplicate settings links; hook mounts also remained alive. | Add cleanup and replace the hover sleep with controlled timer advancement. |
| `integration/sidebar-chat-list.test.tsx` | The long-press test depended on a 550 ms wall-clock sleep. | Advance fake timers to the 500 ms long-press threshold, then assert first-click suppression and second-click navigation. |
| `integration/spatial-artifacts-sync-worker.test.ts` | Three tests assumed queued work finished within 100–150 ms. | Wait for the expected upsert count before inspecting results. |
| `e2e/welcome.spec.ts` | All four tests failed through broad selectors: multiple H1s, an outer layout section, substring matches in link descriptions/footer copy, repeated illustration text and hidden measurement copies. | Scope the hero and illustration assertions, use exact headings/footer text, assert the Showcase destination, and select the accessible paragraph. Request reduced motion for copy/layout coverage. |
| Protected browser routes | Status, sandbox chrome, tasks, and gallery tests navigated without authentication. Tasks failed during client initialization without Supabase configuration. Passing unauthenticated prototype renders did not validate signed-in behavior. | Use the same credential gate and sign-in helper as Aion and Mermaid. Preserve all tests; explicitly skip when credentials are absent. |
| `e2e/helpers/auth.ts` | The old duplicated helper treated a not-yet-visible sign-in button as an existing session. | Wait for the sign-in UI and a populated Clerk user before continuing. The credentialed path remains unverified here. |
| `package.json` | `test:watch` searched the whole repository, including incompatible Playwright and Vitest tests. The nine relay contract tests were absent from normal test commands. | Keep unit/integration watchers in separate processes using the existing `concurrently` dependency; include relay contracts in `test:unit`; compose `test` from the two suite scripts. |
| `unit/tts-real-fixture.test.ts` | Six missing-fixture tests returned early and counted as passes. | Register actual conditional skips. Verify the missing-fixture branch using a temporary loader mock. |
| Relay golden-fixture tests | Fixed ciphertext will eventually expire; tests also leaked their shared-secret environment override. | Separate golden-wire compatibility from expiration validation, retain the dedicated expired-payload test, and restore/remove test environment overrides. |
| `playwright.config.ts` | An explicit `PLAYWRIGHT_BASE_URL` still started an unrelated localhost server. | Treat the override as an externally managed server. That server must provide the required test mode and service configuration. |

No application implementation, dependencies, snapshots, or assertion expectations
were changed to hide a reproduced application defect. Timer assertions and upsert
counts retain the behavior being tested.

## Historical CI failures that already pass on this checkout

The latest inspected [failed run](https://github.com/Alexjoshua14/Organic-LLM/actions/runs/33595831569)
reported 12 failures. Its explicit failures were generation-step updates and
ChatStylePicker rendering. The older
[August run](https://github.com/Alexjoshua14/Organic-LLM/actions/runs/31985444824)
also exposed incomplete AI SDK mocks and generation/restaurant test interference.

| Failure family | Affected tests | Current evidence |
| --- | --- | --- |
| Generation-step payload was null | Both `advanceGenerationStep.test.ts` cases | Existing cache-busted real import bypasses partial mocks; both pass. |
| Generation cleanup used competing mocks | Four failure/early-return cases in `runGenerationAndPersist.test.ts` | Existing mock snapshots/restoration and test-specific module import are present; all pass. |
| Undefined component during render | ChatStylePicker rendering, selection, starter, and keyboard-tab cases | All 10 current tests pass, including shuffled repetition. |
| Restaurant tool result mismatches | Both `restaurant-tool.test.ts` cases | Current fetch fixtures and setup pass on repetition. |
| Shared sync queue state | Dedupe/priority upgrade, ordering, and owner clearing in `spatial-artifacts-sync.test.ts` | Existing queue reset helper is used; all pass. |
| Missing `ai` exports (`tool`, `generateText`, `zodSchema`) | Files listed below | All current files load and pass in the complete suite and repeated run. |
| Frozen lockfile mismatch | [Dependency-update run](https://github.com/Alexjoshua14/Organic-LLM/actions/runs/30176609597) failed before tests | The current lockfile installs successfully with `--frozen-lockfile`. |

Files affected by the historical AI SDK export failures:

```text
aion-logic.test.ts
delphi-memory-tools.test.ts
gen-ui-chat-message.test.tsx
gen-ui-tool.test.ts
kanban-tool.test.ts
message-copy-markdown.test.ts
query-rewriter.test.ts
rabbit-hole-drawer-chat.test.tsx
rabbit-hole-memory-context.test.ts
rabbit-hole-node-creation-approval.test.tsx
rabbit-hole-node-creation-tool.test.ts
restaurant-tool.test.ts
short-title-from-summary.test.ts
spatial-artifacts-actions.test.ts
spatial-artifacts-sync-worker.test.ts
spatial-artifacts.test.ts
```

The other inspected failed runs were
[30176541910](https://github.com/Alexjoshua14/Organic-LLM/actions/runs/30176541910),
[30176578613](https://github.com/Alexjoshua14/Organic-LLM/actions/runs/30176578613), and
[29679400972](https://github.com/Alexjoshua14/Organic-LLM/actions/runs/29679400972).
These repeat the generation-step, ChatStylePicker, and sync-queue families above.
This audit does not claim to have reproduced Linux filesystem discovery order locally.

## Remaining verification and lint work

Configure the app services and a Clerk test account to run the 13 protected browser
tests: Aion (1), Mermaid (6), status chrome (2), glass-fonts chrome (2), sandbox tasks
(1), and the memory-ingest gallery (1). Aion expects `AION_TEST_MODE=1` on its server.
The shared authentication helper's successful sign-in path requires that account.
Missing Supabase variables also caused development-server initialization errors
during the initial unconfigured browser run; public UI assertions alone do not
verify service startup. Follow [CONTRIBUTING.md](../CONTRIBUTING.md) for setup.

Lint errors are outside the test-harness changes. Most concern accessibility or
markup and can be corrected locally: valid roles, associated labels, appropriate
interactive elements, escaped text, and Next Link usage. Audio caption findings
need review of the actual playback/transcript interaction. The memory-migration
route's direct store import needs a boundary review; substituting a user-facing
operation without checking its migration behavior would be unsafe. Review wrapper
components before changing the third-party element findings.

### Lint error inventory

| File | Lines | Rules |
| --- | --- | --- |
| `app/admin/layout.tsx` | 20 | `@next/next/no-html-link-for-pages` |
| `app/api/sandbox/memory-migration-test/route.ts` | 16 | `no-restricted-imports` |
| `app/privacy-and-security/page.tsx` | 161 | `react/no-unescaped-entities` |
| `app/rabbitholes/_components/RabbitHoleTTSButton.tsx` | 333 | `jsx-a11y/media-has-caption` |
| `app/sandbox/prototypes/spatial-archetypes/_components/spatial/ArtifactSlot.tsx` | 50 | `jsx-a11y/no-static-element-interactions` |
| `app/sandbox/prototypes/spatial-archetypes/_components/zones/AudioRackZone.tsx` | 31 | `jsx-a11y/aria-role` |
| `app/sandbox/prototypes/spatial-archetypes/_components/zones/BookshelfZone.tsx` | 94 | `jsx-a11y/aria-role` |
| `app/sandbox/prototypes/spatial-archetypes/_components/zones/PlansZone.tsx` | 65, 91 | `jsx-a11y/aria-role` |
| `app/sandbox/prototypes/strata/_components/strata-shell/StrataTextSourceCard.tsx` | 81 | `jsx-a11y/no-static-element-interactions` |
| `app/speak/_components/LiveVoiceStage.tsx` | 155 | `jsx-a11y/media-has-caption` |
| `app/speak/_components/ReadAloudStage.tsx` | 99, 114 | `jsx-a11y/media-has-caption`, `jsx-a11y/aria-role` |
| `app/status/page.tsx` | 153, 177 | `jsx-a11y/label-has-associated-control` |
| `components/chat/gen-ui/blocks/PlanTimeline.tsx` | 54, 191 | `jsx-a11y/no-redundant-roles` |
| `components/ergon/TaskRow.tsx` | 166 | `jsx-a11y/no-noninteractive-element-interactions` |
| `components/sandbox/AdaptiveSandboxInput.tsx` | 124 | `jsx-a11y/label-has-associated-control` |
| `components/sandbox/DebugTracePanel.tsx` | 117 | `jsx-a11y/no-static-element-interactions` |
| `components/sandbox/SandboxShell.tsx` | 163, 189 | `jsx-a11y/label-has-associated-control` |
| `components/third-party/ai-elements/prompt-input.tsx` | 1247 | `jsx-a11y/heading-has-content` |
| `components/third-party/ui/command.tsx` | 43 | `react/no-unknown-property` |
| `components/third-party/ui/input-group.tsx` | 64 | `jsx-a11y/no-noninteractive-element-interactions` |
| `components/tts/ClipBrowser.tsx` | 206, 254 | `jsx-a11y/media-has-caption`, `jsx-a11y/no-static-element-interactions` |
| `components/tts/SegmentManager.tsx` | 219 | `jsx-a11y/no-static-element-interactions` |
| `components/tts/ttsButton-v2.tsx` | 106 | `jsx-a11y/media-has-caption` |

## Reproduce

```bash
bun install --frozen-lockfile
bun run test
bun run test:unit --randomize --seed=2026 --rerun-each=3
bun run test:integration --randomize --seed=2026 --rerun-each=3
bunx playwright install chromium
bun run test:e2e --repeat-each=3
bun run test:watch
bun run lint:check
```

Run `bun install --frozen-lockfile`, `bun run build`, and `bun run test` from
`llm/morph-physics/` for the package suite. Use its Vitest runner, not root `bun test`.
Root `bun test` without explicit scope also discovers the browser and package tests.

Running Next dev added its required guidance block to `AGENTS.md`; Clerk added
`.clerk/` to `.gitignore` for its local configuration. Those generated changes are
retained; local Clerk configuration is not part of this change.
