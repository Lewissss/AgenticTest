import React, { useEffect, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import SelectInput from "ink-select-input";
import Spinner from "ink-spinner";
import fs from "fs/promises";
import path from "path";
import { runTraceFile, compileTrace, loadTrace } from "@atf/core";
import type { TraceV1, TraceStep } from "@atf/core";

const ACTION_MENU = [
    { label: "Replay Trace", value: "replay" },
    { label: "Compile Trace", value: "compile" },
    { label: "Inspect Trace", value: "inspect" },
    { label: "Back", value: "back" }
];

type Screen = "apps" | "traces" | "trace-actions" | "status" | "runs" | "run-detail" | "trace-detail";

interface RunDetail {
    runId: string;
    verdict: string;
    reasons: string[];
    failedStepId?: string;
    artifacts: Record<string, string>;
}

const UI_ACTIONS = new Set(["navigate", "click", "input", "select", "press", "waitForText", "waitForSelector", "extractText"]);

const loadDirectory = async (dir: string) => {
    try {
        return await fs.readdir(dir);
    } catch {
        return [];
    }
};

function flagFragileSelectors(steps: TraceStep[]) {
    return steps
        .filter(step => UI_ACTIONS.has(step.action) && step.selectorOrEndpoint && (step.selectorOrEndpoint.length > 80 || step.selectorOrEndpoint.includes("//") || !step.selectorOrEndpoint.includes("data-testid")))
        .map(step => step.id);
}

const App = () => {
    const { exit } = useApp();
    const [screen, setScreen] = useState<Screen>("apps");
    const [apps, setApps] = useState<string[]>([]);
    const [selectedApp, setSelectedApp] = useState<string | null>(null);
    const [traces, setTraces] = useState<string[]>([]);
    const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>("");
    const [runs, setRuns] = useState<string[]>([]);
    const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
    const [traceDetail, setTraceDetail] = useState<{ trace: TraceV1; fragile: string[] } | null>(null);
    const [message, setMessage] = useState<string>("");

    useEffect(() => {
        (async () => {
            const appsDir = path.resolve(process.cwd(), "apps");
            const entries = await fs.readdir(appsDir, { withFileTypes: true });
            setApps(entries.filter(entry => entry.isDirectory()).map(entry => entry.name));
        })();
    }, []);

    useEffect(() => {
        if (selectedApp) {
            (async () => {
                const list = await loadDirectory(path.resolve(process.cwd(), "traces", selectedApp));
                setTraces(list.filter(file => file.endsWith(".trace.json")));
            })();
        }
    }, [selectedApp]);

    useEffect(() => {
        if (screen === "runs") {
            (async () => {
                const list = await loadDirectory(path.resolve(process.cwd(), "runs"));
                list.sort().reverse();
                setRuns(list);
            })();
        }
    }, [screen]);

    useInput((input, key) => {
        if (key.escape) {
            if (screen === "apps") exit();
            else if (screen === "traces") {
                setSelectedApp(null);
                setScreen("apps");
            } else if (screen === "trace-actions") {
                setScreen("traces");
            } else if (screen === "runs" || screen === "run-detail") {
                setScreen("traces");
            } else if (screen === "trace-detail") {
                setScreen("trace-actions");
            } else if (screen === "status") {
                setScreen("traces");
            }
        }
        if (input === "q") exit();
    });

    const runReplay = async () => {
        if (!selectedApp || !selectedTrace) return;
        setScreen("status");
        setStatusMessage(`Running replay for ${selectedTrace}...`);
        try {
            const result = await runTraceFile({
                tracePath: path.resolve(process.cwd(), "traces", selectedApp, selectedTrace),
                headless: true
            });
            setMessage(`Replay ${result.runId} -> ${result.verdict.status}`);
        } catch (err: any) {
            setMessage(`Replay failed: ${err.message}`);
        }
        setScreen("traces");
    };

    const runCompile = async () => {
        if (!selectedApp || !selectedTrace) return;
        setScreen("status");
        setStatusMessage(`Compiling ${selectedTrace}...`);
        try {
            const out = await compileTrace(selectedApp, path.resolve(process.cwd(), "traces", selectedApp, selectedTrace));
            setMessage(`Compiled trace -> ${out}`);
        } catch (err: any) {
            setMessage(`Compile failed: ${err.message}`);
        }
        setScreen("traces");
    };

    const compileAll = async () => {
        if (!selectedApp) return;
        setScreen("status");
        setStatusMessage("Compiling all traces...");
        try {
            const dir = path.resolve(process.cwd(), "traces", selectedApp);
            for (const file of traces) {
                await compileTrace(selectedApp, path.join(dir, file));
            }
            setMessage("All traces compiled");
        } catch (err: any) {
            setMessage(`Compile failed: ${err.message}`);
        }
        setScreen("traces");
    };

    const inspectTrace = async () => {
        if (!selectedApp || !selectedTrace) return;
        setScreen("status");
        setStatusMessage("Loading trace...");
        try {
            const trace = await loadTrace(path.resolve(process.cwd(), "traces", selectedApp, selectedTrace));
            setTraceDetail({ trace, fragile: flagFragileSelectors(trace.steps) });
            setScreen("trace-detail");
        } catch (err: any) {
            setMessage(`Failed to read trace: ${err.message}`);
            setScreen("traces");
        }
    };

    const inspectRun = async (runId: string) => {
        try {
            const verdict = JSON.parse(await fs.readFile(path.resolve(process.cwd(), "runs", runId, "verdict.json"), "utf-8"));
            const runJson = JSON.parse(await fs.readFile(path.resolve(process.cwd(), "runs", runId, "run.json"), "utf-8"));
            const artifacts = runJson.artifacts || {};
            setRunDetail({
                runId,
                verdict: verdict.status,
                reasons: verdict.reasons || [],
                failedStepId: verdict.failedStepId,
                artifacts
            });
            setScreen("run-detail");
        } catch (err: any) {
            setMessage(`Failed to load run: ${err.message}`);
            setScreen("traces");
        }
    };

    if (screen === "apps") {
        return (
            <Box flexDirection="column">
                <Text color="cyan" bold>OpenTUI Operator</Text>
                <Text>Select an app to operate:</Text>
                <SelectInput
                    items={apps.map(app => ({ label: app, value: app }))}
                    onSelect={item => { setSelectedApp(item.value); setScreen("traces"); setMessage(""); }}
                />
                <Text dimColor>Press q to exit.</Text>
                {message && <Text color="green">{message}</Text>}
            </Box>
        );
    }

    if (screen === "traces" && selectedApp) {
        const traceItems = traces.map(trace => ({ label: trace, value: trace }));
        return (
            <Box flexDirection="column">
                <Text color="cyan" bold>{selectedApp} :: Traces</Text>
                <SelectInput
                    items={[{ label: "Compile all traces", value: "__compileAll" }, { label: "View run history", value: "__runs" }, ...traceItems]}
                    onSelect={async item => {
                        if (item.value === "__compileAll") await compileAll();
                        else if (item.value === "__runs") setScreen("runs");
                        else {
                            setSelectedTrace(item.value);
                            setScreen("trace-actions");
                        }
                    }}
                />
                {message && <Text color="green">{message}</Text>}
            </Box>
        );
    }

    if (screen === "trace-actions" && selectedTrace) {
        return (
            <Box flexDirection="column">
                <Text color="cyan" bold>{selectedTrace}</Text>
                <SelectInput
                    items={ACTION_MENU}
                    onSelect={async item => {
                        if (item.value === "replay") await runReplay();
                        else if (item.value === "compile") await runCompile();
                        else if (item.value === "inspect") await inspectTrace();
                        else setScreen("traces");
                    }}
                />
            </Box>
        );
    }

    if (screen === "status") {
        return (
            <Box flexDirection="column">
                <Text color="yellow"><Spinner type="dots" /> {statusMessage}</Text>
            </Box>
        );
    }

    if (screen === "runs") {
        return (
            <Box flexDirection="column">
                <Text color="cyan" bold>Run History</Text>
                <SelectInput
                    items={runs.map(run => ({ label: run, value: run }))}
                    onSelect={item => inspectRun(item.value)}
                />
            </Box>
        );
    }

    if (screen === "run-detail" && runDetail) {
        const extraArtifacts = {
            ui: `runs/${runDetail.runId}/ui/`,
            api: `runs/${runDetail.runId}/api/`
        };
        return (
            <Box flexDirection="column">
                <Text color="cyan" bold>Run {runDetail.runId}</Text>
                <Text>Verdict: <Text color={runDetail.verdict === "pass" ? "green" : "red"}>{runDetail.verdict.toUpperCase()}</Text></Text>
                {runDetail.failedStepId && <Text>Failed Step: {runDetail.failedStepId}</Text>}
                {runDetail.reasons.length > 0 && (
                    <Box flexDirection="column">
                        <Text>Reasons:</Text>
                        {runDetail.reasons.map((reason, idx) => (
                            <Text key={idx}>- {reason}</Text>
                        ))}
                    </Box>
                )}
                <Text bold>Artifacts:</Text>
                {Object.entries({ ...runDetail.artifacts, ...extraArtifacts }).map(([key, value]) => {
                    const display = value.startsWith("runs/") ? value : `runs/${runDetail.runId}/${value}`;
                    return <Text key={key}>{key}: {display}</Text>;
                })}
                <Text dimColor>Press Esc to go back.</Text>
            </Box>
        );
    }

    if (screen === "trace-detail" && traceDetail) {
        const rows = traceDetail.trace.steps.map(step => {
            const selector = step.selectorOrEndpoint.length > 50 ? step.selectorOrEndpoint.slice(0, 50) + "..." : step.selectorOrEndpoint;
            const fragile = traceDetail.fragile.includes(step.id) ? "⚠" : "";
            return `${step.id.padEnd(4)} ${step.action.padEnd(14)} ${selector.padEnd(55)} ${fragile}`;
        });
        return (
            <Box flexDirection="column">
                <Text color="cyan" bold>{traceDetail.trace.testName} (fragile selectors {traceDetail.fragile.length})</Text>
                <Text>{"ID  Action         Selector                                               ⚠"}</Text>
                {rows.map(row => <Text key={row}>{row}</Text>)}
                <Text dimColor>Press Esc to go back.</Text>
            </Box>
        );
    }

    return <Text>Loading...</Text>;
};

export default App;
