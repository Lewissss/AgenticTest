import { redactHeaders } from "../utils/redaction.js";

export interface ApiRequest {
    method: string;
    path: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: any;
}

export interface ApiResponse {
    status: number;
    headers: Record<string, string>;
    body: any;
    durationMs: number;
    url: string;
    request: {
        method: string;
        path: string;
        headers: Record<string, string>;
        body?: any;
    };
}

export class ApiDriver {
    constructor(private baseUrl: string) { }

    async request(req: ApiRequest): Promise<ApiResponse> {
        const url = new URL(req.path, this.baseUrl);
        if (req.query) {
            for (const [k, v] of Object.entries(req.query)) {
                url.searchParams.append(k, v);
            }
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(req.headers || {})
        };

        let bodyToSend: BodyInit | undefined;
        if (typeof req.body === "string" || req.body instanceof Uint8Array) {
            bodyToSend = req.body;
        } else if (req.body !== undefined && req.body !== null) {
            bodyToSend = JSON.stringify(req.body);
        }

        const start = Date.now();
        const response = await fetch(url.toString(), {
            method: req.method,
            headers,
            body: bodyToSend
        });
        const durationMs = Date.now() - start;

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });

        let responseBody: any;
        const text = await response.text();
        try {
            responseBody = JSON.parse(text);
        } catch {
            responseBody = text;
        }

        return {
            status: response.status,
            headers: responseHeaders,
            body: responseBody,
            durationMs,
            url: url.toString(),
            request: {
                method: req.method,
                path: req.path,
                headers: redactHeaders(headers),
                body: req.body
            }
        };
    }
}
