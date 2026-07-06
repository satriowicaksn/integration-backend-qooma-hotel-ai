import { describe, expect, it } from '@jest/globals';

import { applyDebounce } from '../channel-health.debounce.js';
import type { ProbeResult } from '../channel-health.types.js';

const OK: ProbeResult = { ok: true, latencyMs: 42 };
const FAIL: ProbeResult = { ok: false, error: 'timeout' };

describe('applyDebounce — success paths', () => {
  it('should stay healthy when previous was healthy and probe ok', () => {
    expect(applyDebounce('healthy', OK)).toEqual({
      nextStatus: 'healthy',
      previousStatus: 'healthy',
      didTransition: false,
    });
  });

  it('should recover to healthy when previous was degraded and probe ok', () => {
    expect(applyDebounce('degraded', OK)).toEqual({
      nextStatus: 'healthy',
      previousStatus: 'degraded',
      didTransition: true,
    });
  });

  it('should recover to healthy when previous was down and probe ok', () => {
    expect(applyDebounce('down', OK)).toEqual({
      nextStatus: 'healthy',
      previousStatus: 'down',
      didTransition: true,
    });
  });

  it('should transition to healthy on first ever probe when probe ok', () => {
    expect(applyDebounce(null, OK)).toEqual({
      nextStatus: 'healthy',
      previousStatus: null,
      didTransition: true,
    });
  });
});

describe('applyDebounce — failure progression (2-poll debounce spec §4.8)', () => {
  it('should transition healthy → degraded on first consecutive failure', () => {
    expect(applyDebounce('healthy', FAIL)).toEqual({
      nextStatus: 'degraded',
      previousStatus: 'healthy',
      didTransition: true,
    });
  });

  it('should transition degraded → down on second consecutive failure', () => {
    expect(applyDebounce('degraded', FAIL)).toEqual({
      nextStatus: 'down',
      previousStatus: 'degraded',
      didTransition: true,
    });
  });

  it('should stay down when previous was down and probe fails again', () => {
    expect(applyDebounce('down', FAIL)).toEqual({
      nextStatus: 'down',
      previousStatus: 'down',
      didTransition: false,
    });
  });

  it('should transition to degraded on first ever probe when probe fails', () => {
    expect(applyDebounce(null, FAIL)).toEqual({
      nextStatus: 'degraded',
      previousStatus: null,
      didTransition: true,
    });
  });
});

describe('applyDebounce — flap protection sequence', () => {
  it('should follow healthy → degraded → down → healthy on the "recover after outage" sequence', () => {
    const t1 = applyDebounce('healthy', FAIL);
    expect(t1.nextStatus).toBe('degraded');
    const t2 = applyDebounce(t1.nextStatus, FAIL);
    expect(t2.nextStatus).toBe('down');
    const t3 = applyDebounce(t2.nextStatus, OK);
    expect(t3.nextStatus).toBe('healthy');
    expect(t3.didTransition).toBe(true);
  });

  it('should NOT flap to down on a single flap between healthy pings', () => {
    const t1 = applyDebounce('healthy', FAIL);
    expect(t1.nextStatus).toBe('degraded');
    const t2 = applyDebounce(t1.nextStatus, OK);
    expect(t2.nextStatus).toBe('healthy');
    expect(t2.didTransition).toBe(true);
  });
});
