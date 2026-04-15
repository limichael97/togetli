alter table public.profiles enable row level security;

drop policy if exists "Authenticated users can read basic profiles" on public.profiles;

create policy "Authenticated users can read basic profiles"
on public.profiles
for select
to authenticated
using (true);
