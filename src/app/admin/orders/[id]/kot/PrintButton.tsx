"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

export function PrintButton() {
  const searchParams = useSearchParams();
  const autoprint = searchParams.get("autoprint");
  const t = useTranslations("common");

  useEffect(() => {
    if (autoprint === "1") {
      // Small timeout to ensure styles are applied
      setTimeout(() => window.print(), 300);
    }
  }, [autoprint]);

  return (
    <button
      onClick={() => window.print()}
      className="print:hidden w-full py-4 text-xl font-bold bg-black text-white active:scale-95 transition-transform"
    >
      {t("print")}
    </button>
  );
}
