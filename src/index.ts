/**
 * whereq.cloud — official JavaScript/TypeScript SDK for the WhereQ data cloud.
 *
 * A thin, typed wrapper over the versioned `/v1` HTTP API at `api.whereq.cloud`.
 * Public endpoints work with no key; metered endpoints take an API key.
 *
 * ```ts
 * import { Whereq } from "whereq.cloud";
 *
 * const wq = new Whereq();                          // public access
 * // const wq = new Whereq({ apiKey: "wq_live_…" }); // metered tier
 *
 * await wq.costOfLiving("us:California,ca:Ontario");
 * await wq.prices({ domain: "rent", region: "us", bedrooms: 2 });
 * await wq.get("/v1/trending", { limit: 10 });       // escape hatch
 * ```
 */
export const VERSION = "0.1.0";
const DEFAULT_BASE_URL = "https://api.whereq.cloud";

export class WhereqError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly url: string,
  ) {
    super(`whereq.cloud API error ${status} for ${url}: ${message}`);
    this.name = "WhereqError";
  }
}

export interface ClientOptions {
  /** `wq_live_…` key for metered endpoints (sent as `X-API-Key`). */
  apiKey?: string;
  /** Override the API base (default `https://api.whereq.cloud`). */
  baseUrl?: string;
  /** Custom fetch (e.g. for Node <18 or testing). Defaults to global `fetch`. */
  fetch?: typeof fetch;
}

type Params = Record<string, unknown>;

export class Whereq {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly _fetch: typeof fetch;

  constructor(opts: ClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.headers = { Accept: "application/json" };
    if (opts.apiKey) this.headers["X-API-Key"] = opts.apiKey;
    const f = opts.fetch ?? globalThis.fetch;
    if (!f) throw new Error("No global fetch available — pass `fetch` in options (Node <18).");
    this._fetch = f;
  }

  private url(path: string, params: Params): string {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    }
    const s = qs.toString();
    return `${this.baseUrl}${path}${s ? `?${s}` : ""}`;
  }

  /** GET any endpoint; `undefined`/`null` params are dropped. Returns parsed JSON. */
  async get<T = unknown>(path: string, params: Params = {}): Promise<T> {
    const url = this.url(path, params);
    const res = await this._fetch(url, { headers: this.headers });
    if (!res.ok) {
      let msg = res.statusText;
      try {
        const j = (await res.json()) as { detail?: string };
        msg = j?.detail || JSON.stringify(j) || msg;
      } catch {
        /* non-JSON error body */
      }
      throw new WhereqError(res.status, msg, url);
    }
    return (await res.json()) as T;
  }

  /** GET a non-JSON endpoint (e.g. CSV export) as text. */
  async getText(path: string, params: Params = {}): Promise<string> {
    const url = this.url(path, params);
    const res = await this._fetch(url, { headers: this.headers });
    if (!res.ok) throw new WhereqError(res.status, res.statusText, url);
    return res.text();
  }

  // -- prices / cost of living ------------------------------------------------
  prices(p: { domain?: string; region?: string; bedrooms?: number; q?: string; limit?: number; offset?: number } = {}) {
    return this.get("/v1/prices", p);
  }
  price(seriesId: number) {
    return this.get(`/v1/prices/${seriesId}`);
  }
  pricesCsv(p: { domain?: string; region?: string; bedrooms?: number; q?: string } = {}) {
    return this.getText("/v1/prices/export", p);
  }
  /** Compare cost of living across US states / CA provinces / metros.
   *  `places`: comma-separated `region:name` or `m:<rent-series-id>`. */
  costOfLiving(places: string) {
    return this.get("/v1/cost-of-living", { places });
  }

  // -- discovery / facets -----------------------------------------------------
  catalog() { return this.get("/v1/catalog"); }
  categories() { return this.get("/v1/categories"); }
  regions() { return this.get("/v1/regions"); }
  domains() { return this.get("/v1/domains"); }
  trending(p: Params = {}) { return this.get("/v1/trending", p); }

  // -- finance ----------------------------------------------------------------
  hotstocks(limit = 20) { return this.get("/v1/hotstocks", { limit }); }
  quotes(p: Params = {}) { return this.get("/v1/quotes", p); }
  news(p: Params = {}) { return this.get("/v1/news", p); }
  screener(p: Params = {}) { return this.get("/v1/screener", p); }
  search(q: string, p: Params = {}) { return this.get("/v1/search", { q, ...p }); }

  // -- autos ------------------------------------------------------------------
  autosRecalls(p: Params = {}) { return this.get("/v1/autos/recalls", p); }
  autosListings(p: Params = {}) { return this.get("/v1/autos/listings", p); }
  autosFuelEconomy(p: Params = {}) { return this.get("/v1/autos/fuel-economy", p); }
  autosModels(p: Params = {}) { return this.get("/v1/autos/models", p); }
}

export default Whereq;
