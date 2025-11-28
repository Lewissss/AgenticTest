import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { runTraceFile } from "../src/runner";
import { compileTrace } from "../src/compiler";
import fs from "fs/promises";
import path from "path";

const workspace = process.cwd();

async function runCommand(cmd: string[]) {
    const proc = Bun.spawn(cmd, { cwd: workspace, stdout: "inherit", stderr: "inherit" });
    const code = await proc.exited;
    if (code !== 0) {
        throw new Error(`Command ${cmd.join(" ")} failed with code ${code}`);
    }
}

async function waitFor(url: string, timeoutMs = 60000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(url);
            if (res.ok) return;
        } catch {
            // retry
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Timed out waiting for ${url}`);
}

describe("Framework Integration", () => {
    const demoApp = "demo-system";
    const tracesDir = path.resolve(process.cwd(), `traces/${demoApp}`);
    const compiledDir = path.resolve(process.cwd(), `compiled-tests/${demoApp}`);

    beforeAll(async () => {
        await runCommand(["docker", "compose", "up", "-d"]);
        await waitFor("http://localhost:3020/health");
        await waitFor("http://localhost:3010/health");
    }, 180000);

    afterAll(async () => {
        await runCommand(["docker", "compose", "down", "-v"]);
    }, 180000);

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
