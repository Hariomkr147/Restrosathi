 
import { AiProvider } from "./provider";

export class FakeAiProvider implements AiProvider {
  async complete(prompt: { system: string; user: string }): Promise<{ text: string }> {
    let itemId: string | null = "e2e-orderable-item";
    try {
      const match = prompt.system.match(/Available menu:\s*(\[[\s\S]*\])/);
      if (match) {
        const menu = JSON.parse(match[1]);
        if (Array.isArray(menu) && menu.length > 0) {
          const lowerQ = prompt.user.toLowerCase();
          if (lowerQ.includes("taxi") || lowerQ.includes("wifi") || lowerQ.includes("password")) {
            itemId = null;
          } else {
            const isVegRequest = lowerQ.includes("veg");
            const item = isVegRequest ? menu.find(m => m.isVeg) : menu[0];
            if (item) {
              itemId = item.id;
            }
          }
        }
      }
    } catch {
      // Ignore parse errors, fallback to default
    }

    return {
      text: JSON.stringify({
        reply: "Here are some options.",
        itemIds: itemId ? [itemId] : []
      })
    };
  }
}
