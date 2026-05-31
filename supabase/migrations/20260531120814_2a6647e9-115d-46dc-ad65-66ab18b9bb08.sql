ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS geocoded_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS geocode_confidence numeric;

CREATE INDEX IF NOT EXISTS work_orders_lat_lng_idx
  ON public.work_orders (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;