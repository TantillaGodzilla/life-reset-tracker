create table if not exists public.tracker_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.tracker_snapshots enable row level security;

create policy "Users can read their own tracker snapshot"
  on public.tracker_snapshots
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own tracker snapshot"
  on public.tracker_snapshots
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own tracker snapshot"
  on public.tracker_snapshots
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_tracker_snapshot_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_tracker_snapshot_updated_at on public.tracker_snapshots;

create trigger set_tracker_snapshot_updated_at
  before update on public.tracker_snapshots
  for each row
  execute function public.set_tracker_snapshot_updated_at();
