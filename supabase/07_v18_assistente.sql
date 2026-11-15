-- ============================================================
-- NUMI 1.8 — Assistente (IA)
-- Uso diário da IA por usuário: serve para o limite diário (freio de gasto)
-- e para mostrar quanto já foi usado. Só a Edge Function "numi-ai" escreve
-- aqui (com a service role); o usuário só pode LER o próprio uso.
-- Só CRIA uma tabela nova; não altera nada existente. Idempotente.
-- ============================================================

create table if not exists public.ai_usage (
  user_id        uuid not null references auth.users(id) on delete cascade,
  day            date not null default current_date,
  requests       int  not null default 0,      -- chamadas à IA (cada ida e volta conta)
  questions      int  not null default 0,      -- perguntas novas do usuário
  input_tokens   int  not null default 0,
  output_tokens  int  not null default 0,
  cache_read     int  not null default 0,
  cache_write    int  not null default 0,
  web_searches   int  not null default 0,
  cost_usd       numeric(10,5) not null default 0,  -- custo estimado em dólar (preço de tabela)
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage
  for select using ((select auth.uid()) = user_id);
-- sem policies de insert/update/delete: só a service role (Edge Function) grava.

-- soma atômica do uso (chamada pela Edge Function com a service role)
create or replace function public.ai_add_usage(
  p_user uuid, p_requests int, p_questions int, p_in int, p_out int,
  p_cache_read int, p_cache_write int, p_web int, p_cost numeric)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ai_usage as u (user_id, day, requests, questions, input_tokens, output_tokens, cache_read, cache_write, web_searches, cost_usd)
  values (p_user, current_date, p_requests, p_questions, p_in, p_out, p_cache_read, p_cache_write, p_web, p_cost)
  on conflict (user_id, day) do update set
    requests      = u.requests + excluded.requests,
    questions     = u.questions + excluded.questions,
    input_tokens  = u.input_tokens + excluded.input_tokens,
    output_tokens = u.output_tokens + excluded.output_tokens,
    cache_read    = u.cache_read + excluded.cache_read,
    cache_write   = u.cache_write + excluded.cache_write,
    web_searches  = u.web_searches + excluded.web_searches,
    cost_usd      = u.cost_usd + excluded.cost_usd;
$$;
revoke all on function public.ai_add_usage(uuid,int,int,int,int,int,int,int,numeric) from public, anon, authenticated;
grant execute on function public.ai_add_usage(uuid,int,int,int,int,int,int,int,numeric) to service_role;
