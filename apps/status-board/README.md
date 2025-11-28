# Static Status Board

Single-page status dashboard demonstrating AgenticTest coverage for a static site. The UI fetches a mocked `status.json` file and renders current uptime, SLA badges, and incident timelines.

## Run Locally

```bash
cd apps/status-board
docker build -f Dockerfile.ui -t status-board .
docker run --rm -p 4010:80 status-board
```

Then open http://localhost:4010.

You can also start it via the root `docker compose up status-board`.

## Structure

- `public/index.html` – vanilla layout with sections for summary, detailed services, and incident feed.
- `public/status.json` – mocked telemetry that the page fetches.
- `public/app.js` – client-side script that fetches the JSON, renders badges, and applies color-coded state.
- `Dockerfile.ui` – packages everything into an Nginx container.
