-- Run AFTER setup.sql. Browser reports are bounded, not replay-validated.
begin;
alter table public.nd_profiles add column if not exists inventory jsonb not null default '{"ability":["overdrive"],"skin":["neon","razor","solar","ghost","void"],"trail":["pulse"]}';
alter table public.nd_profiles add column if not exists equipped jsonb not null default '{"ability":"overdrive","skin":"neon","trail":"pulse"}';
alter table public.nd_profiles add column if not exists energy_tier integer not null default 0;
alter table public.nd_profiles add column if not exists score_tier integer not null default 0;
alter table public.nd_profiles add column if not exists played boolean not null default false;
create table if not exists public.nd_runs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 started_at timestamptz not null default now(), completed boolean not null default false,
 difficulty text not null, energy_multiplier numeric not null, score_multiplier numeric not null
);
alter table public.nd_runs enable row level security;
revoke all on public.nd_runs from public, anon, authenticated;

create or replace function public.nd_start(p_difficulty text) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.nd_profiles; ticket uuid; tiers numeric[]:=array[1,1.25,1.5,1.75,2,4,5];
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_difficulty not in ('easy','normal','hard','insane') or p_difficulty is null then raise exception 'Invalid difficulty'; end if;
 select * into p from public.nd_profiles where user_id=auth.uid() for update;
 if not found then raise exception 'Load your profile first'; end if;
 if exists(select 1 from public.nd_runs where user_id=auth.uid() and started_at>now()-interval '2 seconds') then raise exception 'Please wait before starting again'; end if;
 -- Only one active run per account, including across tabs/devices.
 delete from public.nd_runs where user_id=auth.uid() and (not completed or started_at<now()-interval '1 day');
 insert into public.nd_runs(user_id,difficulty,energy_multiplier,score_multiplier)
 values(auth.uid(),p_difficulty,tiers[p.energy_tier+1],tiers[p.score_tier+1]) returning id into ticket;
 return ticket;
end; $$;

create or replace function public.nd_finish(p_run uuid,p_score bigint,p_energy numeric,p_seconds numeric)
returns public.nd_profiles language plpgsql security definer set search_path='' as $$
declare p public.nd_profiles; r public.nd_runs; reward numeric; max_score numeric; max_energy numeric;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into p from public.nd_profiles where user_id=auth.uid() for update;
 if not found then raise exception 'Profile missing'; end if;
 select * into r from public.nd_runs where id=p_run and user_id=auth.uid() for update;
 if not found then raise exception 'Run expired or replaced by another run'; end if;
 if r.completed then return p; end if;
 if p_score is null or p_energy is null or p_seconds is null or
    p_score<0 or p_energy<0 or p_energy>1000000 or p_seconds<0 or p_seconds>7200 or
    p_seconds>extract(epoch from now()-r.started_at)+2 or now()-r.started_at>interval '1 day'
 then raise exception 'Invalid run report'; end if;
 reward:=case r.difficulty when 'easy' then .6 when 'normal' then 1 when 'hard' then 2.25 else 6 end;
 max_energy:=(floor(p_seconds/1.85)+1)*5*reward*r.energy_multiplier;
 -- Generous ceilings cover near misses, combos, bosses and Score Surge.
 max_score:=(p_seconds*20000+5000)*r.score_multiplier;
 if p_score>max_score or p_energy>max_energy then raise exception 'Run exceeds reward limits'; end if;
 update public.nd_runs set completed=true where id=r.id;
 update public.nd_profiles set points=points+p_score,energy=energy+round(p_energy,2),
 lifetime_points=lifetime_points+p_score,best_score=greatest(best_score,p_score),played=true
 where user_id=auth.uid() returning * into p;
 return p;
end; $$;

create or replace function public.nd_buy(p_kind text,p_item text) returns public.nd_profiles
language plpgsql security definer set search_path='' as $$
declare p public.nd_profiles; price integer; n integer; current_tier integer;
 catalog jsonb := '{"ability":{"overdrive":0,"shield":80,"magnet":120,"warp":175,"repulsor":260,"surge":360,"quantum":500},"skin":{"neon":0,"razor":0,"solar":0,"ghost":0,"void":0,"nova":5,"glitch":10,"eclipse":15,"aurora":20,"royal":25},"trail":{"pulse":0,"lightning":18,"fire":24,"glitch":30,"rainbow":36,"void":45}}';
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into p from public.nd_profiles where user_id=auth.uid() for update;
 if not found then raise exception 'Profile missing'; end if;
 if exists(select 1 from public.nd_runs where user_id=auth.uid() and not completed and started_at>now()-interval '1 day') then raise exception 'Finish your active run before shopping'; end if;
 if p_kind in ('energy_tier','score_tier') then
  n:=array_position(array['1.25','1.5','1.75','2','4','5'],p_item);
  if n is null then raise exception 'Invalid tier'; end if;
  current_tier:=case p_kind when 'energy_tier' then p.energy_tier else p.score_tier end;
  if n<=current_tier then return p; end if;
  if n<>current_tier+1 then raise exception 'Buy tiers in order'; end if;
  if p_kind='energy_tier' then
   price:=(array[2500,6000,12000,25000,75000,150000])[n];
   if p.points<price then raise exception 'Not enough points'; end if;
   p.points:=p.points-price; p.energy_tier:=n;
  else
   price:=(array[15,30,50,80,180,320])[n];
   if p.energy<price then raise exception 'Not enough energy'; end if;
   p.energy:=p.energy-price; p.score_tier:=n;
  end if;
 else
  price:=(catalog->p_kind->>p_item)::integer;
  if price is null then raise exception 'Unknown item'; end if;
  if not (p.inventory->p_kind ? p_item) then
   if p.energy<price then raise exception 'Not enough energy'; end if;
   p.energy:=p.energy-price;
   p.inventory:=jsonb_set(p.inventory,array[p_kind],(p.inventory->p_kind)||jsonb_build_array(p_item));
  end if;
  p.equipped:=jsonb_set(p.equipped,array[p_kind],to_jsonb(p_item));
 end if;
 update public.nd_profiles set points=p.points,energy=p.energy,inventory=p.inventory,equipped=p.equipped,
 energy_tier=p.energy_tier,score_tier=p.score_tier where user_id=auth.uid() returning * into p;
 return p;
end; $$;

revoke all on function public.nd_start(text) from public,anon,authenticated;
revoke all on function public.nd_finish(uuid,bigint,numeric,numeric) from public,anon,authenticated;
revoke all on function public.nd_buy(text,text) from public,anon,authenticated;
grant execute on function public.nd_start(text) to authenticated;
grant execute on function public.nd_finish(uuid,bigint,numeric,numeric) to authenticated;
grant execute on function public.nd_buy(text,text) to authenticated;
commit;
