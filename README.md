# Agentic Test Framework (ATF)

A Bun-native automation framework with OpenTUI operations, Playwright UI execution, and real API clients. Nothing is mocked; every run talks to a live demo system via Docker Compose.

## Prerequisites

- [Bun](https://bun.sh)
- Docker & Docker Compose
- Playwright system dependencies (install via `npx playwright install-deps` if required)

## Install Dependencies

```bash
bun install
npx playwright install chromium
```

## Start the Demo System

Launch both the demo API and UI (required for any replay or test):

```bash
docker compose up -d
```

Check health (optional):

```bash
bun run check-health.ts
```

Stop everything when finished:

```bash
docker compose down -v
```

## Core Commands

| Task | Command |
| --- | --- |
| Replay a trace deterministically | `bun run atf replay --trace traces/demo-system/login_and_view_dashboard.trace.json` |
| Compile every trace for an app | `bun run atf compile --app demo-system --all` |
| Compile a single trace | `bun run atf compile --trace traces/demo-system/add_to_cart.trace.json` |
| Run compiled tests (CI mode) | `bun test compiled-tests/` |
| Launch the OpenTUI operator | `bun run atf tui` |
| Explore & auto-build a trace (Ollama example) | `bun run atf explore --app demo-system --testName new_goal --type ui --goal "Login and open cart" --llm.provider ollama --llm.baseUrl http://localhost:11434 --llm.model llama3.2` |

The OpenTUI interface lets you list apps, inspect traces, replay, compile, and inspect run artifacts directly from the terminal.

## Tests

Unit + integration tests (includes Docker Compose bring-up and compiled test execution):

```bash
bun test
```

Compiled tests alone:

```bash
bun test compiled-tests/
```

Integration coverage includes:

1. `docker compose up -d`
2. Replay of `login_and_view_dashboard`
3. `bun test compiled-tests/`

## Environment Variables

The framework interpolates `${ENV:VARNAME}` inside traces. The demo system expects:

- `DEMO_USERNAME`
- `DEMO_PASSWORD`

Set them before running explore/replay if you override the defaults.

Optional overrides:

- `UI_BASE_URL` (defaults to `http://localhost:3010`)
- `API_BASE_URL` (defaults to `http://localhost:3020`)

## Architecture Summary

- **Runner / Replay** – Validates trace schema, resolves `${baseUrl}`, `${apiBaseUrl}`, `${ENV:}` and `${STATE:}` tokens, exercises Playwright or the API driver, and writes artifacts under `runs/<runId>` (run.json, verdict.json, logs.jsonl, steps.jsonl, plus `ui/` screenshots and `api/` exchanges).
- **Compiler** – Converts trace JSON into `compiled-tests/<app>/*.test.js` Bun tests that reuse the deterministic runner and emit the same artifact structure.
- **Explorer** – Calls a real LLM provider (Ollama or any OpenAI-compatible endpoint) one step at a time, validates/repairs output, executes live steps, saves the trace, and compiles it immediately.
- **OpenTUI** – Terminal UI to list apps/traces, replay, compile, inspect traces (with fragile selector heuristics), and view run history/artifacts.
- **Demo System** – Live Bun-powered API (`http://localhost:3020/api/...`) plus an SPA UI (`http://localhost:3010`) served via Docker Compose. The API maintains in-memory carts and requires Bearer auth tokens from login responses.

## Troubleshooting

- **`bun` not found**: Install from https://bun.sh and ensure it is on your PATH.
- **Playwright errors**: Install browser dependencies (`npx playwright install chromium && npx playwright install-deps`).
- **Docker ports busy**: Stop conflicting containers or change `DEMO_WEB_PORT` / `DEMO_API_PORT` in `docker-compose.yml`.
- **LLM explore failures**: Verify Ollama/OpenAI endpoints are reachable and pass `--llm.baseUrl`, `--llm.model`, and `--llm.apiKey` as needed.
- **Authentication issues**: Confirm `DEMO_USERNAME`/`DEMO_PASSWORD` match the credentials configured for the demo API server.

## Guarantees

- No HTTP mocks, fake browsers, or stubbed LLMs—every mode drives the live demo system.
- Artifacts for each run land under `runs/<runId>/` with logs, verdicts, steps, UI screenshots, and API exchanges for full auditability.
- All modes (explore, replay, compiled tests) share the same deterministic execution engine and interpolation rules.
