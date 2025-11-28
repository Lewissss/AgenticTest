#!/usr/bin/env node
import { chromium } from "playwright";
import readline from "readline";

let browser = null;
let context = null;
let page = null;

const rl = readline.createInterface({ input: process.stdin });
let queue = Promise.resolve();

async function handleCommand(message) {
    const { cmd } = message;
    switch (cmd) {
        case "start":
            await startSession(message);
            return null;
        case "stop":
            await stopSession();
            return null;
        case "goto":
            await page.goto(message.url);
            return null;
        case "click":
            await page.locator(message.selector).click();
            return null;
        case "type": {
            const locator = page.locator(message.selector);
            await locator.fill("");
            await locator.type(message.text || "");
            return null;
        }
        case "select":
            await page.selectOption(message.selector, message.value);
            return null;
        case "press":
            await page.locator(message.selector).press(message.key);
            return null;
        case "waitForSelector":
            await page.locator(message.selector).waitFor({ state: "visible", timeout: message.timeout ?? undefined });
            return null;
        case "waitForText":
            await page.waitForFunction(
                (needle) => document.body.innerText.includes(needle),
                message.text,
                { timeout: message.timeout ?? undefined }
            );
            return null;
        case "extractText": {
            const text = await page.locator(message.selector).textContent();
            return (text || "").trim();
        }
        case "screenshot":
            await page.screenshot({ path: message.path });
            return null;
        case "url":
            return page.url();
        case "textContent": {
            const text = await page.textContent(message.selector);
            return text || "";
        }
        case "evaluate": {
            const fn = eval(`(${message.source})`);
            return page.evaluate(fn, message.arg);
        }
        case "title":
            return page.title();
        default:
            throw new Error(`Unknown command ${cmd}`);
    }
}

async function startSession(options) {
    await stopSession();
    browser = await chromium.launch({ headless: options.headless });
    context = await browser.newContext({ baseURL: options.baseUrl });
    page = await context.newPage();
}

async function stopSession() {
    await page?.close();
    await context?.close();
    await browser?.close();
    page = null;
    context = null;
    browser = null;
}

function respond(id, payload) {
    process.stdout.write(JSON.stringify({ id, ...payload }) + "\n");
}

rl.on("line", (line) => {
    if (!line.trim()) return;
    queue = queue.then(async () => {
        let message;
        try {
            message = JSON.parse(line);
        } catch (err) {
            respond(null, { ok: false, error: "Invalid JSON" });
            return;
        }
        try {
            const result = await handleCommand(message);
            respond(message.id, { ok: true, result });
        } catch (err) {
            respond(message.id, { ok: false, error: err?.message || String(err) });
        }
    });
});

process.on("SIGTERM", () => {
    queue.then(async () => {
        await stopSession();
        process.exit(0);
    });
});
