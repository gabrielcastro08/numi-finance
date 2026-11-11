-- ============================================================
-- CONTROLE FINANCEIRO — Schema multi-usuário (Etapa 1)
-- Rodar no Supabase: SQL Editor > New query > colar tudo > Run
-- Idempotente: pode rodar mais de uma vez sem erro.
-- A tabela antiga app_state NÃO é tocada (fica como backup).
-- ============================================================

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default '',
  birth_date  date,
  avatar_url  text,
  start_date  date not null default current_date,
  goal        numeric not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

-- ---------- TRANSACTIONS ----------
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('receita','despesa')),
  name        text not null,
  value       numeric not null,
  tag         text not null,
  meio        text,                                   -- só despesas
  date        date,                                   -- opcional
  month       int  not null check (month between 0 and 11),
  year        int  not null default 2026,
  created_at  timestamptz not null default now()
);

create index if not exists transactions_user_year_month_idx
  on public.transactions (user_id, year, month);

alter table public.transactions enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
drop policy if exists "transactions_insert_own" on public.transactions;
drop policy if exists "transactions_update_own" on public.transactions;
drop policy if exists "transactions_delete_own" on public.transactions;

create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);
create policy "transactions_insert_own" on public.transactions
  for insert with check (auth.uid() = user_id);
create policy "transactions_update_own" on public.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions_delete_own" on public.transactions
  for delete using (auth.uid() = user_id);

-- ---------- RECURRENTS ----------
create table if not exists public.recurrents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('receita','despesa')),
  name        text not null,
  value       numeric not null default 0,             -- 0 = valor variável
  tag         text not null,
  meio        text,
  created_at  timestamptz not null default now()
);

create index if not exists recurrents_user_idx on public.recurrents (user_id);

alter table public.recurrents enable row level security;

drop policy if exists "recurrents_select_own" on public.recurrents;
drop policy if exists "recurrents_insert_own" on public.recurrents;
drop policy if exists "recurrents_update_own" on public.recurrents;
drop policy if exists "recurrents_delete_own" on public.recurrents;

create policy "recurrents_select_own" on public.recurrents
  for select using (auth.uid() = user_id);
create policy "recurrents_insert_own" on public.recurrents
  for insert with check (auth.uid() = user_id);
create policy "recurrents_update_own" on public.recurrents
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recurrents_delete_own" on public.recurrents
  for delete using (auth.uid() = user_id);

-- ---------- CATEGORIES ----------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null check (type in ('receita','despesa','meio')),
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, type, name)
);

create index if not exists categories_user_idx on public.categories (user_id);

alter table public.categories enable row level security;

drop policy if exists "categories_select_own" on public.categories;
drop policy if exists "categories_insert_own" on public.categories;
drop policy if exists "categories_update_own" on public.categories;
drop policy if exists "categories_delete_own" on public.categories;

create policy "categories_select_own" on public.categories
  for select using (auth.uid() = user_id);
create policy "categories_insert_own" on public.categories
  for insert with check (auth.uid() = user_id);
create policy "categories_update_own" on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories_delete_own" on public.categories
  for delete using (auth.uid() = user_id);

-- ---------- STORAGE: bucket de avatares ----------
-- Público para leitura; escrita apenas na pasta do próprio usuário
-- (convenção de caminho: {user_id}/avatar.ext)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read"  on storage.objects;
drop policy if exists "avatars_owner_insert" on storage.objects;
drop policy if exists "avatars_owner_update" on storage.objects;
drop policy if exists "avatars_owner_delete" on storage.objects;

create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "avatars_owner_update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "avatars_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
