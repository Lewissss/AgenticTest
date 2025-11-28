---
title: Configuration
layout: layout.njk
collection: docs
permalink: /config/index.html
---

Configuration is stored in `agentic.config.json`. The schema is simple for this mock:

```json
{
  "tracesDir": "./traces",
  "compiledDir": "./compiled-tests",
  "llm": {
    "provider": "mock",
    "model": "gpt-lite"
  }
}
```
