create table if not exists travel_details (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  arrival_time timestamptz,
  departure_time timestamptz,
  flight_number text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (trip_id, user_id)
);

create table if not exists trip_notes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  title text,
  content text,
  link text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);