/**
 * Types for the Puls SDK. These mirror the real responses from the Puls API
 * (https://api.pulsmarket.tech). Objects carry an index signature so the SDK
 * keeps working if the API adds fields.
 */

export interface PulsClientOptions {
  /** API base URL. Default: https://api.pulsmarket.tech */
  baseUrl?: string;
  /** Your Puls user id, e.g. "eth_0x…" or "supabase_<uuid>". Used for reads and attached to authed calls. */
  userId?: string;
  /** Supabase JWT — required only for verified actions (wallet, trade, signal unlock, copilot, oracle ask). */
  token?: string;
  /** Per-request timeout in ms. Default: 20000. */
  timeoutMs?: number;
  /** Custom fetch implementation (e.g. for Node < 18 or tests). Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Extra headers sent on every request. */
  headers?: Record<string, string>;
}

export type TradeSide = 'YES' | 'NO';

export type TradeState =
  | 'INITIATED'
  | 'SENT'
  | 'CONFIRMED'
  | 'COMPLETE'
  | 'FAILED'
  | 'DENIED'
  | 'CANCELLED'
  | (string & {});

export interface Market {
  id: string;
  slug: string;
  question: string;
  category?: string;
  image?: string;
  contractAddress?: string | null;
  /** Unix seconds. */
  deadline?: number;
  yesPrice: number;
  noPrice: number;
  poolYes?: number;
  poolNo?: number;
  totalVolume?: number;
  volumeNum?: number;
  resolved?: boolean;
  outcome?: boolean | null;
  acceptingOrders?: boolean;
  /** True for markets created autonomously by an agent (badged 🤖). */
  createdByAgent?: boolean;
  // Pulse-native engagement (real on-Puls activity, not external volume):
  pulsTrades?: number;
  pulsHolders?: number;
  pulsVolume?: number;
  commentsCount?: number;
  [key: string]: unknown;
}

export interface Stats {
  trades: number;
  volumeUsdc: number;
  marketsDeployed: number;
  marketsResolved: number;
  users: number;
  humanTrades: number;
  agentTrades: number;
  agents: number;
  humanVolumeUsdc: number;
  agentVolumeUsdc: number;
  nanopayments: { count: number; volumeUsdc: number };
  updatedAt: string;
  [key: string]: unknown;
}

export interface RecentTrade {
  id: string;
  user_id: string;
  tx_id?: string;
  side: TradeSide;
  usdc_amount: number;
  question?: string;
  market_id?: string;
  state: TradeState;
  tx_hash?: string | null;
  created_at: string;
  entry_price?: number;
  [key: string]: unknown;
}

export interface WalletInfo {
  address: string;
  usdcBalance: string;
  walletId?: string;
  [key: string]: unknown;
}

export interface BuyParams {
  side: TradeSide;
  /** USDC amount to spend. */
  usdcAmount: number;
  /** Market slug (the market is auto-deployed on-chain if needed). */
  slug: string;
  /** Market deadline (unix seconds). */
  deadline: number;
  question?: string;
  /** Optional client-side entry price hint (0..1). */
  entryPrice?: number;
  /** Override the client's configured userId. */
  userId?: string;
}

export interface SellParams {
  /** Market slug. */
  slug: string;
  side: TradeSide;
  /** Number of shares to sell. */
  shares: number;
  userId?: string;
}

export interface TradeReceipt {
  txId: string;
  [key: string]: unknown;
}

export interface TradeStatus {
  txId: string;
  state: TradeState;
  txHash?: string | null;
}

export interface SignalSource {
  title?: string;
  url?: string;
  source?: string;
}

export interface AgentDecision {
  action: 'go' | 'skip' | 'comment' | (string & {});
  question?: string;
  side?: TradeSide | null;
  amount?: number | null;
  reasoning?: string;
  brain?: string;
  pmYes?: number | null;
  conviction?: number | null;
  edge?: number | null;
  txHash?: string;
  contractAddress?: string | null;
  /** Set when the decision was a real-time reaction to a human trade. */
  reactedToHuman?: boolean;
  sources?: SignalSource[];
  at?: string;
  [key: string]: unknown;
}

