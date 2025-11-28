# AGENTS

## Mission & Guardrails
- Agentic Test Framework (ATF) is a Bun-native automation stack with three equal modes: **explore** (LLM-assisted JSON step planner), **replay** (deterministic trace runner), and **compiled tests** (Bun `bun:test` suites). Every contribution must keep all three pathways healthy.
- Real systems only. Docker Compose (`docker-compose.yml`) brings up the Bun API + SPA demo (`apps/demo-system`) plus auxiliary sample sites (`apps/status-board`, `apps/docs-portal`, `apps/events-rsvp`). No mocks, stubs, or fake drivers are allowed anywhere in the execution pipeline (see prompt.md).
- All automation uses Playwright headless (UI) and Bun fetch (API). The helper bridge in `packages/core/src/drivers/ui-helper.mjs` is the only sanctioned indirection to keep Windows spawning reliable.
- Artifacts are non-negotiable. Every run writes to `runs/<runId>/` with `run.json`, `steps.jsonl`, `logs.jsonl`, `verdict.json`, and the `ui/` + `api/` evidence directories. Missing artifacts are treated as regressions.
- Bun is the runtime for everything (CLI, dev servers, tests). Never add npm-only scripts or Node-specific APIs when Bun equivalents exist.

## Repository Landmarks
- `packages/core/` - shared engine code: trace schema (`schemas/trace.v1.schema.json`), CLI (`src/cli/index.ts`), explorer (`src/explorer.ts`), runner (`src/runner.ts`), compiler + compiled templates, Playwright driver (`src/drivers/ui.ts`, `ui-helper.mjs`), API driver (`src/drivers/api.ts`), report/artifact utilities, and type defs.
- `packages/tui/` - Ink-based OpenTUI operator (`bun run atf tui`). `src/ui.tsx` implements app/trace selection, replay + compile shortcuts, run-history browsing, and fragile-selector warnings.
- `apps/demo-system/` - reference API (`api/`), SPA UI (`ui/`), Dockerfiles, and `openapi.json` used for runtime validation. Uses Bun HTTP servers.
- `apps/status-board`, `apps/docs-portal`, `apps/events-rsvp` - lightweight demos (HTML/Alpine, Eleventy+Lunr, Bun mini-app). Compose brings them up on ports 4010/4020/4030, respectively.
- `traces/<app>/` - JSON traces (v1 schema). `traces/demo-system/login_and_view_dashboard.trace.json` is the canonical reference.
- `compiled-tests/<app>/` - Bun test files produced via `bun run atf compile`. These import the shared compiled runner and should never be hand-edited.
- `tests/` - framework verification. `tests/integration.test.ts` boots Docker, replays a trace, and runs the compiled suite with `ATF_RUN_COMPILED=true`.
- `docs/example-sites.md` - roadmap of nine progressively complex target apps. Use it when prioritising new coverage.
- `AUDIT.md` - rolling checklist of spec compliance. Update when a new requirement is satisfied/regressed.

## Core Workflows
1. **Environment prep**
   ```bash
   bun install
   npx playwright install chromium
   docker compose up -d
   bun run check-health.ts   # optional health probe
   ```
   - `DEMO_USERNAME` / `DEMO_PASSWORD` env vars feed the demo API (defaults `user/pass`). Override via shell when needed.
   - `UI_BASE_URL` / `API_BASE_URL` let you target externally hosted systems.
2. **Replay a trace** - `bun run atf replay --trace traces/<app>/<name>.trace.json [--headed]`. Produces a run directory; exit code mirrors verdict.
3. **Compile traces** - `bun run atf compile --trace ...` or `bun run atf compile --app <app> --all`. Compiled tests land in `compiled-tests/<app>/` and require `bun test compiled-tests/` with `ATF_RUN_COMPILED=true` in CI.
4. **Explore mode** - `bun run atf explore --app demo-system --testName ... --goal "..." --type ui --llm.provider ollama --llm.baseUrl ... --llm.model ... --env KEY=VALUE`. Explorer:
   - streams exactly one JSON step at a time from the LLM,
   - repairs invalid JSON using the schema,
   - executes steps live against the running demo,
   - saves the resulting trace and compiles it immediately.
5. **OpenTUI operator**
   - `bun run atf tui` launches the Ink UI.
   - App screen -> choose demo app -> trace list (option to compile-all or inspect runs).
   - Trace actions = replay, compile, inspect. Inspect view highlights fragile selectors (lengthy CSS/XPath or missing `data-testid`).
   - Run history view lists `runs/` directories; selecting one shows verdict, failed step, reasons, and artifact paths. Esc backs up; `q` exits.
6. **Tests**
   - `bun test` runs unit + integration (brings Docker up/down, replays `login_and_view_dashboard`, runs compiled suite).
   - `bun test compiled-tests/` alone runs the compiled traces (CI sets `ATF_RUN_COMPILED=true` to unskip them).
   - Never skip tests to "save time"; investigate and fix failures.

