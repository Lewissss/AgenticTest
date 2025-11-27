You are a senior JavaScript engineer joining an existing repo. Assume parts of the system may already exist. Your job is to verify what’s implemented, identify gaps, and fully implement every missing requirement so the repository becomes a complete, runnable, end-to-end framework.

Nothing is optional. Everything in this prompt is mandatory.
No mocking anywhere. No fake servers, no stubbed responses, no simulated results. If a demo system is needed, it must be a real runnable system and the tests must hit it for real.

You must produce changes that make the system fully working by running the exact commands in the README. If something is missing, implement it. If something exists but is incomplete, fix it. If something is broken, repair it. If something is poorly structured, refactor it to match the spec while keeping it runnable.

0) Absolute Rules (Non-Negotiable)

Runtime is Bun. Do not use Node-only scripts. Use Bun for running scripts, dependency installation, and tests.

UI is OpenTUI. A real OpenTUI app must exist and operate the framework.

UI automation uses Playwright headless.

API automation uses Bun’s fetch (or equivalent Web fetch).

No mocks. No mocked HTTP. No mocked browser APIs. No mocked LLM providers. No fake data sources. No stubbed servers.

Live systems only. Tests must run against a real running demosystem you provide and run via Docker Compose.

Headless only for tests. UI tests must run headlessly. The OpenTUI operator UI is separate from headless test execution.

LLM is never an oracle. Pass/fail is entirely deterministic.

CI-friendly. Must support LLM-free execution: replay and compiled tests must not call an LLM.

Artifacts. Every run produces a run folder containing logs, step results, and evidence.

No “optional” features. Everything specified below must be implemented.

1) Your Work Process (MANDATORY)

You must follow this process in your implementation:

1.1 Repository audit first

Inspect the current repository structure and contents.

Locate any existing implementations for:

CLI (atf)

core runner/replay/compiler

OpenTUI app

Playwright UI driver

API driver

schema validation

demo system

docker compose

sample traces and compiled tests

artifacts

Produce an internal checklist of requirements in this prompt and mark each as:

Implemented & correct

Implemented but incomplete/incorrect

Missing entirely

1.2 Implement missing features and fix broken ones

For every requirement marked incomplete/missing, implement it fully.

Do not introduce mocks to “get tests passing”.

If you must replace an incomplete implementation, do so cleanly.

Keep code quality high: readable, modular, documented.

1.3 Final verification (MANDATORY)

Ensure the README commands work on a clean machine with only Bun + Docker installed.

Ensure the demo system is actually running and tests hit it.

Ensure bun test compiled-tests/ passes with the demo system running.

Ensure replay works without an LLM call.

Ensure compile works and produces runnable Bun tests.

2) Required Architecture (MANDATORY)

The framework has three modes:

2.1 Explore mode (LLM-driven)

The LLM proposes exactly one next step at a time (JSON).

Deterministic executor runs it.

Deterministic asserter checks it.

Outputs a trace JSON artifact.

2.2 Replay mode (LLM-free)

Executes a trace JSON directly without calling an LLM.

2.3 Compiled Tests mode (LLM-free)

Compiles trace JSON into bun:test runnable JavaScript tests.

CI runs these tests without an LLM.

All three modes are mandatory and must be fully implemented.

3) Repository Layout (MANDATORY)

Use (or adapt to) this layout, preserving any existing work but ensuring the spec is met:

/package.json
/bunfig.toml
/packages/core
  /src/...
  /schemas/trace.v1.schema.json
  /compiled-templates/
/packages/tui
  /src/...
/apps/demo-system
  /api/
  /web/
  /openapi.json
