"use client";
import { createContext, useContext, type ReactNode } from "react";

export type AssistantText = (typeof import("../../../messages/en.json"))["assistant"];
const Context = createContext<AssistantText | null>(null);

export function AssistantTextProvider({ value, children }: { value: AssistantText; children: ReactNode }) { 
  return <Context.Provider value={value}>{children}</Context.Provider>; 
}

export function useAssistantText() { 
  const value = useContext(Context); 
  if (!value) throw new Error("Assistant text provider is required."); 
  return value; 
}
