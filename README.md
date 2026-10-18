# Stockport Rail Atlas

An interactive railway infrastructure atlas centred on Stockport station, covering a **20-mile geographical radius**. The initial release focuses on accurate, traceable signal-box locations and openly mapped railway infrastructure. It is not yet a real-time train tracker.

## What Phase 1 does

- Displays a zoomable geographic map with OpenRailwayMap railway and signalling tile overlays.
- Defines a 32,186.88 metre study radius from the published position of Stockport station.
- Locates five traditional signal boxes along the Stockport corridor, each with a geographical source.
- Discovers other OSM-tagged signal boxes in the full study radius where the Overpass service is available, without assuming they remain operational.
- Provides a reference panel for each box with documented neighbours, descriptions, provenance, uncertainty notes and a conceptual corridor schematic.
- Shows mapped OSM signals and points from the Overpass API at detailed zoom levels. These **do not** show live indications and are **not** presented as controlled by a particular box.
- Lets researchers trace **unverified** draft boundaries on the map. Each saved draft requires a source URL, is kept in the current browser's local storage and can be exported as JSON.
- Offers dark/light map styling of a key-free OpenStreetMap basemap, independent railway layers and mobile layouts.
- Includes a PostgreSQL/PostGIS schema and tested Train Describer event parser to support later phases.

## Launch locally

Requires internet access for Leaflet, base-map tiles, OpenRailwayMap and optional Overpass data. No package installation or API key is required for Phase 1.

```bash
cd stockport-rail-atlas
python3 -m http.server 8765 --directory site
```

Open http://localhost:8765 . Do not open the `index.html` file directly; the site fetches a local JSON dataset.

Alternatively, use `npm run serve`. Run `npm test` for data integrity and TD parser tests.

## Deploy to GitHub Pages

GitHub Actions is configured in `.github/workflows/deploy-pages.yml` to publish the `site/` directory automatically on pushes to `main`. Under Settings → Pages, select **GitHub Actions**. The project URL is `https://mikelnewell.github.io/Stockport-rail-atlas/` once deployment succeeds.

The basemap uses `tile.openstreetmap.org`, without a CARTO API key. Dark mode uses a CSS filter applied only to the base tiles. The OpenStreetMap Foundation tile servers have a [usage policy](https://operations.osmfoundation.org/policies/tiles/); this is suitable for modest educational traffic, not guaranteed capacity for a popular public service.

## Deploy to Netlify

Create a new Netlify site with this folder or a GitHub repository containing these files. The project is a static site; **build command: blank**, **publish directory: `site`**. The included `netlify.toml` provides these defaults. No environment variables are needed for Phase 1.

**Cost note:** Netlify, OpenStreetMap-related services and Supabase have their own usage limits and conditions. Publicly hosted OpenRailwayMap and Overpass are community services, not guaranteed free-capacity APIs for high-traffic deployments. Check their usage policies before wider publication or substantial traffic.

## Live Train Describer integration (prepared, not active)

The `worker/` folder contains a Node.js STOMP reader and event parser. It is intentionally **not started**, because Network Rail data-feed login details, the appropriate signalling area IDs and a Supabase project are not supplied.

To integrate subsequently:

1. Register for [Network Rail Open Data](https://www.networkrail.co.uk/who-we-are/transparency-and-ethics/transparency/open-data-feeds/) and request access to the TD feed.
2. Confirm the relevant train describer area IDs. Do not assume an area ID corresponds to a particular historic signal box.
3. Set up a Supabase project and run `sql/001_initial_schema.sql` in its SQL editor.
4. In `worker/`, install dependencies with `npm install`, copy `.env.example` to a **private** `.env` and supply credentials via your process manager's environment. Node does not load `.env` automatically; run with `node --env-file=.env td-bridge.cjs` if using Node 20.6+.
5. Run the worker on a long-lived service (small VPS, home server or equivalent). Netlify Functions are not a persistent STOMP consumer.
6. Validate captured berth messages and equipment mapping before adding any visible train markers. The current website makes **no** live connection and displays **no** fictitious trains.

The worker stores only C-Class CA/CB/CC events for explicitly supplied area IDs and leaves S-Class interpretation for a later, documented mapping phase. The `td_events` table is not client-readable by default. A Phase 2 backend must add a carefully scoped API and live interface. Do not expose Network Rail or Supabase service role credentials in frontend assets.

## Source and verification policy

The five pinned signal-box coordinates come from OSM/Mapcarta and Geograph geographic records with links retained individually in `site/data/stockport-boxes.json`. Context about signalling relationships is attributed to the Film Archive of Railway Signalling & People and the Signalling Record Society. Published historical route, lever and point details must not be treated as an authoritative present-day inventory.

There are deliberately no coloured current-control polygons. Positioning a box on a map does not identify which individual signals and switches it controls. Without dated, verified current signal/point control diagrams, these relationships remain `unverified`.

OSM and OpenRailwayMap content is community-maintained and may contain omissions or outdated equipment tags. OpenRailwayMap's signals layer displays map features rather than measured signal states. The optional Overpass query occurs only at detailed zoom levels and is limited to the visible small region, to avoid excessive service load. If the endpoint is unavailable, the railway tile overlay and five reference boxes remain useful.

This is an **unofficial educational tool only** and is not suitable for operational or safety-critical decisions.

## Project layout

```text
site/index.html            Web interface
site/styles.css            Responsive dark/light application styles
site/app.js                Map, layer management, details and local research
site/data/stockport-boxes.json Evidence-backed corridor reference data
 worker/td-parser.cjs      Train Describer C-Class message parser
 worker/td-bridge.cjs      Opt-in STOMP ingestion integration scaffold
 worker/.env.example       Server environment variable template
 sql/001_initial_schema.sql PostGIS and Supabase schema with RLS
 tests/                    Dataset and parser automated tests
 docs/DATA_AUDIT.md        Coverage and evidence audit
 docs/ROADMAP.md           Phased build milestones
```

## Known limits

- Train tracking, live signal indications, point positions and train replay have **not** been implemented. The backend groundwork is provided for future integration.
- Detailed signal and point coverage depends on OSM mapping completeness and Overpass server availability.
- Signal-box adjacency and historical routes are presented as reference information, not measured limits of control.
- Research drafts are browser-local. Database-backed verified publishing and moderation are future work.
- The site is published through GitHub Pages when the GitHub Actions workflow succeeds.

## Attribution

© OpenStreetMap contributors. Railway overlays from OpenRailwayMap (CC BY-SA 2.0), subject to its terms. Geograph locations are attributed via links to the original source. No OpenTrainTimes proprietary diagrams or data have been copied.
