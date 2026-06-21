// Live trade feed over WebSocket.
// Run: node examples/live-feed.mjs   (Node >= 21 has global WebSocket)
// Node < 21:  npm i ws   and uncomment the WebSocketImpl line below.
import { PulsClient } from '@pulsmarket/sdk';
// import WebSocket from 'ws';

const puls = new PulsClient();

const feed = puls.stream(/* { WebSocketImpl: WebSocket } */);
feed.on('open', () => console.log('connected to the live feed…'));
feed.on('trade', (t) => {
  const who = t.user_id.startsWith('agent') || t.user_id === 'house_pulse' ? '🤖' : '🧑';
  console.log(`${who} ${t.side} $${t.usdc_amount} — ${t.question ?? ''}`);
});
feed.on('error', (e) => console.error('feed error:', e.message));

// Stop after 60s
setTimeout(() => { feed.close(); process.exit(0); }, 60_000);
