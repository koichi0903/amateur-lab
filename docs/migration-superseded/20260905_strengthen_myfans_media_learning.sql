alter table public.myfans_products
  add column if not exists approved_media_id bigint references public.myfans_approved_media(id) on delete set null;

alter table public.myfans_companion_imports
  add column if not exists approved_media_id bigint references public.myfans_approved_media(id) on delete set null,
  add column if not exists import_source text not null default 'chrome_companion',
  add column if not exists payload_hash text not null default '';

update public.myfans_products p
set approved_media_id = m.id
from public.myfans_approved_media m
where p.approved_media_id is null
  and p.approved_media_name <> ''
  and p.approved_media_name = m.media_name;

update public.myfans_x_posts x
set approved_media_id = coalesce(x.approved_media_id, p.approved_media_id),
    approved_media_name = coalesce(nullif(x.approved_media_name, ''), p.approved_media_name)
from public.myfans_products p
where x.product_id = p.id
  and (x.approved_media_id is null or x.approved_media_name = '');

create index if not exists myfans_products_approved_media_idx
  on public.myfans_products (approved_media_id, selection_score desc, created_at desc);

create index if not exists myfans_companion_imports_media_idx
  on public.myfans_companion_imports (approved_media_id, created_at desc);

create unique index if not exists myfans_companion_imports_payload_hash_idx
  on public.myfans_companion_imports (payload_hash)
  where payload_hash <> '';

alter table public.myfans_products enable row level security;
alter table public.myfans_companion_imports enable row level security;
revoke all on table public.myfans_products from anon, authenticated;
revoke all on table public.myfans_companion_imports from anon, authenticated;
