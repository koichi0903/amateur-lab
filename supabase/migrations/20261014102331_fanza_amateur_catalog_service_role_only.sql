revoke all privileges on table public.fanza_amateur_catalog_pages from anon, authenticated, service_role;
grant select, insert, update on table public.fanza_amateur_catalog_pages to service_role;
