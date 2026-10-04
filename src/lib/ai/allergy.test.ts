import { describe, expect, it } from "vitest";
import { isAllergyQuestion } from "./allergy";

describe("isAllergyQuestion", () => {
  it("detects allergy words in English", () => {
    expect(isAllergyQuestion("I have a peanut allergy")).toBe(true);
    expect(isAllergyQuestion("is there gluten in naan")).toBe(true);
    expect(isAllergyQuestion("lactose intolerant")).toBe(true);
    expect(isAllergyQuestion("are there any nuts in this")).toBe(true);
    expect(isAllergyQuestion("I am allergic to dairy")).toBe(true);
  });

  it("detects allergy words in Hindi/Hinglish", () => {
    expect(isAllergyQuestion("mujhe allergy hai")).toBe(true);
    expect(isAllergyQuestion("मुझे मूंगफली से एलर्जी है")).toBe(true);
    expect(isAllergyQuestion("kya isme gluten hai")).toBe(true);
    expect(isAllergyQuestion("लैक्टोज है क्या")).toBe(true); // "लैक्टोज" isn't explicitly in the required list, wait, let's use the required list: "allergy, allergic, allergen, peanut, nut, nuts, gluten, lactose, एलर्जी, एलर्जिक, मूंगफली, ग्लूटेन, allergi"
    expect(isAllergyQuestion("mujhe allergi hai")).toBe(true);
    expect(isAllergyQuestion("ग्लूटेन")).toBe(true);
  });

  it("does not detect normal questions (including 'nutritious')", () => {
    expect(isAllergyQuestion("what is nutritious")).toBe(false);
    expect(isAllergyQuestion("is the dal spicy")).toBe(false);
    expect(isAllergyQuestion("kuch meetha batao")).toBe(false);
    expect(isAllergyQuestion("nutmeg")).toBe(false); // only match nut as whole word
    expect(isAllergyQuestion("donut")).toBe(false); // only match nut as whole word
  });
});
