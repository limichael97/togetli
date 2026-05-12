alter table public.poll_responses enable row level security;

drop policy if exists "Active trip members can view poll responses"
  on public.poll_responses;
drop policy if exists "Eligible voters can insert own poll response"
  on public.poll_responses;
drop policy if exists "Eligible voters can update own poll response"
  on public.poll_responses;
drop policy if exists "Poll response inserts require eligible voter"
  on public.poll_responses;
drop policy if exists "Poll response updates require eligible voter"
  on public.poll_responses;

create policy "Active trip members can view poll responses"
on public.poll_responses
for select
to authenticated
using (
  exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = poll_responses.trip_id
      and tm.user_id = auth.uid()
      and tm.is_active = true
  )
);

create policy "Eligible voters can insert own poll response"
on public.poll_responses
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = poll_responses.trip_id
      and tm.user_id = auth.uid()
      and tm.is_active = true
      and tm.role in ('planner', 'guest')
  )
);

create policy "Eligible voters can update own poll response"
on public.poll_responses
for update
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = poll_responses.trip_id
      and tm.user_id = auth.uid()
      and tm.is_active = true
      and tm.role in ('planner', 'guest')
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = poll_responses.trip_id
      and tm.user_id = auth.uid()
      and tm.is_active = true
      and tm.role in ('planner', 'guest')
  )
);

create policy "Poll response inserts require eligible voter"
on public.poll_responses
as restrictive
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = poll_responses.trip_id
      and tm.user_id = auth.uid()
      and tm.is_active = true
      and tm.role in ('planner', 'guest')
  )
);

create policy "Poll response updates require eligible voter"
on public.poll_responses
as restrictive
for update
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = poll_responses.trip_id
      and tm.user_id = auth.uid()
      and tm.is_active = true
      and tm.role in ('planner', 'guest')
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = poll_responses.trip_id
      and tm.user_id = auth.uid()
      and tm.is_active = true
      and tm.role in ('planner', 'guest')
  )
);
