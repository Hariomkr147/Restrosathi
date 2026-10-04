import { AiProvider } from "./provider";

export class AnthropicProvider implements AiProvider {
  async complete(prompt: { system: string; user: string }): Promise<{ text: string }> {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY not set");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307", // use a fast model
        max_tokens: 300,
        system: prompt.system,
        messages: [{ role: "user", content: prompt.user }]
      })
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error: ${res.status}`);
    }

    const data = await res.json();
    return { text: data.content[0].text };
  }
}
