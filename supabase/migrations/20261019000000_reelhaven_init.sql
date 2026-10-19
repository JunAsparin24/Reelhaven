-- Reelhaven — initial online schema (Supabase / Postgres).
--
-- Tables
--   profiles          public-ish player card (display name, friend code, look)
--   saves             one cloud save per account, optimistic-concurrency revisions
--   island_snapshots  read-only island layout that friends may visit
--   friendships       pending / accepted friend links (one row per pair)
--
-- Security model
--   * Row-level security is enabled on every table.
--   * Players can only read/write their own save and snapshot.
--   * Friendships are created and accepted only through the SECURITY DEFINER
--     functions below, which validate every step on the server.
--   * Snapshots are readable by accepted friends only (and only if the owner
--     allows visits). Profiles are readable by yourself and by players you
--     share a friendship row with; strangers are looked up by friend code via
--     find_player(), which returns a minimal card.
--   * The game client is never trusted to grant itself rewards through these
--     tables: the cloud save is the player's own single-player progress.

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
               check (char_length(display_name) between 2 and 20
                      and display_name ~ '^[[:alnum:] _.''-]+$'),
  friend_code  text not null unique check (friend_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  island_name  text not null default 'Sunny Shores' check (char_length(island_name) between 1 and 30),
  look         jsonb not null default '{}'::jsonb check (pg_column_size(look) < 2000),
  level        integer not null default 1 check (level between 1 and 999),
  allow_visits boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 8-character friend codes without look-alike characters (no I, O, 0, 1).
create or replace function public.generate_friend_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles p where p.friend_code = code);
  end loop;
  return code;
end;
$$;

-- Create a profile for every new account. The display name comes from the
-- sign-up form (user metadata) and is sanitised here; email is never used.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  name text;
begin
  name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Islander');
  name := left(regexp_replace(name, '[^[:alnum:] _.''-]', '', 'g'), 20);
  if char_length(name) < 2 then
    name := 'Islander';
  end if;
  insert into public.profiles (id, display_name, friend_code)
  values (new.id, name, public.generate_friend_code())
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Identity fields can never be changed by the client.
create or replace function public.protect_profile()
returns trigger
language plpgsql
as $$
begin
  new.id := old.id;
  new.friend_code := old.friend_code;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile();

-- ----------------------------------------------------------------------------
-- friendships (one row per pair, either direction)
-- ----------------------------------------------------------------------------
create table if not exists public.friendships (
  id           bigint generated always as identity primary key,
  requester    uuid not null references auth.users (id) on delete cascade,
  addressee    uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (requester <> addressee)
);

-- Prevents duplicates in either direction (A→B and B→A are the same pair).
create unique index if not exists friendships_pair
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee on public.friendships (addressee);

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  );
$$;

create or replace function public.is_connected(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where (f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a)
  );
$$;

-- ----------------------------------------------------------------------------
-- saves (one per account)
-- ----------------------------------------------------------------------------
create table if not exists public.saves (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  data            jsonb not null,
  save_version    integer not null check (save_version between 1 and 1000),
  revision        bigint not null default 1 check (revision >= 1),
  client_saved_at timestamptz,
  device_label    text check (char_length(device_label) <= 60),
  updated_at      timestamptz not null default now(),
  constraint saves_size check (pg_column_size(data) < 2000000)
);

-- Revisions start at 1 and must go up by exactly one per write; the client
-- updates "where revision = <the one I last saw>", so two devices can never
-- silently overwrite each other (the loser gets 0 rows and must resolve).
create or replace function public.saves_revision()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.revision := 1;
  elsif new.revision <> old.revision + 1 then
    raise exception 'save revision must increase by one' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists saves_revision on public.saves;
create trigger saves_revision
  before insert or update on public.saves
  for each row execute function public.saves_revision();

-- ----------------------------------------------------------------------------
-- island_snapshots (what friends see when they visit)
-- ----------------------------------------------------------------------------
create table if not exists public.island_snapshots (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  constraint snapshots_size check (pg_column_size(data) < 500000)
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists snapshots_touch on public.island_snapshots;
create trigger snapshots_touch
  before insert or update on public.island_snapshots
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Row-level security
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.saves enable row level security;
alter table public.island_snapshots enable row level security;
alter table public.friendships enable row level security;

drop policy if exists "profiles: read self and connections" on public.profiles;
create policy "profiles: read self and connections" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_connected(auth.uid(), id));

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "saves: read own" on public.saves;
create policy "saves: read own" on public.saves
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "saves: insert own" on public.saves;
create policy "saves: insert own" on public.saves
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "saves: update own" on public.saves;
create policy "saves: update own" on public.saves
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "snapshots: read own or friend's" on public.island_snapshots;
create policy "snapshots: read own or friend's" on public.island_snapshots
  for select to authenticated
  using (
    user_id = auth.uid()
    or (public.are_friends(auth.uid(), user_id)
        and exists (select 1 from public.profiles p where p.id = island_snapshots.user_id and p.allow_visits))
  );
