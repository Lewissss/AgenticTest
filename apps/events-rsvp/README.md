# Events RSVP Mini-App

Mocked events browsing experience with RSVP flow. Built with a lightweight Bun server that serves static HTML + JS and exposes `/api/events` and `/api/rsvp` endpoints backed by a JSON file (no database).

## Run locally

```bash
cd apps/events-rsvp
bun install
bun run server.ts
```

Visit http://localhost:4030 to browse events.

## Docker

```bash
docker build -f Dockerfile.ui -t events-rsvp .
docker run --rm -p 4030:4030 events-rsvp
```

Or rely on the root compose file: `docker compose up events-rsvp`.

## Features

- Event grid built from `events.json`.
- Detail modal surfaces speaker, location, and timeline content.
- RSVP form posts to `/api/rsvp` and displays a deterministic toast.
- Data-test hooks throughout so traces can target selectors easily.
