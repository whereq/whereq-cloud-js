---
"@whereq/cloud": minor
---

Add the geography methods: `geoPlaces()` (the place list — provinces,
regions, municipalities, cities, towns, wards, neighbourhoods, countries),
`geoPlace(uid)` (one place with its containers AND the places inside it),
`geoBoundary(uid)` (the outline as GeoJSON, `simplify` in metres),
`geoAt(lon, lat)` (every place containing a point, broadest first),
`geoConcepts()` (the vocabulary with live counts) and `geoOverlaps({ bbox })`
(the pairs of places covering the same ground).

A place belongs to SEVERAL things at once, so `parents` is an array on
purpose. The country filter accepts either ISO spelling — `"CA"` and
`"CAN"` find the same places in both vocabularies.
