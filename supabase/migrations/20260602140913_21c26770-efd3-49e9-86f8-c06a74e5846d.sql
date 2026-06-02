CREATE OR REPLACE FUNCTION public.tg_notify_work_order_pdf()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _kind text;
  _token text;
  _url text := 'https://project--7bc054e2-4753-4359-b744-bb8607bf056d.lovable.app/api/public/work-orders/notify-pdf';
BEGIN
  IF TG_OP = 'INSERT' THEN
    _kind := 'created';
  ELSIF TG_OP = 'UPDATE'
        AND NEW.current_status = 'closed'
        AND OLD.current_status IS DISTINCT FROM NEW.current_status THEN
    _kind := 'closed';
  ELSE
    RETURN NEW;
  END IF;

  SELECT value INTO _token FROM public.internal_settings WHERE key = 'telegram_flush_token';
  IF _token IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _token
    ),
    body := jsonb_build_object(
      'work_order_id', NEW.id,
      'kind', _kind
    ),
    timeout_milliseconds := 30000
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_work_order_pdf_ins ON public.work_orders;
DROP TRIGGER IF EXISTS trg_notify_work_order_pdf_upd ON public.work_orders;

CREATE TRIGGER trg_notify_work_order_pdf_ins
AFTER INSERT ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_work_order_pdf();

CREATE TRIGGER trg_notify_work_order_pdf_upd
AFTER UPDATE OF current_status ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_work_order_pdf();