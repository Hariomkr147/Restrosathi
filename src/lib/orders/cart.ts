export type CartLine = { itemId: string; variantId?: string; optionIds: string[]; qty: number; note?: string };
export type CartAction = { type: "add"; line: CartLine } | { type: "setQty"; index: number; qty: number } | { type: "remove"; index: number } | { type: "clear" };
export function cartLineKey(line: CartLine): string {
  return JSON.stringify([line.itemId, line.variantId ?? "", [...new Set(line.optionIds)].sort(), line.note?.trim() ?? ""]);
}
export function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  if (action.type === "clear") return [];
  if (action.type === "remove") return state.filter((_, index) => index !== action.index);
  if (action.type === "setQty") {
    if (!Number.isInteger(action.qty) || action.qty < 1 || action.qty > 20) return state;
    return state.map((line, index) => index === action.index ? { ...line, qty: action.qty } : line);
  }
  const line = action.line;
  if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 20) return state;
  const index = state.findIndex((entry) => cartLineKey(entry) === cartLineKey(line));
  if (index >= 0) return state.map((entry, at) => at === index ? { ...entry, qty: Math.min(20, entry.qty + line.qty) } : entry);
  if (state.length >= 30) return state;
  return [...state, { ...line, optionIds: [...new Set(line.optionIds)].sort(), note: line.note?.trim() }];
}
export function cartCount(state: CartLine[]): number { return state.reduce((count, line) => count + line.qty, 0); }
