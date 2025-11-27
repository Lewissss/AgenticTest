import { describe, expect, test } from "bun:test";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { buildInterpolationContext, interpolateString } from "@atf/core";
import { redact } from "@atf/core";
import { compileTrace } from "@atf/core";
import { runTraceFile } from "@atf/core";
import { loadTrace } from "@atf/core";

const tmp = async (name: string) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "atf-tests-"));
    return path.join(dir, name);
};

describe("core utilities", () => {
    test("trace schema validation", async () => {
        const tracePath = await tmp("valid.trace.json");
        await fs.writeFile(tracePath, JSON.stringify({
            version: 1,
            type: "api",
            testName: "schema_pass",
            description: "",
            app: "demo-system",
            baseUrl: "http://localhost",
            apiBaseUrl: "http://localhost",
            createdAt: new Date().toISOString(),
            generator: { mode: "manual", llmProvider: "none", llmModel: "none" },
            inputs: { env: {} },
            policies: { headless: true, noMocks: true, maxSteps: 1, timeoutsMs: 1000 },
            steps: [
                { id: "s1", action: "get", selectorOrEndpoint: "/health" }
            ]
        }));
        const loaded = await loadTrace(tracePath);
        expect(loaded.testName).toBe("schema_pass");

        const invalidPath = await tmp("invalid.trace.json");
        await fs.writeFile(invalidPath, JSON.stringify({ type: "ui" }));
        await expect(loadTrace(invalidPath)).rejects.toThrow();
    });

    test("interpolation resolves base/api/env/state", () => {
        const ctx = buildInterpolationContext({
            baseUrl: "http://example.com",
            apiBaseUrl: "http://api.example.com",
            traceEnv: { TOKEN: "abc" },
            overrides: { state: { session: "xyz" } }
        });
        const resolved = interpolateString("${baseUrl}/login?token=${ENV:TOKEN}&s=${STATE:session}", ctx);
        expect(resolved).toBe("http://example.com/login?token=abc&s=xyz");
    });

    test("redaction masks secrets", () => {
        const payload = { auth: "secret123", ok: true };
        const redacted = redact(payload, ["secret123"]);
        expect(redacted.auth).toBe("[REDACTED]");
        expect(redacted.ok).toBe(true);
    });

    test("compiler emits compiled runner", async () => {
        const outPath = await compileTrace("demo-system", path.resolve("traces/demo-system/login_and_view_dashboard.trace.json"));
        const content = await fs.readFile(outPath, "utf-8");
        expect(content).toContain("CompiledRunner");
        expect(content).toContain("test(`demo-system");
    });

    test("API replay executes step", async () => {
        const server = Bun.serve({
            port: 4505,
            fetch(req) {
                const url = new URL(req.url);
                if (url.pathname === "/api/login" && req.method === "POST") {
                    return Response.json({ token: "demo-token" });
                }
                if (url.pathname === "/api/items" && req.method === "GET") {
                    return Response.json([{ id: 1 }]);
                }
                return new Response("Not found", { status: 404 });
            }
        });
        const tracePath = await tmp("api.trace.json");
        await fs.writeFile(tracePath, JSON.stringify({
            version: 1,
            type: "api",
            testName: "local_api",
            description: "",
            app: "demo-system",
            baseUrl: "http://localhost",
            apiBaseUrl: `http://127.0.0.1:${server.port}`,
            createdAt: new Date().toISOString(),
            generator: { mode: "manual", llmProvider: "none", llmModel: "none" },
            inputs: { env: {} },
            policies: { headless: true, noMocks: true, maxSteps: 3, timeoutsMs: 1000 },
            steps: [
                { id: "s1", action: "post", selectorOrEndpoint: "/api/login", input: { body: {} }, guards: { expectStatusCode: 200 }, expected: { saveState: { token: "token" } } },
                { id: "s2", action: "get", selectorOrEndpoint: "/api/items", input: null, guards: { expectStatusCode: 200 } }
            ]
        }));
        const result = await runTraceFile({ tracePath });
        expect(result.verdict.status).toBe("pass");
        server.stop();
    });
});
