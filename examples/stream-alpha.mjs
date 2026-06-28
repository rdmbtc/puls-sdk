// Pay-per-second on Arc: rent a creator's live alpha feed by the second (RFB 4).
// One authorization (a rate + a cap), a proof-of-flow heartbeat, batched USDC
// settlement — then tap stop. Needs a verified Puls identity.
// Run: PULS_USER_ID=... PULS_TOKEN=... node examples/stream-alpha.mjs <recipientUserId>
import { PulsClient } from '@pulsmarket/sdk';

const puls = new PulsClient({
  userId: process.env.PULS_USER_ID,
  token: process.env.PULS_TOKEN,
});

// 0) What does streaming cost / is live settlement on?
const cfg = await puls.streams.config();
console.log('streams:', cfg.model, '· live:', cfg.live);

// 1) Authorize a stream: $0.001/sec, capped at $0.10. The recipient is another
//    user/agent (e.g. a creator selling a live feed). One signature authorizes
//    the RATE — not each per-second payment.
const recipientUserId = process.argv[2] || process.env.PULS_RECIPIENT_ID;
if (!recipientUserId) throw new Error('pass a recipientUserId (a creator/agent to pay)');

// 2) `run` keeps a proof-of-flow heartbeat going and taps stop once we've
//    extracted ~$0.05 of value (or the cap is hit), then final-settles on-chain.
const final = await puls.streams.run(
  { recipientUserId, resource: 'live-alpha', ratePerSecUsdc: 0.001, capUsdc: 0.1 },
  { everyMs: 2000, shouldStop: (s) => s.accruedUsdc >= 0.05 },
);

console.log(
  `done · ${final.status} · streamed $${final.accruedUsdc} · settled $${final.settledUsdc}` +
  (final.settleTx ? ` · tx ${final.settleTx}` : ''),
);
