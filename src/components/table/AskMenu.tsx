"use client";

import { useState, useTransition } from "react";
import { Sheet } from "./Sheet";
import { useAssistantText } from "./AssistantText";
import { askMenuAction } from "@/lib/ai/actions";
import { DishCard } from "../menu/DishCard";
import { useTableText } from "./TableText";
import type { PublicItem, PublicMenu } from "@/lib/menu/queries";
import type { Locale } from "@/lib/i18n/l10n";

export function AskMenu({ menu, locale, onAdd }: { menu: PublicMenu; locale: Locale; onAdd: (item: PublicItem) => void }) {
  const text = useAssistantText();
  const tableText = useTableText();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [isPending, startTransition] = useTransition();
  const [reply, setReply] = useState<string | null>(null);
  const [items, setItems] = useState<PublicItem[]>([]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    
    setReply(null);
    setItems([]);

    startTransition(async () => {
      const res = await askMenuAction({ question, locale });
      if (res.ok) {
        // If it's a translation key like 'assistant.allergy' or 'assistant.fallback', text[res.reply] works?
        // Wait, text has keys 'allergy', 'fallback'
        let replyText = res.reply;
        if (replyText === "assistant.allergy") replyText = text.allergy;
        if (replyText === "assistant.fallback") replyText = text.fallback;
        
        setReply(replyText);
        
        const fullItems = res.items
          .map(resItem => menu.categories.flatMap(c => c.items).find(i => i.id === resItem.id))
          .filter((i): i is PublicItem => !!i);
        setItems(fullItems);
      } else {
        if (res.error === "LIMIT_DEVICE") setReply(text.limit_device);
        else if (res.error === "LIMIT_MONTH") setReply(text.limit_month);
        else if (res.error === "TOO_LONG") setReply(text.too_long);
        else if (res.error === "EMPTY") setReply(text.empty);
      }
    });
  };

  return <>
    {/* Floating button */}
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="fixed bottom-6 right-6 z-20 flex h-14 items-center justify-center gap-2 rounded-full bg-primary px-6 font-medium text-primary-foreground shadow-lg hover:bg-primary/90 active:bg-primary/80"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {text.button}
    </button>

    {open && <Sheet title={text.title} onClose={() => setOpen(false)}>
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder={text.placeholder}
          disabled={isPending}
          className="min-h-touch flex-1 rounded-md border border-muted-foreground bg-secondary px-3 py-2 text-base"
        />
        <button
          type="submit"
          disabled={isPending || !question.trim()}
          className="min-h-touch rounded-md bg-primary px-4 font-medium text-primary-foreground disabled:opacity-50"
        >
          {text.send}
        </button>
      </form>

      {isPending && <div className="mt-8 text-center text-muted-foreground animate-pulse">...</div>}

      {reply && !isPending && <div className="mt-8 rounded-lg bg-secondary p-4">
        <p className="text-base">{reply}</p>
      </div>}

      {items.length > 0 && !isPending && <div className="mt-6 space-y-4 divide-y divide-border">
        {items.map(item => (
          <DishCard key={item.id} item={item} locale={locale}>
            <button
              type="button"
              onClick={() => onAdd(item)}
              className={`${tableText.buttonClass} mt-4`}
            >
              {tableText.add}
            </button>
          </DishCard>
        ))}
      </div>}
    </Sheet>}
  </>;
}
