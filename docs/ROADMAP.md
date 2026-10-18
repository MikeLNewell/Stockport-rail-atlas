# Delivery roadmap

## Phase 1: Open infrastructure atlas (implemented locally)

- [x] Actual 20-mile circular coverage around Stockport station.
- [x] Railway tracks and signalling thematic cartography from OpenRailwayMap.
- [x] Five separately located and attributed Stockport control locations.
- [x] Interactive details and relationships for the five-box corridor.
- [x] Explicit distinctions between existing facts, historical documentation and unknown current control inventory.
- [x] Nearby OSM equipment discovery at detailed zoom.
- [x] Provisional user-drawn boundaries stored/exported with mandatory source, always unverified.
- [x] Mobile and desktop layouts; dark/light basemap.
- [x] Database design, feed parser scaffold, initial tests and deployment instructions.
- [ ] Obtain authoritative, current plans specifying exact control ownership for signals/points.
- [ ] Commission or generate original SVG track diagrams using verified point-to-point geometry.

## Phase 2: Real berth movement data (credentials/verification required)

- [x] Build opt-in STOMP C-Class event ingestion scaffold and parse tests.
- [ ] Verify applicable TD area codes for full regional geography and obtain Network Rail access.
- [ ] Deploy persistent worker and database; check feed correctness and retention.
- [ ] Import licensed berth reference tables, locations and stable network topology.
- [ ] Create live feed API and dashboard with freshness/staleness tracking.
- [ ] Map real berthed train descriptions and test cross-area train identification with uncertainty.

## Phase 3: Signalling states and route control

- [ ] Verify published S-Class mappings area by area and individual signals.
- [ ] Add true track schematic geometry and state model.
- [ ] Relate signal, points and route indications to verified control ownership.
- [ ] Ensure 'off' != green and present missing states explicitly.

## Phase 4: Replay and wider coverage

- [ ] Store/partition event history and support replay of observed events.
- [ ] Train journey timeline, route transitions and reliability metrics.
- [ ] Expand corroborated control-area mapping throughout the 20-mile study region.
- [ ] Research administration workflow and reviewed publishing of verified data.

## Required inputs to go live

- Network Rail account with TD subscription.
- List of verified TD geographical codes; correct topic authorisation.
- Supabase project credentials, secured with service-side policy.
- Long-running STOMP worker deployment location.
- Verified signalling plans and permission/licences where relevant.
