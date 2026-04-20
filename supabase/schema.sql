-- Fotowand SaaS — Datenbankschema
-- Supabase nutzt bereits ein eingebautes auth.users-Schema für Authentifizierung.
-- Wir legen hier die Anwendungs-Tabellen an.

-- ============================================================
-- EVENTS: jede Hochzeit / jedes Event eines Kunden
-- ============================================================
create table if not exists public.events (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references auth.users(id) on delete cascade,
  slug              text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,60}$'),
  couple_names      text not null default '',
  welcome_text      text not null default '',
  couple_photo_url  text not null default '',
  plan              text not null default 'basic' check (plan in ('basic','plus','premium')),
  status            text not null default 'pending' check (status in ('pending','active','expired','disabled')),
  event_date        date,
  expires_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists events_owner_idx on public.events(owner_id);
create index if not exists events_status_idx on public.events(status);

-- ============================================================
-- ORDERS: Bezahlvorgänge (manuell oder via PayPal)
-- ============================================================
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  event_id       uuid references public.events(id) on delete set null,
  plan           text not null check (plan in ('basic','plus','premium')),
  amount_cents   integer not null,
  currency       text not null default 'EUR',
  provider       text not null default 'manual' check (provider in ('manual','paypal')),
  provider_ref   text,
  status         text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  note           text,
  created_at     timestamptz not null default now(),
  paid_at        timestamptz
);

create index if not exists orders_user_idx on public.orders(user_id);
create index if not exists orders_event_idx on public.orders(event_id);
create index if not exists orders_status_idx on public.orders(status);

-- ============================================================
-- updated_at Trigger
-- ============================================================
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.events enable row level security;
alter table public.orders enable row level security;

-- EVENTS: Besitzer sehen und ändern nur ihre eigenen Events
drop policy if exists "events_owner_select" on public.events;
create policy "events_owner_select" on public.events
  for select using (auth.uid() = owner_id);

drop policy if exists "events_owner_insert" on public.events;
create policy "events_owner_insert" on public.events
  for insert with check (auth.uid() = owner_id);

drop policy if exists "events_owner_update" on public.events;
create policy "events_owner_update" on public.events
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "events_owner_delete" on public.events;
create policy "events_owner_delete" on public.events
  for delete using (auth.uid() = owner_id);

-- ORDERS: Benutzer sehen nur ihre eigenen Bestellungen; Inserts/Updates nur via Service-Role-Key
drop policy if exists "orders_owner_select" on public.orders;
create policy "orders_owner_select" on public.orders
  for select using (auth.uid() = user_id);

-- ============================================================
-- Hilfsfunktion: Event per Slug öffentlich lesbar (nur Grunddaten)
-- Wird vom Backend mit service_role gelesen; RLS greift hier nicht.
-- ============================================================
-- (Keine Policy nötig — der Server liest mit service_role und filtert,
--  welche Felder an den Client gehen.)
