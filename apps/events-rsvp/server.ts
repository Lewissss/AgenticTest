import { readFile } from "node:fs/promises";
import path from "node:path";

const PORT = Number(process.env.RSVP_PORT || 4030);
const eventsPath = path.join(import.meta.dir, "events.json");

const server = Bun.serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/") {
            const html = await readFile(path.join(import.meta.dir, "public/index.html"));
            return new Response(html, { headers: { "Content-Type": "text/html" } });
        }

        if (url.pathname.startsWith("/public/")) {
            try {
                const file = await readFile(path.join(import.meta.dir, url.pathname));
                const type = url.pathname.endsWith(".css")
                    ? "text/css"
                    : url.pathname.endsWith(".js")
                    ? "application/javascript"
                    : "text/plain";
                return new Response(file, { headers: { "Content-Type": type } });
            } catch {
                return new Response("Not Found", { status: 404 });
            }
        }

        if (url.pathname === "/api/events") {
            const data = await readFile(eventsPath, "utf-8");
            return new Response(data, { headers: { "Content-Type": "application/json" } });
        }

        if (url.pathname === "/api/rsvp" && req.method === "POST") {
            const payload = await req.json().catch(() => null);
            if (!payload?.name || !payload?.email) {
                return new Response(
                    JSON.stringify({ ok: false, error: "Missing name or email" }),
                    { status: 400, headers: { "Content-Type": "application/json" } }
                );
            }
            return new Response(
                JSON.stringify({
                    ok: true,
                    message: `RSVP received for ${payload.name}`,
                    schedule: "Mock confirmation sent"
                }),
                { headers: { "Content-Type": "application/json" } }
            );
        }

        return new Response("Not found", { status: 404 });
    }
});

console.log(`Events RSVP listening on http://localhost:${server.port}`);
