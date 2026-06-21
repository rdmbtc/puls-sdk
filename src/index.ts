import { PulsClient } from './client';
import type { PulsClientOptions } from './types';

export { PulsClient };
export { PulsError, PulsPaymentRequiredError, PulsAuthError } from './errors';
export type { LiveFeed, LiveFeedOptions } from './live';
export * from './types';

/** Convenience factory — same as `new PulsClient(options)`. */
export function createPuls(options?: PulsClientOptions): PulsClient {
  return new PulsClient(options);
}
