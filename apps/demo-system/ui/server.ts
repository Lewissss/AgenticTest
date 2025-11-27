import { serve } from "bun";
import fs from "fs/promises";
import path from "path";

const PORT = Number(process.env.DEMO_WEB_PORT || 3010);
const API_BASE_URL = process.env.DEMO_API_BASE_URL || "http://localhost:3020";
const HTML_PATH = path.join(import.meta.dir, "index.html");

const ROUTES = new Set(["/", "/login", "/dashboard", "/products", "/cart"]);

async function renderHtml() {
    const template = await fs.readFile(HTML_PATH, "utf-8");
    return template.replace("{{API_BASE_URL}}", API_BASE_URL);
}

serve({
    port: PORT,
    fetch: async (req) => {
        const url = new URL(req.url);
        if (req.method === "GET" && ROUTES.has(url.pathname)) {
            return new Response(await renderHtml(), {
                headers: { "Content-Type": "text/html" }
            });
        }
        if (url.pathname === "/health") {
            return new Response("ok");
        }
        return new Response("Not Found", { status: 404 });
    }
});

console.log(`Demo UI available at http://localhost:${PORT}`);
