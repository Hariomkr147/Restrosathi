import { expect, it } from "vitest";
import { localize } from "./l10n";
import { l10nSchema } from "./schema";

it("returns Hindi when present", () => expect(localize({ en: "Dal", hi: "दाल" }, "hi")).toBe("दाल"));
it("falls back to English when hi is missing", () => expect(localize({ en: "Dal" }, "hi")).toBe("Dal"));
it("falls back to English when hi is blank", () => expect(localize({ en: "Dal", hi: "  " }, "hi")).toBe("Dal"));
it("rejects empty English", () => expect(l10nSchema.safeParse({ en: "" }).success).toBe(false));
