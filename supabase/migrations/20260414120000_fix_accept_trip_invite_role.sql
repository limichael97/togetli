drop function if exists public.accept_trip_invite(text);
create or replace function public.accept_trip_invite(_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.trip_invites%rowtype;
  existing_member public.trip_members%rowtype;
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Must be signed in to accept an invite.';
  end if;

  select *
  into invite_row
  from public.trip_invites
  where token = _token
    and (expires_at is null or expires_at > now())
    and uses < max_uses
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'Invite is invalid or expired.';
  end if;

  select *
  into existing_member
  from public.trip_members
  where trip_id = invite_row.trip_id
    and user_id = current_user_id
  order by created_at desc
  limit 1;

  if found then
    update public.trip_members
    set
      role = invite_row.role,
      is_active = true,
      updated_at = now()
    where id = existing_member.id;
  else
    insert into public.trip_members (
      trip_id,
      user_id,
      role,
      is_active
    ) values (
      invite_row.trip_id,
      current_user_id,
      invite_row.role,
      true
    );
  end if;

  update public.trip_invites
  set uses = uses + 1
  where id = invite_row.id;

  return invite_row.trip_id::text;
end;
$$;

grant execute on function public.accept_trip_invite(text) to authenticated;
