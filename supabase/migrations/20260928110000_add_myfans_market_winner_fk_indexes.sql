-- Cover the new foreign keys without changing account data or access grants.
create index if not exists myfans_market_opportunities_quote_idx on public.myfans_market_opportunities (quote_candidate_id) where quote_candidate_id is not null;
create index if not exists myfans_market_opportunities_product_idx on public.myfans_market_opportunities (product_id) where product_id is not null;
create index if not exists myfans_market_opportunities_creator_idx on public.myfans_market_opportunities (creator_id) where creator_id is not null;
create index if not exists myfans_pattern_learning_pattern_idx on public.myfans_pattern_learning (pattern_id);
create index if not exists myfans_pattern_learning_creator_idx on public.myfans_pattern_learning (creator_id) where creator_id is not null;
create index if not exists myfans_pattern_learning_product_idx on public.myfans_pattern_learning (product_id) where product_id is not null;
create index if not exists myfans_pattern_learning_quote_idx on public.myfans_pattern_learning (quote_candidate_id) where quote_candidate_id is not null;
create index if not exists myfans_cross_account_guards_account_idx on public.myfans_cross_account_content_guards (approved_media_id) where approved_media_id is not null;
create index if not exists myfans_x_posts_pattern_idx on public.myfans_x_posts (pattern_id) where pattern_id is not null;
create index if not exists myfans_x_posts_quote_candidate_idx on public.myfans_x_posts (quote_candidate_id) where quote_candidate_id is not null;
create index if not exists myfans_x_posts_creator_idx on public.myfans_x_posts (creator_id) where creator_id is not null;
