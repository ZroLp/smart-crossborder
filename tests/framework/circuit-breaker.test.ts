import {
  CircuitBreaker,
  CircuitOpenError,
  CircuitState,
} from '@/lib/ai/circuit-breaker';

function failingFn(spy: jest.Mock): () => Promise<string> {
  return async () => {
    spy();
    throw new Error('upstream boom');
  };
}

afterEach(() => {
  jest.useRealTimers();
});

describe('CircuitBreaker', () => {
  describe('state transitions', () => {
    test('starts closed and reports not protected', () => {
      const breaker = new CircuitBreaker();
      expect(breaker.getState()).toBe('closed');
      expect(breaker.protected()).toBe(false);
    });

    test('goes closed -> open after failureThreshold consecutive failures', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 5, cooldownMs: 10_000 });
      const calls = jest.fn();
      for (let i = 0; i < 5; i += 1) {
        await expect(breaker.run(failingFn(calls))).rejects.toThrow('upstream boom');
      }
      expect(breaker.getState()).toBe('open');
      expect(calls).toHaveBeenCalledTimes(5);
    });

    test('a single success resets the failure counter and closes the circuit', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 10_000 });
      // One failure below threshold keeps it closed; a success clears the count.
      await breaker.run(failingFn(jest.fn())).catch(() => undefined);
      expect(breaker.getState()).toBe('closed');
      await expect(breaker.run(async () => 'ok')).resolves.toBe('ok');
      expect(breaker.getState()).toBe('closed');
    });

    test('half-open probe succeeds -> closed (deterministic via fake timers)', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(Date.parse('2026-01-01T00:00:00Z'));
      const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 60_000 });

      breaker.recordFailure(); // trips open at t=0
      expect(breaker.getState()).toBe('open');

      jest.advanceTimersByTime(60_000); // cooldown elapses -> half-open probe allowed
      await expect(breaker.run(async () => 'recovered')).resolves.toBe('recovered');
      expect(breaker.getState()).toBe('closed');
    });

    test('half-open probe fails -> back to open (deterministic via fake timers)', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(Date.parse('2026-01-01T00:00:00Z'));
      const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 60_000 });

      breaker.recordFailure(); // open
      jest.advanceTimersByTime(60_000); // half-open probe
      await breaker.run(failingFn(jest.fn())).catch(() => undefined);
      expect(breaker.getState()).toBe('open');
    });
  });

  describe('run() short-circuit', () => {
    test('does not invoke fn and rejects with CircuitOpenError while open (cooldown not elapsed)', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 60_000 });
      await breaker.run(failingFn(jest.fn())).catch(() => undefined);
      expect(breaker.getState()).toBe('open');

      const probe = jest.fn();
      await expect(breaker.run(probe)).rejects.toThrow(CircuitOpenError);
      expect(probe).not.toHaveBeenCalled();
    });

    test('protected() is true while hard-open, false once a probe is allowed (fake timers)', () => {
      jest.useFakeTimers();
      jest.setSystemTime(Date.parse('2026-01-01T00:00:00Z'));
      const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 60_000 });

      breaker.recordFailure();
      expect(breaker.protected()).toBe(true); // hard-open, cooldown not elapsed
      expect(breaker.getState()).toBe('open');

      jest.advanceTimersByTime(60_000); // cooldown elapses
      expect(breaker.protected()).toBe(false); // transitioned to half-open
      expect(breaker.getState()).toBe('half-open');
    });
  });

  describe('reset()', () => {
    test('clears an open breaker back to a clean closed state', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 60_000 });
      await breaker.run(failingFn(jest.fn())).catch(() => undefined);
      expect(breaker.getState()).toBe('open');

      breaker.reset();
      expect(breaker.getState()).toBe('closed');
      expect(breaker.protected()).toBe(false);
      await expect(breaker.run(async () => 'fine')).resolves.toBe('fine');
    });
  });

  describe('CircuitState type surface', () => {
    test('exposes the documented state literals', () => {
      const states: CircuitState[] = ['closed', 'open', 'half-open'];
      expect(states).toEqual(['closed', 'open', 'half-open']);
    });
  });
});
