import fs from "fs/promises";
import path from "path";
import { loadTrace } from "./utils/trace.js";

export async function compileTrace(app: string | undefined, tracePath: string) {
    const trace = await loadTrace(tracePath);
    const outputDir = path.resolve(process.cwd(), "compiled-tests", trace.app || app || "default");
    await fs.mkdir(outputDir, { recursive: true });

    const templatePath = new URL("../compiled-templates/base.test.js.template", import.meta.url);
    const template = await fs.readFile(templatePath, "utf-8");

    const body = template
        .replace("__TRACE_OBJECT__", JSON.stringify(trace, null, 2))
        .replace("__TEST_TITLE__", `${trace.app} :: ${trace.testName}`);

    const outPath = path.join(outputDir, `${trace.testName}.test.js`);
    await fs.writeFile(outPath, body);
    return outPath;
}
