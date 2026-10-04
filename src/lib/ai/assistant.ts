import { z } from "zod";
import { isAllergyQuestion } from "./allergy";
import { consumeDeviceQuota, consumeMonthlyQuota } from "./usage";
import { getProvider } from "./index";
import { prisma } from "../db";

const AiResponseSchema = z.object({
  reply: z.string(),
  itemIds: z.array(z.string())
});

type AssistantResult = 
  | { ok: true; reply: string; items: Array<{ id: string; name: unknown; pricePaise: number; isVeg: boolean }> }
  | { ok: false; error: "LIMIT_DEVICE" | "LIMIT_MONTH" | "TOO_LONG" | "EMPTY" };

export async function askMenuAssistant(params: { question: string; deviceId: string; locale: string }): Promise<AssistantResult> {
  const q = params.question.trim();
  if (q.length === 0) return { ok: false, error: "EMPTY" };
  if (q.length > 300) return { ok: false, error: "TOO_LONG" };

  if (isAllergyQuestion(q)) {
    return { ok: true, reply: "assistant.allergy", items: [] };
  }

  const deviceOk = await consumeDeviceQuota(params.deviceId);
  if (!deviceOk) return { ok: false, error: "LIMIT_DEVICE" };

  const monthOk = await consumeMonthlyQuota();
  if (!monthOk) return { ok: false, error: "LIMIT_MONTH" };

  // Fetch available items
  const menuItems = await prisma.menuItem.findMany({
    where: { available: true },
    include: { variants: true } // we might need price
  });

  const contextData = menuItems.map(m => ({
    id: m.id,
    name: m.name,
    isVeg: m.isVeg,
    spiceLevel: m.spiceLevel,
    tags: m.tags,
    description: m.description,
    pricePaise: m.variants[0]?.pricePaise ?? 0
  }));

  const system = `You are a helpful restaurant assistant.
Answer only from the supplied menu; never claim an item is free, discounted, allergen-free or guaranteed safe.
Keep the reply under 60 words.
Reply in the user's language (English, Hindi or Hinglish).
Output JSON only in the format: {"reply": "...", "itemIds": ["id1", "id2"]}.
Available menu:
${JSON.stringify(contextData)}
`;

  try {
    const provider = getProvider();
    const result = await provider.complete({ system, user: q });
    const parsed = AiResponseSchema.parse(JSON.parse(result.text));
    
    // drop ids not in context
    const validItems = parsed.itemIds
      .map(id => contextData.find(c => c.id === id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map(c => ({
        id: c.id,
        name: c.name,
        pricePaise: c.pricePaise,
        isVeg: c.isVeg
      }));

    return { ok: true, reply: parsed.reply, items: validItems };
  } catch (e) {
    // Provider failure or invalid JSON -> fallback
    return { ok: true, reply: "assistant.fallback", items: [] };
  }
}
