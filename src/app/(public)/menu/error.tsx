"use client";

import { useMenuText } from "@/components/menu/MenuText";

export default function MenuError({ reset }: { reset: () => void }) {
  const text = useMenuText();
  return <main id="main" className="mx-auto w-full max-w-content space-y-4 px-6 py-8">
    <h1 className="font-heading text-3xl">{text.title}</h1>
    <p role="alert">{text.loadError}</p>
    <button type="button" data-slot="button" className={text.retryButtonClass} onClick={reset}>{text.retry}</button>
  </main>;
}
