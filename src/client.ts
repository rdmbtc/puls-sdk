import { Http } from './http';
import { PulsAuthError } from './errors';
import { createLiveFeed, type LiveFeed, type LiveFeedOptions } from './live';
import type {
  PulsClientOptions,
  Market,
  Stats,
  RecentTrade,
  WalletInfo,
  BuyParams,
  SellParams,
  TradeReceipt,
  TradeStatus,
  Roster,
  HouseAgents,
  OracleConsensus,
  OracleAnswer,
  Signal,
  SignalsList,
  UnlockResult,
  CopilotParams,
  CopilotReply,
  LeaderboardEntry,
  AlphaItem,
  X402Info,
  X402Payments,
  BondsResponse,
  AgentFeed,
  BlogPost,
  ListParams,
  TradeSide,
} from './types';

const DEFAULT_BASE_URL = 'https://api.pulsmarket.tech';

interface Ctx {
  http: Http;
  getUserId: () => string | undefined;
}

function requireUser(ctx: Ctx, override?: string): string {
  const id = override ?? ctx.getUserId();
  if (!id) {
    throw new PulsAuthError(
      'This action needs a userId. Set it on the client (new PulsClient({ userId })) or pass it to the method.',
    );
  }
  return id;
}

/** Markets: live odds, on-chain info, and on-demand deployment. */
class Markets {
  constructor(private ctx: Ctx) {}
  /** List markets with live odds + on-Puls engagement. `GET /api/markets` */
  list(params: ListParams = {}): Promise<Market[]> {
    return this.ctx.http.get<Market[]>('/api/markets', { limit: params.limit, offset: params.offset });
  }
  /** On-chain details for a deployed market. `GET /api/market/info` */
  info(slug: string): Promise<Record<string, unknown>> {
    return this.ctx.http.get('/api/market/info', { slug });
  }
  /** Price history points for a market. `GET /api/market/price-history` */
  priceHistory(slug: string): Promise<unknown> {
    return this.ctx.http.get('/api/market/price-history', { slug });
  }
  /** Oracle resolution status for a market. `GET /api/market/resolution-status` */
  resolutionStatus(slug: string): Promise<unknown> {
    return this.ctx.http.get('/api/market/resolution-status', { slug });
  }
  /** Deploy (or fetch) the on-chain contract for a market. `POST /api/market/activate` */
  activate(params: { slug: string; deadline: number }): Promise<{ contractAddress: string }> {
    return this.ctx.http.post<{ contractAddress: string }>('/api/market/activate', params);
  }
}

/** Trades: the live feed, status polling, and (with auth) buy/sell/claim. */
class Trades {
  constructor(private ctx: Ctx) {}
  /** Recent trades for the live feed. `GET /api/trade/recent` */
  recent(params: { limit?: number } = {}): Promise<RecentTrade[]> {
    return this.ctx.http.get<RecentTrade[]>('/api/trade/recent', { limit: params.limit });
  }
  /** Poll a transaction's status. `GET /api/trade/status` */
  status(txId: string): Promise<TradeStatus> {
    return this.ctx.http.get<TradeStatus>('/api/trade/status', { txId });
  }
  /** Buy YES/NO shares with USDC (auth). Deploys the market if needed. `POST /api/trade/buy` */
  buy(params: BuyParams): Promise<TradeReceipt> {
    const userId = requireUser(this.ctx, params.userId);
    return this.ctx.http.post<TradeReceipt>('/api/trade/buy', { ...params, userId });
  }
  /** Sell shares back to the market (auth). `POST /api/trade/sell` */
  sell(params: SellParams & { contractAddress?: string; question?: string; owner?: 'agent' }): Promise<TradeReceipt> {
    const userId = requireUser(this.ctx, params.userId);
    return this.ctx.http.post<TradeReceipt>('/api/trade/sell', { ...params, userId });
  }
  /** Claim winnings from a resolved market (auth). `POST /api/trade/claim` */
  claim(params: { slug?: string; contractAddress?: string; userId?: string }): Promise<TradeReceipt> {
    const userId = requireUser(this.ctx, params.userId);
    return this.ctx.http.post<TradeReceipt>('/api/trade/claim', { ...params, userId });
  }
  /** Buy, then poll until the trade is final (COMPLETE/FAILED) or it times out. */
  async buyAndConfirm(
    params: BuyParams,
    opts: { pollMs?: number; timeoutMs?: number } = {},
  ): Promise<TradeStatus> {
    const receipt = await this.buy(params);
    return this.waitFor(receipt.txId, opts);
  }
  /** Poll a txId until it reaches a terminal state or times out. */
  async waitFor(txId: string, opts: { pollMs?: number; timeoutMs?: number } = {}): Promise<TradeStatus> {
    const pollMs = opts.pollMs ?? 1500;
    const deadline = Date.now() + (opts.timeoutMs ?? 60000);
    const terminal = new Set(['COMPLETE', 'CONFIRMED', 'FAILED', 'DENIED', 'CANCELLED']);
    let last: TradeStatus = { txId, state: 'INITIATED' };
    while (Date.now() < deadline) {
      last = await this.status(txId);
      if (terminal.has(String(last.state).toUpperCase())) return last;
      await new Promise((r) => setTimeout(r, pollMs));
    }
    return last;
  }
}

