"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { RestaurantTable } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { createTable, renameTable, setTableActive, regenerateTableCode } from "./actions";

type Table = RestaurantTable & { url: string };
const fieldClass = "min-h-touch min-w-touch w-full rounded-sm border border-muted-foreground bg-secondary px-3 py-2 text-base";
type Result = Awaited<ReturnType<typeof createTable>>;

export function TablesManager({ tables }: { tables: Table[] }) {
  const t = useTranslations("tables");
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    startTransition(async () => {
      try {
        const result = await createTable(label);
        if (!result.ok) setError(result.error);
        else { setLabel(""); router.refresh(); }
      } catch { setError("FAILED"); }
    });
  }
  return <>
    <Link href="/admin/tables/print" className="inline-flex min-h-touch min-w-touch items-center text-primary underline">{t("print")}</Link>
    <form onSubmit={submit} className="space-y-3" aria-busy={pending}>
      <label htmlFor="new-table" className="block font-medium">{t("newLabel")}</label>
      <div className="flex flex-wrap items-start gap-3">
        <input id="new-table" className={`${fieldClass} sm:max-w-xs`} value={label} onChange={(event) => { setLabel(event.target.value); setError(null); }} required maxLength={20}
          aria-invalid={!!error} aria-describedby={error ? "new-table-error" : "new-table-hint"} disabled={pending} />
        <Button type="submit" disabled={pending} aria-busy={pending}>{t(pending ? "saving" : "add")}</Button>
      </div>
      <p id="new-table-hint" className="text-sm text-muted-foreground">{t("labelHint")}</p>
      {error && <p ref={errorRef} id="new-table-error" tabIndex={-1} role="alert" className="text-destructive">{t(error as "FAILED")}</p>}
    </form>
    {tables.length ? <ul className="divide-y divide-border">{tables.map((table) => <TableRow key={table.id} table={table} />)}</ul>
      : <p role="status">{t("empty")}</p>}
  </>;
}
function TableRow({ table }: { table: Table }) {
  const t = useTranslations("tables"); const router = useRouter();
  const [label, setLabel] = useState(table.label);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const regenerateButton = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const errorId = `table-error-${table.id}`;
  function mutate(run: () => Promise<Result>, close = false) {
    setError(null); setSaved(false);
    startTransition(async () => {
      try {
        const result = await run();
        if (!result.ok) setError(result.error);
        else { if (close) dialog.current?.close(); setSaved(true); router.refresh(); }
      } catch { setError("FAILED"); }
    });
  }
  return <li className="min-w-0 space-y-4 py-6">
    <h2 className="break-words text-xl font-semibold">{table.label}</h2>
    <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); mutate(() => renameTable(table.id, label)); }} aria-busy={pending}>
      <label htmlFor={`label-${table.id}`} className="block">{t("label")}</label>
      <div className="flex flex-wrap gap-3">
        <input id={`label-${table.id}`} className={`${fieldClass} sm:max-w-xs`} required maxLength={20} value={label} disabled={pending}
          aria-invalid={error === "INVALID_LABEL" || error === "LABEL_TAKEN"} aria-describedby={error ? errorId : undefined}
          onChange={(event) => { setLabel(event.target.value); setSaved(false); setError(null); }} />
        <Button type="submit" variant="outline" disabled={pending} aria-busy={pending}>{t(pending ? "saving" : "rename")}</Button>
      </div>
    </form>
    <a href={table.url} className="inline-flex min-h-touch max-w-full items-center break-all text-sm text-primary underline" aria-label={t("openLink")}>{table.url}</a>
    <div className="flex flex-wrap gap-3">
      <Button type="button" variant="outline" role="switch" aria-label={t("active")} aria-checked={table.active} disabled={pending}
        onClick={() => mutate(() => setTableActive(table.id, !table.active))}>{t(table.active ? "active" : "inactive")}</Button>
      <Button ref={regenerateButton} type="button" variant="outline" disabled={pending} onClick={() => { setError(null); setDialogOpen(true); dialog.current?.showModal(); }}>{t("regenerate")}</Button>
    </div>
    {error && !dialogOpen && <p ref={errorRef} id={errorId} tabIndex={-1} role="alert" className="text-destructive">{t(error as "FAILED")}</p>}
    {saved && <p role="status" className="text-sm">{t("saved")}</p>}
    <dialog ref={dialog} aria-labelledby={`dialog-title-${table.id}`} aria-describedby={`dialog-warning-${table.id}`}
      onClose={() => { setDialogOpen(false); regenerateButton.current?.focus(); }} onCancel={(event) => { if (pending) event.preventDefault(); }}
      className="table-code-dialog rounded-md border border-border bg-background p-6 text-foreground">
      <h2 id={`dialog-title-${table.id}`} className="text-xl font-semibold">{t("regenerateFor", { label: table.label })}</h2>
      <p id={`dialog-warning-${table.id}`} className="my-4">{t("regenerateWarning")}</p>
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className="mb-4 text-destructive">{t(error as "FAILED")}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" autoFocus disabled={pending} onClick={() => dialog.current?.close()}>{t("cancel")}</Button>
        <Button type="button" variant="destructive" disabled={pending} aria-busy={pending} onClick={() => mutate(() => regenerateTableCode(table.id), true)}>{t(pending ? "saving" : "regenerate")}</Button>
      </div>
    </dialog>
  </li>;
}
