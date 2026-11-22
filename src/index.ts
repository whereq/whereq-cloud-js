/**
 * whereq.cloud — official JavaScript/TypeScript SDK for the WhereQ data cloud.
 *
 * A thin, typed wrapper over the versioned `/v1` HTTP API at `api.whereq.cloud`.
 * Public endpoints work with no key; metered endpoints take an API key.
 *
 * ```ts
 * import { Whereq } from "@whereq/cloud";
 *
 * const wq = new Whereq();                          // public access
 * // const wq = new Whereq({ apiKey: "wq_live_…" }); // metered tier
 *
 * await wq.costOfLiving("us:California,ca:Ontario");
 * await wq.prices({ domain: "rent", region: "us", bedrooms: 2 });
 * await wq.get("/v1/trending", { limit: 10 });       // escape hatch
 * ```
 */
import pkg from "../package.json";

/**
 * The SDK version, read straight from `package.json` so it can never drift
 * from what is published. The release tooling bumps `package.json`; this
 * follows it.
 */
export const VERSION = pkg.version;

const DEFAULT_BASE_URL = "https://api.whereq.cloud";

/** The products a station can quote. Mexico's CRE feed carries the first,
 *  second and fourth; GasBuddy (US/Canada) adds midgrade. */
export const FUEL_PRODUCTS = ["regular", "midgrade", "premium", "diesel"] as const;
export type FuelProduct = (typeof FUEL_PRODUCTS)[number];

/** Countries with station-level fuel data. */
export const FUEL_COUNTRIES = ["MX", "US", "CA"] as const;
export type FuelCountry = (typeof FUEL_COUNTRIES)[number];

/** The unit each country quotes in — always local currency per litre. */
export const FUEL_CURRENCIES: Record<FuelCountry, string> = {
  MX: "MXN/L",
  US: "USD/L",
  CA: "CAD/L",
};

/** One product's latest price at a station. */
export interface FuelStationPrice {
  price: number;
  observed_at: string;
}

/** A geolocated retail fuel station.
 *  `state` is the human label ("Ontario", "Texas"); `state_iso` is the
 *  two-letter code ("ON", "TX"). */
export interface FuelStation {
  id: number;
  source: string;
  ext_id: string;
  country: string;
  name: string;
  brand?: string | null;
  state?: string | null;
  state_iso?: string | null;
  municipality?: string | null;
  lat?: number | null;
  lon?: number | null;
  /** The latest price per product — present on the *list* endpoint. The
   *  *detail* endpoint omits it: its timeline comes back as the separate
   *  `prices` array on the response. */
  prices?: Record<string, FuelStationPrice>;
}

/** Filters for `fuelStations()`. */
export interface FuelStationsParams {
  /** "MX", "US" or "CA". */
  country?: FuelCountry | string;
  /** State/province name *or* ISO code — "Ontario"/"ON", "Texas"/"TX". */
  state?: string;
  /** City name, e.g. "Mississauga". */
  municipality?: string;
  product?: FuelProduct | string;
  /** "minLon,minLat,maxLon,maxLat" — a map viewport. */
  bbox?: string;
  /** Station-name search. */
  q?: string;
  /** 1–500 rows per page (default 100). */
  limit?: number;
  /** Row offset for paging. */
  offset?: number;
}

/** Filters for `fuelStation()`. */
export interface FuelStationParams {
  /** Restrict the timeline to one product. */
  product?: FuelProduct | string;
  /** How far back the timeline reaches (1–1825, default 90). */
  days?: number;
}

/** `GET /v1/fuel/stations`. Unentitled callers get a 100-row preview of the
 *  oldest rows: `demo` is true, `total` is null and paging is ignored. */
export interface FuelStationsResponse {
  demo?: boolean;
  preview_rows?: number;
  note?: string;
  upgrade_url?: string;
  as_of: string;
  count: number;
  total?: number | null;
  stations: FuelStation[];
}

/** One observed price change — the intra-day timeline for a station. */
export interface FuelStationPricePoint {
  product: string;
  observed_at: string;
  price: number;
}

/** `GET /v1/fuel/stations/{id}`. `days` is null in the unentitled preview. */
export interface FuelStationDetail {
  demo?: boolean;
  preview_rows?: number;
  note?: string;
  upgrade_url?: string;
  station: FuelStation;
  days?: number | null;
  prices: FuelStationPricePoint[];
}

