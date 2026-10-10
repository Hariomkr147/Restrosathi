import { prisma } from "../db";

export async function runRetention({ now = new Date() }: { now?: Date } = {}) {
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoIso = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twentyFourMonthsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

  const [otp, rate, login, auth, msg, ai, errorLog] = await Promise.all([
    prisma.otpCode.deleteMany({ where: { createdAt: { lt: oneDayAgo } } }),
    prisma.rateHit.deleteMany({ where: { at: { lt: twoDaysAgo } } }),
    prisma.loginAttempt.deleteMany({ where: { at: { lt: oneDayAgo } } }),
    prisma.authSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.messageLog.deleteMany({ where: { createdAt: { lt: twentyFourMonthsAgo } } }),
    prisma.aiDeviceUsage.deleteMany({ where: { day: { lt: thirtyDaysAgoIso } } }),
    prisma.errorLog.deleteMany({ where: { at: { lt: thirtyDaysAgo } } }),
  ]);

  return {
    otpCodes: otp.count,
    rateHits: rate.count,
    loginAttempts: login.count,
    authSessions: auth.count,
    messageLogs: msg.count,
    aiDeviceUsage: ai.count,
    errorLogs: errorLog.count,
  };
}
