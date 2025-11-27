import fs from "fs/promises";
import path from "path";

export async function generateReport(runId: string) {
    const runsDir = path.resolve(process.cwd(), "runs");
    const runDir = path.join(runsDir, runId);

    try {
        await fs.access(runDir);
    } catch {
        throw new Error(`Run ID ${runId} not found`);
    }

    const runMeta = JSON.parse(await fs.readFile(path.join(runDir, "run.meta.json"), "utf-8"));
    const verdict = JSON.parse(await fs.readFile(path.join(runDir, "verdict.json"), "utf-8"));
    const stepsContent = await fs.readFile(path.join(runDir, "steps.jsonl"), "utf-8");
    const steps = stepsContent.trim().split("\n").map(line => JSON.parse(line));

    const summary = {
        runId,
        timestamp: runMeta.timestamp,
        app: runMeta.options.app,
        trace: runMeta.trace.title,
        verdict: verdict.status,
        reasons: verdict.reasons,
        totalSteps: steps.length,
        durationMs: steps.reduce((acc: number, s: any) => acc + s.durationMs, 0),
        failedSteps: steps.filter((s: any) => !s.result.ok).map((s: any) => ({
            stepId: s.stepId,
            kind: s.kind,
            error: s.error,
            checkpoint: s.checkpoint
        })),
        artifacts: {
            logs: "logs.jsonl",
            steps: "steps.jsonl",
            trace: "trace.used.json"
        }
    };

    await fs.writeFile(path.join(runDir, "summary.json"), JSON.stringify(summary, null, 2));

    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Run Report: ${runId}</title>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .pass { color: green; }
        .fail { color: red; }
        .step { border: 1px solid #ccc; margin: 10px 0; padding: 10px; border-radius: 4px; }
        .error { background: #fee; color: #c00; padding: 10px; }
    </style>
</head>
<body>
    <h1>Run Report: ${runId}</h1>
    <div>
        <strong>App:</strong> ${summary.app}<br>
        <strong>Trace:</strong> ${summary.trace}<br>
        <strong>Verdict:</strong> <span class="${summary.verdict}">${summary.verdict.toUpperCase()}</span><br>
        <strong>Duration:</strong> ${summary.durationMs}ms
    </div>

    ${summary.reasons.length > 0 ? `<div class="error"><h3>Failures:</h3><ul>${summary.reasons.map((r: string) => `<li>${r}</li>`).join("")}</ul></div>` : ""}

    <h2>Steps</h2>
    ${steps.map((s: any) => `
        <div class="step">
            <strong>${s.stepId}</strong> ${s.kind} <span class="${s.result.ok ? "pass" : "fail"}">${s.result.ok ? "OK" : "FAIL"}</span>
            ${!s.result.ok ? `<pre>${s.error || JSON.stringify(s.checkpoint, null, 2)}</pre>` : ""}
            ${s.artifacts.screenshot ? `<br><a href="${s.artifacts.screenshot}">Screenshot</a>` : ""}
            ${s.artifacts.apiExchange ? `<br><a href="${s.artifacts.apiExchange}">API Exchange</a>` : ""}
        </div>
    `).join("")}
</body>
</html>
    `;

    await fs.writeFile(path.join(runDir, "summary.html"), html);
    console.log(`Report generated at ${path.join(runDir, "summary.html")}`);
}
