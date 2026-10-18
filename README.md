# Stockport Rail Atlas

An open-source railway infrastructure atlas for a geographical 20-mile radius around Stockport station, Greater Manchester. The production homepage is Phase 2 in development. It does **not** yet claim to show live train positions or live signalling states.

## Current site

[Open the Atlas](https://mikelnewell.github.io/Stockport-rail-atlas/)

- Railway reference linework is stored locally at `site/data/railway.geojson`. It currently contains 98 simplified railway line segments sourced from open GIS data, derived from Network Rail records. These are real railway reference geometries, **not** individual track, point or signal control records.
- The default interactive map renders local SVG railway geography directly from the repository, so it is not dependent on loading an external basemap or an API key.
- OpenFreeMap/MapLibre provides an optional street-map background. The railway network remains available if it fails.
- Two map views: full 20-mile railway study area, and zoomed Stockport corridor.
- Five source-referenced traditional Stockport signal-box locations with descriptions, neighbours and source links.
- Exact control-area boundaries, signal/point responsibility and physical berth coordinates remain unverified. Those relationships are not invented.
- A separate Phase 2 Train Describer panel awaits a real, configured data endpoint. No simulated movements are displayed.

## Source and licensing

The current railway dataset is derived from [Raileasy Railway GIS Data](https://github.com/raileasyuk/railway-gis-data), itself using Network Rail Open Government Licence information. The redistributed simplified geometry is attributed to Raileasy Ltd / Network Rail and distributed under CC BY-SA 4.0. It is not a current or complete engineering track plan. Signal-box source links are preserved in `site/data/stockport-boxes.json`. The optional OpenFreeMap street basemap uses OpenStreetMap data.

An automated geometry importer (`scripts/import-railway.mjs`) and `Import open railway geography` GitHub Action can refresh the network, subject to data-source availability. The earlier Overpass-only importer failed; a subsequent import from the Network Rail-derived open dataset succeeded.

## Phase 2 groundwork

- `worker/td-parser.cjs`: Network Rail Train Describer CA/CB/CC parser.
- `worker/td-state.cjs`: timestamped berth-level state reconstruction, stale-event checks and independent TD area identities.
- `worker/td-bridge.cjs`: persistent, authenticated STOMP consumer that can write records to Supabase once configured.
- `sql/001_initial_schema.sql`: infrastructure and event tables with RLS.
- `supabase/functions/atlas-live/index.ts`: limited read-only endpoint returning recent events.
- `site/data/live-config.json`: public endpoint URL only, currently unconfigured.
- `.github/workflows/test-atlas.yml`: syntax, integrity and Train Describer tests.

See [Phase 2 commissioning instructions](docs/PHASE2_SETUP.md). Live movements require Network Rail credentials, a verified list of TD signalling area IDs, a Supabase project, and a continuously running data collector. No credentials belong in GitHub Pages.

**A train reporting number in a berth is not a GPS position.** A train may be represented geographically only when a verified berth-to-track mapping has been provided.

## Local development

Run `python3 -m http.server 8765 --directory site` and visit `http://localhost:8765`. Run `node --test tests/*.test.cjs` for tests.

GitHub Pages publishes the `site/` folder using `.github/workflows/deploy-pages.yml` on changes to the default branch.

## Recovery

The previous Leaflet Phase 1 implementation is preserved on the branch `backup/phase1-leaflet-2026-10-18`. Its original JavaScript, styling and research-draft functionality can be recovered if needed. Browser-local research drafts from that version are not automatically migrated into the new interface.

This is an unofficial educational and observational project, **not for railway operations or safety-critical decisions**.
