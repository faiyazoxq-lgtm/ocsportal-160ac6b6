DO $$
DECLARE
  keep_id uuid := 'b8fe5c59-af9a-47cc-b1d8-09b5eda32864';
BEGIN
  DELETE FROM public.work_order_assignments WHERE engineer_id <> keep_id;
  DELETE FROM public.engineer_availability WHERE engineer_id <> keep_id;
  DELETE FROM public.engineers WHERE id <> keep_id;
END $$;