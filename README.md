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

## License

MIT © WhereQ
