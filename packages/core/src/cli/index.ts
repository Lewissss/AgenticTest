#!/usr/bin/env bun
import { Command } from "commander";
import fs from "fs/promises";
import path from "path";
import { runTraceFile } from "../runner.js";
import { compileTrace } from "../compiler.js";
import { Explorer } from "../explorer.js";

const program = new Command();
program.name("atf").description("Agentic Test Framework CLI").version("1.0.0");

program
    .command("list")
    .argument("<entity>", "apps|traces")
    .option("--app <app>", "App name when listing traces")
    .action(async (entity, options) => {
        if (entity === "apps") {
            const appsDir = path.resolve(process.cwd(), "apps");
            const entries = await fs.readdir(appsDir, { withFileTypes: true });
            entries.filter((entry) => entry.isDirectory()).forEach((entry) => console.log(entry.name));
            return;
        }
        if (entity === "traces") {
            if (!options.app) throw new Error("--app is required when listing traces");
            const tracesDir = path.resolve(process.cwd(), "traces", options.app);
            const traces = await fs.readdir(tracesDir).catch(() => []);
            traces.filter((file) => file.endsWith(".trace.json")).forEach((file) => console.log(file));
            return;
        }
        throw new Error(`Unknown entity ${entity}`);
    });

program
    .command("replay")
    .requiredOption("--trace <path>", "Path to trace file")
    .option("--headed", "Run Playwright in headed mode")
    .action(async (options) => {
        try {
            const result = await runTraceFile({
                tracePath: path.resolve(process.cwd(), options.trace),
                headless: !options.headed
            });
            console.log(`Run ${result.runId} finished with status ${result.verdict.status}`);
            console.log(`Artifacts: ${result.artifactsPath}`);
            process.exit(result.verdict.status === "pass" ? 0 : 1);
        } catch (err: any) {
            console.error("Replay failed", err.message);
            process.exit(2);
        }
    });

program
    .command("compile")
    .option("--trace <path>", "Compile a single trace")
    .option("--app <app>", "App name")
    .option("--all", "Compile every trace for the app")
    .action(async (options) => {
        if (options.trace) {
            const out = await compileTrace(options.app, path.resolve(process.cwd(), options.trace));
            console.log(`Compiled to ${out}`);
            return;
        }
        if (options.all && options.app) {
            const dir = path.resolve(process.cwd(), "traces", options.app);
            const entries = await fs.readdir(dir).catch(() => []);
            for (const file of entries) {
                if (file.endsWith(".trace.json")) {
                    const out = await compileTrace(options.app, path.join(dir, file));
                    console.log(`Compiled ${file} -> ${out}`);
                }
            }
            return;
        }
        console.error("Specify --trace or --app and --all");
        process.exit(1);
    });

function collectEnv(value: string, previous: Record<string, string>) {
    const [key, ...rest] = value.split("=");
    return { ...previous, [key]: rest.join("=") };
}

program
    .command("explore")
    .requiredOption("--app <app>")
    .requiredOption("--testName <name>")
    .requiredOption("--goal <goal>")
    .requiredOption("--type <type>", "ui|api")
    .option("--llm.provider <provider>", "ollama|openaiCompat", "ollama")
    .option("--llm.baseUrl <url>")
    .option("--llm.model <model>", "llama3.2")
    .option("--llm.apiKey <key>")
    .option("--llm.timeoutMs <ms>", "60000")
    .option("--env <key=value>", "Trace env variable", collectEnv, {})
    .action(async (options) => {
        try {
            const inheritedEnv: Record<string, string> = {};
            ["DEMO_USERNAME", "DEMO_PASSWORD"].forEach((key) => {
                if (process.env[key]) inheritedEnv[key] = process.env[key]!;
            });
            const explorer = new Explorer({
                app: options.app,
                testName: options.testName,
                goal: options.goal,
                type: options.type,
                baseUrl: process.env.UI_BASE_URL || "http://localhost:3010",
                apiBaseUrl: process.env.API_BASE_URL || "http://localhost:3020",
                env: { ...inheritedEnv, ...options.env },
                llm: {
                    provider: options["llm.provider"],
                    baseUrl: options["llm.baseUrl"],
                    model: options["llm.model"],
                    apiKey: options["llm.apiKey"],
                    timeoutMs: Number(options["llm.timeoutMs"]) || 60000
                }
            });
            const result = await explorer.run();
            console.log(`Trace saved to ${result.tracePath}`);
            console.log(`Explore run artifacts: runs/${result.runId}`);
        } catch (err: any) {
            console.error("Explore failed", err.message);
            process.exit(2);
        }
    });

program
    .command("tui")
    .action(async () => {
        const { startTui } = await import("@atf/tui/src/index.tsx");
        await startTui();
    });

program.parseAsync();
