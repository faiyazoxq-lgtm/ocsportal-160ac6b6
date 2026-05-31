-- Sequence for auto-generated work order numbers
CREATE SEQUENCE IF NOT EXISTS public.work_order_no_seq START 1;
GRANT USAGE, SELECT ON SEQUENCE public.work_order_no_seq TO authenticated, service_role;

-- Trigger function: fill order_no if blank
CREATE OR REPLACE FUNCTION public.auto_fill_work_order_no()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

DROP TRIGGER IF EXISTS trg_auto_fill_work_order_no ON public.work_orders;
CREATE TRIGGER trg_auto_fill_work_order_no
BEFORE INSERT ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_fill_work_order_no();