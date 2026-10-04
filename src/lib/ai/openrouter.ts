import { AiProvider } from "./provider";

export class OpenRouterProvider implements AiProvider {
  async complete(prompt: { system: string; user: string }): Promise<{ text: string }> {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY not set");

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku", // default fast model on OpenRouter
        response_format: { type: "json_object" }, // OpenRouter / OpenAI supports JSON object enforcement
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user }
        ]
      })
    });

    if (!res.ok) {
      throw new Error(`OpenRouter API error: ${res.status}`);
    }

    const data = await res.json();
    return { text: data.choices[0].message.content };
  }
}
