import { setPhoneVerifiedCookie } from "../../src/lib/otp/verified-cookie";
import { Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

export async function asVerifiedPhone(phone: string) {
  // Uses the mock cookie jar to set the cookie in memory.
  // Assumes vitest context where cookieJar is mocked in helpers/auth
  await setPhoneVerifiedCookie(phone);
}

export async function verifyPhoneInBrowser(page: Page, phone: string) {
  // Drives the real OTP UI and reads the code from the fake outbox file
  // Wait for the outbox to be written (it takes some time for cron/sendNow)
  await page.waitForTimeout(1000); // give time for the file write
  
  const outboxFile = path.resolve("test-results/fake-wa-outbox.jsonl");
  const data = await fs.readFile(outboxFile, "utf8");
  const lines = data.trim().split("\n");
  
  // Find the latest OTP message to this phone
  let code = "000000";
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i]) continue;
    try {
      const msg = JSON.parse(lines[i]);
      if (msg.to.includes(phone.replace("+", "")) && msg.text.includes("is your code for RestroSathi")) {
        // extract 6 digit code from beginning of message
        const match = msg.text.match(/^(\d{6})/);
        if (match) {
          code = match[1];
          break;
        }
      }
    } catch {}
  }
  
  // Fill the OTP input
  // OtpField has 6 inputs. We assume we can type in the first one or paste
  const inputs = page.locator('input[inputmode="numeric"]');
  const count = await inputs.count();
  if (count === 6) {
    for (let i = 0; i < 6; i++) {
      await inputs.nth(i).fill(code[i]);
    }
  } else {
    throw new Error("OTP inputs not found");
  }
}
