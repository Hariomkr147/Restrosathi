import { AiProvider } from "./provider";

export class FakeAiProvider implements AiProvider {
  async complete(prompt: { system: string; user: string }): Promise<{ text: string }> {
    return {
      text: JSON.stringify({
        reply: "Here are some options.",
        itemIds: ["e2e-orderable-item"]
      })
    };
  }
}
