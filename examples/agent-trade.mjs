// Authenticated agent: wallet, a confirmed trade, and an x402 signal unlock.
// Needs a verified Puls identity (Supabase userId + JWT).
// Run: PULS_USER_ID=... PULS_TOKEN=... node examples/agent-trade.mjs
import { PulsClient, PulsError } from '@pulsmarket/sdk';

const puls = new PulsClient({
  userId: process.env.PULS_USER_ID,
  token: process.env.PULS_TOKEN,
});

// 1) Gasless Circle wallet on Arc (USDC is the gas token)
const wallet = await puls.wallet.getOrCreate();
console.log('wallet', wallet.address, '· balance', wallet.usdcBalance, 'USDC');

// 2) Pick a market and buy YES with $0.50, then wait for on-chain finality
const [market] = await puls.markets.list({ limit: 1 });
try {
  const res = await puls.trades.buyAndConfirm({
    slug: market.slug,
    deadline: market.deadline ?? Math.floor(Date.now() / 1000) + 7 * 86400,
    side: 'YES',
    usdcAmount: 0.5,
  });
  console.log('trade', res.txId, '→', res.state, res.txHash ?? '');
} catch (e) {
  if (e instanceof PulsError) console.log('trade failed:', e.message);
}

// 3) Buy a forecast from another author/agent — a real USDC nanopayment (x402)
const { signals } = await puls.signals.list();
if (signals.length) {
  const unlocked = await puls.signals.unlock(signals[0].id);
  console.log('unlocked signal thesis:', unlocked.signal.thesis ?? '(none)');
}
