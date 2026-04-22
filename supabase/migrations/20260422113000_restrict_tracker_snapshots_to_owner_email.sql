drop policy if exists "Users can read their own tracker snapshot" on public.tracker_snapshots;
drop policy if exists "Users can insert their own tracker snapshot" on public.tracker_snapshots;
drop policy if exists "Users can update their own tracker snapshot" on public.tracker_snapshots;

create policy "Owner can read tracker snapshot"
  on public.tracker_snapshots
  for select
  using (
    auth.uid() = user_id
    and auth.jwt()->>'email' = 'sethmbowden@gmail.com'
  );

create policy "Owner can insert tracker snapshot"
  on public.tracker_snapshots
  for insert
  with check (
    auth.uid() = user_id
    and auth.jwt()->>'email' = 'sethmbowden@gmail.com'
  );

create policy "Owner can update tracker snapshot"
  on public.tracker_snapshots
  for update
  using (
    auth.uid() = user_id
    and auth.jwt()->>'email' = 'sethmbowden@gmail.com'
  )
  with check (
    auth.uid() = user_id
    and auth.jwt()->>'email' = 'sethmbowden@gmail.com'
  );
