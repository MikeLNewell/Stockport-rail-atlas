# Data availability and accuracy audit

Audit prepared 18 October 2026. The audit identifies what may be presented without live credentials or official signalling asset diagrams.

| Feature | Phase 1 availability | Approach | Constraint |
|---|---|---|---|
| Stockport station centre | Published OSM location | 53.40545, -2.16304 | This is a geographic centre, not network route mileage |
| Twenty-mile study radius | Fully computable | Leaflet 32186.88 m circle | Geographic radius may cut across control areas |
| Railway track geometry | Available as third-party tiles | OpenRailwayMap standard overlay | Tile image, not queryable graph connectivity |
| Signal box physical locations | Five source-referenced locations | Curated Mapcarta/Geograph coordinates | Position is not the controlled area |
| Signal box neighbours | Documentary evidence | FARSAP and SRS, with date caveats | Does not identify present-day routes for every line |
| Signals and points | Community OSM records, zoom-limited | Overpass viewport requests + ORM tiles | Incomplete; static locations, not indications |
| Individual signals owned/controlled by each box | Not established comprehensively | Research / authorised diagrams needed | Do not infer from distance |
| Individual point controls | Not established comprehensively | Research / authorised diagrams needed | Historical lever mapping is not current mapping |
| Signal-box control boundaries | Not authoritatively verified | No verified polygon; optional unverified drafts | Boxes, workstations and TD areas differ |
| Live TD C-Class train descriptions | Network Rail feed exists | Dedicated authenticated, persistent STOMP worker | Account, area IDs and hosting required |
| Live S-Class signalling data | Varies by TD area | Future verified bit-map interpretation | Aspect 'off' does not mean green; coverage varies |
| True GPS train location | Not supplied by TD | Do not attempt | Berth-level train reporting positions only |
| Historical train replay | No collection yet | Timestamped `td_events` in PostGIS | Data only exists after feed starts recording |

## Key sources

- [Network Rail Open Data Feeds](https://www.networkrail.co.uk/who-we-are/transparency-and-ethics/transparency/open-data-feeds/): TD real-time berth positioning; SMART berth reference data; schedules and movements.
- [Train Describer documentation](https://wiki.openraildata.com/index.php?title=TD): C/S messages and the `TD_ALL_SIG_AREA` topic.
- [OpenRailwayMap API](https://wiki.openstreetmap.org/wiki/OpenRailwayMap/API): Standard and signals raster tiles.
- [OpenRailwayMap UK tagging](https://wiki.openstreetmap.org/wiki/OpenRailwayMap/Tagging_in_the_United_Kingdom): Separate track ways, signals, signal boxes and reference tags.
- [Film Archive of Railway Signalling & People, Stockport Corridor](https://farsap.co.uk/StockportCorridor.php): Five traditional boxes in geographic north-south order and high-level corridor relationships.
- [Signalling Record Society, Stockport No.2](https://www.s-r-s.org.uk/Audio/stockport2.php): Historical detailed track and lever reference, principally 1970s/1981 rather than an automatically reliable 2026 equipment list.

## Five mapped locations

| Box | Latitude | Longitude | Location evidence |
|---|---:|---:|---|
| Edgeley Junction No.1 | 53.39777 | -2.16450 | [OSM / Mapcarta](https://mapcarta.com/W152223562) |
| Edgeley Junction No.2 | 53.40077 | -2.16310 | [OSM / Mapcarta](https://mapcarta.com/W238480200) |
| Stockport No.1 | 53.40428 | -2.16316 | [Geograph](https://www.geograph.org.uk/photo/4233322) |
| Stockport No.2 | 53.40697 | -2.16347 | [Geograph](https://www.geograph.org.uk/photo/7401024) |
| Heaton Norris Junction | 53.41559 | -2.17088 | [Geograph](https://www.geograph.org.uk/photo/3636342) |

These are published positions with metre-scale or building-scale uncertainty, not engineering survey values. Operating status should be rechecked as railway signalling arrangements can change.

## Operational integrity principles

- Do not infer a signal box control area from a circle around its building.
- Do not show green/red aspects unless backed by decoded live data and a reliable age indicator.
- Do not assign train location to a physical signal unless the berth mapping is supported by released reference data.
- Do not infer points positioning merely because a train moves through a crossover on a track diagram.
- Treat recorded 1981 equipment as historical evidence, never as a verified current asset inventory.
- Separate `signal_boxes`, `control_areas`, `td_areas`, `rail_assets`, and `control_relationships` in the data model.
