import { ArtifactWriter, RunVerdict } from "./utils/artifacts.js";
import { TraceExecutor } from "./execution/trace-executor.js";
import { loadTrace } from "./utils/trace.js";
import { TraceV1 } from "./types/trace.js";

export interface RunResult {
    verdict: RunVerdict;
    runId: string;
    artifactsPath: string;
    trace: TraceV1;
}

export interface RunnerOptions {
    tracePath: string;
    headless?: boolean;
}

export async function runTraceFile(options: RunnerOptions): Promise<RunResult> {
    const trace = await loadTrace(options.tracePath);
    const artifacts = new ArtifactWriter({ trace, mode: "replay" });
    await artifacts.init();

    const executor = new TraceExecutor({
        trace,
        headless: options.headless ?? trace.policies.headless,
        artifacts
    });

    const reasons: string[] = [];
    let failedStepId: string | undefined;

    await executor.setup();
    try {
        for (const step of trace.steps) {
            const record = await executor.runStep(step);
            await artifacts.recordStep(record);
            if (record.status === "fail") {
                failedStepId = step.id;
                reasons.push(record.error || `Step ${step.id} failed`);
                break;
            }
        }
    } finally {
        await executor.teardown();
    }

    const verdict: RunVerdict = {
        status: reasons.length > 0 ? "fail" : "pass",
        reasons,
        failedStepId
    };
    await artifacts.finalize(verdict);

    return {
        verdict,
        runId: artifacts.runId,
        artifactsPath: artifacts.runDir,
        trace
    };
}
