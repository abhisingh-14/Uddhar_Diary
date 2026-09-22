-- Prevent the same user from creating two people whose names match
-- case-insensitively.
--
-- The API trims the name before insert, so comparing stored values with
-- lower(name) is enough. The POST /api/people route maps the resulting
-- unique_violation (Postgres 23505) to a friendly 409 PERSON_EXISTS.
--
-- Run this manually in the Supabase SQL Editor.

create unique index if not exists idx_people_user_id_lower_name
  on people (user_id, lower(name));
