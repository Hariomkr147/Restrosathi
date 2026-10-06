import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { markHandledAction } from "./actions";
import Link from "next/link";

export const metadata = { title: "Messages" };

export default async function AdminMessagesPage() {
  await requireUser("STAFF");

  const uniquePhones = await prisma.messageLog.findMany({
    distinct: ["phone"],
    select: { phone: true }
  });

  const threadsData = await Promise.all(
    uniquePhones.map(async ({ phone }) => {
      const msgs = await prisma.messageLog.findMany({
        where: { phone },
        orderBy: { createdAt: "desc" },
        take: 20
      });
      const needsHuman = msgs.some(m => m.needsHuman);
      const latestAt = msgs[0]?.createdAt || new Date(0);
      return { phone, msgs: msgs.reverse(), needsHuman, latestAt };
    })
  );

  threadsData.sort((a, b) => {
    if (a.needsHuman && !b.needsHuman) return -1;
    if (!a.needsHuman && b.needsHuman) return 1;
    return b.latestAt.getTime() - a.latestAt.getTime();
  });

  return (
    <main className="mx-auto w-full max-w-4xl p-4 md:p-8">
      <div className="mb-6 flex justify-between items-end">
        <h1 className="text-3xl font-black tracking-tight">Messages</h1>
      </div>

      <div className="space-y-6">
        {threadsData.length === 0 && <div className="text-muted-foreground">No messages found.</div>}
        
        {threadsData.map((thread) => (
          <div key={thread.phone} className="border border-border bg-surface-card rounded-lg overflow-hidden flex flex-col">
            <div className={`p-4 border-b border-border flex justify-between items-center ${thread.needsHuman ? "bg-red-500/10" : "bg-surface-raised"}`}>
              <div className="font-bold text-lg flex items-center gap-2">
                {thread.phone}
                {thread.needsHuman && <span className="text-xs bg-red-600 text-white px-2 py-1 rounded-full uppercase tracking-wider">Needs Human</span>}
              </div>
              <div className="flex gap-2">
                <Link 
                  href={`https://wa.me/${thread.phone.replace("+", "")}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm border border-border px-3 py-1 rounded-sm bg-surface hover:bg-surface-raised"
                >
                  Open in WhatsApp
                </Link>
                {thread.needsHuman && (
                  <form action={async () => {
                    "use server";
                    await markHandledAction(thread.phone);
                  }}>
                    <button type="submit" className="text-sm bg-primary text-primary-foreground px-3 py-1 rounded-sm hover:opacity-90">
                      Mark Handled
                    </button>
                  </form>
                )}
              </div>
            </div>
            
            <div className="p-4 bg-surface max-h-96 overflow-y-auto flex flex-col gap-3">
              {thread.msgs.map(m => {
                const isOut = m.direction === "OUT";
                return (
                  <div key={m.id} className={`max-w-[80%] p-3 rounded-lg ${isOut ? "bg-surface-raised self-end rounded-tr-none" : "bg-primary/10 text-foreground self-start rounded-tl-none border border-primary/20"}`}>
                    <div className="whitespace-pre-wrap">{m.body || m.kind}</div>
                    <div className="text-[10px] text-muted-foreground mt-1 text-right">
                      {m.createdAt.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
