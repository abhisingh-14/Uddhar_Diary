create table debts (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills(id) on delete cascade,
  person_id uuid not null references people(id) on delete restrict,
  direction text not null check (direction in ('they_owe_you', 'you_owe_them')),
  amount_paise integer not null check (amount_paise > 0),
  amount_paid_paise integer not null default 0
    check (amount_paid_paise >= 0 and amount_paid_paise <= amount_paise),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);