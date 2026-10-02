-- Manual loan / due entries: debts that have no bill attached.
-- Run manually in the Supabase SQL Editor.

begin;

-- 1. A manual debt has no bill
alter table public.debts
  alter column bill_id drop not null;

-- 2. New columns. Existing rows get kind = 'bill' from the default.
alter table public.debts
  add column kind text not null default 'bill',
  add column note text,
  add column incurred_on date;

-- 3. Constraints
alter table public.debts
  add constraint debts_kind_check
    check (kind in ('bill', 'old_due', 'loan')),
  add constraint debts_note_length
    check (note is null or char_length(note) <= 200),
  -- kind = 'bill' if and only if a bill is attached
  add constraint debts_kind_bill_consistency
    check ((kind = 'bill') = (bill_id is not null));

-- 4. Backfill incurred_on for existing bill debts so history sorts uniformly
update public.debts d
set incurred_on = b.bill_date
from public.bills b
where d.bill_id = b.id
  and b.bill_date is not null;

commit;
