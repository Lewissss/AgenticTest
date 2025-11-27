import { serve } from "bun";
import { randomUUID } from "crypto";

interface Product {
    id: string;
    name: string;
    price: number;
    description: string;
    inventory: number;
}

interface CartItem {
    productId: string;
    name: string;
    price: number;
    quantity: number;
}

const PORT = Number(process.env.DEMO_API_PORT || 3020);
const API_PREFIX = "/api";
const DEMO_USERNAME = process.env.DEMO_USERNAME || "user";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "pass";

const products: Product[] = [
    {
        id: "laptop",
        name: "Performance Laptop",
        price: 1499,
        description: "15\" performance laptop with 32GB RAM and 1TB SSD",
        inventory: 5
    },
    {
        id: "monitor",
        name: "4K Monitor",
        price: 499,
        description: "27\" 4K IPS display",
        inventory: 10
    },
    {
        id: "mouse",
        name: "Wireless Mouse",
        price: 79,
        description: "Ergonomic wireless scroll mouse",
        inventory: 30
    }
];

const carts = new Map<string, CartItem[]>();
const sessions = new Map<string, string>();

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
};

function json(body: any, init: ResponseInit = {}): Response {
    return new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
            ...(init.headers || {})
        }
    });
}

function authToken(req: Request): string | null {
    const header = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!header) return null;
    const [, token] = header.split(" ");
    if (!token) return null;
    if (!sessions.has(token)) return null;
    return token;
}

function ensureCart(token: string): CartItem[] {
    if (!carts.has(token)) carts.set(token, []);
    return carts.get(token)!;
}

serve({
    port: PORT,
    fetch: async (req) => {
        const url = new URL(req.url);

        if (req.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        if (!url.pathname.startsWith(API_PREFIX)) {
            if (url.pathname === "/health") {
                return json({ status: "ok" });
            }
            return new Response("Not Found", { status: 404 });
        }

        const route = url.pathname.slice(API_PREFIX.length);

        if (route === "/login" && req.method === "POST") {
            let payload: any = {};
            try {
                payload = await req.json();
            } catch {
                return json({ error: "Invalid JSON" }, { status: 400 });
            }

            if (payload.username === DEMO_USERNAME && payload.password === DEMO_PASSWORD) {
                const token = `demo-${randomUUID()}`;
                sessions.set(token, payload.username);
                carts.set(token, []);
                return json({
                    token,
                    displayName: payload.username
                });
            }
            return json({ error: "Invalid credentials" }, { status: 401 });
        }

        if (route === "/products" && req.method === "GET") {
            return json(products);
        }

        if (route === "/cart/items" && req.method === "GET") {
            const token = authToken(req);
            if (!token) return json({ error: "Unauthorized" }, { status: 401 });
            return json({ items: ensureCart(token) });
        }

        if (route === "/cart/items" && req.method === "POST") {
            const token = authToken(req);
            if (!token) return json({ error: "Unauthorized" }, { status: 401 });

            let payload: any = {};
            try {
                payload = await req.json();
            } catch {
                return json({ error: "Invalid JSON" }, { status: 400 });
            }

            const product = products.find(p => p.id === payload.productId);
            if (!product) {
                return json({ error: "Product not found" }, { status: 404 });
            }
            if (product.inventory <= 0) {
                return json({ error: "Out of stock" }, { status: 409 });
            }

            const qty = Number(payload.quantity || 1);
            const cart = ensureCart(token);
            const existing = cart.find(item => item.productId === product.id);
            if (existing) {
                existing.quantity += qty;
            } else {
                cart.push({
                    productId: product.id,
                    name: product.name,
                    price: product.price,
                    quantity: qty
                });
            }
            return json({ items: cart });
        }

        return json({ error: "Not Found" }, { status: 404 });
    }
});

console.log(`Demo API listening on http://localhost:${PORT}${API_PREFIX}`);
