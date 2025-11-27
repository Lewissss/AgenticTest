import { test } from "bun:test";
import { CompiledRunner } from "../../packages/core/src/compiled-runner.ts";

const trace = {
  "version": 1,
  "type": "ui",
  "testName": "login_and_view_dashboard",
  "description": "Login and verify dashboard renders",
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
      "action": "navigate",
      "selectorOrEndpoint": "${baseUrl}/login",
      "input": null,
      "guards": {
        "expectUrlIncludes": "/login"
      }
    },
    {
      "id": "s2",
      "action": "input",
      "selectorOrEndpoint": "[data-testid='username-input']",
      "input": "${ENV:DEMO_USERNAME}"
    },
    {
      "id": "s3",
      "action": "input",
      "selectorOrEndpoint": "[data-testid='password-input']",
      "input": "${ENV:DEMO_PASSWORD}"
    },
    {
      "id": "s4",
      "action": "click",
      "selectorOrEndpoint": "[data-testid='login-button']",
      "input": null
    },
    {
      "id": "s5",
      "action": "waitForText",
      "selectorOrEndpoint": "Dashboard",
      "input": null,
      "guards": {
        "expectTextIncludes": "Welcome"
      },
      "expected": {
        "textIncludes": "Welcome"
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
