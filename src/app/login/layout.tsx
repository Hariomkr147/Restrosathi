import type { ReactNode } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>
    <div className="mx-auto w-full max-w-content px-6 py-4"><LanguageToggle /></div>
    {children}
  </>;
}
