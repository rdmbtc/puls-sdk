import { PulsError, PulsPaymentRequiredError } from './errors';

export type Query = Record<string, string | number | boolean | undefined | null>;

export interface HttpConfig {
  baseUrl: string;
  token?: string;
  timeoutMs: number;
  fetchImpl: typeof fetch;
  headers: Record<string, string>;
}

function buildUrl(baseUrl: string, path: string, query?: Query): string {
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const url = new URL(path.replace(/^\//, ''), base);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export class Http {
  constructor(private cfg: HttpConfig) {}

  setToken(token?: string): void {
    this.cfg.token = token;
  }

  async request<T>(method: string, path: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
    const url = buildUrl(this.cfg.baseUrl, path, opts.query);
    const headers: Record<string, string> = { accept: 'application/json', ...this.cfg.headers };
    if (this.cfg.token) headers.authorization = `Bearer ${this.cfg.token}`;
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    let res: Response;
    try {
      res = await this.cfg.fetchImpl(url, { method, headers, body, signal: controller.signal });
    } catch (e) {
      clearTimeout(timer);
      const err = e as { name?: string; message?: string };
      if (err?.name === 'AbortError') {
        throw new PulsError(`Request timed out after ${this.cfg.timeoutMs}ms`, { url });
      }
      throw new PulsError(err?.message || 'Network error', { url });
    }
    clearTimeout(timer);

    const text = await res.text();
    let parsed: unknown = text;
    const ct = res.headers.get('content-type') || '';
    if (text && ct.includes('json')) {
      try {
        parsed = JSON.parse(text);
      } catch {
        /* leave as text */
      }
    }

    if (res.status === 402) throw new PulsPaymentRequiredError(parsed, url);
    if (!res.ok) {
      const b = parsed as { error?: string; message?: string } | undefined;
      const msg = b?.error || b?.message || `HTTP ${res.status}`;
      throw new PulsError(String(msg), { status: res.status, body: parsed, url });
    }
    return parsed as T;
  }

  get<T>(path: string, query?: Query): Promise<T> {
    return this.request<T>('GET', path, { query });
  }
  post<T>(path: string, body?: unknown, query?: Query): Promise<T> {
    return this.request<T>('POST', path, { body, query });
  }
  delete<T>(path: string, query?: Query): Promise<T> {
    return this.request<T>('DELETE', path, { query });
  }
}
