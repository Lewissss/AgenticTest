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

        const validate = this.ajv.compile(responseSchema);
        const valid = validate(body);
        return { valid, errors: validate.errors };
    }
}
