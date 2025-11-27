import fs from "fs/promises";
import path from "path";
import { TraceV1, TraceStep, TraceAction } from "./types/trace.js";
import { ArtifactWriter, RunVerdict } from "./utils/artifacts.js";
import { TraceExecutor } from "./execution/trace-executor.js";
import { compileTrace } from "./compiler.js";
import { LlmClient, LlmConfig } from "./llm/index.js";

const ACTIONS: TraceAction[] = [
    "navigate",
    "click",
    "input",
    "select",
    "press",
    "waitForText",
    "waitForSelector",
    "extractText",
    "get",
    "post",
    "put",
    "patch",
    "delete"
];

export interface ExplorerOptions {
    app: string;
    testName: string;
    type: "ui" | "api";
    goal: string;
    baseUrl: string;
    apiBaseUrl: string;
    env: Record<string, string>;
    llm: LlmConfig;
    maxSteps?: number;
}

export class Explorer {
    private trace: TraceV1;
    private artifacts: ArtifactWriter;
    private executor: TraceExecutor;
    private llm: LlmClient;
    private reasons: string[] = [];

    constructor(private options: ExplorerOptions) {
        this.trace = {
            version: 1,
            type: options.type,
            testName: options.testName,
            description: options.goal,
            app: options.app,
            baseUrl: options.baseUrl,
            apiBaseUrl: options.apiBaseUrl,
            createdAt: new Date().toISOString(),
            generator: {
                mode: "explore",
                llmProvider: options.llm.provider,
                llmModel: options.llm.model
            },
            inputs: { env: options.env },
            policies: {
                headless: true,
                noMocks: true,
                maxSteps: options.maxSteps || 15,
                timeoutsMs: 60000
            },
            steps: []
        };

        this.artifacts = new ArtifactWriter({ trace: this.trace, mode: "explore" });
        this.executor = new TraceExecutor({
            trace: this.trace,
            headless: true,
            artifacts: this.artifacts
        });
        this.llm = new LlmClient(options.llm);
    }

    async run() {
        await this.artifacts.init();
        await this.executor.setup();

        try {
            for (let index = 0; index < this.trace.policies.maxSteps; index++) {
                const observation = await this.observe();
                const step = await this.proposeStep(index, observation);
                if (!step) break;

                const record = await this.executor.runStep(step);
                await this.artifacts.recordStep(record);
                this.trace.steps.push(step);

                if (record.status === "fail") {
                    this.reasons.push(record.error || `Step ${step.id} failed`);
                    break;
                }
            }
        } finally {
            await this.executor.teardown();
        }

        const verdict: RunVerdict = {
            status: this.reasons.length ? "fail" : "pass",
            reasons: this.reasons,
            failedStepId: this.reasons.length ? this.trace.steps.at(-1)?.id : undefined
        };
        await this.artifacts.finalize(verdict);

        const tracePath = await this.persistTrace();
        await compileTrace(this.trace.app, tracePath);
        return { tracePath, runId: this.artifacts.runId };
    }

    private async persistTrace() {
        const dir = path.resolve(process.cwd(), "traces", this.trace.app);
        await fs.mkdir(dir, { recursive: true });
        const filePath = path.join(dir, `${this.trace.testName}.trace.json`);
        await fs.writeFile(filePath, JSON.stringify(this.trace, null, 2));
        return filePath;
    }

    private async observe() {
        if (this.trace.type === "ui") {
            const page = this.executor.getPage();
            if (!page) return {};
            const elements = await page.evaluate(() => {
                const nodes = Array.from(document.querySelectorAll("[data-testid]"));
                return nodes.slice(0, 15).map((node) => ({
                    testId: node.getAttribute("data-testid"),
                    text: (node as HTMLElement).innerText?.trim().slice(0, 120)
                }));
            });
            return {
                url: page.url(),
                title: await page.title(),
                elements
            };
        }
        return {
            lastResponse: this.executor.getLastApiResponse()
        };
    }

    private async proposeStep(index: number, observation: any): Promise<TraceStep | null> {
        const systemPrompt = `You operate the Agentic Test Framework. Output only JSON objects defining the next step. Allowed actions: ${ACTIONS.join(", ")}. Use data-testid selectors when possible. Return {"action":"stop"} when the goal is met.`;
        const recentSteps = this.trace.steps.slice(-3).map((step) => ({
            action: step.action,
            selectorOrEndpoint: step.selectorOrEndpoint
        }));
        const userPrompt = JSON.stringify({
            goal: this.trace.description,
            type: this.trace.type,
            observation,
            recentSteps
        });

        let lastError = "";
        for (let attempt = 0; attempt < 3; attempt++) {
            const raw = await this.llm.generate(systemPrompt, lastError ? `${userPrompt}\nPrevious error: ${lastError}` : userPrompt);
            try {
                const parsed = JSON.parse(raw);
                if (parsed.action === "stop") {
                    return null;
                }
                return this.normalizeStep(parsed, index);
            } catch (err: any) {
                lastError = err.message;
                continue;
            }
        }
        throw new Error("LLM could not produce a valid step");
    }

    private normalizeStep(candidate: any, index: number): TraceStep {
        if (!candidate || typeof candidate !== "object") {
            throw new Error("LLM produced non-object step");
        }
        const action = candidate.action as TraceAction;
        if (!ACTIONS.includes(action)) {
            throw new Error(`Invalid action ${candidate.action}`);
        }
        if (typeof candidate.selectorOrEndpoint !== "string" || !candidate.selectorOrEndpoint) {
            throw new Error("selectorOrEndpoint is required");
        }
        const guards = candidate.guards && typeof candidate.guards === "object" ? this.filterGuards(candidate.guards) : undefined;
        const expected = candidate.expected && typeof candidate.expected === "object" ? candidate.expected : undefined;

        return {
            id: `s${index + 1}`,
            action,
            selectorOrEndpoint: candidate.selectorOrEndpoint,
            input: candidate.input ?? null,
            expected,
            guards
        };
    }

    private filterGuards(raw: Record<string, any>) {
        const guards: Record<string, any> = {};
        if (typeof raw.expectUrlIncludes === "string") guards.expectUrlIncludes = raw.expectUrlIncludes;
        if (raw.expectTextIncludes) guards.expectTextIncludes = raw.expectTextIncludes;
        if (typeof raw.expectStatusCode === "number") guards.expectStatusCode = raw.expectStatusCode;
        if (typeof raw.allowRetry === "boolean") guards.allowRetry = raw.allowRetry;
        if (typeof raw.timeoutMs === "number") guards.timeoutMs = raw.timeoutMs;
        return guards;
    }
}
