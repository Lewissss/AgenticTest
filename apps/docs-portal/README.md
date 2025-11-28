# Docs Portal

Eleventy + Lunr.js powered documentation site to validate search, navigation, and keyboard workflows in AgenticTest. Content is static markdown compiled into HTML. Search runs entirely on the client using a pre-built index.

## Run locally

```bash
cd apps/docs-portal
# Install once
bun install

# Start Eleventy dev server
npx @11ty/eleventy --serve
```

Or build static output:

```bash
npx @11ty/eleventy
```

The site is simple enough to serve directly from the Eleventy output directory (`_site/`) or bundle via Docker if needed later.

## Features

- Hierarchical left nav with section anchors.
- Search modal (`/`) backed by Lunr.
- Keyboard navigation (J/K to move between headings).
- Content is mocked in `content/` — edit or add markdown files to expand coverage.

## Docker

```bash
docker build -f Dockerfile.ui -t docs-portal .
docker run --rm -p 4020:80 docs-portal
```

Or rely on the root `docker compose up docs-portal`.
