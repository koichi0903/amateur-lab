alter table public.actress_profiles
  alter column height_cm type numeric(5,1) using height_cm::numeric,
  alter column bust_cm type numeric(5,1) using bust_cm::numeric,
  alter column waist_cm type numeric(5,1) using waist_cm::numeric,
  alter column hip_cm type numeric(5,1) using hip_cm::numeric;
