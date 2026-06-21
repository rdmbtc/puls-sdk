/** Base error for any non-2xx Puls API response or transport failure. */
export class PulsError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly url: string;
  constructor(message: string, opts: { status?: number; body?: unknown; url?: string } = {}) {
    super(message);
    this.name = 'PulsError';
    this.status = opts.status ?? 0;
    this.body = opts.body;
    this.url = opts.url ?? '';
  }
}

/**
 * Thrown on HTTP 402 from an x402-paywalled endpoint (e.g. GET /api/alpha/sample).
 * `accepts` carries the payment instructions returned by the facilitator so an
 * agent can settle the nanopayment and retry.
 */
export class PulsPaymentRequiredError extends PulsError {
  readonly accepts: unknown;
  constructor(body: unknown, url: string) {
    super('Payment required (x402)', { status: 402, body, url });
    this.name = 'PulsPaymentRequiredError';
    this.accepts = (body as { accepts?: unknown })?.accepts ?? body;
  }
}

/** Thrown when a request needs a Supabase token/userId that wasn't configured. */
export class PulsAuthError extends PulsError {
  constructor(message: string) {
    super(message, { status: 401 });
    this.name = 'PulsAuthError';
  }
}
