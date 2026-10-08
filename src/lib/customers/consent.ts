/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma as db } from "../db";
import { ConsentSource } from "@prisma/client";

export const MARKETING_CONSENT_TEXT_VERSION = "marketing-v1";

export async function recordConsent(
  customerId: string,
  granted: boolean,
  source: ConsentSource,
  actorId?: string,
  tx: import("@prisma/client").Prisma.TransactionClient = db
) {
  return await tx.consentRecord.create({
    data: {
      customerId,
      purpose: "MARKETING",
      granted,
      textVersion: MARKETING_CONSENT_TEXT_VERSION,
      source,
      actorId,
    },
  });
}

export async function hasMarketingConsent(customerId: string) {
  const latest = await db.consentRecord.findFirst({
    where: { customerId, purpose: "MARKETING" },
    orderBy: { at: "desc" },
  });
  return latest?.granted === true;
}

export async function getMarketingAudience() {
  // latest consent granted, not in OptOut, phone valid
  // since prisma doesn't support 'distinct on' or complex lateral joins well without raw sql, we'll use a raw query or do two passes.
  // Actually, we can fetch customers who have at least one MARKETING granted, then filter by latest record. Or we just use raw SQL.
  
  const query = `
    SELECT c.* 
    FROM "Customer" c
    LEFT JOIN "OptOut" o ON c.phone = o.phone
    WHERE o.phone IS NULL
      AND c.phone IS NOT NULL
      AND c.phone NOT LIKE '%deleted%'
      AND EXISTS (
        SELECT 1 
        FROM "ConsentRecord" cr 
        WHERE cr."customerId" = c.id 
          AND cr.purpose = 'MARKETING'
        ORDER BY cr.at DESC 
        LIMIT 1
      )
      AND (
        SELECT cr.granted 
        FROM "ConsentRecord" cr 
        WHERE cr."customerId" = c.id 
          AND cr.purpose = 'MARKETING'
        ORDER BY cr.at DESC 
        LIMIT 1
      ) = true
  `;

  return await db.$queryRawUnsafe<any[]>(query);
}
