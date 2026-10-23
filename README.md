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

// Cost of living — compare US states, CA provinces, or metros (by rent-series id)
await wq.costOfLiving("us:California,ca:Ontario,m:3958");

// Prices — fuel | food | energy | housing | rent
await wq.prices({ domain: "rent", region: "us", bedrooms: 2, limit: 10 });
await wq.price(3958);                              // one series + full history
const csv = await wq.pricesCsv({ domain: "food", region: "us" });

// Fuel — North-America gas & diesel: geolocated stations + aggregated series
await wq.fuelStations({ country: "MX", municipality: "Tijuana", product: "regular" });
await wq.fuelStation(1);                           // one station + intra-day price history
await wq.fuelPrices({ region: "mx" });             // state / national price series

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

## License

MIT © WhereQ