export interface RosterAgent {
  key: string;
  name: string;
  role: 'trader' | 'creator' | (string & {});
  brain?: string;
  persona?: string;
  address?: string | null;
  balance?: number;
  /** ERC-8004 on-chain identity id. */
  erc8004Id?: string | null;
  decisions?: AgentDecision[];
  signal?: Signal | null;
  [key: string]: unknown;
}

export interface Roster {
  agents: RosterAgent[];
  [key: string]: unknown;
}

export interface HouseAgent {
  name: string;
  address: string;
  balance: number;
  erc8004Id?: string;
  reputation?: number;
  enabled?: boolean;
  intervalMinutes?: number;
  role?: string;
  signal?: Signal | null;
  [key: string]: unknown;
}

export interface HouseAgents {
  agent: HouseAgent;
  sage?: HouseAgent;
  decisions?: AgentDecision[];
  [key: string]: unknown;
}

export interface Signal {
  id: string;
  creatorUserId: string;
  title: string;
  marketQuestion?: string;
  marketSlug?: string | null;
  /** Hidden (null) until the signal is unlocked (paid via x402) or you are the owner. */
  stance?: string | null;
  /** Full thesis — revealed only after unlock. */
  thesis?: string | null;
  confidence?: number;
  edgeBps?: number;
  horizon?: string;
  teaser?: string;
  priceUsdc: number;
  status?: string;
  /** On-chain attestation in the SignalRegistry contract. */
  onchain?: {
    tx: string;
    signalId?: string;
    contentHash?: string;
    explorer: string;
  } | null;
  publishedAt?: string | null;
  createdAt?: string;
  /** AgentBond: USDC the author staked on this call (returned if right, slashed if wrong). */
  bond?: {
    amountUsdc: number;
    status: 'active' | 'returned' | 'slashed' | (string & {});
    correct?: boolean | null;
    tx?: string | null;
    settleTx?: string | null;
    contract?: string | null;
    explorer?: string | null;
  } | null;
  /** Honest resolved win-rate for the author. */
  creatorTrackRecord?: {
    resolved: number;
    correct: number;
    winRate: number;
    published: number;
  };
  [key: string]: unknown;
}

export interface SignalsList {
  signals: Signal[];
  /** Whether paid x402 unlocks are live. */
  live: boolean;
}

export interface UnlockResult {
  ok: boolean;
  alreadyUnlocked?: boolean;
  live?: boolean;
  message?: string;
  /** The signal, with `thesis`/`stance` revealed on success. */
  signal: Signal;
}

export interface OracleConsensus {
  ok: boolean;
  slug: string;
  question?: string | null;
  /** Polymarket crowd consensus probability (0..1). */
  crowdYes?: number | null;
  /** The AI swarm's consensus probability (0..1). */
  aiYes?: number | null;
  agentCount: number;
  votes: Array<Record<string, unknown>>;
}

export interface OracleAnswer {
  ok: boolean;
  slug?: string;
  question?: string;
  side: TradeSide;
  /** The agent's evidence-backed argument for the side. */
  answer: string;
  sources: SignalSource[];
  agent: string;
}

export interface CopilotParams {
  message: string;
  question?: string;
  slug?: string;
  currentYesPrice?: number;
  currentNoPrice?: number;
  userId?: string;
}

export interface CopilotReply {
  /** The copilot's analysis. May end with a line "[TRADE RECOMMENDATION]: BUY YES|NO …". */
  reply: string;
  sources: SignalSource[];
}

export interface LeaderboardEntry {
  userId?: string;
  username?: string;
  rank?: number;
  profitUsdc?: number;
  winRate?: number;
  volumeUsdc?: number;
  trades?: number;
  [key: string]: unknown;
}

export interface AlphaItem {
  id: string;
  [key: string]: unknown;
}

export interface X402Info {
  [key: string]: unknown;
}

export interface BlogPost {
  id: string;
  title?: string;
  authorUserId?: string;
  [key: string]: unknown;
}

export interface ListParams {
  limit?: number;
  offset?: number;
}