/** Filters for `fuelPrices()`. */
export interface FuelPricesParams {
  /** Region slug, or a comma-separated list of them ("us,ca"). */
  region?: string;
  /** Free-text place name ("Calgary, Alberta"). */
  geo?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

/** One aggregated price series (state / national / metro). */
export interface PriceSeries {
  id: number;
  domain: string;
  source: string;
  region?: string | null;
  geo?: string | null;
  item: string;
  item_cn?: string | null;
  unit?: string | null;
  unit_cn?: string | null;
  frequency?: string | null;
  latest_period?: string | null;
  latest_value?: number | null;
  prev_value?: number | null;
  points?: number | null;
  spark?: number[];
}

/** `GET /v1/prices` — a page of series plus the page's own metadata. */
export interface PriceSeriesResponse {
  count: number;
  domain?: string | null;
  region?: string | null;
  limit: number;
  offset: number;
  data: PriceSeries[];
}

// -- geography (places, boundaries, hierarchy) ---------------------------------

/** One place — a province, a municipality, a ward, a neighbourhood.
 *
 *  `kind` is the platform's own concept (`province`, `region`,
 *  `municipality`, `city`, `town`, `ward`, `neighbourhood`…), not the
 *  source's admin level. `country_code` is the two-letter ISO code and is
 *  the same for both vocabularies — a country filter accepts `CA` or
 *  `CAN` and answers with the same places either way.
 */
export interface GeoPlace {
  uid: string;
  kind: string;
  kind_source: string;
  name: string;
  name_en?: string | null;
  name_zh?: string | null;
  name_local?: string | null;
  official_name?: string | null;
  source: string;
  source_id: string;
  source_url?: string | null;
  license?: string | null;
  raw_admin_level?: number | null;
  raw_place?: string | null;
  raw_boundary?: string | null;
  country_code?: string | null;
  province_code?: string | null;
  iso_code?: string | null;
  ref?: string | null;
  population?: number | null;
  population_date?: string | null;
  wikidata?: string | null;
  wikipedia?: string | null;
  website?: string | null;
  capital?: string | null;
  centroid_lon?: number | null;
  centroid_lat?: number | null;
  bbox_min_lon?: number | null;
  bbox_min_lat?: number | null;
  bbox_max_lon?: number | null;
  bbox_max_lat?: number | null;
  area_km2?: number | null;
  has_boundary: boolean;
}

export interface GeoPlaceList {
  count: number;
  data: GeoPlace[];
  limit: number;
  offset: number;
}

/** One container of a place, as the detail endpoint lists them.
 *
 *  A place has SEVERAL parents — a neighbourhood is in a ward, in a city,
 *  in a census division and in a province, all at once. The list is
 *  deliberately a list.
 */
export interface GeoParent {
  uid: string;
  kind: string;
  name: string;
  source: string;
  area_ratio?: number | null;
  is_primary: boolean;
}

/** One place with its containers and the places inside it. */
export interface GeoPlaceDetail {
  uid: string;
  place: GeoPlace;
  parents: GeoParent[];
  children: GeoParent[];
}

/** One concept in the vocabulary, with a live count behind it. */
export interface GeoConcept {
  kind: string;
  name: string;
  name_cn?: string | null;
  description?: string | null;
  description_cn?: string | null;
  places: number;
  with_boundary: number;
  rank: number;
}

/** The vocabulary, explained. */
export interface GeoConceptList {
  count: number;
  concepts: GeoConcept[];
  sources: Array<Record<string, unknown>>;
}

/** Two places of DIFFERENT kinds covering the same ground.
 *
 *  This is the deliberate part of the dataset: a census subdivision and
 *  an OpenStreetMap city boundary that describe the same town in two
 *  vocabularies. The platform keeps both rather than picking one.
 */
export interface GeoOverlap {
  a_id: number;
  b_id: number;
  a_uid: string;
  b_uid: string;
  a_name: string;
  b_name: string;
  a_kind: string;
  b_kind: string;
  a_source: string;
  b_source: string;
  overlap_ratio: number;
  a_concept: string;
  b_concept: string;
}

/** The overlapping pairs inside a box. */
export interface GeoOverlapList {
  bbox: Record<string, number>;
  min_ratio: number;
  count: number;
  overlaps: GeoOverlap[];
}

/** One place in the containing stack at a point.
 *
 *  `country_code` is on every level, so the stack can be read without a
 *  second lookup.
 */
export interface GeoAtPlace {
  uid: string;
  kind: string;
  kind_source: string;
  name: string;
  name_en?: string | null;
  name_zh?: string | null;
  source: string;
  /** The attribution link. ODbL 1.0 and CC-BY 4.0 both require it, and it
   *  travels with the shape. */
  source_url?: string | null;
  license?: string | null;
  raw_admin_level?: number | null;
  raw_place?: string | null;
  population?: number | null;
  wikidata?: string | null;
  centroid_lon?: number | null;
  centroid_lat?: number | null;
  area_km2?: number | null;
  country_code?: string | null;
  province_code?: string | null;
  boundary_area_km2?: number | null;
  concept?: Record<string, unknown>;
}

/** Every place containing a point, broadest first: country, province,
 *  region, municipality, city, ward, neighbourhood. The answer to "where
 *  am I?" without pretending one of them is *the* answer. */
export interface GeoAtResponse {
  lon: number;
  lat: number;
  count: number;
  places: GeoAtPlace[];
}

/** A place's outline as GeoJSON — a FeatureCollection you can hand
 *  straight to a map library. */
export interface GeoBoundary {
  type: string;
  features: Array<Record<string, unknown>>;
}

/** One outline from `GET /v1/geo/boundaries`.
 *
 *  `license` and `source_url` are the attribution the open licences
 *  require, and they travel with the row.
 */
export interface GeoBoundaryItem {
  uid: string;
  name: string;
  kind: string;
  source: string;
  source_url?: string | null;
  license?: string | null;
  area_km2?: number | null;
  centroid_lon?: number | null;
  centroid_lat?: number | null;
  simplified_m: number;
  /** A GeoJSON geometry — a Polygon or a MultiPolygon. */
  geometry: Record<string, unknown>;
}

/** Every outline in a viewport — and whether the answer was truncated.
 *
 *  `count` is how many outlines matched the filters; `truncated` says
 *  whether the limit cut the answer short. A client that draws polygons
 *  must be able to tell "that is all of them" from "that is the first
 *  two hundred", or it will draw a map with holes in it.
 */
export interface GeoBoundaryList {
  count: number;
  truncated: boolean;
  limit: number;
  items: GeoBoundaryItem[];
}

export interface GeoPlacesParams {
  kind?: string;
  source?: string;
  country?: string;
  q?: string;
  bbox?: string;
  has_boundary?: boolean;
  limit?: number;
  offset?: number;
}

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

/* -- local (news, events, stories, places) -------------------------------- */

/** One item from a local feed — a story, an event, a notice. */
export interface LocalContent {
  id: number;
  type: string;
  category?: string | null;
  title: string;
  summary?: string | null;
  description?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  url?: string | null;
  publish_time?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  geocode_status?: string | null;
  confidence_score?: number | null;
  status: string;
  expires_at?: string | null;
  tags?: string[];
}

/** One point of interest. */
export interface LocalPlace {
  id: number;
  source: string;
  source_url?: string | null;
  license?: string | null;
  external_id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  category?: string | null;
  kind?: string | null;
  metadata?: Record<string, unknown>;
}

/** One configured local feed. */
export interface LocalSource {
  slug: string;
  name: string;
  kind: string;
  url?: string | null;
  default_type?: string | null;
  default_city?: string | null;
  default_province?: string | null;
  default_country?: string | null;
  enabled: boolean;
  crawl_interval_minutes: number;
}

/** The page envelope every list endpoint uses. */
export interface Page<T> {
  data: T[];
  pagination: {
    limit: number;
    count: number;
    /** The keyset routes (`/v1/local/content`) hand out a cursor. */
    next_cursor?: string | null;
    /** The offset-paged routes (`/v1/schools`) hand out the offset the next
     *  page starts at — an integer, not a cursor, so it can be passed
     *  straight back as `offset`. */
    next_offset?: number | null;
    offset?: number;
  };
}

/* -- schools ---------------------------------------------------------------- */

/** One school board. */
export interface SchoolBoard {
  slug: string;
  name: string;
  type?: string | null;
  region?: string | null;
  /** The province code, e.g. `ON`. */
  province?: string | null;
  school_count: number;
}

/**
 * One school.
 *
 * The `hs_*` fields are **present only when the API key holds the
 * `school_licensed` scope**. Without it they are absent — not null — so a
 * caller can tell "you are not entitled to this" from "there is no value
 * here".
 */
export interface SchoolSummary {
  /**
   * The platform's own row id.
   *
   * **Not an identifier** — the `uid` is — but the join key for the
   * migration: whereq.com's school rows carry the same integers, because
   * the import preserved them. It changes if the dataset is reloaded.
   */
  id: number;
  uid: string;
  name: string;
  type?: string | null;
  status?: string | null;
  province?: string | null;
  /**
   * The **board's** region — `York Region`, `Toronto`.
   *
   * This is what the `region` filter matches. The school row's own
   * `region` column holds a denormalised province name and is not served.
   */
  region?: string | null;
  city?: string | null;
  municipality?: string | null;
  board?: SchoolBoard | null;
  latitude?: number | null;
  longitude?: number | null;
  grade_range?: string | null;
  /**
   * The programme **codes** (`french_immersion`), not the labels.
   *
   * The code is what the `program` filter takes and what the taxonomy
   * lists as its `id`; the labels are in the taxonomy.
   */
  programs: string[];
  has_boundary: boolean;
  source?: string | null;
  source_url?: string | null;
  license?: string | null;
  hs_score?: number | null;
  hs_rank?: number | null;
  hs_rank_total?: number | null;
  hs_school_type?: string | null;
}

/** One school's yearly assessment snapshot. Licensed. */
export interface SchoolScores {
  uid: string;
  year: number;
  rank?: number | null;
  rank_total?: number | null;
  rank_score?: number | null;
  avg_exam_mark?: number | null;
  year_label?: string | null;
  source?: string | null;
  eqao: Array<{
    grade: number;
    year_mark?: string | null;
    rank?: number | null;
    total?: number | null;
    last5_avg?: number | null;
  }>;
}

/** One school, with its contact block. `scores` needs `school_licensed`. */
export interface SchoolDetail extends SchoolSummary {
  address?: string | null;
  phone?: string | null;
  phone2?: string | null;
  fax?: string | null;
  website_url?: string | null;
  boundary_pdf_url?: string | null;
  principal?: string | null;
  feeder_schools?: Record<string, unknown> | null;
  extra?: Record<string, unknown> | null;
  scores?: SchoolScores[];
  // The licensed block — present only with the `school_licensed` scope.
  /** HouseSigma's own name for the school. */
  hs_name?: string | null;
  /** HouseSigma's own label for the kind of board — `Public` or `Catholic`. */
  hs_board_type?: string | null;
  hs_score_year?: number | null;
  hs_score_average?: number | null;
  hs_rank_year?: number | null;
}

/** A school's catchment outline. Licensed. */
export interface SchoolBoundary {
  uid: string;
  name: string;
  geometry?: { type: string; coordinates: unknown } | null;
  polygon_count: number;
  point_count: number;
  source?: string | null;
  source_url?: string | null;
  license?: string | null;
}

/** One catchment covering a queried point. Licensed. */
export interface CatchmentHit {
  uid: string;
  name: string;
  type?: string | null;
  /** The board the school belongs to. */
  board?: string | null;
  /** Which of the school's polygons this is — a catchment can be split. */
  polygon_index: number;
  distance_m?: number | null;
}

/** The school vocabulary and the headline counts.
 *
 * The whole vocabulary comes in one call.
 */
export interface SchoolTaxonomy {
  boards: SchoolBoard[];
  types: Array<{ id: string; name: string; count: number }>;
  /** The programmes, as `{ id: <code>, name: <label> }`. */
  program_categories: Array<{ id: string; name: string; count: number }>;
  /** The provinces, by code. The *names* come from the geography feed. */
  provinces: Array<{ id: string; name: string; count: number }>;
  /** The boards' own regions, each with its province. */
  regions: Array<{ id: string; name: string; province: string | null; count: number }>;
  /** The boards' own types — public, catholic, private. */
  board_types: Array<{ id: string; name: string; count: number }>;
  /** The headline counts, with the breakdowns by province, board type and
   *  school type. */
  stats: Record<string, unknown>;
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

/** The API key from the environment, when there is one. */
function envApiKey(): string {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.WHEREQ_API_KEY ?? "";
}

export class Whereq {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly _fetch: typeof fetch;

