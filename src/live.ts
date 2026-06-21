import type { RecentTrade } from './types';

export interface LiveFeedOptions {
  /**
   * WebSocket implementation. Defaults to the global `WebSocket`
   * (browsers, Bun, Deno, Node >= 21). On Node < 21 pass the `ws` package:
   *   import WebSocket from 'ws';
   *   puls.stream({ WebSocketImpl: WebSocket });
   */
  WebSocketImpl?: unknown;
  /** Auto-reconnect with exponential backoff. Default: true. */
  reconnect?: boolean;
  /** Max reconnect delay in ms. Default: 15000. */
  maxReconnectMs?: number;
}

type TradeHandler = (trade: RecentTrade) => void;
type ErrorHandler = (err: Error) => void;
type VoidHandler = () => void;

export interface LiveFeed {
  /** A new trade was broadcast. */
  on(event: 'trade', cb: TradeHandler): LiveFeed;
  /** Socket opened / closed. */
  on(event: 'open' | 'close', cb: VoidHandler): LiveFeed;
  /** Transport or parse error. */
  on(event: 'error', cb: ErrorHandler): LiveFeed;
  /** Stop listening and close the socket (disables reconnect). */
  close(): void;
}

export function createLiveFeed(baseUrl: string, opts: LiveFeedOptions = {}): LiveFeed {
  const WS = (opts.WebSocketImpl ?? (globalThis as { WebSocket?: unknown }).WebSocket) as
    | (new (url: string) => WebSocketLike)
    | undefined;
  if (typeof WS !== 'function') {
    throw new Error(
      'puls-sdk: no WebSocket implementation found. In Node < 21 pass { WebSocketImpl } from the "ws" package.',
    );
  }
  const Ctor: new (url: string) => WebSocketLike = WS;

  const wsUrl = baseUrl.replace(/^http/i, 'ws');
  const reconnect = opts.reconnect !== false;
  const maxReconnectMs = opts.maxReconnectMs ?? 15000;

  const handlers = {
    trade: [] as TradeHandler[],
    open: [] as VoidHandler[],
    close: [] as VoidHandler[],
    error: [] as ErrorHandler[],
  };

  let ws: WebSocketLike | null = null;
  let closed = false;
  let delay = 1000;

  const emitError = (e: unknown) => {
    const err = e instanceof Error ? e : new Error(String((e as { message?: string })?.message ?? e));
    handlers.error.forEach((h) => h(err));
  };

  function scheduleReconnect() {
    if (closed || !reconnect) return;
    setTimeout(connect, delay);
    delay = Math.min(maxReconnectMs, delay * 2);
  }

  function connect() {
    if (closed) return;
    try {
      ws = new Ctor(wsUrl);
    } catch (e) {
      emitError(e);
      scheduleReconnect();
      return;
    }
    ws.onopen = () => {
      delay = 1000;
      handlers.open.forEach((h) => h());
    };
    ws.onmessage = (ev: { data?: unknown }) => {
      try {
        const raw = typeof ev.data === 'string' ? ev.data : String((ev.data as { toString?: () => string })?.toString?.() ?? '');
        if (!raw) return;
        const trade = JSON.parse(raw) as RecentTrade;
        handlers.trade.forEach((h) => h(trade));
      } catch (e) {
        emitError(e);
      }
    };
    ws.onerror = (ev: { message?: string }) => emitError(new Error(ev?.message || 'WebSocket error'));
    ws.onclose = () => {
      handlers.close.forEach((h) => h());
      scheduleReconnect();
    };
  }

  connect();

  const feed: LiveFeed = {
    on(event: 'trade' | 'open' | 'close' | 'error', cb: unknown): LiveFeed {
      (handlers[event] as unknown[]).push(cb);
      return feed;
    },
    close() {
      closed = true;
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    },
  };
  return feed;
}

interface WebSocketLike {
  onopen: (() => void) | null;
  onmessage: ((ev: { data?: unknown }) => void) | null;
  onerror: ((ev: { message?: string }) => void) | null;
  onclose: (() => void) | null;
  close(): void;
}
