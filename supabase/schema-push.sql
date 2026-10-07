create table public.code_push_config (
 id integer primary key check(id=1), public_key text not null, private_key text not null,
 cron_secret text not null, group_pin text not null
);
create table public.code_push_devices (
 id text primary key, subscription jsonb not null, settings jsonb not null,
 active boolean not null default true, test_at timestamptz,
 updated_at timestamptz not null default now()
);
create table public.code_push_events (
 device_id text references public.code_push_devices(id) on delete cascade,
 spot_id text references public.code_spots(id) on delete cascade,
 target_day date not null, last_day date not null, favorable boolean not null,
 sent_leads jsonb not null default '[]', sent_at timestamptz not null default now(),
 primary key(device_id,spot_id,target_day)
);
create table public.code_push_runs (
 bucket text primary key, status text not null default 'running', detail jsonb,
 created_at timestamptz not null default now()
);
alter table public.code_push_config enable row level security;
alter table public.code_push_devices enable row level security;
alter table public.code_push_events enable row level security;
alter table public.code_push_runs enable row level security;
revoke all on public.code_push_config,public.code_push_devices,public.code_push_events,public.code_push_runs from anon,authenticated;
grant all on public.code_push_config,public.code_push_devices,public.code_push_events,public.code_push_runs to service_role;
create index code_push_devices_active on public.code_push_devices(active) where active;
create index code_push_events_target on public.code_push_events(target_day);
create index code_push_events_spot on public.code_push_events(spot_id);
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
