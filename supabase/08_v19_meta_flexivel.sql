-- ============================================================
-- NUMI 1.9 — Meta de economia flexível
-- goal_mode: 'nenhuma' (só controle), 'data' (guardar X até uma data), 'mensal' (guardar X por mês)
-- goal_date: data-alvo do modo 'data'
-- Perfis antigos ficam com goal_mode nulo: o app trata como 'data' até 31/12 do ano
-- (= a meta anual de antes) quando há meta, ou 'nenhuma' quando não há.
-- Só ADICIONA colunas; não altera dados. Idempotente.
-- ============================================================
alter table public.profiles add column if not exists goal_mode text
  check (goal_mode in ('nenhuma','data','mensal'));
alter table public.profiles add column if not exists goal_date date;
