import { prisma } from "../db";
import { Prisma } from "@prisma/client";
import { getSettings } from "../settings";
import { computeBillDraft } from "./calc";
import { audit } from "../audit";
import { z } from "zod";
import { calculateRedemptionValue } from "../loyalty";

type GenerateResult = 
  | { ok: true; billId: string }
  | { ok: false; error: "NOT_FOUND" | "SESSION_CLOSED" | "UNACCEPTED_ORDERS" | "EMPTY_BILL" | "DISCOUNT_FORBIDDEN" | "DISCOUNT_INVALID" | "BILL_LOCKED" };

const discountSchema = z.object({
  type: z.enum(["FLAT", "PERCENT"]),
  value: z.number().int().min(0),
  reason: z.string().trim().min(3).max(100)
});

const generateOptsSchema = z.object({
  discount: discountSchema.nullable().optional(),
  customerName: z.string().trim().max(100).optional(),
  customerPhone: z.string().trim().max(20).optional(),
  marketingConsent: z.boolean().optional()
});

export async function generateBill(
  sessionId: string,
  optsInput: { discount?: { type: "FLAT" | "PERCENT"; value: number; reason: string } | null; customerName?: string; customerPhone?: string; marketingConsent?: boolean },
  actor: { id: string; role: string }
): Promise<GenerateResult> {
  const parsed = generateOptsSchema.safeParse(optsInput);
  if (!parsed.success) return { ok: false, error: "DISCOUNT_INVALID" };
  const opts = parsed.data;

  return prisma.$transaction(async (tx) => {
    const sessionMeta = await tx.diningSession.findUnique({
      where: { id: sessionId },
      select: { id: true, kind: true, tableId: true }
    });
    if (!sessionMeta) return { ok: false, error: "NOT_FOUND" };

    const { lockSession } = await import("../sessions");
    await lockSession(tx, sessionMeta);

    const session = await tx.diningSession.findUnique({
      where: { id: sessionId },
      include: {
        bill: true,
        orders: { include: { lines: true } }
      }
    });

    if (!session) return { ok: false, error: "NOT_FOUND" };

    if (session.bill) {
      // lock bill
      await tx.$queryRaw`SELECT id FROM "Bill" WHERE id = ${session.bill.id} FOR UPDATE`;
    }

    if (!session) return { ok: false, error: "NOT_FOUND" };
    if (session.status === "CLOSED") return { ok: false, error: "SESSION_CLOSED" };

    if (session.bill && ["SETTLED", "CANCELLED"].includes(session.bill.status)) {
      return { ok: false, error: "BILL_LOCKED" };
    }

    const settings = await getSettings(tx);

    if (opts.discount !== undefined && (opts.discount || session.bill?.discountType)) {
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
      // Omitted discount preserves the draft; null explicitly removes it.
      const discount = opts.discount !== undefined ? opts.discount : session.bill?.discountType
        ? { type: session.bill.discountType, value: session.bill.discountValue ?? 0, reason: session.bill.discountReason ?? "" }
        : null;
      const finalPhone = opts.customerPhone !== undefined
        ? opts.customerPhone || session.customerPhone || null : session.bill?.customerPhone ?? session.customerPhone;
      const sameCustomer = !session.bill || session.bill.customerPhone === finalPhone;
      const finalVerifiedAt = sameCustomer && session.bill?.phoneVerifiedAt
        ? session.bill.phoneVerifiedAt
        : sameCustomer && finalPhone === session.customerPhone ? session.customerPhoneVerifiedAt : null;
      const savedPoints = session.bill?.loyaltyPointsRedeemed ?? 0;
      const keepRedemption = settings.loyaltyEnabled && sameCustomer && !!finalVerifiedAt
        && savedPoints > 0 && savedPoints % settings.loyaltyRedeemUnitPoints === 0;
      const loyaltyPointsRedeemed = keepRedemption ? session.bill?.loyaltyPointsRedeemed ?? 0 : 0;
      const loyaltyDiscountPaise = keepRedemption
        ? calculateRedemptionValue(loyaltyPointsRedeemed, settings.loyaltyRedeemUnitPoints, settings.loyaltyRedeemUnitValuePaise) : 0;
      const computed = computeBillDraft({
        lines: calcLines,
        discount,
        extraDiscountPaise: loyaltyDiscountPaise,
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
          header: header as Prisma.InputJsonValue,
          subtotalPaise: computed.subtotalPaise,
          discountType: discount?.type ?? null,
          discountValue: discount?.value ?? null,
          discountPaise: computed.discountPaise,
          discountReason: discount?.reason ?? null,
          taxableValuePaise: computed.taxableValuePaise,
          cgstPaise: computed.cgstPaise,
          sgstPaise: computed.sgstPaise,
          roundOffPaise: computed.roundOffPaise,
          totalPaise: computed.totalPaise,
          loyaltyPointsRedeemed,
          loyaltyDiscountPaise,
          customerName: opts.customerName || session.customerName || null,
          customerPhone: finalPhone,
          phoneVerifiedAt: finalVerifiedAt,
          marketingConsent: opts.marketingConsent ?? session.bill?.marketingConsent ?? false,
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
          name: l.nameSnapshot as Prisma.InputJsonValue,
          variant: l.variantSnapshot as Prisma.InputJsonValue,
          modifiers: l.modifiersSnapshot as Prisma.InputJsonValue,
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
    } catch (e: unknown) {
      if (typeof e === "object" && e !== null && "code" in e) {
        const code = (e as { code: string }).code;
        if (code === "EMPTY_BILL") return { ok: false, error: "EMPTY_BILL" };
        if (code === "DISCOUNT_EXCEEDS_SUBTOTAL" || code === "INVALID_DISCOUNT") return { ok: false, error: "DISCOUNT_INVALID" };
      }
      throw e;
    }
  }, { maxWait: 20000, timeout: 30000 });
}
