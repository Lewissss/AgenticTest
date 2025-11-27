import fs from "fs/promises";
import path from "path";
import { Page } from "playwright";
import { TraceV1 } from "../types/trace.js";
import { ApiResponse } from "../drivers/api.js";
import { redact, redactHeaders } from "./redaction.js";

export type RunMode = "replay" | "compiled" | "explore";

export interface RunVerdict {
    status: "pass" | "fail";
    reasons: string[];
    failedStepId?: string;
}

export interface StepRecord {
    stepId: string;
    action: string;
    status: "pass" | "fail";
    startedAt: string;
    endedAt: string;
    durationMs: number;
    error?: string;
    selectorOrEndpoint: string;
    input?: any;
    expected?: any;
    guards?: any;
    artifacts?: Record<string, string>;
}

export interface ArtifactWriterOptions {
    trace: TraceV1;
    mode: RunMode;
    runId?: string;
}

export class ArtifactWriter {
    public readonly runId: string;
    public readonly runDir: string;
    private stepsFile: string;
    private logsFile: string;
    private verdictFile: string;
    private runFile: string;
    private secrets: string[];
    private startedAt: string;

    constructor(private options: ArtifactWriterOptions) {
        this.runId = options.runId || `${options.mode}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        this.runDir = path.resolve(process.cwd(), "runs", this.runId);
        this.stepsFile = path.join(this.runDir, "steps.jsonl");
        this.logsFile = path.join(this.runDir, "logs.jsonl");
        this.verdictFile = path.join(this.runDir, "verdict.json");
        this.runFile = path.join(this.runDir, "run.json");
        this.secrets = Object.values(options.trace.inputs?.env || {});
        this.startedAt = new Date().toISOString();
    }

    async init() {
        await fs.mkdir(path.join(this.runDir, "ui"), { recursive: true });
        await fs.mkdir(path.join(this.runDir, "api"), { recursive: true });
        await fs.writeFile(this.stepsFile, "");
        await fs.writeFile(this.logsFile, "");
        await fs.writeFile(this.runFile, JSON.stringify({
            runId: this.runId,
            mode: this.options.mode,
            trace: {
                app: this.options.trace.app,
                testName: this.options.trace.testName,
                type: this.options.trace.type
            },
            startedAt: this.startedAt,
            baseUrl: this.options.trace.baseUrl,
            apiBaseUrl: this.options.trace.apiBaseUrl
        }, null, 2));
    }

    async recordStep(record: StepRecord) {
        await fs.appendFile(this.stepsFile, JSON.stringify(record) + "\n");
    }

    async log(message: string, level: "info" | "error" | "debug" | "warn" = "info", meta: Record<string, any> = {}) {
        await fs.appendFile(this.logsFile, JSON.stringify({
            timestamp: new Date().toISOString(),
            level,
            message,
            ...meta
        }) + "\n");
    }

    async saveUiScreenshot(stepId: string, page: Page): Promise<string> {
        const filename = `ui/${stepId}-${Date.now()}.png`;
        await page.screenshot({ path: path.join(this.runDir, filename) });
        return filename;
    }

    async saveApiExchange(stepId: string, response: ApiResponse): Promise<string> {
        const filename = `api/${stepId}-${Date.now()}.json`;
        const payload = {
            request: {
                method: response.request.method,
                path: response.request.path,
                headers: redactHeaders(response.request.headers),
                body: redact(response.request.body, this.secrets)
            },
            response: {
                status: response.status,
                headers: redactHeaders(response.headers),
                body: redact(response.body, this.secrets),
                durationMs: response.durationMs,
                url: response.url
            }
        };
        await fs.writeFile(path.join(this.runDir, filename), JSON.stringify(payload, null, 2));
        return filename;
    }

    async finalize(verdict: RunVerdict) {
        const finishedAt = new Date().toISOString();
        await fs.writeFile(this.verdictFile, JSON.stringify(verdict, null, 2));
        await fs.writeFile(this.runFile, JSON.stringify({
            runId: this.runId,
            mode: this.options.mode,
            trace: {
                app: this.options.trace.app,
                testName: this.options.trace.testName,
                type: this.options.trace.type
            },
            startedAt: this.startedAt,
            finishedAt,
            verdict,
            artifacts: {
                steps: path.basename(this.stepsFile),
                logs: path.basename(this.logsFile)
            }
        }, null, 2));
    }
}
