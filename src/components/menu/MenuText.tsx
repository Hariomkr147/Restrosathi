"use client";
import { createContext, useContext, type ReactNode } from "react";

export type MenuText = Omit<(typeof import("../../../messages/en.json"))["menu"], "spice" | "from"> & { spiceLevels: string[]; retryButtonClass: string };
const MenuTextContext = createContext<MenuText | null>(null);
export function MenuTextProvider({ value, children }: { value: MenuText; children: ReactNode }) {
  return <MenuTextContext.Provider value={value}>{children}</MenuTextContext.Provider>;
}
export function useMenuText(): MenuText {
  const value = useContext(MenuTextContext);
  if (!value) throw new Error("Menu text provider is required.");
  return value;
}
