-- Run once in the Supabase SQL Editor. Safe to rerun.
-- No browser role can insert/update balances or award itself progress.
begin;
create table if not exists public.nd_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points bigint not null default 0 check (points >= 0),
  energy numeric(16,2) not null default 0 check (energy >= 0),
  lifetime_points bigint not null default 0 check (lifetime_points >= 0),
  best_score bigint not null default 0 check (best_score >= 0),
  created_at timestamptz not null default now()
);
alter table public.nd_profiles enable row level security;
revoke all on public.nd_profiles from anon, authenticated;
grant select on public.nd_profiles to authenticated;
drop policy if exists nd_read_own on public.nd_profiles;
create policy nd_read_own on public.nd_profiles for select to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.nd_my_profile()
returns public.nd_profiles
language plpgsql security definer set search_path = ''
as $$
declare result public.nd_profiles; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in required'; end if;
  insert into public.nd_profiles(user_id) values (uid) on conflict do nothing;
  select * into result from public.nd_profiles where user_id = uid;
  return result;
end;
$$;
revoke all on function public.nd_my_profile() from public, anon, authenticated;
grant execute on function public.nd_my_profile() to authenticated;
commit;