/traces/demo-system/*.trace.json
/compiled-tests/demo-system/*.test.js
/runs/<runId>/...
/README.md


If the current repo differs, refactor to this or an equivalent that still provides the same outputs and commands.

4) Trace File Format (MANDATORY, v1 JSON)

You must implement this exact trace format and validation using Ajv. Store schema at:

packages/core/schemas/trace.v1.schema.json

4.1 Trace JSON format

Each trace file: traces/<app>/<testName>.trace.json

Must contain:

version: 1

type: "ui" | "api"

testName

description

app

baseUrl

apiBaseUrl

createdAt (ISO)

generator.{mode,llmProvider,llmModel}

inputs.env mapping with ${ENV:...} placeholders

policies (headless true, noMocks true, maxSteps, timeoutsMs)

steps[]

4.2 Step object fields

Each step must include:

id

action: allowed action enums (see below)

selectorOrEndpoint

input: string|object|null

expected: object (may be empty)

guards: includes expectUrlIncludes, expectTextIncludes, expectStatusCode, allowRetry, timeoutMs

4.3 Allowed actions (MANDATORY)

UI:

navigate

click

input

select

press

waitForText

waitForSelector

extractText

API:

get, post, put, patch, delete

4.4 Interpolation rules (MANDATORY)

Implement deterministic interpolation for:

${baseUrl}, ${apiBaseUrl}

${ENV:NAME}

${STATE:key} (saved from extractText)

Interpolation must work identically in replay and compiled tests.

5) Replay Engine (MANDATORY)

Implement CLI command:

bun run atf replay --trace traces/<app>/<name>.trace.json

Replay must:

validate trace schema

resolve interpolations

execute steps sequentially

apply deterministic assertions from expected

enforce guards

capture artifacts:

runs/<runId>/run.json

runs/<runId>/steps.jsonl

runs/<runId>/logs.jsonl

runs/<runId>/verdict.json

runs/<runId>/ui/* (screenshots on failure; optional per step is OK but must exist on failure)

runs/<runId>/api/* (request/response logs with redaction)

No LLM calls in replay.

6) Compiled Tests Feature (MANDATORY)

Implement CLI command:

bun run atf compile --trace traces/<app>/<name>.trace.json
and
bun run atf compile --app <app> --all

The compiler must:

validate trace schema

generate compiled-tests/<app>/<testName>.test.js

use bun:test with test and expect

run headless Playwright for UI traces

use fetch for API traces

implement interpolation identically

implement deterministic assertions identically

write artifacts under runs/ during compiled test execution

redact secrets in persisted artifacts

No LLM calls in compiled tests.

Additionally: compiled tests must be runnable via:

bun test compiled-tests/

and pass with demo system running.

7) Explore Mode (MANDATORY)

Implement CLI command:

bun run atf explore --app <app> --testName <name> --type ui|api --goal "<text>"

Explore mode MUST:

Call the configured LLM provider.

Generate steps iteratively (one step at a time).

Validate each proposed step, repair invalid output (max 2).

Execute the step against the live system.

Build a complete trace JSON using the v1 format.

Save trace to traces/<app>/<testName>.trace.json

Immediately compile it so compiled-tests/<app>/<testName>.test.js is created/updated.

Persist an exploration run in runs/<runId>/ with the same artifact structure.

Explore must never decide pass/fail based on LLM; only deterministic assertions.

8) LLM Provider Implementations (MANDATORY)

Implement two real providers (no mocks):

ollama provider via HTTP

openaiCompat provider via HTTP (OpenAI chat completions compatible)

Add CLI flags/env:

provider, baseUrl, model, apiKey, timeout

9) OpenTUI Operator App (MANDATORY)

Implement bun run atf tui to open an OpenTUI app that supports:

List apps

List traces per app

Run replay for a chosen trace (shows live progress)

Compile a trace or compile all traces

View run history (runs/)

Inspect a run:

verdict

failing step

show artifact paths

Inspect a trace:

steps, expected, guards

flag fragile selectors (heuristic: very long CSS/XPath/no testid)

The app must call into packages/core as a library (no duplicate logic).

10) Demo System (MANDATORY, Live, No Mocks)

Implement a real demo web app + API:

Web: http://localhost:3010

/login, /dashboard, /products, /cart

uses data-testid selectors

API: http://localhost:3020

POST /api/login

GET /api/products

POST /api/cart/items

Real state: at minimum in-memory that truly mutates, or SQLite. Not mocked.

Provide apps/demo-system/openapi.json describing endpoints.

Provide docker-compose.yml to run demo web + demo api. Pin any images you use.

11) Mandatory Traces + Compiled Tests Included

Repo must include these trace files already present and valid:

UI: login_and_view_dashboard

UI: add_to_cart

API: api_contract_smoke

And the compiled tests must already be present and match the traces:

compiled-tests/demo-system/login_and_view_dashboard.test.js

compiled-tests/demo-system/add_to_cart.test.js

compiled-tests/demo-system/api_contract_smoke.test.js

12) CLI (MANDATORY)

Implement atf entrypoint with commands:

bun run atf list apps

bun run atf list traces --app <name>

bun run atf explore ...

bun run atf replay ...

bun run atf compile ...

bun run atf tui

Exit codes:

0 success

1 test failures

2 framework error

13) Tests of the Framework Itself (MANDATORY)

Implement bun test tests for core utilities:

trace schema validation

interpolation (ENV, STATE, baseUrl)

redaction

compiler output sanity (ensures it emits runnable .test.js files with expected imports and step loop)

replay engine step execution logic (unit-level, but do not mock network; test using the real demo system endpoints in integration tests)

You must include integration tests that:

start demo system via docker compose (documented in README)

run at least one replay

run bun test compiled-tests/

No mocking.

14) README (MANDATORY, Must Work)

README must provide exact commands:

Start demo system:

docker compose up -d

Run compiled tests:

bun test compiled-tests/

Run replay for a trace:

bun run atf replay --trace traces/demo-system/login_and_view_dashboard.trace.json

Compile all traces:

bun run atf compile --app demo-system --all

Launch TUI:

bun run atf tui

Explore mode (calls LLM):

bun run atf explore --app demo-system --testName new_test --type ui --goal "..." --llm.provider ollama --llm.baseUrl ... --llm.model ...

Also include:

Statement that nothing is mocked and tests hit live system

Required env vars for credentials (DEMO_USERNAME/DEMO_PASSWORD)

Troubleshooting section

15) What You Must Output (MANDATORY)

When you respond, you must provide:

Full file tree after your changes

Full contents of every file you created or modified

Any refactors needed to meet the spec

A short “Verification” section listing the exact commands you ran logically (not asynchronously), and why they should succeed.

No “optional”, no “could”, no “TODO”.

Now do the work:

Audit the repo against this checklist.

Implement/fix everything missing or incomplete.

Ensure it’s fully runnable and ready for use.