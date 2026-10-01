import { expect, it } from "vitest";
import { l10nSchema, localize } from "./l10n";

it("returns Hindi when present", () => expect(localize({ en: "Dal", hi: "दाल" }, "hi")).toBe("दाल"));
it("falls back to English when hi is missing", () => expect(localize({ en: "Dal" }, "hi")).toBe("Dal"));
it("falls back to English when hi is blank", () => expect(localize({ en: "Dal", hi: "  " }, "hi")).toBe("Dal"));
it("rejects empty English", () => expect(l10nSchema.safeParse({ en: "" }).success).toBe(false));
