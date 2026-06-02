CREATE POLICY "Lead engineers delete their files"
  ON public.work_order_files
  FOR DELETE
  TO authenticated
  USING (public.engineer_is_lead(work_order_id));

CREATE POLICY "work-order-evidence delete lead"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'work-order-evidence' AND public.engineer_is_lead(public.wo_id_from_path(name)));

CREATE POLICY "work-order-signatures delete lead"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'work-order-signatures' AND public.engineer_is_lead(public.wo_id_from_path(name)));

CREATE POLICY "work-order-receipts delete lead"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'work-order-receipts' AND public.engineer_is_lead(public.wo_id_from_path(name)));

CREATE POLICY "work-order-source-docs delete lead"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'work-order-source-docs' AND public.engineer_is_lead(public.wo_id_from_path(name)));