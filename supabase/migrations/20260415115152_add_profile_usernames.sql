alter table public.profiles
add column if not exists username text;

update public.profiles
set username = lower(trim(username))
where username is not null;

update public.profiles
set username = null
where username = '';

with duplicate_usernames as (
  select
    id,
    row_number() over (
      partition by lower(username)
      order by created_at, id
    ) as duplicate_rank
  from public.profiles
  where username is not null
)
update public.profiles as p
set username = null
from duplicate_usernames as d
where p.id = d.id
  and d.duplicate_rank > 1;

create or replace function public.normalize_username_seed(seed text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      left(
        regexp_replace(lower(split_part(trim(coalesce(seed, '')), ' ', 1)), '[^a-z0-9]', '', 'g'),
        16
      ),
      ''
    ),
    'traveler'
  );
$$;

do $$
declare
  profile_row record;
  username_base text;
  candidate text;
  attempt integer;
begin
  for profile_row in
    select id, full_name, display_name
    from public.profiles
    where username is null
    order by created_at, id
  loop
    username_base := public.normalize_username_seed(
      coalesce(
        nullif(profile_row.display_name, ''),
        nullif(profile_row.full_name, ''),
        left(replace(profile_row.id::text, '-', ''), 8)
      )
    );

    attempt := 0;
    loop
      candidate := lower(
        username_base ||
        lpad(((floor(random() * 9000) + 1000))::int::text, 4, '0')
      );

      exit when not exists (
        select 1
        from public.profiles
        where lower(username) = candidate
      );

      attempt := attempt + 1;
      if attempt > 50 then
        candidate := lower('user' || left(replace(profile_row.id::text, '-', ''), 8));
        exit;
      end if;
    end loop;

    update public.profiles
    set username = candidate
    where id = profile_row.id;
  end loop;
end
$$;

create unique index if not exists profiles_username_lower_idx
on public.profiles (lower(username));

alter table public.profiles
drop constraint if exists profiles_username_lowercase_check;

alter table public.profiles
add constraint profiles_username_lowercase_check
check (username = lower(username));

alter table public.profiles
alter column username set not null;
