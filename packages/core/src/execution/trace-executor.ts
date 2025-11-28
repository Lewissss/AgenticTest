import { TraceStep, TraceV1 } from "../types/trace.js";
import { UiDriver } from "../drivers/ui.js";
import { ApiDriver, ApiResponse } from "../drivers/api.js";
import { ArtifactWriter, StepRecord } from "../utils/artifacts.js";
import { buildInterpolationContext, InterpolationContext, interpolateString, interpolateValue } from "../utils/interpolation.js";
import { OpenApiValidator } from "../utils/openapi.js";
import { isMatch, get } from "lodash";
import path from "path";

const UI_ACTIONS = new Set<TraceStep["action"]>([
    "navigate",
    "click",
    "input",
    "select",
    "press",
    "waitForText",
    "waitForSelector",
    "extractText"
]);

export interface TraceExecutorOptions {
    trace: TraceV1;
    headless: boolean;
    artifacts: ArtifactWriter;
}

export class TraceExecutor {
    private uiDriver: UiDriver | null = null;
    private apiDriver: ApiDriver;
    private context: InterpolationContext;
    private lastApiResponse: ApiResponse | null = null;
    private openApi: OpenApiValidator;

    constructor(private options: TraceExecutorOptions) {
        this.apiDriver = new ApiDriver(options.trace.apiBaseUrl);
        this.context = buildInterpolationContext({
            baseUrl: options.trace.baseUrl,
            apiBaseUrl: options.trace.apiBaseUrl,
            traceEnv: options.trace.inputs?.env
        });
        this.openApi = new OpenApiValidator();
    }

    async setup() {
        if (this.options.trace.type === "ui") {
            this.uiDriver = new UiDriver(this.options.headless);
            await this.uiDriver.start(this.options.trace.baseUrl);
        }
        try {
            const specPath = path.resolve(process.cwd(), `apps/${this.options.trace.app}/openapi.json`);
            await this.openApi.loadSpec(specPath);
        } catch {
            // Optional
        }
    }

    async teardown() {
        await this.uiDriver?.stop();
    }

    getPage() {
        return this.uiDriver?.getPage() || null;
    }

    async getCurrentUrl() {
        if (!this.uiDriver) return "";
        return this.uiDriver.currentUrl();
    }

    getLastApiResponse() {
        return this.lastApiResponse;
    }

