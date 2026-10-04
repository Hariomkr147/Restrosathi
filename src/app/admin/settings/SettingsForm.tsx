"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { SettingsView } from "@/lib/settings";
import type { Hours } from "@/lib/settings/schema";
import { updateSettings } from "./actions";

const inputClass = "min-h-touch w-full min-w-0 rounded-sm border border-muted-foreground bg-secondary px-3 py-2 text-base";
const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export function SettingsForm({ settings }: { settings: SettingsView }) {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const [hours, setHours] = useState<Hours>(settings.hours);
  const previousHours = useRef<Hours>({ ...settings.hours });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [status, setStatus] = useState<"saved" | "network" | null>(null);
  const [taxMode, setTaxMode] = useState(settings.taxMode);
  const [pending, startTransition] = useTransition();
  function editHours(value: Hours) { setHours(value); setStatus(null); }
  function error(field: string) {
    return fieldErrors[field] ? <p id={`error-${field}`} className="text-destructive" role="alert">{t(`errors.${field}`)}</p> : null;
  }
  function field(name: "name" | "address" | "phone" | "whatsappPhone" | "mapEmbedUrl" | "googleReviewUrl") {
    return <div className="min-w-0 space-y-2">
      <label htmlFor={name} className="block font-medium">{t(name)}</label>
      <input id={name} name={name} className={inputClass} defaultValue={settings[name] ?? ""}
        type={name.includes("Url") ? "url" : name.toLowerCase().includes("phone") ? "tel" : "text"}
        required={!name.includes("Url")} maxLength={name === "name" ? 80 : undefined}
        autoComplete={name.toLowerCase().includes("phone") ? "tel" : undefined}
        aria-invalid={!!fieldErrors[name]} aria-describedby={fieldErrors[name] ? `error-${name}` : undefined} />
      {name.toLowerCase().includes("phone") && <p className="text-sm text-muted-foreground">{t("phoneHint")}</p>}
      {error(name)}
    </div>;
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "");
    setStatus(null); setFieldErrors({});
    startTransition(async () => {
      try {
        const result = await updateSettings({
          name: value("name"), address: value("address"), phone: value("phone"), whatsappPhone: value("whatsappPhone"),
          about: { en: value("about-en"), hi: value("about-hi") }, mapEmbedUrl: value("mapEmbedUrl"), googleReviewUrl: value("googleReviewUrl"), hours,
          taxMode: value("taxMode"), gstRatePercent: parseInt(value("gstRatePercent") || "5", 10), pricesIncludeTax: form.get("pricesIncludeTax") === "on",
          gstin: value("gstin"), fssai: value("fssai"), staffCanDiscount: form.get("staffCanDiscount") === "on"
        });
        if (result.ok) setStatus("saved"); else setFieldErrors(result.fieldErrors);
      } catch { setStatus("network"); }
    });
  }
  return <form onSubmit={submit} onChange={() => setStatus(null)} className="mt-6 space-y-8">
    <fieldset disabled={pending} className="min-w-0 space-y-8">
      <fieldset className="min-w-0 space-y-4"><legend className="mb-4 font-heading text-2xl">{t("basics")}</legend>{field("name")}{field("address")}</fieldset>
      <fieldset className="min-w-0"><legend className="mb-4 font-heading text-2xl">{t("about")}</legend>
        <div className="grid gap-4 md:grid-cols-2">{(["en", "hi"] as const).map((locale) => <div key={locale} className="min-w-0 space-y-2">
          <label htmlFor={`about-${locale}`} className="block font-medium">{t(`about-${locale}`)}</label>
          <textarea id={`about-${locale}`} name={`about-${locale}`} lang={locale} rows={4} className={inputClass} defaultValue={settings.about[locale] ?? ""}
            required={locale === "en"} aria-invalid={!!fieldErrors.about} aria-describedby={fieldErrors.about ? "error-about" : undefined} />
        </div>)}</div>{error("about")}
      </fieldset>
      <fieldset className="min-w-0 space-y-4"><legend className="mb-4 font-heading text-2xl">{t("contact")}</legend>{field("phone")}{field("whatsappPhone")}</fieldset>
      <fieldset className="min-w-0 space-y-4"><legend className="mb-4 font-heading text-2xl">{t("links")}</legend><p className="text-sm text-muted-foreground">{t("linkHint")}</p>{field("mapEmbedUrl")}{field("googleReviewUrl")}</fieldset>
      <fieldset className="min-w-0 space-y-6"><legend className="mb-4 font-heading text-2xl">{t("hours")}</legend>
        <p className="text-sm text-muted-foreground">{t("hoursHint")}</p>
        {days.map((day) => <fieldset key={day} className="min-w-0 space-y-3 border-b border-border pb-6">
          <legend className="font-medium">{common(`days.${day}`)}</legend>
          <label className="flex min-h-touch w-fit items-center gap-3 py-2"><input type="checkbox" checked={!hours[day].length}
            onChange={(e) => {
              if (e.target.checked) previousHours.current[day] = hours[day];
              editHours({ ...hours, [day]: e.target.checked ? [] : previousHours.current[day].length ? previousHours.current[day] : [{ open: "11:00", close: "23:00" }] });
            }} />{common("closed")}</label>
          {hours[day].map((shift, index) => <div key={index} className="grid min-w-0 gap-3 sm:grid-cols-2">
            {(["open", "close"] as const).map((key) => <div key={key} className="min-w-0 space-y-2">
              <label htmlFor={`${day}-${index}-${key}`} className="block">{t(key)} {index + 1}</label>
              <input id={`${day}-${index}-${key}`} type="time" required className={inputClass} value={shift[key]}
                aria-invalid={!!fieldErrors.hours} aria-describedby={fieldErrors.hours ? "error-hours" : undefined}
                onChange={(e) => editHours({ ...hours, [day]: hours[day].map((value, at) => at === index ? { ...value, [key]: e.target.value } : value) })} />
            </div>)}
            {index > 0 && <Button type="button" variant="outline" onClick={() => editHours({ ...hours, [day]: hours[day].filter((_, at) => at !== index) })}>{t("removeShift")}</Button>}
          </div>)}
          {hours[day].length === 1 && <Button type="button" variant="outline" className="h-auto whitespace-normal py-2" onClick={() => editHours({ ...hours, [day]: [...hours[day], { open: "18:00", close: "23:00" }] })}>{t("addShift")}</Button>}
        </fieldset>)}{error("hours")}
      </fieldset>
      <fieldset className="min-w-0 space-y-4">
        <legend className="mb-4 font-heading text-2xl">{t("taxBilling")}</legend>
        <p className="text-sm text-muted-foreground">{t("taxWarning")}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <label htmlFor="taxMode" className="block font-medium">{t("taxMode")}</label>
            <select id="taxMode" name="taxMode" className={inputClass} value={taxMode} onChange={e => setTaxMode(e.target.value as any)}>
              <option value="NONE">{t("taxModes.NONE")}</option>
              <option value="COMPOSITION">{t("taxModes.COMPOSITION")}</option>
              <option value="REGULAR">{t("taxModes.REGULAR")}</option>
            </select>
          </div>
          <div className="min-w-0 space-y-2">
            <label htmlFor="gstRatePercent" className="block font-medium">{t("gstRatePercent")}</label>
            <input id="gstRatePercent" name="gstRatePercent" type="number" min="0" max="28" className={inputClass} defaultValue={settings.gstRatePercent} required aria-invalid={!!fieldErrors.gstRatePercent} />
            {error("gstRatePercent")}
          </div>
        </div>
        <label className="flex items-center gap-3 py-2"><input type="checkbox" name="pricesIncludeTax" defaultChecked={settings.pricesIncludeTax} />{t("pricesIncludeTax")}</label>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <label htmlFor="gstin" className="block font-medium">GSTIN</label>
            <input id="gstin" name="gstin" className={inputClass} defaultValue={settings.gstin ?? ""} aria-invalid={!!fieldErrors.gstin} aria-describedby={fieldErrors.gstin ? "error-gstin" : undefined} />
            {error("gstin")}
          </div>
          <div className="min-w-0 space-y-2">
            <label htmlFor="fssai" className="block font-medium">FSSAI</label>
            <input id="fssai" name="fssai" className={inputClass} defaultValue={settings.fssai ?? ""} aria-invalid={!!fieldErrors.fssai} aria-describedby={fieldErrors.fssai ? "error-fssai" : undefined} />
            {error("fssai")}
          </div>
        </div>
        <label className="flex items-center gap-3 py-2"><input type="checkbox" name="staffCanDiscount" defaultChecked={settings.staffCanDiscount} />{t("staffCanDiscount")}</label>
      </fieldset>
      <Button type="submit" disabled={pending} aria-busy={pending}>{t(pending ? "saving" : "save")}</Button>
    </fieldset>
    {status && <p role={status === "saved" ? "status" : "alert"} className={status === "network" ? "text-destructive" : "bg-secondary p-4"}>{t(status)}</p>}
  </form>;
}
