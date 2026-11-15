-- ============================================================
-- NUMI 1.7 — Objetivos (caixinhas)
-- Rodar no Supabase: SQL Editor > New query > colar > Run
-- Só CRIA duas tabelas novas; não altera nada existente. Idempotente.
-- ============================================================

-- ---------- GOALS: cada objetivo (viagem, compra, projeto...) ----------
create table if not exists public.goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  icon         text check (char_length(icon) <= 16),
  target       numeric(12,2) not null check (target > 0),       -- valor estimado
  target_date  date,                                            -- quando quer realizar (opcional)
  priority     int  not null default 0,                         -- menor = mais importante
  status       text not null default 'ativo' check (status in ('ativo','pausado','concluido')),
  plan         jsonb not null default '[]'::jsonb,              -- orçamento detalhado [{label, amount}]
  notes        text check (char_length(notes) <= 2000),
  created_at   timestamptz not null default now(),
  done_at      timestamptz
);
create index if not exists goals_user_idx on public.goals (user_id);

alter table public.goals enable row level security;
drop policy if exists "goals_select_own" on public.goals;
drop policy if exists "goals_insert_own" on public.goals;
drop policy if exists "goals_update_own" on public.goals;
drop policy if exists "goals_delete_own" on public.goals;
create policy "goals_select_own" on public.goals
  for select using ((select auth.uid()) = user_id);
create policy "goals_insert_own" on public.goals
  for insert with check ((select auth.uid()) = user_id);
create policy "goals_update_own" on public.goals
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "goals_delete_own" on public.goals
  for delete using ((select auth.uid()) = user_id);

-- ---------- GOAL_MOVES: dinheiro guardado (+) ou retirado (−) de um objetivo ----------
create table if not exists public.goal_moves (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  goal_id     uuid not null references public.goals(id) on delete cascade,
  amount      numeric(12,2) not null check (amount <> 0),
  date        date not null default current_date,
  note        text check (char_length(note) <= 200),
  created_at  timestamptz not null default now()
);
create index if not exists goal_moves_user_idx on public.goal_moves (user_id);
create index if not exists goal_moves_goal_idx on public.goal_moves (goal_id);

alter table public.goal_moves enable row level security;
drop policy if exists "goal_moves_select_own" on public.goal_moves;
drop policy if exists "goal_moves_insert_own" on public.goal_moves;
drop policy if exists "goal_moves_update_own" on public.goal_moves;
drop policy if exists "goal_moves_delete_own" on public.goal_moves;
create policy "goal_moves_select_own" on public.goal_moves
  for select using ((select auth.uid()) = user_id);
-- só pode guardar dinheiro em objetivo próprio
create policy "goal_moves_insert_own" on public.goal_moves
  for insert with check ((select auth.uid()) = user_id
    and exists (select 1 from public.goals g where g.id = goal_id and g.user_id = (select auth.uid())));
create policy "goal_moves_update_own" on public.goal_moves
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and exists (select 1 from public.goals g where g.id = goal_id and g.user_id = (select auth.uid())));
create policy "goal_moves_delete_own" on public.goal_moves
  for delete using ((select auth.uid()) = user_id);
