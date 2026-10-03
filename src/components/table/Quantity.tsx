"use client";
import { useId } from "react";
import { useTableText } from "./TableText";

export function Quantity({ value, onChange, name = "", disabled = false }: { value: number; onChange: (value: number) => void; name?: string; disabled?: boolean }) {
  const text = useTableText(); const id = useId();
  return <div className="space-y-2">
    <label htmlFor={id} className="block font-medium">{text.quantity}{name && ` — ${name}`}</label>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={text.outlineClass} aria-label={`${text.decrease} ${name}`} disabled={disabled || value <= 1} onClick={() => onChange(value - 1)}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14" /></svg>
      </button>
      <input id={id} type="number" min={1} max={20} step={1} value={Number.isNaN(value) ? "" : value} disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)} className="min-h-touch w-20 rounded-md border border-muted-foreground bg-secondary px-3 py-2 text-base" />
      <button type="button" className={text.outlineClass} aria-label={`${text.increase} ${name}`} disabled={disabled || value >= 20} onClick={() => onChange(value + 1)}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5v14" /></svg>
      </button>
    </div>
  </div>;
}
