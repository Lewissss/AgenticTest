import { test } from "bun:test";
import { CompiledRunner } from "../../packages/core/src/compiled-runner.ts";

const trace = {
  "version": 1,
  "type": "ui",
  "testName": "add_to_cart",
  "description": "Login, view products, and add a laptop to the cart",
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
    "maxSteps": 15,
    "timeoutsMs": 60000
  },
  "steps": [
    { "id": "s1", "action": "navigate", "selectorOrEndpoint": "${baseUrl}/login", "input": null },
    { "id": "s2", "action": "input", "selectorOrEndpoint": "[data-testid='username-input']", "input": "${ENV:DEMO_USERNAME}" },
    { "id": "s3", "action": "input", "selectorOrEndpoint": "[data-testid='password-input']", "input": "${ENV:DEMO_PASSWORD}" },
    { "id": "s4", "action": "click", "selectorOrEndpoint": "[data-testid='login-button']", "input": null },
    { "id": "s5", "action": "click", "selectorOrEndpoint": "[data-testid='nav-products']", "input": null },
    { "id": "s6", "action": "waitForSelector", "selectorOrEndpoint": "[data-testid='products-list']", "input": null },
    { "id": "s7", "action": "click", "selectorOrEndpoint": "[data-testid='add-to-cart-laptop']", "input": null },
    { "id": "s8", "action": "click", "selectorOrEndpoint": "[data-testid='nav-cart']", "input": null },
    { "id": "s9", "action": "waitForSelector", "selectorOrEndpoint": "[data-testid='cart-items']", "input": null },
    {
      "id": "s10",
      "action": "waitForText",
      "selectorOrEndpoint": "Performance Laptop",
      "input": null,
      "expected": {
        "textIncludes": "Performance Laptop"
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
