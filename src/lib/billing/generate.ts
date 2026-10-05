import { prisma } from "../db";
import { getSettings } from "../settings";
import { computeBill, type ComputeBillInput } from "./calc";
import { audit } from "../audit";
import { z } from "zod";

type GenerateResult = 
  | { ok: true; billId: string }
  | { ok: false; error: "NOT_FOUND" | "SESSION_CLOSED" | "UNACCEPTED_ORDERS" | "EMPTY_BILL" | "DISCOUNT_FORBIDDEN" | "DISCOUNT_INVALID" | "BILL_LOCKED" };

const discountSchema = z.object({
  type: z.enum(["FLAT", "PERCENT"]),
  value: z.number().int().min(0),
  reason: z.string().trim().min(3).max(100)
});

const generateOptsSchema = z.object({
  discount: discountSchema.optional(),
  customerName: z.string().trim().max(100).optional(),
  customerPhone: z.string().trim().max(20).optional()
});

export async function generateBill(
  sessionId: string,
  optsInput: { discount?: { type: "FLAT" | "PERCENT"; value: number; reason: string }; customerName?: string; customerPhone?: string },
  actor: { id: string; role: string }
): Promise<GenerateResult> {
  const parsed = generateOptsSchema.safeParse(optsInput);
  if (!parsed.success) return { ok: false, error: "DISCOUNT_INVALID" };
  const opts = parsed.data;

  return prisma.$transaction(async (tx) => {
    const session = await tx.diningSession.findUnique({
      where: { id: sessionId },
      include: {
        bill: true,
        orders: { include: { lines: true } }
      }
    });

    if (!session) return { ok: false, error: "NOT_FOUND" };
    if (session.status === "CLOSED") return { ok: false, error: "SESSION_CLOSED" };

    if (session.bill && ["SETTLED", "CANCELLED"].includes(session.bill.status)) {
      return { ok: false, error: "BILL_LOCKED" };
    }

    const settings = await getSettings();

    if (opts.discount) {
      if (actor.role === "STAFF" && !settings.staffCanDiscount) {
        return { ok: false, error: "DISCOUNT_FORBIDDEN" };
      }
    }

    if (session.orders.some(o => o.status === "NEW")) {
      return { ok: false, error: "UNACCEPTED_ORDERS" };
    }

    const validLines = session.orders
      .filter(o => o.status !== "REJECTED")
      .flatMap(o => o.lines)
      .filter(l => !l.voidedAt);

    if (validLines.length === 0) {
      return { ok: false, error: "EMPTY_BILL" };
    }

    const calcLines = validLines.map(l => ({
      qty: l.qty,
      unitPricePaise: l.unitPricePaise
    }));

    try {
      const computed = computeBill({
        lines: calcLines,
        discount: opts.discount ? { type: opts.discount.type, valuePaise: opts.discount.type === "FLAT" ? opts.discount.value : 0, percent: opts.discount.type === "PERCENT" ? opts.discount.value : 0 } : undefined,
        taxMode: settings.taxMode,
        gstRatePercent: settings.gstRatePercent,
        pricesIncludeTax: settings.pricesIncludeTax
      });

      const header = {
        name: settings.name,
        address: settings.address,
        phone: settings.phone,
        gstin: settings.gstin,
        fssai: settings.fssai
      };

      const billData = {
        docType: computed.docType,
        taxMode: settings.taxMode,
        gstRatePercent: settings.gstRatePercent,
        pricesIncludeTax: settings.pricesIncludeTax,
        header: header as any,
        subtotalPaise: computed.subtotalPaise,
        discountType: opts.discount?.type || null,
        discountValue: opts.discount?.value || null,
        discountPaise: computed.discountPaise,
        discountReason: opts.discount?.reason || null,
        taxableValuePaise: computed.taxableValuePaise,
        cgstPaise: computed.cgstPaise,
        sgstPaise: computed.sgstPaise,
        roundOffPaise: computed.roundOffPaise,
        totalPaise: computed.totalPaise,
        customerName: opts.customerName || null,
        customerPhone: opts.customerPhone || null,
        generatedAt: new Date(),
        generatedById: actor.id
      };

      let billId: string;

      if (session.bill) {
        billId = session.bill.id;
        await tx.billLine.deleteMany({ where: { billId } });
        await tx.bill.update({
          where: { id: billId },
          data: billData
        });
      } else {
        const created = await tx.bill.create({
          data: {
            ...billData,
            session: { connect: { id: sessionId } }
          }
        });
        billId = created.id;
      }

      await tx.billLine.createMany({
        data: validLines.map(l => ({
          billId,
          name: l.nameSnapshot as any,
          variant: l.variantSnapshot as any,
          modifiers: l.modifiersSnapshot as any,
          qty: l.qty,
          unitPricePaise: l.unitPricePaise,
          linePaise: l.qty * l.unitPricePaise
        }))
      });

      await audit({ actorId: actor.id, action: "bill.generate", entity: "Bill", entityId: billId, data: { totalPaise: computed.totalPaise, subtotalPaise: computed.subtotalPaise } }, tx);
      if (opts.discount) {
        await audit({ actorId: actor.id, action: "bill.discount", entity: "Bill", entityId: billId, data: opts.discount }, tx);
      }

      return { ok: true, billId };
    } catch (e: any) {
      if (e.code === "EMPTY_BILL" || e.code === "DISCOUNT_EXCEEDS_SUBTOTAL" || e.code === "INVALID_DISCOUNT") {
        return { ok: false, error: e.code as any };
      }
      throw e;
    }
  }, { maxWait: 20000, timeout: 30000 });
}
