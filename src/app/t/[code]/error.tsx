"use client";
import { useTableText } from "@/components/table/TableText";
export default function TableError({ reset }: { reset: () => void }) {
  const text = useTableText();
  return <main id="main" className="mx-auto max-w-content space-y-4 px-6 py-8"><p role="alert">{text.loadError}</p><button type="button" className={text.buttonClass} onClick={reset}>{text.retry}</button></main>;
}
