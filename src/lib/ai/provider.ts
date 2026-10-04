export interface AiProvider {
  complete(prompt: { system: string; user: string }): Promise<{ text: string }>;
}
