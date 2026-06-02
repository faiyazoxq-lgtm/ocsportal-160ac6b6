-- Drop dependent views, then columns, then the complexity_level enum.

-- 1) Drop columns that reference complexity_level / primary_trade
ALTER TABLE public.work_orders
  DROP COLUMN IF EXISTS primary_trade,
  DROP COLUMN IF EXISTS complexity_level;

ALTER TABLE public.engineers
  DROP COLUMN IF EXISTS primary_trade,
  DROP COLUMN IF EXISTS complexity_cap;

-- 2) Drop the enum if it is no longer referenced.
DROP TYPE IF EXISTS public.complexity_level;