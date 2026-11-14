-- ============================================================
-- NUMI 1.5 — local da compra (ou destinatário, no Pix) das despesas
-- Rodar no Supabase: SQL Editor > New query > colar > Run
-- Só ADICIONA uma coluna opcional. Idempotente.
-- ============================================================
alter table public.transactions
  add column if not exists place text check (char_length(place) <= 80);
