begin;

-- 1. Add the column as bigint (nullable for now, so the backfill can run)
alter table public.bills
  add column user_share_paise bigint;

-- 2. Backfill with the old formula: total in paise minus the stored debts.
--    round() matters because total_amount is numeric(10,2); the cast to bigint comes after.
update public.bills b
set user_share_paise =
      round(b.total_amount * 100)::bigint
      - coalesce((select sum(d.amount_paise)
                  from public.debts d
                  where d.bill_id = b.id), 0);

-- 3. Lock it down: required, and never negative or above the bill total
alter table public.bills
  alter column user_share_paise set not null;

alter table public.bills
  add constraint bills_user_share_paise_range
  check (user_share_paise >= 0
         and user_share_paise <= round(total_amount * 100)::bigint);

-- 4. Source column for photo vs manual bills
alter table public.bills
  add column source text not null default 'photo',
  add constraint bills_source_check check (source in ('photo', 'manual'));

-- 5. Rewrite the view to read the stored share. Same 5 columns, same order, same types.
create or replace view public.bill_user_expense as
select
  b.id               as bill_id,
  b.user_id,
  b.category_id,
  b.bill_date,
  b.user_share_paise::bigint as user_share_paise
from public.bills b;

commit;