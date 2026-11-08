import { describe, it, expect, vi } from "vitest";
import pkg from "../package.json";
import {
  Whereq,
  WhereqError,
  VERSION,
  FUEL_PRODUCTS,
  FUEL_COUNTRIES,
  FUEL_CURRENCIES,
} from "./index";

function mockFetch(status: number, body: unknown) {
  return vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      ({
        ok: status < 400,
        status,
        statusText: "",
        json: async () => body,
        text: async () => JSON.stringify(body),
      }) as unknown as Response,
  );
}

describe("Whereq", () => {
  it("keeps VERSION in step with the package version", () => {
    // VERSION is derived from package.json, so this cannot drift — the test
    // stays as a guard against someone re-introducing a hardcoded literal.
    // It bit us once: a hardcoded VERSION broke the Changesets release PR.
    expect(VERSION).toBe(pkg.version);
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("builds params, drops undefined, sends the key", async () => {
    const f = mockFetch(200, { ok: true });
    const wq = new Whereq({ apiKey: "wq_test", fetch: f });
    const out = await wq.prices({ domain: "rent", region: undefined, bedrooms: 2 });
    expect(out).toEqual({ ok: true });
    const url = String(f.mock.calls[0][0]);
    const init = f.mock.calls[0][1] as RequestInit;
    expect(url).toContain("domain=rent");
    expect(url).toContain("bedrooms=2");
    expect(url).not.toContain("region");
    expect((init.headers as Record<string, string>)["X-API-Key"]).toBe("wq_test");
  });

  it("falls back to WHEREQ_API_KEY for the key", () => {
    const prev = process.env.WHEREQ_API_KEY;
    process.env.WHEREQ_API_KEY = "wq_env_key";
    try {
      const wq = new Whereq({ fetch: mockFetch(200, {}) });
      expect((wq as unknown as { headers: Record<string, string> }).headers["X-API-Key"]).toBe(
        "wq_env_key",
      );
      // An explicit key still wins over the environment.
      const wq2 = new Whereq({ apiKey: "wq_explicit", fetch: mockFetch(200, {}) });
      expect((wq2 as unknown as { headers: Record<string, string> }).headers["X-API-Key"]).toBe(
        "wq_explicit",
      );
    } finally {
      if (prev === undefined) delete process.env.WHEREQ_API_KEY;
      else process.env.WHEREQ_API_KEY = prev;
    }
  });

  it("throws WhereqError on non-2xx", async () => {
    const wq = new Whereq({ fetch: mockFetch(402, { detail: "quota reached" }) });
    await expect(wq.prices({ domain: "rent" })).rejects.toBeInstanceOf(WhereqError);
  });

  it("encodes the cost-of-living places param", async () => {
    const f = mockFetch(200, { places: [] });
    const wq = new Whereq({ fetch: f });
    await wq.costOfLiving("us:California");
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain("/v1/cost-of-living");
    expect(url).toContain("places=us%3ACalifornia");
  });
});

describe("fuel", () => {
  it("sends every station filter", async () => {
    const f = mockFetch(200, { as_of: "t", count: 0, stations: [] });
    const wq = new Whereq({ fetch: f });
    await wq.fuelStations({
      country: "CA",
      state: "ON",
      municipality: "Mississauga",
      product: "midgrade",
      bbox: "-80,43,-79,44",
      q: "husky",
      limit: 250,
      offset: 500,
    });
    const url = String(f.mock.calls[0][0]);
    for (const frag of [
      "country=CA",
      "state=ON",
      "municipality=Mississauga",
      "product=midgrade",
      "bbox=-80%2C43%2C-79%2C44",
      "q=husky",
      "limit=250",
      "offset=500",
    ]) {
      expect(url).toContain(frag);
    }
  });

  it("passes product and days to a single station", async () => {
    const f = mockFetch(200, { station: {}, prices: [] });
    const wq = new Whereq({ fetch: f });
    await wq.fuelStation(436335, { product: "regular", days: 7 });
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain("/v1/fuel/stations/436335");
    expect(url).toContain("product=regular");
    expect(url).toContain("days=7");
  });

  it("forces the fuel domain on fuelPrices", async () => {
    const f = mockFetch(200, { count: 0, data: [] });
    const wq = new Whereq({ fetch: f });
    await wq.fuelPrices({ region: "ca", limit: 10 });
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain("domain=fuel");
    expect(url).toContain("region=ca");
    expect(url).toContain("limit=10");
  });

  it("pages through every station with fuelStationsAll", async () => {
    const pages = [
      { as_of: "t0", count: 2, total: 3, stations: [{ id: 1 }, { id: 2 }] },
      { as_of: "t1", count: 1, total: 3, stations: [{ id: 3 }] },
    ];
    let n = 0;
    const f = vi.fn(async (_input: RequestInfo | URL) => {
      const body = pages[n++];
      return {
        ok: true,
        status: 200,
        statusText: "",
        json: async () => body,
        text: async () => JSON.stringify(body),
      } as unknown as Response;
    });
    const wq = new Whereq({ fetch: f });
    const ids: number[] = [];
    for await (const s of wq.fuelStationsAll({ country: "CA" })) ids.push(s.id);
    expect(ids).toEqual([1, 2, 3]);
    expect(f).toHaveBeenCalledTimes(2);
    expect(String(f.mock.calls[0][0])).toContain("offset=0");
    expect(String(f.mock.calls[1][0])).toContain("offset=2");
  });

  it("stops the iterator on an empty page", async () => {
    const f = mockFetch(200, { as_of: "t", count: 0, total: null, stations: [] });
    const wq = new Whereq({ fetch: f });
    const out = [];
    for await (const s of wq.fuelStationsAll()) out.push(s);
    expect(out).toEqual([]);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("stops the iterator on the demo preview", async () => {
    // The preview returns the same 100 rows for every offset — stop, don't loop.
    const f = mockFetch(200, {
      demo: true,
      preview_rows: 100,
      total: null,
      count: 2,
      as_of: "t",
      stations: [{ id: 1 }, { id: 2 }],
    });
    const wq = new Whereq({ fetch: f });
    const out = [];
    for await (const s of wq.fuelStationsAll({ country: "CA" })) out.push(s);
    expect(out.map((s) => s.id)).toEqual([1, 2]);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("covers the lottery endpoints", async () => {
    const f = mockFetch(200, { count: 0 });
    const wq = new Whereq({ fetch: f });
    await wq.lotteryDraws({ game: "powerball", days: 7, limit: 5 });
    await wq.lotteryLatestDraw("powerball");
    await wq.lotteryFrequency("powerball", 90);
    await wq.lotteryGames({ country: "US", region: "NY" });
    await wq.lotteryGame("powerball");

    const urls = f.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toContain("/v1/lottery/draws?");
    expect(urls[0]).toContain("game=powerball");
    expect(urls[0]).toContain("days=7");
    expect(urls[1]).toContain("/v1/lottery/draws/powerball/latest");
    expect(urls[2]).toContain("/v1/lottery/draws/powerball/frequency");
    expect(urls[2]).toContain("days=90");
    expect(urls[3]).toContain("/v1/lottery/games?");
    expect(urls[3]).toContain("country=US");
    expect(urls[3]).toContain("region=NY");
    expect(urls[4]).toContain("/v1/lottery/games/powerball");
  });

  it("types the detail station without a prices map", async () => {
    // The detail endpoint returns the station without `prices`; the timeline
    // is the separate array on the response.
    const f = mockFetch(200, {
      station: { id: 1, name: "Shell", country: "CA" },
      prices: [{ product: "regular", observed_at: "t", price: 1.67 }],
    });
    const wq = new Whereq({ fetch: f });
    const d = await wq.fuelStation(1, { days: 3 });
    expect(d.station.prices).toBeUndefined();
    expect(d.prices[0].price).toBe(1.67);
  });

  // -- geography ---------------------------------------------------------------

  it("sends every geo place filter", async () => {
    const f = mockFetch(200, { count: 0, data: [], limit: 50, offset: 0 });
    const wq = new Whereq({ fetch: f });
    await wq.geoPlaces({
      kind: "ward",
      source: "osm",
      country: "CA",
      q: "yonge",
      bbox: "-79.6,43.5,-79.2,43.8",
      has_boundary: true,
      limit: 200,
      offset: 20,
    });
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain("/v1/geo/places?");
    for (const fragment of [
      "kind=ward",
      "source=osm",
      "country=CA",
      "q=yonge",
      "bbox=-79.6%2C43.5%2C-79.2%2C43.8",
      "has_boundary=true",
      "limit=200",
      "offset=20",
    ]) {
      expect(url).toContain(fragment);
    }
  });

  it("drops the geo filters it was not given", async () => {
    const f = mockFetch(200, { count: 0, data: [], limit: 50, offset: 0 });
    const wq = new Whereq({ fetch: f });
    await wq.geoPlaces({ kind: "city" });
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain("kind=city");
    expect(url).not.toContain("country");
    expect(url).not.toContain("bbox");
  });

  it("returns a place with its parents and children", async () => {
    const f = mockFetch(200, {
      uid: "osm:r1428125",
      place: { uid: "osm:r1428125", kind: "country", name: "Canada" },
      parents: [],
      children: [
        { uid: "osm:r1", kind: "city", name: "Ajax", source: "osm", area_ratio: 1, is_primary: false },
      ],
    });
    const wq = new Whereq({ fetch: f });
    const d = await wq.geoPlace("osm:r1428125");
    // The uid is percent-encoded on the way in — the API decodes the path
    // segment, so `osm:r1428125` and `osm%3Ar1428125` are the same place.
    expect(String(f.mock.calls[0][0])).toContain("/v1/geo/places/osm%3Ar1428125");
    expect(d.place.name).toBe("Canada");
    // The parents are a LIST: a place belongs to several things at once.
    expect(Array.isArray(d.parents)).toBe(true);
    expect(d.children[0].name).toBe("Ajax");
  });

  it("passes simplify in metres to the boundary", async () => {
    const f = mockFetch(200, { type: "FeatureCollection", features: [] });
    const wq = new Whereq({ fetch: f });
    const b = await wq.geoBoundary("osm:r1428125", { simplify: 50 });
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain("/v1/geo/places/osm%3Ar1428125/boundary");
    expect(url).toContain("simplify=50");
    expect(b.type).toBe("FeatureCollection");
  });

  it("sends the point to the at endpoint", async () => {
    const f = mockFetch(200, { lon: -79.38, lat: 43.65, count: 0, places: [] });
    const wq = new Whereq({ fetch: f });
    await wq.geoAt(-79.38, 43.65);
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain("/v1/geo/at?");
    expect(url).toContain("lon=-79.38");
    expect(url).toContain("lat=43.65");
  });

  it("reads the concept vocabulary", async () => {
    const f = mockFetch(200, { count: 1, concepts: [], sources: [] });
    const wq = new Whereq({ fetch: f });
    const c = await wq.geoConcepts();
    expect(String(f.mock.calls[0][0])).toContain("/v1/geo/concepts");
    expect(c.count).toBe(1);
  });

  it("sends the box to the overlaps endpoint", async () => {
    const f = mockFetch(200, { bbox: {}, min_ratio: 0.05, count: 0, overlaps: [] });
    const wq = new Whereq({ fetch: f });
    await wq.geoOverlaps({ bbox: "-79.6,43.5,-79.2,43.8", min_ratio: 0.2, limit: 50 });
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain("/v1/geo/overlaps?");
    expect(url).toContain("bbox=-79.6%2C43.5%2C-79.2%2C43.8");
    expect(url).toContain("min_ratio=0.2");
    expect(url).toContain("limit=50");
  });

  it("exports the fuel constants", () => {
    expect(FUEL_PRODUCTS).toContain("midgrade");
    expect(FUEL_COUNTRIES).toEqual(["MX", "US", "CA"]);
    expect(FUEL_CURRENCIES.CA).toBe("CAD/L");
  });
});
