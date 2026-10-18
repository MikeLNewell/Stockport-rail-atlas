# Phase 2: live Train Describer integration

Status (18 October 2026): Frontend and ingestion scaffolding exist. No verified live feed is connected and no train positions are shown as live.

## 1. Map replacement

The candidate replacement page is `site/atlas-v2.html`. It loads signal-box locations from the local source file. It uses MapLibre GL JS v5 and OpenFreeMap as a geographical basemap. If vector rendering fails, a separate labelled reference schematic stays accessible. This fallback is not a geographical track alignment.

Local railway geometry is `site/data/railway.geojson`, with source and ODbL attribution in metadata. A GitHub Action can populate it by executing `scripts/import-railway.mjs`. Do not publish a claimed completed 20-mile network until this import succeeds and its geometry is verified. As of this release the file contains zero features.

## 2. Network Rail data collection

Register for a Network Rail Open Data Feeds account and arrange TD feed access.

Confirm the relevant Train Describer area identifiers against Network Rail reference documentation, including transitions between areas. TD areas are NOT individual signal-box control boundaries.

Create a persistent Node.js runtime for `worker/td-bridge.cjs`, using the values described in `worker/.env.example`. The process connects to the authenticated STOMP broker and persists C-Class events to Supabase.

Keep `NETWORK_RAIL_PASSWORD` and `SUPABASE_SERVICE_ROLE_KEY` on the worker. They must never appear in GitHub Pages or `site/data/live-config.json`.

Do not activate the worker until the area IDs have been checked against released source material.

## 3. Database

Create a dedicated Supabase project or choose an authorised existing project. Apply `sql/001_initial_schema.sql` once, using a secure SQL editor, and verify RLS. The `td_events` table has no public read policy.

Keep the service role key private and only in the ingestion runtime or Supabase Edge Function.

## 4. Safe public read API

Deploy `supabase/functions/atlas-live/index.ts` as `atlas-live`.

Set environment variable `ATLAS_TD_AREAS` to the verified comma-separated TD area IDs. The function uses its server-side Supabase environment credentials to read bounded C-Class event records. It exposes timestamps, berths, and reporting numbers, not raw signalling bit patterns or service-role keys.

The function must be deployed with public GET access for the static GitHub Pages site (for example using `--no-verify-jwt`). The response contains no privileged database credentials. Validate rate limits and CORS configuration before broad public use.

After deployment, edit `site/data/live-config.json`:

```json
{
  "readEndpoint": "https://YOUR_PROJECT.supabase.co/functions/v1/atlas-live",
  "pollSeconds": 15,
  "configured": true
}
```

Only populate a real endpoint that has been confirmed to return the expected schema.

## 5. Accurate movement interpretation

C-Class events describe trains moving between signalling BERTHS. A headcode is not a GPS position. The parser processes CA, CB and CC; heartbeat CT messages are feed-health signals, not train movements.

`worker/td-state.cjs` provides deterministic in-memory area/description state, cancellation handling and stale-data checks. It does not join descriptions between TD areas. Berths can be plotted at a physical signal or track location only after a reliable released berth lookup table has been verified and stored, with provenance.

Never infer which individual signal box controls a train solely from a TD area ID. Route-setting states, points and signal aspects remain Phase 3 research.

## 6. Verification checklist

- [x] Reference signal-box records load without Network Rail access
- [x] Dedicated public read API code written, with no client service-role key
- [x] TD event parsing and state reducer implemented
- [ ] Full OSM railway geometry imported and validated
- [ ] Vector basemap proven to render reliably in intended browsers
- [ ] Supabase schema applied
- [ ] Verified local TD area IDs entered
- [ ] Authenticated worker connected to Network Rail
- [ ] Data API deployed and freshness verified
- [ ] Berth-to-track mapping sourced and verified
- [ ] Live train movement tested against actual broker data

Do not represent the unfinished checklist as live tracking.