drop policy if exists "snapshots: insert own" on public.island_snapshots;
create policy "snapshots: insert own" on public.island_snapshots
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "snapshots: update own" on public.island_snapshots;
create policy "snapshots: update own" on public.island_snapshots
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Friendships: you can see and delete (cancel / decline / unfriend) rows you
-- are part of. Creating and accepting go through the functions below.
drop policy if exists "friendships: read own" on public.friendships;
create policy "friendships: read own" on public.friendships
  for select to authenticated using (auth.uid() in (requester, addressee));
drop policy if exists "friendships: delete own" on public.friendships;
create policy "friendships: delete own" on public.friendships
  for delete to authenticated using (auth.uid() in (requester, addressee));

-- ----------------------------------------------------------------------------
-- Social functions (validated on the server)
-- ----------------------------------------------------------------------------

-- Minimal public card for a friend code, plus how you're related.
create or replace function public.find_player(p_code text)
returns table (id uuid, display_name text, friend_code text, level integer, look jsonb, relation text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  return query
  select p.id, p.display_name, p.friend_code, p.level, p.look,
         case
           when p.id = me then 'self'
           when exists (select 1 from friendships f where f.status = 'accepted'
                        and ((f.requester = me and f.addressee = p.id) or (f.requester = p.id and f.addressee = me))) then 'friend'
           when exists (select 1 from friendships f where f.status = 'pending' and f.requester = me and f.addressee = p.id) then 'outgoing'
           when exists (select 1 from friendships f where f.status = 'pending' and f.requester = p.id and f.addressee = me) then 'incoming'
           else 'none'
         end
  from profiles p
  where p.friend_code = upper(trim(p_code));
end;
$$;

-- Send a request by friend code. If they already asked you, this accepts it.
create or replace function public.send_friend_request(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target uuid;
  existing friendships%rowtype;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select p.id into target from profiles p where p.friend_code = upper(trim(p_code));
  if target is null then
    raise exception 'no player has that friend code' using errcode = 'P0002';
  end if;
  if target = me then
    raise exception 'that is your own friend code' using errcode = 'P0001';
  end if;
  select * into existing from friendships f
  where (f.requester = me and f.addressee = target) or (f.requester = target and f.addressee = me);
  if found then
    if existing.status = 'accepted' then
      return 'already_friends';
    elsif existing.requester = me then
      return 'already_requested';
    else
      update friendships set status = 'accepted', responded_at = now() where id = existing.id;
      return 'accepted';
    end if;
  end if;
  if (select count(*) from friendships f where f.requester = me and f.status = 'pending') >= 50 then
    raise exception 'too many pending requests' using errcode = 'P0001';
  end if;
  insert into friendships (requester, addressee) values (me, target);
  return 'sent';
end;
$$;

-- Accept or decline a request addressed to you.
create or replace function public.respond_friend_request(p_id bigint, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  req friendships%rowtype;
begin
  select * into req from friendships where id = p_id;
  if not found or req.addressee <> me or req.status <> 'pending' then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if p_accept then
    update friendships set status = 'accepted', responded_at = now() where id = p_id;
  else
    delete from friendships where id = p_id;
  end if;
end;
$$;

-- Your friends and pending requests with the other player's public card.
create or replace function public.list_friends()
returns table (
  friendship_id bigint, other_id uuid, display_name text, friend_code text, level integer,
  look jsonb, island_name text, allow_visits boolean, status text, direction text, since timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select f.id,
         p.id, p.display_name, p.friend_code, p.level, p.look, p.island_name, p.allow_visits,
         f.status,
         case when f.status = 'accepted' then 'friend'
              when f.requester = auth.uid() then 'outgoing'
              else 'incoming' end,
         coalesce(f.responded_at, f.created_at)
  from friendships f
  join profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where auth.uid() in (f.requester, f.addressee)
  order by f.status, p.display_name;
$$;

revoke all on function public.find_player(text) from public, anon;
revoke all on function public.send_friend_request(text) from public, anon;
revoke all on function public.respond_friend_request(bigint, boolean) from public, anon;
revoke all on function public.list_friends() from public, anon;
revoke all on function public.are_friends(uuid, uuid) from anon;
revoke all on function public.is_connected(uuid, uuid) from anon;
grant execute on function public.find_player(text) to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(bigint, boolean) to authenticated;
grant execute on function public.list_friends() to authenticated;
