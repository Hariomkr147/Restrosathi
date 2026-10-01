import { expect, it } from "vitest";
import en from "../../../messages/en.json";
import hi from "../../../messages/hi.json";

function missingKeys(english: Record<string, unknown>, hindi: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(english).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!(key in hindi)) return [path];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const translated = hindi[key];
      return missingKeys(value as Record<string, unknown>,
        translated && typeof translated === "object" ? translated as Record<string, unknown> : {}, path);
    }
    return [];
  });
}

it("hi.json has every key of en.json", () => expect(missingKeys(en, hi)).toEqual([]));
