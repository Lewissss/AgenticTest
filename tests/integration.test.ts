import { beforeAll, afterAll, test, expect } from "bun:test";

const workspace = process.cwd();

const runCommand = async (cmd: string[]) => {
    const proc = Bun.spawn(cmd, { cwd: workspace, stdout: "inherit", stderr: "inherit" });
    return await proc.exited;
};

const waitFor = async (url: string, timeoutMs = 60000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(url);
            if (res.ok) return;
        } catch {
            // retry
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error(`Timed out waiting for ${url}`);
};

beforeAll(async () => {
    await runCommand(["docker", "compose", "up", "-d"]);
    await waitFor("http://localhost:3020/health");
    await waitFor("http://localhost:3010/health");
});

afterAll(async () => {
    await runCommand(["docker", "compose", "down", "-v"]);
});

test("replay login trace", async () => {
    const code = await runCommand(["bun", "run", "atf", "replay", "--trace", "traces/demo-system/login_and_view_dashboard.trace.json"]);
    expect(code).toBe(0);
}, 180000);

test("compiled suite passes", async () => {
    const code = await runCommand(["bun", "test", "compiled-tests/"]);
    expect(code).toBe(0);
}, 180000);