    async runStep(step: TraceStep): Promise<StepRecord> {
        const artifacts: Record<string, string> = {};
        const start = Date.now();
        const startedAt = new Date().toISOString();

        const resolvedInput = step.input !== undefined ? interpolateValue(step.input, this.context) : undefined;
        const resolvedExpected = step.expected ? interpolateValue(step.expected, this.context) : undefined;
        const resolvedGuards = step.guards ? interpolateValue(step.guards, this.context) : undefined;
        const target = interpolateString(step.selectorOrEndpoint, this.context);

        let error: Error | null = null;
        const attempts = resolvedGuards?.allowRetry ? 2 : 1;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                await this.executeAction(step.action, target, resolvedInput, resolvedExpected, resolvedGuards);
                error = null;
                break;
            } catch (err) {
                error = err instanceof Error ? err : new Error(String(err));
                if (attempt < attempts) {
                    await this.options.artifacts.log(`Retrying step ${step.id} due to ${error.message}`, "warn");
                } else {
                    break;
                }
            }
        }

        if (error && this.uiDriver?.getPage()) {
            artifacts.screenshot = await this.options.artifacts.saveUiScreenshot(step.id, this.uiDriver.getPage()!);
        }

        if (this.lastApiResponse && !UI_ACTIONS.has(step.action)) {
            artifacts.api = await this.options.artifacts.saveApiExchange(step.id, this.lastApiResponse);
        }

        const endedAt = new Date().toISOString();
        const durationMs = Date.now() - start;

        return {
            stepId: step.id,
            action: step.action,
            status: error ? "fail" : "pass",
            startedAt,
            endedAt,
            durationMs,
            error: error?.message,
            selectorOrEndpoint: target,
            input: resolvedInput,
            expected: resolvedExpected,
            guards: resolvedGuards,
            artifacts
        };
    }

    private async executeAction(
        action: TraceStep["action"],
        target: string,
        input: any,
        expected: any,
        guards: TraceStep["guards"] | undefined
    ) {
        if (UI_ACTIONS.has(action)) {
            await this.ensureUi();
        }

        switch (action) {
            case "navigate":
                await this.uiDriver!.goto(target);
                break;
            case "click":
                await this.uiDriver!.click(target);
                break;
            case "input":
                await this.uiDriver!.type(target, String(input ?? ""));
                break;
            case "select":
                await this.uiDriver!.select(target, String(input ?? ""));
                break;
            case "press":
                await this.uiDriver!.press(target, String(input ?? ""));
                break;
            case "waitForText":
                await this.uiDriver!.waitForText(target, guards?.timeoutMs);
                break;
            case "waitForSelector":
                await this.uiDriver!.waitForSelector(target, guards?.timeoutMs);
                break;
            case "extractText":
                const text = await this.uiDriver!.extractText(target);
                if (typeof input === "string" && input.startsWith("save:")) {
                    const key = input.split(":")[1];
                    this.context.state[key] = text;
                }
                break;
            default:
                await this.handleApiAction(action, target, input);
                break;
        }

        await this.applyGuards(guards);
        await this.applyExpected(action, expected);
    }

    private async handleApiAction(action: string, endpoint: string, input: any) {
        const method = action.toUpperCase();
        let body = input;
        let headers;
        let query;
        if (input && typeof input === "object" && (input.body !== undefined || input.headers || input.query)) {
            body = input.body;
            headers = input.headers;
            query = input.query;
        }
        this.lastApiResponse = await this.apiDriver.request({
            method,
            path: endpoint,
            body,
            headers,
            query
        });

        const validation = this.openApi.validateResponse(method, endpoint, this.lastApiResponse.status, this.lastApiResponse.body);
        if (!validation.valid) {
            throw new Error(`OpenAPI validation failed for ${action} ${endpoint}`);
        }
    }

    private async applyGuards(guards?: TraceStep["guards"]) {
        if (!guards) return;
        if (guards.expectUrlIncludes) {
            const url = this.uiDriver ? await this.uiDriver.currentUrl() : "";
            if (!url.includes(guards.expectUrlIncludes)) {
                throw new Error(`Guard failed: URL does not include ${guards.expectUrlIncludes}`);
            }
        }
        if (guards.expectTextIncludes) {
            const values = Array.isArray(guards.expectTextIncludes)
                ? guards.expectTextIncludes
                : [guards.expectTextIncludes];
            const body = await this.uiDriver?.getPage()?.textContent("body");
            for (const value of values) {
                if (!body || !body.includes(value)) {
                    throw new Error(`Guard failed: page text missing "${value}"`);
                }
            }
        }
        if (guards.expectStatusCode !== undefined) {
            if (!this.lastApiResponse) {
                throw new Error("Guard failed: no API response to check status code");
            }
            if (this.lastApiResponse.status !== guards.expectStatusCode) {
                throw new Error(`Guard failed: expected status ${guards.expectStatusCode}, received ${this.lastApiResponse.status}`);
            }
        }
    }

    private async applyExpected(action: string, expected: any) {
        if (!expected || Object.keys(expected).length === 0) {
            return;
        }

        if (!UI_ACTIONS.has(action)) {
            if (!this.lastApiResponse) {
                throw new Error("No API response to validate expected payload");
            }
            const { saveState, ...subset } = expected;
            if (saveState && typeof saveState === "object") {
                for (const [key, pathExpr] of Object.entries(saveState)) {
                    const value = get(this.lastApiResponse.body, pathExpr as string);
                    if (value !== undefined) {
                        this.context.state[key] = value;
                    }
                }
            }
            if (Object.keys(subset).length > 0 && !isMatch(this.lastApiResponse.body, subset)) {
                throw new Error("API response body does not match expected subset");
            }
            return;
        }

        const page = this.uiDriver?.getPage();
        if (!page) return;
        const bodyText = await page.textContent("body");
        if (expected.textIncludes) {
            const values = Array.isArray(expected.textIncludes) ? expected.textIncludes : [expected.textIncludes];
            for (const value of values) {
                if (!bodyText || !bodyText.includes(value)) {
                    throw new Error(`Expected text "${value}" not found`);
                }
            }
        }
        if (expected.selectorText) {
            const locator = page.locator(expected.selectorText.selector);
            const text = (await locator.textContent())?.trim() || "";
            if (expected.selectorText.equals && text !== expected.selectorText.equals) {
                throw new Error(`Expected selector text to equal "${expected.selectorText.equals}"`);
            }
            if (expected.selectorText.includes && !text.includes(expected.selectorText.includes)) {
                throw new Error(`Expected selector text to include "${expected.selectorText.includes}"`);
            }
        }
    }

    private async ensureUi() {
        if (!this.uiDriver) {
            this.uiDriver = new UiDriver(this.options.headless);
            await this.uiDriver.start(this.options.trace.baseUrl);
        }
    }
}
