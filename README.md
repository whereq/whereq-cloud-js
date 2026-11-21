# whereq.cloud — JavaScript / TypeScript SDK

Official JS/TS client for the [WhereQ data cloud](https://whereq.cloud) — the versioned,
metered `/v1` API at **`api.whereq.cloud`**: North-America fuel & gas-station prices,
cost-of-living prices, a cross-region comparison, trending hot-lists, autos, lottery,
equities & market data, and more.

Zero runtime dependencies, ESM + CJS, fully typed. Works in Node 18+ and the browser.
Public endpoints work with no key; metered endpoints take an API key.

## Install

```bash
npm i @whereq/cloud        # or: pnpm add @whereq/cloud · yarn add @whereq/cloud
```

## Usage

```ts
import { Whereq } from "@whereq/cloud";

const wq = new Whereq();                           // public access
// const wq = new Whereq({ apiKey: "wq_live_…" });  // metered tier
// const wq = new Whereq();                        // uses $WHEREQ_API_KEY

// Cost of living — compare US states, CA provinces, or metros (by rent-series id)
await wq.costOfLiving("us:California,ca:Ontario,m:3958");

// Prices — fuel | food | energy | housing | rent
await wq.prices({ domain: "rent", region: "us", bedrooms: 2, limit: 10 });
await wq.price(3958);                              // one series + full history
await wq.prices({ domain: "fuel", geo: "Calgary, Alberta" });
const csv = await wq.pricesCsv({ domain: "food", region: "us" });

// Fuel — North-America gas & diesel: geolocated stations + aggregated series
await wq.fuelStations({ country: "MX", municipality: "Tijuana", product: "regular" });
await wq.fuelStation(1);                           // one station + intra-day price history
await wq.fuelPrices({ region: "mx" });             // state / national price series

// Lottery — draws, per-number frequency, and the game registry
await wq.lotteryGames({ country: "US", region: "NY" });
await wq.lotteryDraws({ game: "ny_lotto", days: 30 });
await wq.lotteryLatestDraw("ny_lotto");
await wq.lotteryFrequency("ny_lotto", 365);

// Geography — places, drawable boundaries, and the containment hierarchy
await wq.geoPlaces({ kind: "ward", country: "CA" });   // "CA" or "CAN" — either finds Canada
await wq.geoPlace("osm:r1428125");                     // one place + its parents + its children
await wq.geoBoundary("osm:r1428125", { simplify: 50 });// GeoJSON, simplification in METRES
await wq.geoAt(-79.38, 43.65);                         // every place containing a point
await wq.geoConcepts();                                // the vocabulary, with live counts
await wq.geoOverlaps({ bbox: "-79.6,43.5,-79.2,43.8" }); // pairs covering the same ground

// Discovery
await wq.catalog(); await wq.categories(); await wq.regions(); await wq.domains();

// Finance
await wq.hotstocks(5);
await wq.screener({ sector: "Technology" });

// Escape hatch — call any /v1 endpoint directly
await wq.get("/v1/trending", { limit: 10 });
```

Errors throw `WhereqError` (with `.status`, `.message`, `.url`). A typed response is
available via `wq.get<MyType>(…)`.

## Fuel stations

Station-level retail fuel prices for **Mexico (`MX`)**, the **United States (`US`)**
and **Canada (`CA`)**. Every price is in **local currency per litre** — `MXN/L`,
`USD/L` or `CAD/L`.

```ts
// Canada — by ISO code or by name ("ON" and "Ontario" both match)
await wq.fuelStations({ country: "CA", state: "ON", limit: 500 });

// United States — every product a station quotes
await wq.fuelStations({ country: "US", state: "TX", product: "diesel" });

// A map viewport: "minLon,minLat,maxLon,maxLat"
await wq.fuelStations({ country: "US", bbox: "-123,37,-122,38" });

// One station's price-change timeline
await wq.fuelStation(436335, { product: "regular", days: 7 });

// Every matching station, paging for you
for await (const station of wq.fuelStationsAll({ country: "CA" })) {
  console.log(station.name, station.prices);
}
```

Products are `regular`, `midgrade`, `premium` and `diesel` — `FUEL_PRODUCTS`,
`FUEL_COUNTRIES` and `FUEL_CURRENCIES` are exported for convenience.

> **The preview.** Without an entitled API key the fuel endpoints return a
> 100-row preview of the *oldest* rows, ignore `limit`/`offset`, and set
> `demo: true` in the response. Check `response.demo` before paging.

`fuelPrices()` is a different thing: the aggregated *series* behind the charts
(EIA weekly for the US, StatCan monthly for Canada, CRE for Mexico), not
station-level prices.

## Geography

Provinces, regions, municipalities, cities, towns, wards and neighbourhoods —
with real, drawable boundaries, and with the places that cover the same ground
kept side by side rather than merged into one.

```ts
// The place list. "CA" and "CAN" find the same country, in both vocabularies.
await wq.geoPlaces({ kind: "city", country: "CA", limit: 50 });
await wq.geoPlaces({ source: "osm", has_boundary: true }); // only places with an outline

// One place: its containers AND the places inside it
const detail = await wq.geoPlace("osm:r1428125");
console.log(detail.place.name, detail.parents.length, detail.children.length);

// The outline as GeoJSON — simplification is in METRES
await wq.geoBoundary("osm:r1428125", { simplify: 50 });

// "Which district is this?" — every container, broadest first, none picked
const stack = await wq.geoAt(-79.38, 43.65);
for (const place of stack.places) {
  console.log(place.kind, place.name, place.country_code);
}

// The vocabulary, and the pairs of places covering the same ground
await wq.geoConcepts();
await wq.geoOverlaps({ bbox: "-79.6,43.5,-79.2,43.8", min_ratio: 0.2 });
```

A place belongs to **several** things at once — a neighbourhood is in a ward,
in a city, in a census division, in a province and in a country. `parents` is an
array on purpose. `bbox` is required on `geoOverlaps()`: comparing every pair in
the country is a quadratic join.

## Local

News, events, stories and notices from the configured local feeds, plus the
points of interest from the OpenStreetMap sweep — with their positions.

```ts
// The feed — news, events, stories, notices
await wq.localContent({ type: "news", city: "Toronto", limit: 20 });
await wq.localContent({ q: "storm", has_location: true });

// One item, with its tags
await wq.localContentItem(42);

// The points of interest. lat/lng/radius_km go together.
await wq.localPlaces({ category: "food", limit: 50 });
await wq.localPlaces({ lat: 43.65, lng: -79.38, radius_km: 5 });

// One place, the configured feeds, and the vocabulary
await wq.localPlace(7);
await wq.localSources();
await wq.localTaxonomy();
```

## Schools

The school boards' own published directories: the name, the board, the type,
the grade range, the programmes, the contact block and the position.

```ts
// The directory
await wq.schools({ board: "ycdsb", type: "secondary", limit: 50 });
await wq.schools({ q: "theresa", has_boundary: true });

// The board registry, and the vocabulary
await wq.schoolBoards();
await wq.schoolTaxonomy();

// One school. The uid is board-qualified and carries a slash.
await wq.school("ycdsb/0158");

// The catchments and the scores — these need the `school_licensed` scope.
await wq.schoolsAt({ lat: 43.89, lng: -79.47 });
await wq.schoolBoundary("ycdsb/0158", { simplify: 50 });
await wq.schoolScores("ycdsb/0158", { year: 2024 });
```

### The two licence tiers

The school data splits in two, and the split is by licence:

- **The open tier** — the name, the board, the type, the grade range, the
  programmes, the address, the contact block, the position. The boards
  publish these on their own websites. Scope: `school`.
- **The licensed tier** — the catchment polygons and the assessment
  scores. The catchment maps are the boards' licensed data (**viewing, not
  redistribution**), and the scores come from a commercially-encumbered
  feed. Scope: `school_licensed`, which is **internal-only** — it is never
  granted to a customer-facing key.

So the behaviour is:

- A key **without** `school_licensed` gets the school back with the `hs_*`
  fields **absent** — not null, absent — and `schoolBoundary()`,
  `schoolScores()` and `schoolsAt()` reject with a `WhereqError` of status
  **403**.
- A key **with** `school_licensed` gets the scores and the polygons.

A valid key that lacks the scope gets 403, not 401: 401 means "who are
you", and a client that gets 401 retries with different credentials.


## License

MIT © WhereQ
