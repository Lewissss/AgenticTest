import { test } from "bun:test";
import { CompiledRunner } from "../../packages/core/src/compiled-runner.ts";

const trace = {
  "version": 1,
  "type": "api",
  "testName": "api_contract_smoke",
  "description": "Smoke test for login, products, and cart APIs",
  "app": "demo-system",
  "baseUrl": "http://localhost:3010",
  "apiBaseUrl": "http://localhost:3020",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "generator": {
    "mode": "manual",
    "llmProvider": "none",
    "llmModel": "none"
  },
  "inputs": {
    "env": {
      "DEMO_USERNAME": "user",
      "DEMO_PASSWORD": "pass"
    }
  },
  "policies": {
    "headless": true,
    "noMocks": true,
    "maxSteps": 10,
    "timeoutsMs": 60000
  },
  "steps": [
    {
      "id": "s1",
      "action": "post",
      "selectorOrEndpoint": "/api/login",
      "input": {
        "body": {
          "username": "${ENV:DEMO_USERNAME}",
          "password": "${ENV:DEMO_PASSWORD}"
        }
      },
      "guards": {
        "expectStatusCode": 200
      },
      "expected": {
        "displayName": "${ENV:DEMO_USERNAME}",
        "saveState": {
          "authToken": "token"
        }
      }
    },
    {
      "id": "s2",
      "action": "get",
      "selectorOrEndpoint": "/api/products",
      "input": null,
      "guards": {
        "expectStatusCode": 200
      }
    },
    {
      "id": "s3",
      "action": "post",
      "selectorOrEndpoint": "/api/cart/items",
      "input": {
        "headers": {
          "Authorization": "Bearer ${STATE:authToken}"
        },
        "body": {
          "productId": "laptop",
          "quantity": 1
        }
      },
      "guards": {
        "expectStatusCode": 200
      },
      "expected": {
        "saveState": {
          "cartCount": "items.length"
        }
      }
    }
  ]
};

const timeout = trace.policies?.timeoutsMs || 60000;

test(`demo-system :: ${trace.testName}`, async () => {
  const runner = new CompiledRunner(trace);
  await runner.setup();
  try {
    for (const step of trace.steps) {
      await runner.executeStep(step);
    }
  } finally {
    await runner.teardown();
  }
}, timeout);
