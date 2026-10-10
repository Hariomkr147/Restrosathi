"use client";

import { useActionState } from "react";
import { confirmBookingAction, declineBookingAction, setBookingStatusAction } from "./actions";
import { BookingStatus } from "@prisma/client";
import { useTranslations } from "next-intl";

export function ConfirmButton({ id }: { id: string }) {
  const t = useTranslations("Admin.bookingErrors");
  const [state, formAction, pending] = useActionState(async () => {
    return confirmBookingAction(id);
  }, null);

  return (
    <form action={formAction}>
      <button disabled={pending} className="bg-emerald-600 text-white px-3 py-1.5 rounded min-h-touch text-sm font-medium disabled:opacity-50">
        {pending ? "Confirming..." : "Confirm"}
      </button>
      {state?.error && <p className="text-destructive text-xs mt-1">{t(state.error) || state.error}</p>}
    </form>
  );
}

export function DeclineButton({ id }: { id: string }) {
  const t = useTranslations("Admin.bookingErrors");
  const [state, formAction, pending] = useActionState(async () => {
    return declineBookingAction(id);
  }, null);

  return (
    <form action={formAction}>
      <button disabled={pending} className="bg-destructive text-destructive-foreground px-3 py-1.5 rounded min-h-touch text-sm font-medium disabled:opacity-50">
        {pending ? "Declining..." : "Decline"}
      </button>
      {state?.error && <p className="text-destructive text-xs mt-1">{t(state.error) || state.error}</p>}
    </form>
  );
}

export function StatusButton({ id, status, label, className }: { id: string, status: BookingStatus, label: string, className: string }) {
  const t = useTranslations("Admin.bookingErrors");
  const [state, formAction, pending] = useActionState(async () => {
    return setBookingStatusAction(id, status);
  }, null);

  return (
    <form action={formAction}>
      <button disabled={pending} className={`px-3 py-1.5 rounded min-h-touch text-sm font-medium disabled:opacity-50 ${className}`}>
        {pending ? "..." : label}
      </button>
      {state?.error && <p className="text-destructive text-xs mt-1">{t(state.error) || state.error}</p>}
    </form>
  );
}

