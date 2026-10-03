"use client";
import { createContext, useContext, type ReactNode } from "react";

export type TableText = Record<keyof (typeof import("../../../messages/en.json"))["table"], string> & { buttonClass: string; outlineClass: string };
const Context = createContext<TableText | null>(null);
export function TableTextProvider({ value, children }: { value: TableText; children: ReactNode }) { return <Context.Provider value={value}>{children}</Context.Provider>; }
export function useTableText() { const value = useContext(Context); if (!value) throw new Error("Table text provider is required."); return value; }