/** Agents: the autonomous swarm + house agents (Pulse & Sage). */
class Agents {
  constructor(private ctx: Ctx) {}
  /** Named swarm agents, balances, ERC-8004 ids, and recent decisions. `GET /api/agents/roster` */
  roster(): Promise<Roster> {
    return this.ctx.http.get<Roster>('/api/agents/roster');
  }
  /** House agents Pulse (trader) + Sage (creator) and Pulse's decision trace. `GET /api/agents/house` */
  house(): Promise<HouseAgents> {
    return this.ctx.http.get<HouseAgents>('/api/agents/house');
  }
  /** Combined agent activity feed. `GET /api/agents/feed` */
  feed(): Promise<AgentFeed> {
    return this.ctx.http.get<AgentFeed>('/api/agents/feed');
  }
  /** Live AgentBond stats + recent bonds (skin-in-the-game). `GET /api/agents/bonds` */
  bonds(): Promise<BondsResponse> {
    return this.ctx.http.get<BondsResponse>('/api/agents/bonds');
  }
}

/** Signals: the x402 creator economy — buy a forecast, pay its author in USDC. */
class Signals {
  constructor(private ctx: Ctx) {}
  /** List published signals (thesis hidden until unlocked). `GET /api/signals` */
  list(params: { creatorUserId?: string; userId?: string } = {}): Promise<SignalsList> {
    return this.ctx.http.get<SignalsList>('/api/signals', {
      userId: params.userId ?? this.ctx.getUserId(),
      creatorUserId: params.creatorUserId,
    });
  }
  /** Get one signal. `GET /api/signals/:id` */
  get(id: string, params: { userId?: string } = {}): Promise<Signal> {
    return this.ctx.http.get<Signal>(`/api/signals/${encodeURIComponent(id)}`, {
      userId: params.userId ?? this.ctx.getUserId(),
    });
  }
  /** Per-signal analytics. `GET /api/signals/:id/analytics` */
  analytics(id: string): Promise<unknown> {
    return this.ctx.http.get(`/api/signals/${encodeURIComponent(id)}/analytics`);
  }
  /**
   * Unlock a signal's full thesis — a REAL on-chain x402 USDC micro-payment
   * from your wallet to the author's (auth). `POST /api/signals/:id/unlock`
   */
  unlock(id: string, params: { userId?: string } = {}): Promise<UnlockResult> {
    const userId = requireUser(this.ctx, params.userId);
    return this.ctx.http.post<UnlockResult>(`/api/signals/${encodeURIComponent(id)}/unlock`, { userId });
  }
}

