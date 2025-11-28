# AgenticTest Validation Sites

Nine additional demo sites, arranged from simplest to most complex, so we can exercise AgenticTest against different architectures, rendering strategies, and deployment footprints.

| # | Name | Summary | Tech Stack & Architecture | Suggested Validation Focus |
|---|------|---------|---------------------------|----------------------------|
| 1 | **Static Status Board** | Single-page marketing/status site with live uptime badges. | Pure HTML + Alpine.js, served by Nginx container; JSON fetched from mocked `/status.json`. | Smoke navigation, link validation, accessibility scan, JSON polling assertions. |
| 2 | **Docs Portal** | Content-heavy docs with search/filter. | Eleventy static site, Lunr-powered search, hosted from Bun static server. | Trace search interactions, keyboard navigation, doc TOC anchor checks. |
| 3 | **Events RSVP Mini-App** | Users browse static event cards and submit RSVP forms that hit mocked endpoints. | Remix.run + lightweight JSON file acting as the “DB”; submission handler simply logs and returns canned responses. | Multi-step form automation, optimistic UI checks, “email confirmation” toast driven by mock service. |
| 4 | **Realtime Chat Lobby** | Lobby interface showing online users and ephemeral chat bubbles. | SvelteKit front-end with a mocked WebSocket server that replays scripted messages/presence updates. | Validate websocket-driven DOM updates, message ordering, presence indicators without a real backend. |
| 5 | **Inventory Admin Console** | CRUD grid with bulk actions for warehouse stock. | React + TanStack Table; REST calls proxied to MirageJS/Faker mocks so data lives in-memory. | Pagination, filtering, editing workflows, optimistic unlock/rollback behavior using mock responses. |
| 6 | **Analytics Dashboard** | KPI dashboards with drill-down charts. | Vue 3 + Vite front-end serving static JSON (pre-aggregated) and chart configs; FastAPI route can be stubbed using JSON files. | Validate chart rendering states, drill-down navigation, CSV export artifacts sourced from static fixtures. |
| 7 | **Digital Banking Portal** | Authenticated flows for balances, transfers, statements. | Angular 17 SPA with MSW/Mock Service Worker providing JWT+account data; Spring Boot replaced by simple Bun API returning canned payloads. | Multi-role login, funds transfer workflow, download statement PDFs (pre-rendered), strict schema validation against mock OpenAPI. |
| 8 | **IoT Fleet Command** | Device map, OTA updates, and alert triage. | Next.js (App Router) UI with static GeoJSON + scripted alert feeds; MQTT interactions simulated through periodic fetches. | Real-time alert stream, map interactions, OTA rollout wizard, GraphQL contract checks backed by mock resolvers. |
| 9 | **Marketplace Super-App** | Buyer/seller marketplace journeys with chat and logistics overlays. | Micro-frontend shell using Module Federation, but each remote renders static fixture data and uses mocked Kafka/GraphQL gateways. | Long-lived journeys (list product → purchase), cross-MFE state sync, notifications, saga compensation flows using deterministic mock timelines. |

> **Note:** None of these demo systems require full production backends. Every API, queue, or device feed can be mocked (MSW, Mirage, static JSON), and UI layers may rely on static data where that speeds up delivery. The goal is to represent architecture patterns for AgenticTest scenarios, not to ship full products.

## Next Steps

1. Prioritize which stacks to implement first (e.g., start with sites 1-3 for fast wins).
2. For each site, scaffold under `apps/<site-name>` with shared conventions (Dockerfiles, OpenAPI, seed data).
3. Add matching trace suites under `traces/<site-name>` plus compiled tests so AgenticTest covers the full spectrum.
