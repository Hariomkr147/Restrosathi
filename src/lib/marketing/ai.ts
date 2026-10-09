import { consumeMonthlyQuota } from "../ai/usage";
import { getProvider } from "../ai";
import { z } from "zod";

const variantSchema = z.object({
  variants: z.array(z.string()).min(3).max(3)
});

export async function generateMarketingVariants(goal: string, locale: "en" | "hi" = "en") {
  if (goal.length < 10 || goal.length > 400) {
    throw new Error("Goal must be between 10 and 400 characters.");
  }

  const allowed = await consumeMonthlyQuota();
  if (!allowed) {
    throw new Error("AI monthly quota exceeded.");
  }

  const stopLine = locale === "hi" 
    ? "अनसब्सक्राइब करने के लिए STOP भेजें।" 
    : "Reply STOP to unsubscribe.";

  const prompt = `You are an expert restaurant marketer writing WhatsApp messages.
Goal: "${goal}"
Language: ${locale === "hi" ? "Hindi" : "English"}

Rules for the 3 variants:
1. <=300 characters each (including the STOP line).
2. Any numbers or amounts (prices, discounts, dates) must exactly match those mentioned in the goal. Do not invent numbers.
3. If you include a link, it must ONLY be a placeholder like APP_URL. Do not invent URLs.
4. You may use at most one {name} placeholder to greet the customer (e.g. "Hi {name},").
5. DO NOT include the STOP line yourself, it will be added automatically, just ensure the length leaves room for it (${stopLine.length} chars).

Output a JSON array object: { "variants": ["variant 1", "variant 2", "variant 3"] }
Return ONLY valid JSON.`;

  const ai = getProvider();
  const res = await ai.complete({
    system: "You output JSON.",
    user: prompt
  });

  let parsed: z.infer<typeof variantSchema>;
  try {
    parsed = variantSchema.parse(JSON.parse(res.text));
  } catch (err) {
    throw new Error("AI returned invalid structure.");
  }

  // Extract all numbers from the goal
  const goalNumbers = (goal.match(/\d+/g) || []);

  return parsed.variants.map(v => {
    let clean = v.trim();
    
    // Check for invented numbers
    const variantNumbers = (clean.match(/\d+/g) || []);
    const inventedNumbers = variantNumbers.filter(n => !goalNumbers.includes(n));
    if (inventedNumbers.length > 0) {
      throw new Error("Variant contained invented numbers.");
    }

    // Check for non-APP_URL links
    if (/(http|www\.)/i.test(clean) && !clean.includes("APP_URL")) {
      throw new Error("Variant contained unauthorized links.");
    }

    // Check placeholder count
    const nameMatches = clean.match(/\{name\}/g) || [];
    if (nameMatches.length > 1) {
      throw new Error("Variant contained too many name placeholders.");
    }

    // enforce STOP line
    if (!clean.includes("STOP")) {
      clean = clean + "\n\n" + stopLine;
    }
    
    if (clean.length > 300) {
      clean = clean.substring(0, 300 - stopLine.length - 2) + "\n\n" + stopLine;
    }

    return clean;
  });
}
