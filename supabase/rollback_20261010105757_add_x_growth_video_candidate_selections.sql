-- Manual rollback only. This permanently removes the new selection row and its saved snapshot.
drop function if exists public.save_x_growth_video_candidate_selection(integer, bigint[], bigint[], bigint[], jsonb);
drop table if exists public.x_growth_video_candidate_selections;
