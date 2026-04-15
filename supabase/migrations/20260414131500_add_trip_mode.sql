alter table public.trips
add column if not exists mode text not null default 'poll';

update public.trips
set mode = 'poll'
where mode is null;

alter table public.trips
drop constraint if exists trips_mode_check;

alter table public.trips
add constraint trips_mode_check
check (mode in ('poll', 'planned'));