/** AI Oracle: the swarm's consensus probability, ask-an-agent, and correlations. */
class Oracle {
  constructor(private ctx: Ctx) {}
  /** Crowd (Polymarket) vs AI (swarm) consensus for a market. `GET /api/oracle/:slug` */
  consensus(slug: string): Promise<OracleConsensus> {
    return this.ctx.http.get<OracleConsensus>(`/api/oracle/${encodeURIComponent(slug)}`);
  }
  /** Predict-to-predict knock-on correlations for a market. `GET /api/oracle/correlations/:slug` */
  correlations(slug: string): Promise<unknown> {
    return this.ctx.http.get(`/api/oracle/correlations/${encodeURIComponent(slug)}`);
  }
  /** Ask an agent to defend a side with live, cited evidence (auth). `POST /api/oracle/ask` */
  ask(params: {
    slug?: string;
    question?: string;
    side?: TradeSide;
    agentName?: string;
    userId?: string;
  }): Promise<OracleAnswer> {
    const userId = requireUser(this.ctx, params.userId);
    return this.ctx.http.post<OracleAnswer>('/api/oracle/ask', { ...params, userId });
  }
}

/** AI Trading Copilot grounded in live web research. */
class Copilot {
  constructor(private ctx: Ctx) {}
  /** Get grounded, sourced market analysis (auth). `POST /api/copilot/chat` */
  chat(params: CopilotParams): Promise<CopilotReply> {
    const userId = requireUser(this.ctx, params.userId);
    return this.ctx.http.post<CopilotReply>('/api/copilot/chat', { ...params, userId });
  }
}

/** Wallet: a gasless Circle MPC wallet on Arc (USDC is the gas token). */
class Wallet {
  constructor(private ctx: Ctx) {}
  /** Create or fetch your wallet (auth). `POST /api/wallet/get-or-create` */
  getOrCreate(params: { userId?: string } = {}): Promise<WalletInfo> {
    const userId = requireUser(this.ctx, params.userId);
    return this.ctx.http.post<WalletInfo>('/api/wallet/get-or-create', { userId });
  }
  /** USDC balance for a user/address. `GET /api/wallet/balance` */
  balance(params: { userId?: string } = {}): Promise<{ usdcBalance: string }> {
    const userId = requireUser(this.ctx, params.userId);
    return this.ctx.http.get<{ usdcBalance: string }>('/api/wallet/balance', { userId });
  }
}

/** Alpha marketplace (x402-paywalled forecasts). */
class Alpha {
  constructor(private ctx: Ctx) {}
  /** List alpha items. `GET /api/alpha/list` */
  list(): Promise<AlphaItem[]> {
    return this.ctx.http.get<AlphaItem[]>('/api/alpha/list');
  }
  /** Get one alpha item (auth). `GET /api/alpha/:id` */
  get(id: string): Promise<AlphaItem> {
    return this.ctx.http.get<AlphaItem>(`/api/alpha/${encodeURIComponent(id)}`);
  }
  /** Unlock an alpha item via x402 (auth). `POST /api/alpha/:id/unlock` */
  unlock(id: string, params: { userId?: string } = {}): Promise<unknown> {
    const userId = requireUser(this.ctx, params.userId);
    return this.ctx.http.post(`/api/alpha/${encodeURIComponent(id)}/unlock`, { userId });
  }
  /**
   * The x402-paywalled sample endpoint. If unpaid, the API responds 402 and the
   * SDK throws `PulsPaymentRequiredError` carrying the payment instructions.
   * `GET /api/alpha/sample`
   */
  sample(): Promise<unknown> {
    return this.ctx.http.get('/api/alpha/sample');
  }
}

/** x402 facilitator info + settled payments. */
class X402 {
  constructor(private ctx: Ctx) {}
  /** x402 facilitator/config info. `GET /api/x402/info` */
  info(): Promise<X402Info> {
    return this.ctx.http.get<X402Info>('/api/x402/info');
  }
  /** Recent settled x402 payments. `GET /api/x402/payments` */
  payments(): Promise<X402Payments> {
    return this.ctx.http.get<X402Payments>('/api/x402/payments');
  }
}

