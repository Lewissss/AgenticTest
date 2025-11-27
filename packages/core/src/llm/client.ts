export type LlmProvider = "ollama" | "openaiCompat";

export interface LlmConfig {
    provider: LlmProvider;
    baseUrl?: string;
    model: string;
    apiKey?: string;
    timeoutMs?: number;
}

export class LlmClient {
    constructor(private config: LlmConfig) { }

    async generate(systemPrompt: string, userPrompt: string): Promise<string> {
        switch (this.config.provider) {
            case "openaiCompat":
                return this.callOpenAi(systemPrompt, userPrompt);
            case "ollama":
            default:
                return this.callOllama(systemPrompt, userPrompt);
        }
    }

    private async callOpenAi(systemPrompt: string, userPrompt: string) {
        const base = this.config.baseUrl || "https://api.openai.com/v1";
        const controller = this.createAbortController();
        const response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(this.config.apiKey ? { "Authorization": `Bearer ${this.config.apiKey}` } : {})
            },
            signal: controller?.signal,
            body: JSON.stringify({
                model: this.config.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                response_format: { type: "json_object" }
            })
        });
        if (!response.ok) {
            throw new Error(`LLM request failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    }

    private async callOllama(systemPrompt: string, userPrompt: string) {
        const base = this.config.baseUrl || "http://localhost:11434";
        const controller = this.createAbortController();
        const response = await fetch(`${base.replace(/\/$/, "")}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller?.signal,
            body: JSON.stringify({
                model: this.config.model,
                system: systemPrompt,
                prompt: userPrompt,
                stream: false,
                format: "json"
            })
        });
        if (!response.ok) {
            throw new Error(`LLM request failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data.response || "";
    }

    private createAbortController(): AbortController | null {
        if (!this.config.timeoutMs) return null;
        const controller = new AbortController();
        setTimeout(() => controller.abort(), this.config.timeoutMs);
        return controller;
    }
}
