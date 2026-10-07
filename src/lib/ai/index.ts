import { AiProvider } from "./provider";
import { OpenRouterProvider } from "./openrouter";
import { FakeAiProvider } from "./fake";

let provider: AiProvider | null = null;

export function getProvider(): AiProvider {
  if (provider) return provider;
  
  if (process.env.AI_PROVIDER === "openrouter") {
    provider = new OpenRouterProvider();
  } else if (process.env.AI_PROVIDER === "fake" || process.env.NODE_ENV === "test") {
    provider = new FakeAiProvider();
  } else {
    // Fail safe on unknown provider / missing config
    provider = {
      async complete() {
        throw new Error("No configured AI provider");
      }
    };
  }
  
  return provider;
}
