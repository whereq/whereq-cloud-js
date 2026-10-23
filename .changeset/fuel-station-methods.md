---
"@whereq/cloud": minor
---

Add fuel methods for the new `/v1/fuel/*` endpoints: `fuelStations()` (geolocated
station list with filters), `fuelStation(id)` (station + intra-day price history),
and `fuelPrices()` (aggregated state/national fuel price series).
