"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { loginWithPassword, loginWithPin, logout } from "./actions";

const inputClass = "min-h-touch w-full min-w-0 rounded-sm border border-muted-foreground bg-secondary px-3 py-2 text-base";

export function LoginForm({ staff }: { staff?: { id: string; name: string }[] }) {
  const t = useTranslations("login");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<"invalid" | "locked" | "network" | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = staff
          ? await loginWithPin({ userId: String(form.get("userId")), pin })
          : await loginWithPassword({ phone: String(form.get("phone")), password: String(form.get("password")) });
        if (result) setError(result.error);
      } catch { setError("network"); }
    });
  }

  if (staff?.length === 0) return <p role="status">{t("noStaff")}</p>;

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        {staff ? <>
          <div className="space-y-2">
            <label htmlFor="staff-user" className="block font-medium">{t("staffName")}</label>
            <select id="staff-user" name="userId" className={inputClass} required>
              {staff.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="staff-pin" className="block font-medium">{t("pin")}</label>
            <input id="staff-pin" name="pin" type="password" inputMode="numeric" autoComplete="current-password"
              className={inputClass} value={pin} required minLength={4} maxLength={6} pattern="[0-9]{4,6}"
              aria-invalid={error === "invalid"} aria-describedby={error ? "login-error" : undefined}
              onChange={(event) => { if (/^\d{0,6}$/.test(event.target.value)) setPin(event.target.value); }} />
          </div>
          <div className="grid grid-cols-3 gap-2" aria-label={t("keypad")}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) =>
              <Button key={digit} type="button" variant="outline" className="w-full text-xl"
                onClick={() => setPin((value) => (value + digit).slice(0, 6))}>{digit}</Button>)}
            <Button type="button" variant="outline" className="h-auto whitespace-normal py-2" onClick={() => setPin((value) => value.slice(0, -1))}>{t("backspace")}</Button>
            <Button type="button" variant="outline" className="w-full text-xl" onClick={() => setPin((value) => (value + "0").slice(0, 6))}>0</Button>
            <Button type="button" variant="outline" className="h-auto whitespace-normal py-2" onClick={() => setPin("")}>{t("clear")}</Button>
          </div>
        </> : <>
          <div className="space-y-2">
            <label htmlFor="owner-phone" className="block font-medium">{t("phone")}</label>
            <input id="owner-phone" name="phone" type="tel" autoComplete="username" className={inputClass}
              required maxLength={13} pattern="\+91[0-9]{10}" aria-describedby="phone-hint" />
            <p id="phone-hint" className="text-sm text-muted-foreground">{t("phoneHint")}</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="owner-password" className="block font-medium">{t("password")}</label>
            <input id="owner-password" name="password" type="password" autoComplete="current-password" className={inputClass}
              required maxLength={128} aria-invalid={error === "invalid"} aria-describedby={error ? "login-error" : undefined} />
          </div>
        </>}
        <Button type="submit" className="w-full text-base" disabled={pending} aria-busy={pending}>
          {pending ? t("signingIn") : t("signIn")}
        </Button>
      </fieldset>
      {error && <p id="login-error" role="alert" className="text-destructive">{t(error)}</p>}
    </form>
  );
}

export function LogoutButton() {
  const t = useTranslations("login");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  return <div className="space-y-2">
    <Button type="button" variant="outline" disabled={pending} aria-busy={pending} aria-invalid={error || undefined}
      onClick={() => {
        setError(false);
        startTransition(async () => { try { await logout(); } catch { setError(true); } });
      }}>{pending ? t("loggingOut") : t("logout")}</Button>
    {error && <p role="alert" className="text-destructive">{t("logoutError")}</p>}
  </div>;
}
