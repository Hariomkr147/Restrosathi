import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../db';
import { generateWeeklyReport, getPreviousWeekWindowIST } from './weekly';
import { getWhatsApp } from '../whatsapp';

describe('Weekly Report Generation', () => {
  beforeEach(async () => {
    await prisma.weeklyReportLog.deleteMany();
    await prisma.billLine.deleteMany();
    await prisma.bill.deleteMany();
    await prisma.diningSession.deleteMany();
    await prisma.restaurantTable.deleteMany();
    await prisma.user.deleteMany();
  });

  it('generates a report atomically only once for a given week', async () => {
    // Generate some fake bills within the previous week window
    const now = new Date();
    const { startAt, weekStart } = getPreviousWeekWindowIST(now);

    const user = await prisma.user.create({
      data: { name: "Test Staff", role: "STAFF" }
    });

    const session = await prisma.diningSession.create({
      data: { kind: "TAKEAWAY" }
    });

    await prisma.bill.create({
      data: {
        sessionId: session.id,
        docType: "BILL",
        taxMode: "NONE",
        gstRatePercent: 5,
        pricesIncludeTax: true,
        header: {},
        subtotalPaise: 10000,
        discountPaise: 0,
        taxableValuePaise: 10000,
        cgstPaise: 0,
        sgstPaise: 0,
        roundOffPaise: 0,
        totalPaise: 10000,
        generatedById: user.id,
        status: "SETTLED",
        generatedAt: startAt // explicitly inside the window
      }
    });

    // Run concurrently to test idempotency
    const p1 = generateWeeklyReport(now);
    const p2 = generateWeeklyReport(now);
    const p3 = generateWeeklyReport(now);

    const results = await Promise.all([p1, p2, p3]);
    
    // Only one should return a log, others should return null
    const successCount = results.filter(r => r !== null).length;
    expect(successCount).toBe(1);

    const logs = await prisma.weeklyReportLog.findMany();
    expect(logs.length).toBe(1);
    
    const content = logs[0].content as any;
    expect(content.orderCount).toBe(1);
    expect(content.revenuePaise).toBe(10000);
  });
});
