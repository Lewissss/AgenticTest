import { TraceV1, TraceStep } from "./types/trace.js";
import { ArtifactWriter, RunVerdict } from "./utils/artifacts.js";
import { TraceExecutor } from "./execution/trace-executor.js";

export class CompiledRunner {
    private artifacts: ArtifactWriter;
    private executor: TraceExecutor;
    private failedReason: string | null = null;
    private failedStep: string | undefined;

    constructor(private trace: TraceV1) {
        this.artifacts = new ArtifactWriter({ trace, mode: "compiled" });
        this.executor = new TraceExecutor({
            trace,
            headless: trace.policies.headless,
            artifacts: this.artifacts
        });
    }

    async setup() {
        await this.artifacts.init();
        await this.executor.setup();
    }

    async executeStep(step: TraceStep) {
        const record = await this.executor.runStep(step);
        await this.artifacts.recordStep(record);
        if (record.status === "fail") {
            this.failedStep = step.id;
            this.failedReason = record.error || `Step ${step.id} failed`;
            throw new Error(this.failedReason);
        }
    }

    async teardown() {
        await this.executor.teardown();
        const verdict: RunVerdict = this.failedReason
            ? { status: "fail", reasons: [this.failedReason], failedStepId: this.failedStep }
            : { status: "pass", reasons: [] };
        await this.artifacts.finalize(verdict);
    }
}
