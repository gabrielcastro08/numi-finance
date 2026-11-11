-- ============================================================
-- NUMI 1.4 — emoji escolhido pelo usuário para cada categoria
-- Rodar no Supabase: SQL Editor > New query > colar > Run
-- Só ADICIONA uma coluna opcional. Idempotente.
-- ============================================================
alter table public.categories
  add column if not exists icon text check (char_length(icon) <= 16);
