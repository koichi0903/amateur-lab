insert into public.myfans_approved_media (
  media_name,
  media_url,
  affiliate_media_id,
  status,
  notes,
  updated_at
)
values (
  '@lumi_reviw',
  'https://x.com/lumi_reviw',
  '',
  'active',
  'myfans側で登録済みのアフィリエイトアカウントをamateur-lab内部の正式approved mediaとして管理する。',
  now()
)
on conflict do nothing;

update public.myfans_products p
set approved_media_id = m.id,
    approved_media_name = coalesce(nullif(p.approved_media_name, ''), m.media_name),
    approved_media_url = coalesce(nullif(p.approved_media_url, ''), m.media_url),
    updated_at = now()
from public.myfans_approved_media m
where m.media_name = '@lumi_reviw'
  and (p.approved_media_id is null or p.approved_media_name = '@lumi_reviw')
  and (p.approved_media_name = '@lumi_reviw' or p.approved_media_name = '' or p.approved_media_name is null);

update public.myfans_x_posts x
set approved_media_id = m.id,
    approved_media_name = coalesce(nullif(x.approved_media_name, ''), m.media_name),
    updated_at = now()
from public.myfans_approved_media m
where m.media_name = '@lumi_reviw'
  and (x.approved_media_id is null or x.approved_media_name = '@lumi_reviw')
  and (x.approved_media_name = '@lumi_reviw' or x.approved_media_name = '' or x.approved_media_name is null);

update public.myfans_companion_imports i
set approved_media_id = m.id
from public.myfans_approved_media m
where m.media_name = '@lumi_reviw'
  and i.approved_media_id is null
  and (
    i.raw_payload->>'approvedMediaName' = '@lumi_reviw'
    or i.raw_payload->>'approved_media_name' = '@lumi_reviw'
  );

insert into public.myfans_audit_logs (entity_type, entity_id, action, summary, metadata)
select 'media', m.id, 'formalize_lumi_reviw', '@lumi_reviw を内部approved mediaとして正式化', jsonb_build_object('scope', 'myfans_only')
from public.myfans_approved_media m
where m.media_name = '@lumi_reviw';
