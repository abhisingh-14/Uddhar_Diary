-- Run this in the Supabase SQL Editor to fix "permission denied for table bills".
-- Adds SECURITY DEFINER so the function runs with the owner's privileges
-- instead of the calling role's (service_role) privileges. Access to the
-- function itself is still locked down by the existing REVOKE/GRANT below,
-- so this doesn't widen who can call it — only what it's allowed to do once called.

CREATE OR REPLACE FUNCTION public.create_bill_with_split(
  p_user_id uuid,
  p_image_url text,
  p_merchant_name text,
  p_total_amount numeric,
  p_category_id uuid,
  p_bill_date date,
  p_items jsonb,
  p_split_entries jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_id uuid;
  v_item jsonb;
  v_entry jsonb;
  v_owed_amount numeric;
BEGIN
  INSERT INTO public.bills (
    user_id,
    category_id,
    image_url,
    merchant_name,
    total_amount,
    bill_date
  )
  VALUES (
    p_user_id,
    p_category_id,
    p_image_url,
    p_merchant_name,
    p_total_amount,
    p_bill_date
  )
  RETURNING id INTO v_bill_id;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    INSERT INTO public.bill_items (bill_id, name, price, quantity)
    VALUES (
      v_bill_id,
      v_item ->> 'name',
      (v_item ->> 'price')::numeric(10, 2),
      COALESCE((v_item ->> 'quantity')::integer, 1)
    );
  END LOOP;

  FOR v_entry IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_split_entries, '[]'::jsonb))
  LOOP
    v_owed_amount := abs((v_entry ->> 'owedAmount')::numeric(10, 2));

    IF v_owed_amount = 0 THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.people
      WHERE id = (v_entry ->> 'personId')::uuid AND user_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'person % does not belong to user %', v_entry ->> 'personId', p_user_id;
    END IF;

    INSERT INTO public.debts (bill_id, person_id, direction, amount_paise)
    VALUES (
      v_bill_id,
      (v_entry ->> 'personId')::uuid,
      v_entry ->> 'direction',
      (v_owed_amount * 100)::integer
    );
  END LOOP;

  RETURN v_bill_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_bill_with_split(
  uuid, text, text, numeric, uuid, date, jsonb, jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_bill_with_split(
  uuid, text, text, numeric, uuid, date, jsonb, jsonb
) TO service_role;