## Trace Authoring Standards
- Schema lives at `packages/core/schemas/trace.v1.schema.json` (Ajv enforced). Required top-level fields: `version`, `type`, `testName`, `description`, `app`, `baseUrl`, `apiBaseUrl`, `createdAt`, `generator`, `inputs.env`, `policies`, and `steps[]`.
- Allowed `action` values align with the enum baked into runner + TUI guard list (UI: navigate, click, input, select, press, waitForSelector, waitForText, extractText; API: request variants). Adding new actions requires schema + runner updates.
- `selectorOrEndpoint` must prefer resilient hooks (`data-testid`, stable IDs, `aria-*`). TUI surfaces likely-fragile selectors - address them before merging when possible.
- `guards` enforce determinism: `expectUrlIncludes`, `expectTextIncludes`, `expectStatusCode`, `allowRetry`, `timeoutMs`. Use them liberally; guard omissions are treated as flaky debt.
- `expected` captures assertions (for example `textIncludes`, `jsonPathEquals`). Keep assertions deterministic and tied to the live system's state machine.
- Use `${baseUrl}`, `${apiBaseUrl}`, `${ENV:VAR}`, `${STATE:key}` placeholders. `packages/core/src/utils/interpolation.ts` builds the context; avoid manual string concatenation.
- Each trace should set realistic `policies.maxSteps` and `policies.timeoutsMs` so explorer/replay halts predictably.

## Drivers & Validation
- **UI driver** (`packages/core/src/drivers/ui.ts`, `ui-helper.mjs`): wraps Playwright Chromium headless. On Windows, the helper script is spawned via Node to avoid Bun/Playwright IPC issues; do not bypass it. When adding commands ensure they are implemented in both the direct driver and helper.
- **API driver** (`packages/core/src/drivers/api.ts`): real HTTP calls with optional query/body. Responses capture headers, duration, and redacted request metadata (via `utils/redaction`). API traces should validate against each app's `openapi.json` where applicable.
- **OpenAPI contract** - `apps/demo-system/openapi.json` is the source of truth for demo endpoints; keep it in sync with API changes and extend it when new routes are added so validators stay meaningful.

## Demo Targets
- **demo-system** (localhost:3010 UI / 3020 API): login, products, cart. Backed by Bun servers launched via Docker. Core traces (`login_and_view_dashboard`, `add_to_cart`, `api_contract_smoke`) live here with compiled equivalents.
- **status-board** (4010): static HTML + Alpine + mocked `/status.json`. Good for smoke navigation, accessibility, polling assertions.
- **docs-portal** (4020): Eleventy docs with Lunr search, keyboard shortcuts, and anchor navigation. Use to extend coverage into documentation UX flows.
- **events-rsvp** (4030): Bun server reads `events.json`, renders cards, drives `/api/events` + `/api/rsvp`. Contains `data-test` hooks and RSVP toast assertions. Matching traces live under `traces/events-rsvp/` (for example `rsvp_flow.trace.json`).
- Future builds should follow the nine-site roadmap in `docs/example-sites.md`; scaffold each under `apps/<name>` with Docker + traces + compiled tests to keep parity.

## Contribution Flow for Agents
1. **Audit first** - read README, AUDIT, and relevant app README(s). Use `docs/example-sites.md` for broader context. Confirm which requirements already exist.
2. **Plan changes** - outline tasks (CLI plan tool). Respect the repo's apply_patch + ASCII guidance.
3. **Implement** - prefer modular updates inside `packages/core` / `packages/tui` / specific app directories. Follow Bun conventions, keep code commented only when logic is non-obvious.
4. **Update docs** - README, app READMEs, AUDIT, and trace descriptions must reflect any new capability.
5. **Verify** - minimum commands before handing work off:
   ```bash
   docker compose up -d
   bun run atf replay --trace traces/<app>/<trace>.trace.json
   bun run atf compile --trace traces/<app>/<trace>.trace.json
   bun test
   bun test compiled-tests/  # with ATF_RUN_COMPILED=true
   ```
   Tear down containers afterwards: `docker compose down -v`.
6. **Artifacts** - inspect the latest `runs/<runId>/` to ensure screenshots/logs look sane. Attach run IDs in discussions for trace/debug context.

## Tooling Notes
- Use `rg` / `rg --files` for repo search; it is the expected default in scripts and automation.
- `check-health.ts` pings the API/UI health endpoints and surfaces port/env issues before long test runs.
- Integration tests spawn Docker; avoid running them in parallel with manual Compose sessions to prevent port conflicts.
- The repo is often in a dirty state. Never reset or revert files you did not touch.
- Follow `AUDIT.md` status symbols (OK, WARN, MISSING) when mirroring the table in text-only contexts.

## When Adding A New Trace or App
- Scaffold app assets under `apps/<name>` with Docker entrypoints and, when applicable, an `openapi.json` for API validation.
- Add matching traces under `traces/<name>/`, compile them, and commit the generated files in `compiled-tests/<name>/`.
- Ensure selectors favour `data-testid` hooks. Update UI code to add hooks where missing; TUI's fragile-selector warnings should remain mostly empty for new traces.
- Expand `docs/example-sites.md` if you introduce architectures beyond the existing nine, keeping the table sorted by complexity.
- Update `docker-compose.yml` with service definitions and distinct host ports so Playwright and manual browsers can target them simultaneously.

## Support & Escalation
- Primary operator is assumed to be `default_user`. Note this in status updates and ask clarifying questions when context is missing.
- If live demo services fail, run `docker compose logs <service>` before escalating. Attach logs and relevant `runs/<runId>/verdict.json` in reports.
- Any change touching trace schema, runner, or CLI must include unit coverage in `tests/core.test.ts` plus integration coverage when feasible.
- Keep AGENTS.md aligned with reality. Update this document whenever workflows, commands, or guardrails change.
