import { AiProvider } from "./provider";
import { AnthropicProvider } from "./anthropic";
import { FakeAiProvider } from "./fake";

let provider: AiProvider | null = null;

export function getProvider(): AiProvider {
  if (provider) return provider;
  
  if (process.env.NODE_ENV === "test" || !process.env.ANTHROPIC_API_KEY) {
    provider = new FakeAiProvider();
  } else {
    provider = new AnthropicProvider();
  }
  
  return provider;
}
