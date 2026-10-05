"use client";

import { useState } from "react";
import { cancelBillAction } from "../../actions";
import { useTranslations } from "next-intl";

export function CancelBillButton({ billId }: { billId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const t = useTranslations("Admin.Bills.View");

  async function handleCancel() {
    if (reason.trim().length < 5) {
      setError(t("reasonTooShort"));
      return;
    }

    setLoading(true);
    setError(null);
    const res = await cancelBillAction(billId, reason);
    setLoading(false);
    
    if (!res.ok) {
      setError(res.error);
    } else {
      setIsOpen(false);
    }
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-red-100 text-red-700 font-medium rounded-lg hover:bg-red-200 transition-colors"
      >
        {t("cancelBtn")}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">{t("cancelConfirmTitle")}</h3>
            <p className="text-sm text-gray-600">{t("cancelConfirmText")}</p>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("cancelReasonLabel")}</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={t("cancelReasonPlaceholder")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[100px]"
                maxLength={200}
              />
              <p className="text-xs text-gray-500 mt-1 text-right">{reason.length}/200</p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setIsOpen(false)}
                disabled={loading}
                className="px-4 py-2 font-medium text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
              >
                {t("cancelDialogClose")}
              </button>
              <button
                onClick={handleCancel}
                disabled={loading || reason.trim().length < 5}
                className="px-4 py-2 font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? t("cancelling") : t("cancelDialogConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
