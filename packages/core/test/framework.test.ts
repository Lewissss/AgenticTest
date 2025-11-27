import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { runTraceFile } from "../src/runner";
import { compileTrace } from "../src/compiler";
import fs from "fs/promises";
import path from "path";

// Integration tests for the framework
// Assumes demo system is running (we will start it in the verification step)

describe("Framework Integration", () => {
    const demoApp = "demo-system";
    const tracesDir = path.resolve(process.cwd(), `traces/${demoApp}`);
    const compiledDir = path.resolve(process.cwd(), `compiled-tests/${demoApp}`);

    test("Schema Validation - Valid Trace", async () => {
        const tracePath = path.join(tracesDir, "login_and_view_dashboard.trace.json");
        const content = await fs.readFile(tracePath, "utf-8");
        const trace = JSON.parse(content);
        expect(trace.version).toBe(1);
    });

    test("Replay - Login Trace", async () => {
        const tracePath = path.join(tracesDir, "login_and_view_dashboard.trace.json");
        // We expect this to fail if demo system is not running, but we will run this AFTER starting docker
        // For now, let's assume it might fail if we run it in isolation without docker.
        // But the prompt says "Implement bun test tests for core utilities... You must include integration tests that start demo system via docker compose"
        // Actually, I should probably run docker compose UP in the verification script, not inside the test file itself unless I use a setup hook.
        // Let's write the test assuming the environment is ready.

        try {
            const result = await runTraceFile({
                app: demoApp,
                tracePath,
                headless: true
            });
            expect(result.verdict.status).toBe("pass");
        } catch (e) {
            console.error("Replay failed (is demo system running?)", e);
            throw e;
        }
    }, 60000);

    test("Compiler - Generate Test", async () => {
        const tracePath = path.join(tracesDir, "login_and_view_dashboard.trace.json");
        await compileTrace(demoApp, tracePath);

        const compiledPath = path.join(compiledDir, "login_and_view_dashboard.test.js");
        const exists = await fs.exists(compiledPath);
        expect(exists).toBe(true);

        const content = await fs.readFile(compiledPath, "utf-8");
        expect(content).toContain("import { test");
        expect(content).toContain("CompiledRunner");
    });
});
