export function redact(obj: any, secrets: string[]): any {
    if (!secrets.length || obj === undefined || obj === null) {
        return obj;
    }

    if (typeof obj === "string") {
        return secrets.reduce((acc, secret) => {
            if (!secret || secret.length < 4) return acc;
            return acc.split(secret).join("[REDACTED]");
        }, obj);
    }

    const json = JSON.stringify(obj);
    let redacted = json;
    for (const secret of secrets) {
        if (secret && secret.length > 3) {
            redacted = redacted.split(secret).join("[REDACTED]");
        }
    }
    return JSON.parse(redacted);
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
    const sensitive = ["authorization", "cookie", "x-api-key"];
    const result = { ...headers };
    for (const key of Object.keys(result)) {
        if (sensitive.includes(key.toLowerCase())) {
            result[key] = "[REDACTED]";
        }
    }
    return result;
}
