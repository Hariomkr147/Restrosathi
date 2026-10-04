export function isAllergyQuestion(text: string): boolean {
  const t = text.toLowerCase();
  
  // Hindi / Hinglish substrings
  const subTerms = [
    "allergy", "allergic", "allergen", "allergi",
    "एलर्जी", "एलर्जिक", "मूंगफली", "ग्लूटेन", "लैक्टोज"
  ];
  if (subTerms.some(term => t.includes(term))) {
    return true;
  }

  // English whole words: peanut, nut, nuts, gluten, lactose
  const wholeWords = ["peanut", "nut", "nuts", "gluten", "lactose"];
  for (const word of wholeWords) {
    const regex = new RegExp(`\\b${word}s?\\b`, 'i');
    if (regex.test(t)) {
      return true;
    }
  }

  return false;
}
