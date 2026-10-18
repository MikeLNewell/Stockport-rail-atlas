-- Stockport Rail Atlas: future Supabase / PostGIS persistence.
-- Phase 1 uses its own attributed JSON and browser research drafts.
create extension if not exists postgis with schema extensions;

create table if not exists public.signal_boxes (
  id text primary key,
  name text not null,
  signalling_type text,
  location extensions.geography(Point,4326) not null,
  location_source text not null,
  location_precision text,
  current_operation_status text not null default 'unverified',
  updated_at timestamptz not null default now()
);
create index if not exists signal_boxes_location_gix on public.signal_boxes using gist (location);

create table if not exists public.control_areas (
  id uuid primary key default gen_random_uuid(),
  signal_box_id text references public.signal_boxes(id),
  kind text not null check (kind in ('signal_box','td_area','workstation')),
  geometry extensions.geometry(MultiPolygon,4326),
  confidence text not null default 'unverified' check (confidence in ('unverified','historical','verified')),
  valid_from date,
  valid_to date,
  source_url text,
  verified_at timestamptz,
  check (confidence <> 'verified' or (source_url is not null and verified_at is not null))
);
create index if not exists control_areas_geometry_gix on public.control_areas using gist (geometry);

create table if not exists public.rail_assets (
  id uuid primary key default gen_random_uuid(),
  osm_type text,
  osm_id bigint,
  asset_type text not null check (asset_type in ('signal','points','track','junction','station','berth')),
  reference text,
  geometry extensions.geometry(Geometry,4326),
  data_source text not null,
  source_url text,
  confidence text not null default 'unverified' check (confidence in ('unverified','historical','verified')),
  recorded_at timestamptz not null default now(),
  unique (osm_type,osm_id,asset_type)
);
create index if not exists rail_assets_geometry_gix on public.rail_assets using gist (geometry);

create table if not exists public.control_relationships (
  id uuid primary key default gen_random_uuid(),
  signal_box_id text not null references public.signal_boxes(id),
  rail_asset_id uuid not null references public.rail_assets(id),
  relationship text not null check (relationship in ('controls','monitors','historic_controls')),
  source_url text not null,
  valid_from date,
  valid_to date,
  confidence text not null default 'unverified' check (confidence in ('unverified','historical','verified')),
  unique (signal_box_id,rail_asset_id,relationship,source_url)
);

-- Train Describer area IDs are independent of signal-box jurisdictions.
create table if not exists public.td_areas (
  id text primary key,
  description text,
  source_url text,
  geometry extensions.geometry(MultiPolygon,4326)
);

create table if not exists public.td_berths (
  id uuid primary key default gen_random_uuid(),
  area_id text not null references public.td_areas(id),
  berth_code text not null,
  location extensions.geometry(Point,4326),
  location_source text,
  location_confidence text not null default 'unverified',
  unique (area_id,berth_code)
);

create table if not exists public.td_events (
  id bigint generated always as identity primary key,
  area_id text not null,
  msg_type text not null check (msg_type in ('CA','CB','CC')),
  event_time timestamptz not null,
  from_berth text,
  to_berth text,
  berth text,
  description text,
  raw jsonb not null,
  received_at timestamptz not null default now()
);
create index if not exists td_events_area_time_idx on public.td_events (area_id,event_time desc);
create index if not exists td_events_description_time_idx on public.td_events (description,event_time desc);
-- Do not create a conflict unique constraint with nullable berth columns: NULLs do
-- not deduplicate under a standard PostgreSQL uniqueness check. Use explicit
-- source message IDs or NULLS NOT DISTINCT on supported PostgreSQL versions.
create unique index if not exists td_events_message_dedup_idx
  on public.td_events (area_id,msg_type,event_time,from_berth,to_berth,description) nulls not distinct;

create table if not exists public.research_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  signal_box_id text references public.signal_boxes(id),
  source_url text not null,
  notes text,
  geometry extensions.geometry(Polygon,4326),
  status text not null default 'unverified' check (status in ('unverified','under_review','verified')),
  created_at timestamptz not null default now()
);

alter table public.signal_boxes enable row level security;
alter table public.control_areas enable row level security;
alter table public.rail_assets enable row level security;
alter table public.control_relationships enable row level security;
alter table public.td_areas enable row level security;
alter table public.td_berths enable row level security;
alter table public.td_events enable row level security;
alter table public.research_notes enable row level security;

create policy "Public published signal box locations" on public.signal_boxes for select using (true);
create policy "Public verified current control areas" on public.control_areas for select using (confidence='verified' and valid_to is null);
create policy "Public published rail assets" on public.rail_assets for select using (confidence='verified');
create policy "Public verified control relationships" on public.control_relationships for select using (confidence='verified' and valid_to is null);
create policy "Research author select" on public.research_notes for select to authenticated using (auth.uid()=user_id);
create policy "Research author insert" on public.research_notes for insert to authenticated with check (auth.uid()=user_id and status='unverified');
create policy "Research author update" on public.research_notes for update to authenticated using (auth.uid()=user_id and status='unverified') with check (auth.uid()=user_id and status='unverified');
create policy "Research author delete" on public.research_notes for delete to authenticated using (auth.uid()=user_id and status='unverified');
-- No client-facing policy on TD event history; add a limited read view / API
-- when Phase 2 has a validated location and licensing model.
