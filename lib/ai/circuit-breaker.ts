export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Consecutive failures that trip the breaker from closed to open. Default 5. */
  failureThreshold?: number;
  /** How long the breaker stays open before allowing a half-open probe. Default 60000ms. */
  cooldownMs?: number;
  /** How many probe attempts to allow in the half-open state. Default 1. */
  halfOpenMaxAttempts?: number;
}

/** Thrown by {@link CircuitBreaker.run} when the circuit is open and the call is short-circuited. */
export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

/**
 * A small failure-counting circuit breaker with closed / open / half-open
 * states. When the breaker is open and the cooldown has not elapsed, {@link
 * CircuitBreaker.run} short-circuits (rejects with {@link CircuitOpenError})
 * without invoking the callback, so callers degrade to their fallback path.
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private lastFailureAt = 0;
  private halfOpenAttempts = 0;
  readonly failureThreshold: number;
  readonly cooldownMs: number;
  readonly halfOpenMaxAttempts: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 60_000;
    this.halfOpenMaxAttempts = options.halfOpenMaxAttempts ?? 1;
  }

  /** Current state (closed / open / half-open). Read-only view for tests/inspection. */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Whether the circuit is currently "protected" (hard-open, i.e. calls should
   * be short-circuited). If the cooldown has elapsed, transitions open to
   * half-open and reports not-protected (a probe is allowed).
   */
  protected(): boolean {
    if (this.state === 'open' && Date.now() - this.lastFailureAt >= this.cooldownMs) {
      this.state = 'half-open';
      this.halfOpenAttempts = 0;
    }
    return this.state === 'open';
  }

  /** Record a successful call: clears failures and closes the circuit. */
  recordSuccess(): void {
    this.failures = 0;
    this.halfOpenAttempts = 0;
    this.state = 'closed';
  }

  /**
   * Record a failed call: increments the failure counter and opens the circuit
   * once the threshold is reached (immediately in the half-open state).
   */
  recordFailure(): void {
    this.failures += 1;
    this.lastFailureAt = Date.now();
    if (this.state === 'half-open') {
      this.state = 'open';
    } else if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  /**
   * Run `fn` through the breaker. When the circuit is open and the cooldown
   * has not elapsed, rejects with {@link CircuitOpenError} without calling
   * `fn`. In the half-open state a bounded number of probe attempts are
   * allowed; a probe success closes the circuit, a probe failure re-opens it.
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailureAt;
      if (elapsed < this.cooldownMs) {
        throw new CircuitOpenError(
          `Circuit breaker is open (retry in ${this.cooldownMs - elapsed}ms)`
        );
      }
      // Cooldown elapsed: begin a half-open probe.
      this.state = 'half-open';
      this.halfOpenAttempts = 0;
    }

    if (this.state === 'half-open') {
      if (this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
        this.state = 'open';
        this.lastFailureAt = Date.now();
        throw new CircuitOpenError('Circuit breaker probe budget exhausted');
      }
      this.halfOpenAttempts += 1;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /** Reset to a clean closed state. Intended for tests. */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailureAt = 0;
    this.halfOpenAttempts = 0;
  }
}
