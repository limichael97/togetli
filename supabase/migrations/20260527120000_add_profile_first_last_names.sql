alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

update public.profiles
set
  first_name = coalesce(
    first_name,
    nullif(split_part(trim(full_name), ' ', 1), ''),
    nullif(trim(display_name), '')
  ),
  last_name = coalesce(
    last_name,
    nullif(regexp_replace(trim(coalesce(full_name, '')), '^\S+\s*', ''), '')
  )
where first_name is null
   or last_name is null;
