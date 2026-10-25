# @whereq/cloud

## 0.3.0

### Minor Changes

- 146633d: Align the fuel methods with the current `/v1/fuel/*` API.

  - `fuelStation(id, params)` now accepts `product` and `days` — the API always
    did; the SDK just could not pass them.
  - `fuelStations()` and `fuelPrices()` are typed: `FuelStationsParams`,
    `FuelStationParams`, `FuelPricesParams` and the matching response interfaces
    (`FuelStation`, `FuelStationsResponse`, `FuelStationDetail`, `PriceSeries`).
  - New `fuelStationsAll()` generator pages through every matching station.
  - New exported constants `FUEL_PRODUCTS`, `FUEL_COUNTRIES`, `FUEL_CURRENCIES`
    — `midgrade` is now a first-class product alongside the Mexico-only three,
    and the US and Canada are now covered.
  - `prices()` / `pricesCsv()` accept the `geo` filter.
  - `VERSION` was stuck at `0.1.0` while the package was at `0.2.0`; a test now
    pins it to `package.json` so it cannot drift again.

## 0.2.0

### Minor Changes

- ddcdc7f: Add fuel methods for the new `/v1/fuel/*` endpoints: `fuelStations()` (geolocated
  station list with filters), `fuelStation(id)` (station + intra-day price history),
  and `fuelPrices()` (aggregated state/national fuel price series).
