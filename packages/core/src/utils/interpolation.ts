import { get } from "lodash";

export interface InterpolationContext {
    baseUrl: string;
    apiBaseUrl: string;
    env: Record<string, string>;
    state: Record<string, any>;
}

function normalizeEnv(env: Record<string, string | undefined>): Record<string, string> {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
        if (typeof value === "string") {
            normalized[key] = value;
        }
    }
    return normalized;
}

export function buildInterpolationContext(input: {
    baseUrl: string;
    apiBaseUrl: string;
    traceEnv?: Record<string, string>;
    overrides?: Partial<Pick<InterpolationContext, "env" | "state">>;
}): InterpolationContext {
    const env = {
        ...normalizeEnv(process.env as Record<string, string | undefined>),
        ...(input.traceEnv || {})
    };
    return {
        baseUrl: input.baseUrl,
        apiBaseUrl: input.apiBaseUrl,
        env: { ...env, ...(input.overrides?.env || {}) },
        state: input.overrides?.state || {}
    };
}

export function interpolateString(value: string, ctx: InterpolationContext): string {
    if (!value) return value;
    let result = value;

    result = result.replace(/\$\{baseUrl\}/g, ctx.baseUrl);
    result = result.replace(/\$\{apiBaseUrl\}/g, ctx.apiBaseUrl);

    result = result.replace(/\$\{ENV:([A-Za-z0-9_]+)\}/g, (_, key) => {
        const envVal = ctx.env[key];
        if (envVal === undefined) {
            throw new Error(`Missing environment variable: ${key}`);
        }
        return envVal;
    });

    result = result.replace(/\$\{STATE:([A-Za-z0-9_.-]+)\}/g, (_, path) => {
        const value = get(ctx.state, path);
        if (value === undefined) {
            throw new Error(`Missing state value: ${path}`);
        }
        return String(value);
    });

    return result;
}

export function interpolateValue<T>(value: T, ctx: InterpolationContext): T {
    if (typeof value === "string") {
        return interpolateString(value, ctx) as T;
    }
    if (Array.isArray(value)) {
        return value.map((item) => interpolateValue(item, ctx)) as T;
    }
    if (value && typeof value === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
            result[key] = interpolateValue(entry as any, ctx);
        }
        return result as T;
    }
    return value;
}
