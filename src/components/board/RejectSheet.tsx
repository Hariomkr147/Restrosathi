import { useState } from "react";
import { useTranslations } from "next-intl";
import { rejectOrder } from "@/app/admin/board/actions";

export function RejectSheet({ orderId, onClose, onAction }: { orderId: string; onClose: () => void; onAction: () => void }) {
  const t = useTranslations("board");
  const tCommon = useTranslations("common");
  const [reason, setReason] = useState("");

  const handleReject = async () => {
    if (!reason) return;
    await rejectOrder(orderId, reason);
    onAction();
    onClose();
  };

  const reasons = [t("outOfStock"), t("kitchenClosed"), t("cantMake")];

  return (
    <div className="fixed inset-0 bg-background/80 flex items-end sm:items-center justify-center p-4 z-50">
      <div className="bg-card w-full max-w-md border rounded-t-xl sm:rounded-xl p-4 flex flex-col gap-4 shadow-lg text-foreground">
        <h3 className="font-bold text-lg">{t("rejectReason")}</h3>
        <div className="flex flex-col gap-2">
          {reasons.map(r => (
            <button key={r} className="text-left px-4 py-3 rounded border hover:bg-muted" onClick={() => setReason(r)}>
              {r}
            </button>
          ))}
          <input 
            type="text" 
            placeholder={t("otherReason")}
            className="border px-4 py-3 rounded"
            value={reason && !reasons.includes(reason) ? reason : ""}
            onChange={e => setReason(e.target.value)}
          />
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button className="px-4 py-2" onClick={onClose}>{tCommon("cancel")}</button>
          <button className="bg-destructive text-destructive-foreground px-4 py-2 rounded font-medium" disabled={!reason} onClick={handleReject}>
            {t("confirmReject")}
          </button>
        </div>
      </div>
    </div>
  );
}
