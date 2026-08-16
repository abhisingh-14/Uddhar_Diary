-- ============================================================
-- Uddhar Diary — Database Schema (Step 0)
-- Target: PostgreSQL via Supabase
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================

-- Supabase enables the pgcrypto/uuid extension by default, which gives us
-- gen_random_uuid(). If it's missing for any reason, uncomment the next line:
-- create extension if not exists pgcrypto;


-- ------------------------------------------------------------
-- 1. profiles
-- Extends Supabase's built-in auth.users table with app-specific fields.
-- We don't store passwords/sessions here — Supabase Auth already handles
-- that in auth.users. This table is just "the rest of the user's profile."
-- ------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  created_at  timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 2. categories
-- Shared lookup table (food, travel, clothing, etc). Kept separate from
-- bills so category names are consistent and easy to change/rename in
-- one place, rather than being a free-text field on every bill.
-- ------------------------------------------------------------
create table categories (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique
);

insert into categories (name) values
  ('Food'), ('Travel'), ('Clothing'), ('Groceries'),
  ('Entertainment'), ('Utilities'), ('Other');


-- ------------------------------------------------------------
-- 3. people
-- The people being tracked (owers/owees). They do NOT have Supabase auth
-- accounts — they're just rows scoped to the main user who added them.
-- email is nullable because it's only needed later, for reminders.
-- ------------------------------------------------------------
create table people (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  name        text not null,
  email       text,
  created_at  timestamptz not null default now()
);

create index idx_people_user_id on people(user_id);


-- ------------------------------------------------------------
-- 4. bills
-- One row per uploaded bill photo. total_amount and category_id come
-- from the Claude vision API's structured JSON response.
-- ------------------------------------------------------------
create table bills (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  category_id    uuid references categories(id),
  image_url      text,                       -- Supabase Storage path/URL
  merchant_name  text,
  total_amount   numeric(10,2) not null check (total_amount >= 0),
  bill_date      date,
  created_at     timestamptz not null default now()
);

create index idx_bills_user_id on bills(user_id);
create index idx_bills_category_id on bills(category_id);


-- ------------------------------------------------------------
-- 5. bill_items
-- Line items extracted from the bill photo (used for the "review & edit
-- extracted items" fallback screen, and for split-by-item later if you
-- add that beyond the MVP even-split).
-- ------------------------------------------------------------
create table bill_items (
  id        uuid primary key default gen_random_uuid(),
  bill_id   uuid not null references bills(id) on delete cascade,
  name      text not null,
  price     numeric(10,2) not null check (price >= 0),
  quantity  integer not null default 1 check (quantity > 0)
);

create index idx_bill_items_bill_id on bill_items(bill_id);


-- ------------------------------------------------------------
-- 6. debts
-- The heart of Uddhar Diary. One row per unpaid portion owed by/to a
-- person for a specific bill. direction determines which of the two
-- Diary tabs a row shows up in. Only UNPAID portions get a row here —
-- fully settled splits never create a debt (per your design doc).
-- ------------------------------------------------------------
create table debts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  bill_id      uuid not null references bills(id) on delete cascade,
  person_id    uuid not null references people(id) on delete cascade,
  direction    text not null check (direction in ('they_owe_you', 'you_owe_them')),
  amount       numeric(10,2) not null check (amount > 0),
  status       text not null default 'unpaid' check (status in ('unpaid', 'settled')),
  settled_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index idx_debts_user_id on debts(user_id);
create index idx_debts_person_id on debts(person_id);
create index idx_debts_bill_id on debts(bill_id);
create index idx_debts_status on debts(status);


-- ------------------------------------------------------------
-- 7. (Optional but recommended) A view for running balances per person
-- Since we never store a balance column directly, this view computes it
-- on the fly by netting "they owe you" against "you owe them" per person.
-- Your /people/:id/balance route can just query this view.
-- ------------------------------------------------------------
create view person_balances as
select
  p.id as person_id,
  p.user_id,
  p.name,
  coalesce(sum(case when d.direction = 'they_owe_you' and d.status = 'unpaid' then d.amount else 0 end), 0) as they_owe_you,
  coalesce(sum(case when d.direction = 'you_owe_them' and d.status = 'unpaid' then d.amount else 0 end), 0) as you_owe_them,
  coalesce(sum(case when d.direction = 'they_owe_you' and d.status = 'unpaid' then d.amount else 0 end), 0)
    - coalesce(sum(case when d.direction = 'you_owe_them' and d.status = 'unpaid' then d.amount else 0 end), 0) as net_balance
from people p
left join debts d on d.person_id = p.id
group by p.id, p.user_id, p.name;


-- ============================================================
-- Row Level Security (RLS)
-- Supabase exposes tables over an auto-generated API, so RLS is what
-- stops user A from reading/writing user B's rows. Without this, any
-- authenticated user could query any row in these tables.
-- ============================================================

alter table profiles enable row level security;
alter table people enable row level security;
alter table bills enable row level security;
alter table bill_items enable row level security;
alter table debts enable row level security;

-- profiles: a user can only see/edit their own profile row
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- people: scoped by user_id
create policy "people_all_own" on people
  for all using (auth.uid() = user_id);

-- bills: scoped by user_id
create policy "bills_all_own" on bills
  for all using (auth.uid() = user_id);

-- bill_items: scoped via the parent bill's user_id
create policy "bill_items_all_own" on bill_items
  for all using (
    exists (
      select 1 from bills b
      where b.id = bill_items.bill_id and b.user_id = auth.uid()
    )
  );

-- debts: scoped by user_id
create policy "debts_all_own" on debts
  for all using (auth.uid() = user_id);

-- categories: no RLS needed, it's a shared read-only lookup table
