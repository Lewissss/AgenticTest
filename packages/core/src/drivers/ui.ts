import { chromium, Browser, BrowserContext, Page } from "playwright";

export class UiDriver {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;

    constructor(private headless: boolean = true) { }

    async start(baseUrl: string) {
        this.browser = await chromium.launch({ headless: this.headless });
        this.context = await this.browser.newContext({ baseURL: baseUrl });
        this.page = await this.context.newPage();
    }

    async stop() {
        await this.page?.close();
        await this.context?.close();
        await this.browser?.close();
    }

    private ensurePage(): Page {
        if (!this.page) throw new Error("UI driver not started");
        return this.page;
    }

    async goto(url: string) {
        await this.ensurePage().goto(url);
    }

    async click(selector: string) {
        await this.ensurePage().locator(selector).click();
    }

    async type(selector: string, text: string) {
        const locator = this.ensurePage().locator(selector);
        await locator.fill("");
        await locator.type(text);
    }

    async select(selector: string, value: string) {
        await this.ensurePage().selectOption(selector, value);
    }

    async press(selector: string, key: string) {
        await this.ensurePage().locator(selector).press(key);
    }

    async waitForSelector(selector: string, timeout?: number) {
        await this.ensurePage().locator(selector).waitFor({ state: "visible", timeout });
    }

    async waitForText(text: string, timeout = 5000) {
        const page = this.ensurePage();
        await page.waitForFunction(
            (needle) => document.body.innerText.includes(needle),
            text,
            { timeout }
        );
    }

    async extractText(selector: string) {
        const content = await this.ensurePage().locator(selector).textContent();
        return content?.trim() || "";
    }

    async screenshot(path: string) {
        await this.ensurePage().screenshot({ path });
    }

    getPage() {
        return this.page;
    }
}
