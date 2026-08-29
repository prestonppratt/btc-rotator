-- Production schema for a private research application. Apply through a managed Postgres migration tool.
create table app_user (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  email text not null unique,
  role text not null check (role in ('owner', 'analyst', 'viewer')),
  created_at timestamptz not null default now()
);

create table portfolio_snapshot (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app_user(id),
  as_of timestamptz not null,
  source text not null,
  source_sha256 text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, as_of, source_sha256)
);

create table position_lot (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references portfolio_snapshot(id) on delete cascade,
  ticker text not null,
  asset_class text not null,
  quantity numeric not null check (quantity >= 0),
  price_usd numeric not null check (price_usd >= 0),
  market_value_usd numeric not null check (market_value_usd >= 0),
  entry_date date,
  cost_basis_usd numeric,
  created_at timestamptz not null default now()
);

create table capital_structure_snapshot (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  known_at timestamptz not null,
  effective_at timestamptz not null,
  source_url text not null,
  source_sha256 text not null,
  btc_held numeric,
  usd_reserve numeric,
  diluted_shares numeric,
  debt_notional numeric,
  otm_converts_notional numeric,
  pref_notional numeric,
  quality text not null check (quality in ('verified', 'review_required', 'rejected')),
  unique (ticker, known_at, source_sha256)
);

create table recommendation_run (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app_user(id),
  as_of timestamptz not null,
  engine_version text not null,
  mode text not null check (mode in ('shadow', 'review', 'production')),
  evidence_status text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table audit_event (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references app_user(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