  constructor(opts: ClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.headers = { Accept: "application/json" };
    // The key may come from the options or the environment, in that order.
    const key = opts.apiKey ?? envApiKey();
    if (key) this.headers["X-API-Key"] = key;
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
  /** Cost-of-living price series (fuel | food | energy | housing | rent).
   *  `region` takes a region slug or a comma-separated list ("us,ca");
   *  `geo` is a free-text place name ("Calgary, Alberta"). */
  prices(p: { domain?: string; region?: string; geo?: string; bedrooms?: number; q?: string; limit?: number; offset?: number } = {}): Promise<PriceSeriesResponse> {
    return this.get<PriceSeriesResponse>("/v1/prices", p);
  }
  price(seriesId: number) {
    return this.get(`/v1/prices/${seriesId}`);
  }
  pricesCsv(p: { domain?: string; region?: string; geo?: string; bedrooms?: number; q?: string } = {}) {
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

  // -- lottery -----------------------------------------------------------------
  /** Recent lottery draws, newest first.
   *
   *  Unentitled callers get the oldest 100 draws instead of the recent
   *  ones — check `response.demo`.
   */
  lotteryDraws(p: { game?: string; days?: number; limit?: number } & Params = {}): Promise<any> {
    return this.get("/v1/lottery/draws", p);
  }
  /** The most recent draw for a game. On the unentitled preview this is the
   *  *oldest* draw — the recent one is the gated, valuable row. */
  lotteryLatestDraw(game: string): Promise<any> {
    return this.get(`/v1/lottery/draws/${encodeURIComponent(game)}/latest`);
  }
  /** Per-number frequency for a game over a window (30–1825 days). */
  lotteryFrequency(game: string, days = 365): Promise<any> {
    return this.get(`/v1/lottery/draws/${encodeURIComponent(game)}/frequency`, { days });
  }
  /** The lottery game registry: names, play rules and draw days. */
  lotteryGames(p: { country?: string; region?: string } & Params = {}): Promise<any> {
    return this.get("/v1/lottery/games", p);
  }
  /** One game's full play rules and metadata. */
  lotteryGame(slug: string): Promise<any> {
    return this.get(`/v1/lottery/games/${encodeURIComponent(slug)}`);
  }

  // -- fuel (gas & diesel) ----------------------------------------------------
  /** Geolocated retail fuel stations with their latest prices.
   *
   *  Coverage: Mexico (`MX`, CRE open data), the United States (`US`) and
   *  Canada (`CA`). Prices are in **local currency per litre** — `MXN/L`,
   *  `USD/L` and `CAD/L` respectively.
   *
   *  Unentitled callers get a 100-row preview of the oldest rows and the
   *  pagination arguments are ignored — check `response.demo`.
   */
  fuelStations(p: FuelStationsParams & Params = {}): Promise<FuelStationsResponse> {
    return this.get<FuelStationsResponse>("/v1/fuel/stations", p);
  }

  /** One station: location, latest prices and its price-change timeline. */
  fuelStation(
    id: number | string,
    p: FuelStationParams & Params = {},
  ): Promise<FuelStationDetail> {
    return this.get<FuelStationDetail>(
      `/v1/fuel/stations/${encodeURIComponent(String(id))}`,
      p,
    );
  }

  /** Yield every matching station, paging through the API for you.
   *
   *  Only meaningful with an entitled key. The unentitled preview always
   *  returns the *same* oldest 100 rows and ignores the paging arguments,
   *  so there is nothing more to fetch: this yields that first page and
   *  stops rather than looping on it.
   */
  async *fuelStationsAll(
    p: FuelStationsParams & Params = {},
  ): AsyncGenerator<FuelStation> {
    const pageSize = Math.min(Math.max(Number(p.limit ?? 500), 1), 500);
    let offset = Number(p.offset ?? 0);
    for (;;) {
      const page = await this.fuelStations({ ...p, limit: pageSize, offset });
      const stations = page.stations ?? [];
      if (stations.length === 0) return;
      for (const s of stations) yield s;
      if (page.demo) return; // preview: every page is the same slice
      offset += stations.length;
      if (page.total != null && offset >= page.total) return;
    }
  }

  /** Aggregated fuel price series (state / national / metro).
   *
   *  These are the *series* behind the charts — EIA weekly for the US,
   *  StatCan monthly for Canada, CRE for Mexico — not the station-level
   *  prices that `fuelStations()` returns.
   */
  fuelPrices(p: FuelPricesParams & Params = {}): Promise<PriceSeriesResponse> {
    return this.get<PriceSeriesResponse>("/v1/prices", { domain: "fuel", ...p });
  }

  // -- geography (places, boundaries, hierarchy) ------------------------------
  /** The place list — provinces, regions, municipalities, cities, towns,
   *  wards, neighbourhoods, countries.
   *
   *  `country` takes an ISO code and either spelling works: `"CA"` and
   *  `"CAN"` find the same places, in both vocabularies.
   *
   *  `limit` goes to 500 rows per page.
   */
  geoPlaces(p: GeoPlacesParams & Params = {}): Promise<GeoPlaceList> {
    return this.get<GeoPlaceList>("/v1/geo/places", p);
  }

  /** One place, with its containers AND the places inside it.
   *
   *  The parents are a list on purpose: a place belongs to several things
   *  at once.
   */
  geoPlace(uid: string): Promise<GeoPlaceDetail> {
    return this.get<GeoPlaceDetail>(`/v1/geo/places/${encodeURIComponent(uid)}`);
  }

  /** A place's outline as GeoJSON.
   *
   *  `simplify` is in METRES: the outline keeps every corner more than
   *  that far from the original, and the result is still a valid polygon.
   */
  geoBoundary(uid: string, p: { simplify?: number } & Params = {}): Promise<GeoBoundary> {
    return this.get<GeoBoundary>(`/v1/geo/places/${encodeURIComponent(uid)}/boundary`, p);
  }

  /** Every outline in a viewport, in one response.
   *
   *  This is the route a map needs. Asking for one outline at a time is
   *  fine when the customer wants one outline; it is unusable when a pan
   *  wants a whole viewport's worth of them — that is one request per
   *  polygon, far past the rate the API allows.
   *
   *  The answer carries `count` (how many matched) and `truncated`
   *  (whether the limit cut the answer short), and the outlines come back
   *  **smallest first**, so a truncated answer drops the large areas
   *  rather than the wards the user is looking at.
   */
  geoBoundaries(
    p: {
      bbox?: string;
      kind?: string;
      exclude_kind?: string;
      source?: string;
      simplify_m?: number;
      limit?: number;
    } & Params = {},
  ): Promise<GeoBoundaryList> {
    return this.get<GeoBoundaryList>("/v1/geo/boundaries", p);
  }

  /** Every place containing a point, broadest first.
   *
   *  The answer to "which district is this?" without picking a winner: a
   *  point downtown Toronto lands in a neighbourhood, a ward, a city, a
   *  census division, a province and a country, and all of them are
   *  returned.
   */
  geoAt(lon: number, lat: number): Promise<GeoAtResponse> {
    return this.get<GeoAtResponse>("/v1/geo/at", { lon, lat });
  }

  /** The vocabulary: every concept, in both languages, with a live count of
   *  how many places and outlines it has. */
  geoConcepts(): Promise<GeoConceptList> {
    return this.get<GeoConceptList>("/v1/geo/concepts");
  }

  /** The places of different kinds that cover the same ground.
   *
   *  `bbox` is required — "minLon,minLat,maxLon,maxLat". Comparing every
   *  pair in the country is a quadratic join, and nobody asks that
   *  question about all of Canada at once.
   */
  geoOverlaps(
    p: { bbox: string; min_ratio?: number; limit?: number } & Params,
  ): Promise<GeoOverlapList> {
    return this.get<GeoOverlapList>("/v1/geo/overlaps", p);
  }

  // -- local (news, events, stories, places) --------------------------------
  /** The local feed — news, events, stories and notices. */
  localContent(
    p: {
      type?: string;
      category?: string;
      source?: string;
      city?: string;
      province?: string;
      bbox?: string;
      q?: string;
      since?: string;
      until?: string;
      has_location?: boolean;
      include_expired?: boolean;
      limit?: number;
      cursor?: string;
    } & Params = {},
  ): Promise<Page<LocalContent>> {
    return this.get<Page<LocalContent>>("/v1/local/content", p);
  }

  /** One item, with its tags. */
  localContentItem(contentId: number): Promise<LocalContent> {
    return this.get<LocalContent>(`/v1/local/content/${contentId}`);
  }

  /** The points of interest — the OpenStreetMap sweep.
   *
   *  `lat`, `lng` and `radius_km` go together: a proximity search needs
   *  all three.
   */
  localPlaces(
    p: {
      category?: string;
      kind?: string;
      sub?: string;
      bbox?: string;
      lat?: number;
      lng?: number;
      radius_km?: number;
      q?: string;
      limit?: number;
      offset?: number;
    } & Params = {},
  ): Promise<Page<LocalPlace>> {
    return this.get<Page<LocalPlace>>("/v1/local/places", p);
  }

  /** One place. */
  localPlace(placeId: number): Promise<LocalPlace> {
    return this.get<LocalPlace>(`/v1/local/places/${placeId}`);
  }

  /** The configured local feeds. */
  localSources(
    p: { enabled?: boolean; kind?: string; limit?: number } & Params = {},
  ): Promise<Page<LocalSource>> {
    return this.get<Page<LocalSource>>("/v1/local/sources", p);
  }

  /** The local vocabulary — types, categories, place categories, sources. */
  localTaxonomy(): Promise<{
    types: Array<{ id: string; name: string; count: number }>;
    categories: Array<{ id: string; name: string; count: number }>;
    place_categories: Array<{ id: string; name: string; count: number }>;
    sources: Array<{ slug: string; name: string; count: number }>;
  }> {
    return this.get("/v1/local/taxonomy");
  }

  // -- schools ----------------------------------------------------------------
  /** The school directory.
   *
   *  `sort` is a whitelist — `name`, `hs_score`, `hs_rank`, `grade_range`,
   *  `type`, `city` — and anything else is a 422. `rank` orders name
   *  matches by relevance: exact, then prefix, then a word that starts
   *  with the query, then any substring.
   *
   *  The limit goes to **5 000**: the map needs a whole viewport in one
   *  call, and the whole directory is 2 647 schools.
   *
   *  The envelope's `pagination` carries `next_offset` — the offset the
   *  next page starts at, as a number — not a cursor: the route pages by
   *  offset and has no cursor parameter.
   */
  schools(
    p: {
      q?: string;
      board?: string;
      /** The board's own type — public, catholic or private. */
      board_type?: string;
      /** The board's region, matched loosely. */
      region?: string;
      city?: string;
      province?: string;
      type?: string;
      /** A programme code, e.g. `french_immersion`. */
      program?: string;
      bbox?: string;
      lat?: number;
      lng?: number;
      radius_km?: number;
      has_boundary?: boolean;
      sort?: string;
      order?: "asc" | "desc";
      rank?: boolean;
      limit?: number;
      offset?: number;
    } & Params = {},
  ): Promise<Page<SchoolSummary>> {
    return this.get<Page<SchoolSummary>>("/v1/schools", p);
  }

  /** The board registry — the vocabulary the `board` filter uses. */
  schoolBoards(): Promise<Page<SchoolBoard>> {
    return this.get<Page<SchoolBoard>>("/v1/schools/boards");
  }

  /** The school vocabulary and the headline counts. */
  schoolTaxonomy(): Promise<SchoolTaxonomy> {
    return this.get<SchoolTaxonomy>("/v1/schools/taxonomy");
  }

  /** The catchments that cover a point.
   *
   *  **Licensed.** This reads the catchment polygons, so it needs the
   *  `school_licensed` scope — a key without it gets a 403.
   */
  schoolsAt(
    p: { lat: number; lng: number; limit?: number } & Params,
  ): Promise<Page<CatchmentHit>> {
    return this.get<Page<CatchmentHit>>("/v1/schools/at", p);
  }

  /** One school.
   *
   *  The uid is board-qualified — `ycdsb/0158`, or
   *  `ycdsb/st-theresa-of-lisieux-chs` when the board publishes no code.
   *  It carries a slash, and the API's route is built for that.
   *
   *  The scores come back only with the `school_licensed` scope.
   */
  school(uid: string): Promise<SchoolDetail> {
    return this.get<SchoolDetail>(`/v1/schools/${uid}`);
  }

  /** A school's catchment outline, as GeoJSON. **Licensed.**
   *  `simplify` is in METRES. */
  schoolBoundary(
    uid: string,
    p: { simplify?: number } & Params = {},
  ): Promise<SchoolBoundary> {
    return this.get<SchoolBoundary>(`/v1/schools/${uid}/boundary`, p);
  }

  /** One year's assessment snapshot, with the EQAO marks. **Licensed.**
   *  `year` picks a year; the latest is the default. */
  schoolScores(
    uid: string,
    p: { year?: number } & Params = {},
  ): Promise<SchoolScores> {
    return this.get<SchoolScores>(`/v1/schools/${uid}/scores`, p);
  }
}

export default Whereq;
