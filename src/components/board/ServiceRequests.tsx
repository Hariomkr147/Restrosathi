import type { BoardRequest } from "@/lib/orders/board";
import { useTranslations } from "next-intl";
import { resolveRequest } from "@/app/admin/board/actions";

export function ServiceRequests({ requests, onResolved }: { requests: BoardRequest[]; onResolved: () => void }) {
  const t = useTranslations("board");
  if (requests.length === 0) return null;

  return (
    <div className="flex gap-2 p-2 overflow-x-auto bg-muted/50 border-b">
      {requests.map(r => (
        <div key={r.id} className="flex items-center gap-2 bg-card border rounded-full px-4 py-1 text-sm whitespace-nowrap">
          <span className="font-medium">{r.tableLabel}</span>
          <span className="text-muted-foreground">•</span>
          <span>{t(`serviceRequests.${r.kind}`)}</span>
          <button 
            className="ml-2 bg-primary/10 hover:bg-primary/20 text-primary px-2 py-0.5 rounded-full"
            onClick={async () => {
              await resolveRequest(r.id);
              onResolved();
            }}
          >
            {t("done")}
          </button>
        </div>
      ))}
    </div>
  );
}
