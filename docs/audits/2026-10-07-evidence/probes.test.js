// Audit probes assert observed defects, not acceptance. No network or database is used.
import { beforeEach, expect, it, vi } from 'vitest';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';

const mocks = vi.hoisted(() => ({
  prisma: {
    settings: { findUnique: vi.fn() },
    alertState: { findUnique: vi.fn() },
    menuItem: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  checks: vi.fn(), place: vi.fn(), settings: vi.fn(), provider: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/monitoring/checks', () => ({ runChecks: mocks.checks }));
vi.mock('@/lib/whatsapp/notify', () => ({ internalSendSystemAlert: vi.fn() }));
vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }));
vi.mock('@/lib/orders/place', () => ({ placeOrder: mocks.place }));
vi.mock('@/lib/device', () => ({ getDeviceId: async () => 'audit-device' }));
vi.mock('@/lib/settings', () => ({ getSettings: mocks.settings }));
vi.mock('@/lib/audit', () => ({ audit: vi.fn() }));
vi.mock('@/lib/ai/usage', () => ({ consumeDeviceQuota: async () => true, consumeMonthlyQuota: async () => true }));
vi.mock('@/lib/ai/index', () => ({ getProvider: () => ({ complete: mocks.provider }) }));

import { GET as alerts } from '../../../src/app/api/cron/alerts/route.ts';
import { POST as orders } from '../../../src/app/api/t/[code]/orders/route.ts';
import { generateBill } from '../../../src/lib/billing/generate.ts';
import { askMenuAssistant } from '../../../src/lib/ai/assistant.ts';
import { checkPreflight } from '../../../scripts/preflight-checks.ts';
import { EncryptStream, DecryptStream } from '../../../scripts/backup/crypto.ts';
import { bookableSlots } from '../../../src/lib/bookings/slots.ts';

beforeEach(() => vi.clearAllMocks());

it('reproduces unauthenticated alerts health disclosure', async () => {
  mocks.prisma.settings.findUnique.mockResolvedValue({ ownerAlertPhone: null });
  mocks.prisma.alertState.findUnique.mockResolvedValue(null);
  mocks.checks.mockResolvedValue([{ key: 'backup', ok: true, detail: 'internal backup status' }]);
  const response = await alerts(new Request('http://localhost/api/cron/alerts'));
  expect(response.status).toBe(200);
  expect((await response.json()).results[0].detail).toBe('internal backup status');
});

it('reproduces substring origin bypass in order route', async () => {
  mocks.place.mockResolvedValue({ ok: false, error: 'INVALID_INPUT' });
  const response = await orders(new Request('https://restaurant.example/api/t/A/orders', {
    method: 'POST', headers: { host: 'restaurant.example', origin: 'https://restaurant.example.attacker.example' }, body: '{}',
  }));
  expect(response.status).toBe(200);
  expect(mocks.place).toHaveBeenCalledOnce();
});

it('reproduces lack of 100 KB public JSON cap', async () => {
  mocks.place.mockResolvedValue({ ok: false, error: 'INVALID_INPUT' });
  const response = await orders(new Request('http://localhost:3000/api/t/A/orders', {
    method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
    body: JSON.stringify({ padding: 'x'.repeat(110000) }),
  }));
  expect(response.status).toBe(200);
  expect(mocks.place.mock.calls[0][0].padding.length).toBe(110000);
});

it('reproduces recalculation dropping loyalty discount while retaining point debit', async () => {
  const update = vi.fn();
  const tx = {
    diningSession: { findUnique: async () => ({ id: 's', status: 'OPEN', customerPhone: null,
      bill: { id: 'b', status: 'OPEN', customerPhone: '+919876543210', phoneVerifiedAt: new Date(), loyaltyPointsRedeemed: 100, loyaltyDiscountPaise: 5000 },
      orders: [{ status: 'SERVED', lines: [{ qty: 1, unitPricePaise: 20000, nameSnapshot: { en: 'Dish' }, modifiersSnapshot: [] }] }],
    }) },
    bill: { update }, billLine: { deleteMany: vi.fn(), createMany: vi.fn() },
  };
  mocks.prisma.$transaction.mockImplementation(fn => fn(tx));
  mocks.settings.mockResolvedValue({ name: 'Demo', taxMode: 'NONE', gstRatePercent: 0, pricesIncludeTax: true });
  await generateBill('s', { customerPhone: '+919876543210' }, { id: 'owner', role: 'OWNER' });
  const data = update.mock.calls[0][0].data;
  expect(data).toMatchObject({ totalPaise: 20000, discountPaise: 0, loyaltyPointsRedeemed: 100, loyaltyDiscountPaise: 5000 });
  expect(data.phoneVerifiedAt).toBeInstanceOf(Date);
});

it('reproduces zero price supplied to AI for a base-priced dish', async () => {
  mocks.prisma.menuItem.findMany.mockResolvedValue([{ id: 'dal', name: { en: 'Dal' }, basePricePaise: 18000, variants: [], isVeg: true }]);
  mocks.provider.mockResolvedValue({ text: JSON.stringify({ reply: 'Dal', itemIds: ['dal'] }) });
  const result = await askMenuAssistant({ question: 'what is good', deviceId: 'd', locale: 'en' });
  expect(result.items[0].pricePaise).toBe(0);
});

it('reproduces passing preflight with fake override and missing restaurant contact/hours', () => {
  const env = { NODE_ENV: 'production', APP_URL: 'https://example.invalid', ALLOW_FAKE_WA: '1',
    BACKUP_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
    CRON_SECRET: 'x'.repeat(32), OTP_SECRET: 'x'.repeat(32), COOKIE_SECRET: 'x'.repeat(32), WA_WEBHOOK_SECRET: 'x'.repeat(32) };
  const results = checkPreflight({ env, settings: { name: 'Restaurant', taxMode: 'NONE', taxModeConfirmedAt: new Date() },
    users: [{ role: 'OWNER', passwordHash: 'not-a-real-hash' }], tables: [{}], itemCount: 5, lastBackup: { at: new Date() } });
  expect(results.every(r => r.ok)).toBe(true);
});

it('reproduces broken notification parameter contracts', async () => {
  const { renderMessage } = await vi.importActual('../../../src/lib/whatsapp/notify.ts');
  expect(() => renderMessage('OTP', { code: '123456', minutes: 10 })).toThrow('Missing parameter otp');
  expect(() => renderMessage('BOOKING_RECEIVED', { name: 'Test', partySize: '2', time: '11:00', cancelLink: 'https://example.invalid/cancel/x' })).toThrow('Missing parameter date');
  expect(() => renderMessage('AUTO_REPLY', { text: 'Hello' })).toThrow('Missing parameter answer');
});

it('reproduces booking day and time drift on a UTC server', () => {
  const previous = process.env.TZ;
  process.env.TZ = 'UTC';
  try {
    const hours = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => [day, [{ open: '11:00', close: '23:00' }]]));
    const slots = bookableSlots('2026-10-08', hours, Date.parse('2026-10-01T00:00:00Z'), { bookingCutoffMinutes: 60 }, []);
    expect(slots[0].toISOString()).toBe('2026-10-07T11:00:00.000Z');
    expect(slots[0].toISOString()).not.toBe('2026-10-08T05:30:00.000Z');
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

async function transform(input, stream) {
  const output = [];
  await pipeline(Readable.from([input]), stream, new Writable({ write(chunk, encoding, cb) { output.push(chunk); cb(); } }));
  return Buffer.concat(output);
}

it('reproduces unauthenticated backup chunk reordering', async () => {
  const key = Buffer.alloc(32, 3).toString('base64');
  const size = 1024 * 1024;
  const original = Buffer.concat([Buffer.alloc(size, 'a'), Buffer.alloc(size, 'b')]);
  const encrypted = await transform(original, new EncryptStream(key));
  const header = Buffer.from('RS_BACKUP\x01').length;
  const frame = 4 + 12 + size + 16;
  const reordered = Buffer.concat([encrypted.subarray(0, header), encrypted.subarray(header + frame, header + 2 * frame),
    encrypted.subarray(header, header + frame), encrypted.subarray(header + 2 * frame)]);
  const decrypted = await transform(reordered, new DecryptStream(key));
  const expected = Buffer.concat([Buffer.alloc(size, 'b'), Buffer.alloc(size, 'a')]);
  expect(createHash('sha256').update(decrypted).digest('hex')).toBe(createHash('sha256').update(expected).digest('hex'));
});
