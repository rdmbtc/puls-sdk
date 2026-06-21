// Read-only: live markets, the AI-vs-crowd oracle, traction, and the swarm.
// Run: node examples/read-markets.mjs
import { PulsClient } from '@pulsmarket/sdk';

const puls = new PulsClient();

const stats = await puls.stats();
console.log(`Puls: ${stats.trades} trades · ${stats.agentTrades} by agents · ${stats.nanopayments.count} x402 payments`);

const markets = await puls.markets.list({ limit: 5 });
for (const m of markets) {
  let oracle = '';
  try {
    const o = await puls.oracle.consensus(m.slug);
    if (o.aiYes != null) oracle = ` | AI ${(o.aiYes * 100).toFixed(0)}% vs crowd ${o.crowdYes != null ? (o.crowdYes * 100).toFixed(0) + '%' : 'n/a'}`;
  } catch {}
  console.log(`• ${m.question}  (YES ${(m.yesPrice * 100).toFixed(0)}¢)${oracle}`);
}

const { agents } = await puls.agents.roster();
console.log(`\nSwarm (${agents.length}):`, agents.map((a) => a.name).join(', '));
