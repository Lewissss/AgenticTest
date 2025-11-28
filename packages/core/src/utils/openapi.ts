import Ajv from "ajv";
import yaml from "js-yaml";
import fs from "fs/promises";

export class OpenApiValidator {
    private ajv: Ajv;
    private spec: any = null;

    constructor() {
        this.ajv = new Ajv({ strict: false, allErrors: true });
    }

    async loadSpec(filePath: string) {
        const content = await fs.readFile(filePath, "utf-8");
        if (filePath.endsWith(".json")) {
            this.spec = JSON.parse(content);
        } else {
            this.spec = yaml.load(content);
        }
    }

    validateResponse(method: string, path: string, status: number, body: any, operationId?: string): { valid: boolean; errors?: any[] } {
        if (!this.spec) return { valid: true }; // No spec loaded, skip

        let operation = null;
        if (operationId) {
            // Find by operationId
            for (const p in this.spec.paths) {
                for (const m in this.spec.paths[p]) {
                    if (this.spec.paths[p][m].operationId === operationId) {
                        operation = this.spec.paths[p][m];
                        break;
                    }
                }
                if (operation) break;
            }
        } else {
            // Find by method + path (simple matching for now)
            // In a real implementation, we'd need a path matcher for parameters
            const pathItem = this.spec.paths[path];
            if (pathItem) {
                operation = pathItem[method.toLowerCase()];
            }
        }

        if (!operation) {
            // If we can't find the operation, we can't validate.
            // For strict mode, this might be a failure, but for now we'll warn/skip.
            return { valid: true };
        }

        const responseSchema = operation.responses[status]?.content?.["application/json"]?.schema;
        if (!responseSchema) return { valid: true };

        const dereferencedSchema = this.dereferenceSchema(responseSchema);
        const validate = this.ajv.compile(dereferencedSchema);
        const valid = validate(body);
        return { valid, errors: validate.errors };
    }

    private dereferenceSchema(schema: any): any {
        if (!schema) return schema;
        if (schema.$ref) {
            const resolved = this.resolveRef(schema.$ref);
            if (!resolved) {
                throw new Error(`Cannot resolve reference ${schema.$ref}`);
            }
            return this.dereferenceSchema(resolved);
        }

        if (Array.isArray(schema)) {
            return schema.map((item) => this.dereferenceSchema(item));
        }

        if (typeof schema !== "object") {
            return schema;
        }

        const clone: any = { ...schema };
        if (clone.properties) {
            clone.properties = Object.fromEntries(
                Object.entries(clone.properties).map(([key, value]) => [key, this.dereferenceSchema(value)])
            );
        }
        if (clone.items) {
            clone.items = this.dereferenceSchema(clone.items);
        }
        if (clone.allOf) {
            clone.allOf = clone.allOf.map((item: any) => this.dereferenceSchema(item));
        }
        if (clone.oneOf) {
            clone.oneOf = clone.oneOf.map((item: any) => this.dereferenceSchema(item));
        }
        if (clone.anyOf) {
            clone.anyOf = clone.anyOf.map((item: any) => this.dereferenceSchema(item));
        }
        if (clone.additionalProperties && typeof clone.additionalProperties === "object") {
            clone.additionalProperties = this.dereferenceSchema(clone.additionalProperties);
        }
        return clone;
    }

    private resolveRef(ref: string): any {
        if (!this.spec || !ref.startsWith("#/")) return null;
        const pathSegments = ref.slice(2).split("/");
        let current: any = this.spec;
        for (const segment of pathSegments) {
            current = current?.[segment];
            if (current === undefined) return null;
        }
        return current;
    }
}
