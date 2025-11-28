import { chromium, Browser, BrowserContext, Page } from "playwright";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const USE_HELPER = Boolean(process.platform === "win32" && process.versions?.bun);

export class UiDriver {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private helper: UiHelperClient | null = null;

    constructor(private headless: boolean = true) { }

    async start(baseUrl: string) {
        if (USE_HELPER) {
            this.helper = new UiHelperClient(this.headless);
            await this.helper.start(baseUrl);
            return;
        }
        this.browser = await chromium.launch({ headless: this.headless });
        this.context = await this.browser.newContext({ baseURL: baseUrl });
        this.page = await this.context.newPage();
    }

    async stop() {
        if (this.helper) {
            await this.helper.stop();
            await this.helper.dispose();
            this.helper = null;
            return;
        }
        await this.page?.close();
        await this.context?.close();
        await this.browser?.close();
    }

    private ensurePage(): Page {
        if (this.helper) {
            const proxy = this.helper.getPageProxy();
            if (!proxy) throw new Error("UI driver not started");
            return proxy;
        }
        if (!this.page) throw new Error("UI driver not started");
        return this.page;
    }

    async goto(url: string) {
        if (this.helper) {
            await this.helper.goto(url);
            return;
        }
        await this.ensurePage().goto(url);
    }

    async click(selector: string) {
        if (this.helper) {
            await this.helper.click(selector);
            return;
        }
        await this.ensurePage().locator(selector).click();
    }

    async type(selector: string, text: string) {
        if (this.helper) {
            await this.helper.type(selector, text);
            return;
        }
        const locator = this.ensurePage().locator(selector);
        await locator.fill("");
        await locator.type(text);
    }

    async select(selector: string, value: string) {
        if (this.helper) {
            await this.helper.select(selector, value);
            return;
        }
        await this.ensurePage().selectOption(selector, value);
    }

    async press(selector: string, key: string) {
        if (this.helper) {
            await this.helper.press(selector, key);
            return;
        }
        await this.ensurePage().locator(selector).press(key);
    }

    async waitForSelector(selector: string, timeout?: number) {
        if (this.helper) {
            await this.helper.waitForSelector(selector, timeout);
            return;
        }
        await this.ensurePage().locator(selector).waitFor({ state: "visible", timeout });
    }

    async waitForText(text: string, timeout = 5000) {
        if (this.helper) {
            await this.helper.waitForText(text, timeout);
            return;
        }
        const page = this.ensurePage();
        await page.waitForFunction(
            (needle) => document.body.innerText.includes(needle),
            text,
            { timeout }
        );
    }

    async extractText(selector: string) {
        if (this.helper) {
            return this.helper.extractText(selector);
        }
        const content = await this.ensurePage().locator(selector).textContent();
        return content?.trim() || "";
    }

    async screenshot(pathname: string) {
        if (this.helper) {
            await this.helper.screenshot(pathname);
            return;
        }
        await this.ensurePage().screenshot({ path: pathname });
    }

    getPage() {
        if (this.helper) {
            return this.helper.getPageProxy();
        }
        return this.page;
    }

    async currentUrl(): Promise<string> {
        if (this.helper) {
            return this.helper.currentUrl();
        }
        return this.page?.url() || "";
    }
}

type PendingRequest = {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
};

class UiHelperClient {
    private child: ChildProcessWithoutNullStreams | null = null;
    private pending = new Map<number, PendingRequest>();
    private seq = 0;
    private proxy: RemotePageProxy;

    constructor(private headless: boolean) {
        this.proxy = new RemotePageProxy(this);
    }

    async start(baseUrl: string) {
        await this.ensureProcess();
        await this.send("start", { baseUrl, headless: this.headless });
    }

    async stop() {
        if (!this.child) return;
        await this.send("stop");
    }

    async dispose() {
        if (!this.child) return;
        this.child.kill();
        this.cleanup(new Error("UI helper terminated"));
    }

    getPageProxy(): Page | null {
        return this.child ? (this.proxy as unknown as Page) : null;
    }

    private cleanup(error?: Error) {
        if (this.child) {
            this.child = null;
        }
        const pending = Array.from(this.pending.values());
        this.pending.clear();
        pending.forEach(({ reject }) => reject(error || new Error("UI helper terminated")));
    }

    private async ensureProcess() {
        if (this.child) return;
        const helperPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "ui-helper.mjs");
        this.child = spawn("node", [helperPath], { stdio: ["pipe", "pipe", "inherit"] });
        const rl = readline.createInterface({ input: this.child.stdout });
        rl.on("line", (line) => {
            if (!line.trim()) return;
            let message;
            try {
                message = JSON.parse(line);
            } catch {
                return;
            }
            const pending = this.pending.get(message.id);
            if (!pending) return;
            if (message.ok) {
                pending.resolve(message.result);
            } else {
                pending.reject(new Error(message.error || "UI helper error"));
            }
            this.pending.delete(message.id);
        });
        this.child.on("exit", () => {
            this.cleanup(new Error("UI helper exited"));
        });
    }

    private send(cmd: string, params: Record<string, any> = {}) {
        return new Promise<any>((resolve, reject) => {
            if (!this.child) {
                reject(new Error("UI helper not started"));
                return;
            }
            const id = ++this.seq;
            this.pending.set(id, { resolve, reject });
            try {
                this.child.stdin.write(JSON.stringify({ id, cmd, ...params }) + "\n");
            } catch (err: any) {
                this.pending.delete(id);
                reject(err instanceof Error ? err : new Error(String(err)));
            }
        });
    }

    goto(url: string) { return this.send("goto", { url }); }
    click(selector: string) { return this.send("click", { selector }); }
    type(selector: string, text: string) { return this.send("type", { selector, text }); }
    select(selector: string, value: string) { return this.send("select", { selector, value }); }
    press(selector: string, key: string) { return this.send("press", { selector, key }); }
    waitForSelector(selector: string, timeout?: number) { return this.send("waitForSelector", { selector, timeout }); }
    waitForText(text: string, timeout?: number) { return this.send("waitForText", { text, timeout }); }
    extractText(selector: string) { return this.send("extractText", { selector }); }
    screenshot(pathname: string) { return this.send("screenshot", { path: pathname }); }
    currentUrl() { return this.send("url"); }
    textContent(selector: string) { return this.send("textContent", { selector }); }
    evaluate(source: string, arg: any) { return this.send("evaluate", { source, arg }); }
    title() { return this.send("title"); }
}

class RemotePageProxy {
    constructor(private helper: UiHelperClient) { }

    async screenshot(options: { path: string }) {
        await this.helper.screenshot(options.path);
    }

    url() {
        return this.helper.currentUrl();
    }

    async textContent(selector: string) {
        return this.helper.textContent(selector);
    }

    async evaluate(fn: any, arg?: any) {
        const source = typeof fn === "string" ? fn : fn.toString();
        return this.helper.evaluate(source, arg);
    }

    async title() {
        return this.helper.title();
    }
}
