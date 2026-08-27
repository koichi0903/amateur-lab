-- Cover the work foreign key used by impression aggregation and cleanup.
create index if not exists affiliate_cta_impressions_work_id_idx
  on public.affiliate_cta_impressions (work_id);
