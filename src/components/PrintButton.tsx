"use client";

import { ReactNode } from "react";

export function PrintButton({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      {children}
    </button>
  );
}
