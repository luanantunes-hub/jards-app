-- T0 (1 de 2): a ticketeria entra nas quatro regras de módulo do banco.
--
-- ESTA É A ÚNICA MIGRATION COM DROP DA ENTREGA. Cada uma das quatro regras
-- lista os módulos que o banco aceita, e uma regra CHECK não troca de lista:
-- só se derruba e se cria de novo (o mesmo caminho da PD0.1, que o conector do
-- Supabase aceitou em 15/10/2026 pelo apply_migration). Se um dia recusar, o
-- precedente é aplicar à mão, no editor SQL do projeto, como
-- supabase/migrations/20261005130100_convites_papeis.sql.
--
-- Aplicada pelo conector do Supabase (apply_migration) em 18/11/2026, na versão
-- 20261118222052, depois de conferir que ninguém tinha a ticketeria.
--
-- Como conferir depois de aplicar (feito em 18/11/2026: as quatro listam
-- 'ticketeria' e continuam listando 'producao'):
--        select conrelid::regclass as tabela, conname, pg_get_constraintdef(oid)
--        from pg_constraint
--        where conname in ('organization_invitations_modulos_acesso_check',
--                          'organization_members_modulos_acesso_check',
--                          'organization_modulos_modulo_check',
--                          'organization_seat_purchases_modulo_check');
-- Só depois aplique 20261118222139_ticketeria_modulo_funcoes.sql (sem DROP).
--
-- Nomes e listas atuais conferidos em pg_constraint no banco de produção em
-- 18/11/2026 (todas com captacao, prestacao e producao). As listas novas são as
-- de MODULOS em lib/modulos.ts, na mesma ordem (tests/ticketeria-modulo-sql.test.ts
-- confere).
--
-- Quem é atingido: ninguém. Nenhuma organização e nenhum vínculo tem a
-- ticketeria; o módulo fica escondido dos clientes (MODULOS_EM_CONSTRUCAO).
-- Reaplicável: cada regra é derrubada (if exists) e criada de novo com a mesma
-- lista. O lock_timeout faz a troca falhar, em vez de travar o app, se alguma
-- consulta longa estiver segurando a tabela (é só rodar de novo).
--
-- Para voltar atrás: o mesmo arquivo com as listas antigas
-- ('captacao', 'prestacao', 'producao'). Só funciona enquanto nenhuma linha
-- tiver 'ticketeria'; o banco recusa a regra se tiver.

set local lock_timeout = '10s';

-- ─── A porta do navegador ───────────────────────────────────────────────────
-- Nada a fazer: a regra restritiva "organization_members: modulo pago so pelo
-- suporte" (PD0.1) vale para qualquer módulo além da captação, a ticketeria
-- inclusive. O navegador continua sem poder inserir vínculo com ela.

-- ─── Convites: módulos que o convite pode dar ───────────────────────────────

alter table public.organization_invitations
  drop constraint if exists organization_invitations_modulos_acesso_check;
alter table public.organization_invitations
  add constraint organization_invitations_modulos_acesso_check
  check (cardinality(modulos_acesso) > 0 and modulos_acesso <@ array['captacao', 'prestacao', 'producao', 'ticketeria']::text[]);

-- ─── Vínculos: módulos que a pessoa usa na organização ──────────────────────

alter table public.organization_members
  drop constraint if exists organization_members_modulos_acesso_check;
alter table public.organization_members
  add constraint organization_members_modulos_acesso_check
  check (cardinality(modulos_acesso) > 0 and modulos_acesso <@ array['captacao', 'prestacao', 'producao', 'ticketeria']::text[]);

-- ─── Contratos: módulo contratado pela organização ──────────────────────────

alter table public.organization_modulos
  drop constraint if exists organization_modulos_modulo_check;
alter table public.organization_modulos
  add constraint organization_modulos_modulo_check
  check (modulo = any (array['captacao', 'prestacao', 'producao', 'ticketeria']::text[]));

-- ─── Compras de vagas: módulo da vaga ───────────────────────────────────────

alter table public.organization_seat_purchases
  drop constraint if exists organization_seat_purchases_modulo_check;
alter table public.organization_seat_purchases
  add constraint organization_seat_purchases_modulo_check
  check (modulo = any (array['captacao', 'prestacao', 'producao', 'ticketeria']::text[]));
