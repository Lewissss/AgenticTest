console.log("Starting integration workflow...");

const run = async (cmd: string[]) => {
    const proc = Bun.spawn(cmd, { stdout: "inherit", stderr: "inherit" });
    const code = await proc.exited;
    if (code !== 0) {
        throw new Error(`${cmd.join(" ")} exited with code ${code}`);
    }
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

try {
    await run(["docker", "compose", "up", "-d"]);
    await waitFor("http://localhost:3020/health");
    await waitFor("http://localhost:3010/health");

    await run(["bun", "run", "atf", "replay", "--trace", "traces/demo-system/login_and_view_dashboard.trace.json"]);
    await run(["bun", "run", "atf", "compile", "--app", "demo-system", "--all"]);
    await run(["bun", "test", "compiled-tests/"]);

    console.log("Integration workflow completed successfully.");
} catch (err: any) {
    console.error("Integration workflow failed:", err.message);
    process.exit(1);
} finally {
    await run(["docker", "compose", "down", "-v"]);
}
