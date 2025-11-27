# ATF Requirement Audit

Status legend:
- ✅ Implemented & correct
- ⚠️ Implemented but incomplete/incorrect
- ❌ Missing entirely

| Requirement | Status | Notes |
| --- | --- | --- |
| Bun runtime & Bun scripts | ✅ | All commands use Bun (`bun run atf`, `bun test`, Bun servers). |
| OpenTUI operator app | ✅ | `bun run atf tui` launches the OpenTUI Ink app with trace/run management features. |
| Playwright UI driver | ✅ | `UiDriver` wraps Chromium headless actions (click/input/wait) and screenshots on failure. |
| API driver & redaction | ✅ | Real fetch client with headers/query/body support and request/response redaction. |
| Trace schema v1 | ✅ | `packages/core/schemas/trace.v1.schema.json` enforces the required structure. |
| Interpolation rules | ✅ | `${baseUrl}`, `${apiBaseUrl}`, `${ENV:}`, and `${STATE:}` handled by `buildInterpolationContext`. |
| Replay engine | ✅ | `runTraceFile` validates schema, executes deterministically, and records artifacts. |
| Compiled tests | ✅ | Compiler emits Bun tests that use `CompiledRunner` and share artifact logic. |
| Explore mode + LLM providers | ✅ | Explorer streams one-step JSON from Ollama/OpenAI-compatible providers, validates/repairs, and compiles traces. |
| CLI commands | ✅ | `list`, `replay`, `compile`, `explore`, and `tui` all implemented with proper exit codes. |
| OpenAPI validation | ✅ | Responses are validated against `apps/<app>/openapi.json`. |
| Demo system (web + API) | ✅ | Live Bun servers for `/login`, `/dashboard`, `/products`, `/cart` with stateful API `/api/login|products|cart/items`. |
| Docker Compose | ✅ | `docker-compose.yml` runs the Bun API/UI services on ports 3020/3010. |
| Mandatory traces | ✅ | `traces/demo-system/*.trace.json` exist and align with the live system. |
| Artifacts per run | ✅ | `runs/<runId>/` contains run.json, verdict, logs, steps, `ui/`, and `api/`. |
| Compiled templates directory | ✅ | `packages/core/compiled-templates/base.test.js` powers compiled test generation. |
| Tests of framework | ✅ | `tests/core.test.ts` (utilities + executor) and `tests/integration.test.ts` (docker compose, replay, compiled suite). |
| README commands & docs | ✅ | README documents setup, demo commands, env vars, and troubleshooting. |
| Explorer -> trace -> compiled pipeline | ✅ | Explorer saves validated traces, writes artifacts, and runs compiler automatically. |
