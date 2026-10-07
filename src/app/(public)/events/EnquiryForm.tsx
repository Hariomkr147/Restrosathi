/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState } from "react";
import { submitEnquiryAction } from "./actions";
import { useTranslations } from "next-intl";
import Link from "next/link";

export function EnquiryForm({ packages }: { packages: { id: string, name: string }[] }) {
  const t = useTranslations("events");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const input = {
      packageId: formData.get("packageId") as string || undefined,
      eventType: formData.get("eventType") as string,
      name: formData.get("name") as string,
      phone: formData.get("phone") as string,
      guests: Number(formData.get("guests")),
      eventDate: formData.get("eventDate") as string,
      message: formData.get("message") as string,
      honeypot: formData.get("bot_field") as string || undefined,
    };

    try {
      const res = await submitEnquiryAction(input);
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(res.error === "RATE_LIMITED" ? t("rateLimited") : t("submitError"));
      }
    } catch (err) {
      setError(t("submitError"));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-[calc(var(--spacing)*8)] space-y-[calc(var(--spacing)*4)]">
        <div className="w-16 h-16 bg-[var(--color-veg)] text-white rounded-full flex items-center justify-center mx-auto text-3xl">
          ✓
        </div>
        <h3 className="text-2xl font-display">{t("successTitle")}</h3>
        <p className="text-[var(--color-text-muted)]">{t("successMessage")}</p>
        <button onClick={() => setSuccess(false)} className="px-[calc(var(--spacing)*4)] py-[calc(var(--spacing)*2)] border border-[var(--color-border)] rounded-[var(--radius-sm)] font-bold mt-[calc(var(--spacing)*4)] text-[var(--color-text)]">
          {t("newEnquiry")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-[calc(var(--spacing)*4)] relative">
      <input type="text" name="bot_field" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />

      {error && (
        <div className="p-[calc(var(--spacing)*4)] bg-[var(--color-danger)] text-white rounded-[var(--radius-sm)]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[calc(var(--spacing)*4)]">
        <div>
          <label className="block text-sm font-bold mb-[var(--spacing)]">{t("name")}</label>
          <input required maxLength={60} name="name" type="text" className="w-full h-[var(--size-touch)] px-[calc(var(--spacing)*3)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-transparent" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-[var(--spacing)]">{t("phone")}</label>
          <input required name="phone" type="tel" className="w-full h-[var(--size-touch)] px-[calc(var(--spacing)*3)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-transparent" placeholder="+91..." />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[calc(var(--spacing)*4)]">
        <div>
          <label className="block text-sm font-bold mb-[var(--spacing)]">{t("eventDate")}</label>
          <input required name="eventDate" type="date" className="w-full h-[var(--size-touch)] px-[calc(var(--spacing)*3)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-transparent" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-[var(--spacing)]">{t("guests")}</label>
          <input required name="guests" type="number" min={1} max={500} className="w-full h-[var(--size-touch)] px-[calc(var(--spacing)*3)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-transparent" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[calc(var(--spacing)*4)]">
        <div>
          <label className="block text-sm font-bold mb-[var(--spacing)]">{t("eventType")}</label>
          <select required name="eventType" className="w-full h-[var(--size-touch)] px-[calc(var(--spacing)*3)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-transparent">
            <option value="BIRTHDAY">{t("typeBirthday")}</option>
            <option value="CORPORATE">{t("typeCorporate")}</option>
            <option value="OTHER">{t("typeOther")}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold mb-[var(--spacing)]">{t("package")}</label>
          <select name="packageId" className="w-full h-[var(--size-touch)] px-[calc(var(--spacing)*3)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-transparent">
            <option value="">{t("noPackage")}</option>
            {packages.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold mb-[var(--spacing)]">{t("message")}</label>
        <textarea name="message" maxLength={600} rows={4} className="w-full p-[calc(var(--spacing)*3)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-transparent" placeholder={t("messagePlaceholder")} />
      </div>

      <div className="text-sm text-[var(--color-text-muted)] bg-[var(--color-surface)] p-[calc(var(--spacing)*4)] rounded border border-[var(--color-border)]">
        {t("depositNotice")}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        By submitting, you agree to our <Link href="/privacy" className="underline hover:text-primary">Privacy Policy</Link>.
      </p>

      <button disabled={loading} type="submit" className="w-full h-[var(--size-touch)] bg-[var(--color-primary)] text-[var(--color-primary-contrast)] rounded-[var(--radius-sm)] font-bold disabled:opacity-50">
        {loading ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
