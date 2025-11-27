import { describe, expect, test } from "bun:test";
import { interpolate } from "../src/utils/interpolation.js";
import { redact } from "../src/utils/redaction.js";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import traceSchema from "../schemas/trace.schema.json";

describe("Core Utilities", () => {
    test("Interpolation", () => {
        const vars = { USER: "alice" };
        const state = { token: "123" };
        expect(interpolate("Hello ${VAR:USER}", vars, state)).toBe("Hello alice");
        expect(interpolate("Token: ${STATE:token}", vars, state)).toBe("Token: 123");
    });

    test("Redaction", () => {
        const obj = { key: "secret123", public: "data" };
        const redacted = redact(obj, ["secret123"]);
        expect(redacted.key).toBe("[REDACTED]");
        expect(redacted.public).toBe("data");
    });
});

describe("Schema Validation", () => {
    test("Valid Trace", () => {
        const ajv = new Ajv();
        addFormats(ajv);
        const validate = ajv.compile(traceSchema);
        const validTrace = {
            schemaVersion: 1,
            app: "test",
            scenarioId: "t1",
            title: "Test Trace",
            mode: "ui",
            createdAt: "2023-01-01T00:00:00.000Z",
            createdBy: "human",
            base: { uiBaseUrl: "http://localhost", apiBaseUrl: "http://localhost" },
            variables: {},
            steps: [
                { id: "s1", kind: "ui.goto", args: { url: "/" } }
            ]
        };
        const valid = validate(validTrace);
        if (!valid) console.error(validate.errors);
        expect(valid).toBe(true);
    });
});
