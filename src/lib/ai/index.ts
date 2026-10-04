import { AiProvider } from "./provider";
import { OpenRouterProvider } from "./openrouter";
import { FakeAiProvider } from "./fake";

let provider: AiProvider | null = null;

export function getProvider(): AiProvider {
  if (provider) return provider;
  
  if (process.env.NODE_ENV === "test" || !process.env.OPENROUTER_API_KEY) {
    provider = new FakeAiProvider();
  } else {
    provider = new OpenRouterProvider();
  }
  
  return provider;
}
