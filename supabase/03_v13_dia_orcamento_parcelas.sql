-- ============================================================
-- NUMI 1.3 — dia nas recorrentes, orçamento por categoria, parcelas
-- Rodar no Supabase: SQL Editor > New query > colar tudo > Run
-- Só ADICIONA colunas opcionais: nada é apagado ou alterado, e versões
-- anteriores do app continuam funcionando. Idempotente.
-- ============================================================

-- dia do mês em que a recorrente costuma cair (opcional; vazio = sem dia fixo)
alter table public.recurrents
  add column if not exists day integer check (day between 1 and 31);

-- limite mensal opcional por categoria de despesa
alter table public.categories
  add column if not exists monthly_limit numeric check (monthly_limit >= 0);

-- compras parceladas: cada parcela é um lançamento ligado ao mesmo grupo
alter table public.transactions
  add column if not exists installment_group uuid,
  add column if not exists installment_no integer check (installment_no >= 1),
  add column if not exists installment_total integer check (installment_total >= 1);

-- o app passa a carregar todos os anos (seletor de ano + visão geral)
create index if not exists transactions_user_year_idx
  on public.transactions (user_id, year);
create index if not exists transactions_installment_idx
  on public.transactions (user_id, installment_group)
  where installment_group is not null;
