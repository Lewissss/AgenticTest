import Ajv, { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import fs from "fs/promises";
import { TraceV1 } from "../types/trace.js";

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

let validator: ValidateFunction<TraceV1> | null = null;

async function getValidator(): Promise<ValidateFunction<TraceV1>> {
    if (validator) return validator;
    const schemaUrl = new URL("../../schemas/trace.v1.schema.json", import.meta.url);
    const schema = JSON.parse(await fs.readFile(schemaUrl, "utf-8"));
    validator = ajv.compile(schema);
    return validator;
}

export async function loadTrace(tracePath: string): Promise<TraceV1> {
    const raw = await fs.readFile(tracePath, "utf-8");
    const parsed = JSON.parse(raw);
    const validate = await getValidator();
    if (!validate(parsed)) {
        const errors = ajv.errorsText(validate.errors, { separator: "\n" });
        throw new Error(`Invalid trace file: ${errors}`);
    }
    return parsed;
}
