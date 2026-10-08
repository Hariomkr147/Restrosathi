import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPreviousWeekWindowIST } from './weekly';

describe('Weekly Report - Date Boundaries', () => {
  it('computes prev week correctly when on Monday at 08:59 IST', () => {
    // 2026-10-12 is a Monday. 08:59 IST is 03:29 UTC.
    const now = new Date('2026-10-12T03:29:00.000Z');
    const window = getPreviousWeekWindowIST(now);
    
    // Previous week should be Monday 2026-10-05 to Sunday 2026-10-11
    expect(window.startAt.toISOString()).toBe('2026-10-04T18:30:00.000Z'); // 2026-10-05T00:00:00+05:30
    expect(window.endAt.toISOString()).toBe('2026-10-11T18:29:59.999Z'); // 2026-10-11T23:59:59.999+05:30
    expect(window.weekStart.toISOString()).toBe('2026-10-05T00:00:00.000Z');
  });

  it('computes prev week correctly when on Monday at 09:00 IST', () => {
    // 2026-10-12 is a Monday. 09:00 IST is 03:30 UTC.
    const now = new Date('2026-10-12T03:30:00.000Z');
    const window = getPreviousWeekWindowIST(now);
    
    // Still the same previous week
    expect(window.startAt.toISOString()).toBe('2026-10-04T18:30:00.000Z');
    expect(window.endAt.toISOString()).toBe('2026-10-11T18:29:59.999Z');
    expect(window.weekStart.toISOString()).toBe('2026-10-05T00:00:00.000Z');
  });

  it('computes prev week correctly when on Sunday', () => {
    // 2026-10-11 is a Sunday. 12:00 IST is 06:30 UTC.
    const now = new Date('2026-10-11T06:30:00.000Z');
    const window = getPreviousWeekWindowIST(now);
    
    // Previous week should be Monday 2026-09-28 to Sunday 2026-10-04
    expect(window.startAt.toISOString()).toBe('2026-09-27T18:30:00.000Z');
    expect(window.endAt.toISOString()).toBe('2026-10-04T18:29:59.999Z');
    expect(window.weekStart.toISOString()).toBe('2026-09-28T00:00:00.000Z');
  });
  
  it('computes prev week correctly across month and year boundaries', () => {
    // 2027-01-01 is a Friday.
    const now = new Date('2027-01-01T06:30:00.000Z'); // 12:00 IST
    const window = getPreviousWeekWindowIST(now);
    
    // Previous week is Monday 2026-12-21 to Sunday 2026-12-27
    expect(window.startAt.toISOString()).toBe('2026-12-20T18:30:00.000Z');
    expect(window.endAt.toISOString()).toBe('2026-12-27T18:29:59.999Z');
    expect(window.weekStart.toISOString()).toBe('2026-12-21T00:00:00.000Z');
  });
});