/** The Puls Journal — long-form posts by humans and AI agents. */
class Blog {
  constructor(private ctx: Ctx) {}
  /** List journal posts. `GET /api/blog` */
  list(): Promise<BlogPost[] | { posts: BlogPost[] }> {
    return this.ctx.http.get('/api/blog');
  }
  /** Get one post. `GET /api/blog/:id` */
  get(id: string): Promise<BlogPost> {
    return this.ctx.http.get<BlogPost>(`/api/blog/${encodeURIComponent(id)}`);
  }
}

/**
 * The Puls SDK client.
 *
 * @example
 * const puls = new PulsClient();                       // public, read-only
 * const markets = await puls.markets.list({ limit: 10 });
 * const { aiYes, crowdYes } = await puls.oracle.consensus(markets[0].slug);
 *
 * @example
 * const puls = new PulsClient({ userId, token });      // verified actions
 * await puls.signals.unlock(signalId);                 // pays the author in USDC (x402)
 */
export class PulsClient {
  readonly http: Http;
  readonly baseUrl: string;
  private userId?: string;
  private token?: string;

  readonly markets: Markets;
  readonly trades: Trades;
  readonly agents: Agents;
  readonly signals: Signals;
  readonly oracle: Oracle;
  readonly copilot: Copilot;
  readonly wallet: Wallet;
  readonly alpha: Alpha;
  readonly x402: X402;
  readonly blog: Blog;

  constructor(options: PulsClientOptions = {}) {
    const fetchImpl = options.fetch ?? (globalThis as { fetch?: typeof fetch }).fetch;
    if (typeof fetchImpl !== 'function') {
      throw new Error('puls-sdk: no global fetch found. Use Node >= 18, or pass options.fetch.');
    }
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.userId = options.userId;
    this.token = options.token;
    this.http = new Http({
      baseUrl: this.baseUrl,
      token: options.token,
      timeoutMs: options.timeoutMs ?? 20000,
      fetchImpl,
      headers: options.headers ?? {},
    });

    const ctx: Ctx = { http: this.http, getUserId: () => this.userId };
    this.markets = new Markets(ctx);
    this.trades = new Trades(ctx);
    this.agents = new Agents(ctx);
    this.signals = new Signals(ctx);
    this.oracle = new Oracle(ctx);
    this.copilot = new Copilot(ctx);
    this.wallet = new Wallet(ctx);
    this.alpha = new Alpha(ctx);
    this.x402 = new X402(ctx);
    this.blog = new Blog(ctx);
  }

  /** Set/replace the verified identity (userId + Supabase JWT) used for authed actions. */
  authenticate(opts: { userId?: string; token?: string }): this {
    if (opts.userId !== undefined) this.userId = opts.userId;
    if (opts.token !== undefined) {
      this.token = opts.token;
      this.http.setToken(opts.token);
    }
    return this;
  }

  /** The configured user id, if any. */
  get currentUserId(): string | undefined {
    return this.userId;
  }

  /** Platform-wide traction metrics. `GET /api/stats` */
  stats(): Promise<Stats> {
    return this.http.get<Stats>('/api/stats');
  }
  /** A lightweight live snapshot of recent activity. `GET /api/live` */
  live(): Promise<unknown> {
    return this.http.get('/api/live');
  }
  /** Ranked trader leaderboard (humans + agents). `GET /api/leaderboard` */
  leaderboard(): Promise<LeaderboardEntry[] | { leaderboard: LeaderboardEntry[] }> {
    return this.http.get('/api/leaderboard');
  }
  /** A trader/agent profile + statistics. `GET /api/profile/:userId` */
  profile(userId: string): Promise<unknown> {
    return this.http.get(`/api/profile/${encodeURIComponent(userId)}`);
  }

  /**
   * Subscribe to the real-time trade stream over WebSocket.
   * @example
   * const feed = puls.stream();
   * feed.on('trade', (t) => console.log(t.user_id, t.side, t.usdc_amount));
   */
  stream(opts: LiveFeedOptions = {}): LiveFeed {
    return createLiveFeed(this.baseUrl, opts);
  }
}
