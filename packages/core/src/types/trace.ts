export type TraceAction =
    | "navigate"
    | "click"
    | "input"
    | "select"
    | "press"
    | "waitForText"
    | "waitForSelector"
    | "extractText"
    | "get"
    | "post"
    | "put"
    | "patch"
    | "delete";

export interface StepGuards {
    expectUrlIncludes?: string;
    expectTextIncludes?: string | string[];
    expectStatusCode?: number;
    allowRetry?: boolean;
    timeoutMs?: number;
}

export interface TraceStep {
    id: string;
    action: TraceAction;
    selectorOrEndpoint: string;
    input?: string | Record<string, any> | null;
    expected?: Record<string, any>;
    guards?: StepGuards;
}

export interface TracePolicies {
    headless: boolean;
    noMocks: boolean;
    maxSteps: number;
    timeoutsMs: number;
}

export interface TraceGenerator {
    mode: string;
    llmProvider: string;
    llmModel: string;
}

export interface TraceV1 {
    version: 1;
    type: "ui" | "api";
    testName: string;
    description: string;
    app: string;
    baseUrl: string;
    apiBaseUrl: string;
    createdAt: string;
    generator: TraceGenerator;
    inputs: {
        env: Record<string, string>;
    };
    policies: TracePolicies;
    steps: TraceStep[];
}
