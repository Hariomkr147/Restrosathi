import { getProvider } from "../src/lib/ai/index";
import { evalCases } from "../src/lib/ai/eval/cases";
import { isAllergyQuestion } from "../src/lib/ai/allergy";
import * as dotenv from "dotenv";

dotenv.config();

async function runEval() {
  const provider = getProvider();
  let passed = 0;
  
  // Dummy context for eval
  const system = `You are a helpful restaurant assistant.
Answer only from the supplied menu; never claim an item is free, discounted, allergen-free or guaranteed safe.
Keep the reply under 60 words.
Reply in the user's language (English, Hindi or Hinglish).
Output JSON only in the format: {"reply": "...", "itemIds": ["id1", "id2"]}.
Available menu:
[{"id":"1","name":{"en":"Spicy Chicken"},"isVeg":false,"spiceLevel":2,"pricePaise":30000},
{"id":"2","name":{"en":"Veg Pulao"},"isVeg":true,"spiceLevel":0,"pricePaise":20000}]
`;

  console.log("Running AI Eval...");
  for (const c of evalCases) {
    if (isAllergyQuestion(c.q)) {
      console.log(`[PASS] (Regex) ${c.q}`);
      passed++;
      continue;
    }
    try {
      const res = await provider.complete({ system, user: c.q });
      const data = JSON.parse(res.text);
      
      const hasIds = Array.isArray(data.itemIds) && data.itemIds.length > 0;
      if (c.expectIds === hasIds) {
        console.log(`[PASS] ${c.q}`);
        passed++;
      } else {
        console.log(`[FAIL] ${c.q} - Expected items: ${c.expectIds}, got: ${hasIds}`);
      }
    } catch (e) {
      console.log(`[FAIL] ${c.q} - Error: ${e}`);
    }
  }
  
  console.log(`\nEval Result: ${passed}/${evalCases.length} passed.`);
}

runEval().catch(console.error);
