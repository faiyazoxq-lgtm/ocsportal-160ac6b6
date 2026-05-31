CREATE OR REPLACE FUNCTION public.auto_fill_work_order_no()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_year text;
  v_num  bigint;
BEGIN
  IF NEW.order_no IS NULL OR length(btrim(NEW.order_no)) = 0 THEN
    v_year := to_char(now() AT TIME ZONE 'UTC', 'YYYY');
    v_num  := nextval('public.work_order_no_seq');
    NEW.order_no := 'WO-' || v_year || '-' || lpad(v_num::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;