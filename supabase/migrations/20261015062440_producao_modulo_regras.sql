-- PD0.1 (1 de 2): a produção entra nas quatro regras de módulo do banco.
--
-- ESTA É A ÚNICA MIGRATION COM DROP DA ENTREGA. Cada uma das quatro regras
-- lista os módulos que o banco aceita, e uma regra CHECK não troca de lista:
-- só se derruba e se cria de novo. Foi aplicada pelo conector do Supabase
-- (apply_migration) em 15/10/2026, na versão 20261015062440: o conector aceita
-- DROP CONSTRAINT. Se um dia recusar, o precedente é aplicar à mão, no editor
-- SQL do projeto, como supabase/migrations/20261005130100_convites_papeis.sql.
--
-- Como conferir depois de aplicar (feito em 15/10/2026: as quatro listam
-- 'producao'):
--        select conrelid::regclass as tabela, conname, pg_get_constraintdef(oid)
--        from pg_constraint
--        where conname in ('organization_invitations_modulos_acesso_check',
--                          'organization_members_modulos_acesso_check',
--                          'organization_modulos_modulo_check',
--                          'organization_seat_purchases_modulo_check');
-- Só depois aplique 20261015062658_producao_modulo_funcoes.sql (sem DROP).
--
-- Nomes conferidos em pg_constraint no banco de produção, em 15/10/2026:
--   organization_invitations     organization_invitations_modulos_acesso_check
--   organization_members         organization_members_modulos_acesso_check
--   organization_modulos         organization_modulos_modulo_check
--   organization_seat_purchases  organization_seat_purchases_modulo_check
-- As listas novas são as de MODULOS em lib/modulos.ts, na mesma ordem
-- (tests/producao-modulo-sql.test.ts confere).
--
-- Quem é atingido: ninguém. Hoje toda organização e todo membro têm só a
-- captação (duas organizações têm também a prestação, em cortesia). Ninguém
-- tem a produção, e nenhuma organização deve recebê-la antes da PD0.3: sem a
-- página /producoes, quem só tem a produção cairia numa página não encontrada.
--
-- Ordem dentro do arquivo: primeiro a porta do navegador, depois as regras.
-- A regra permissiva "organization_members: admin gerencia membros" deixaria o
-- admin de uma organização inserir vínculos direto pela API, e a regra
-- restritiva "prestacao so pelo suporte" de 20261005120000 só olha a prestação.
-- Se as regras abrissem antes, um admin poderia dar a produção a si mesmo sem
-- passar pelas vagas. Hoje isso não acontece só por acaso: a regra permissiva
-- consulta a própria tabela e dá erro de recursão (42P17) em qualquer inserção
-- pelo navegador (conferido em 15/10/2026, numa transação desfeita); o dia em
-- que alguém consertar isso, a porta já estará fechada. A regra nova vale para
-- qualquer módulo além da captação, que é livre; a antiga fica como está e sai
-- numa migration de contração, depois.
--
-- Reaplicável: a regra restritiva só é criada se não existir, e cada regra
-- CHECK é derrubada (if exists) e criada de novo com a mesma lista. Se parar
-- no meio, rode o arquivo de novo. As tabelas são pequenas (em 15/10/2026:
-- 156 vínculos, 7 convites, 2 contratos, 1 compra de vaga), então cada troca
-- leva milissegundos; o lock_timeout faz a troca falhar, em vez de travar o
-- app, se alguma consulta longa estiver segurando a tabela (aí é só rodar de
-- novo). Dentro de uma transação, como o editor SQL faz com vários comandos,
-- ou tudo vale ou nada vale.
--
-- Para voltar atrás: o mesmo arquivo com as listas antigas
-- ('captacao', 'prestacao'). Só funciona enquanto nenhuma linha tiver
-- 'producao'; o banco recusa a regra se tiver.

set local lock_timeout = '10s';

-- ─── A porta do navegador ───────────────────────────────────────────────────
-- Ninguém se dá um módulo pago pelo navegador: o vínculo com qualquer módulo
-- além da captação só entra pelo suporte (super admin) ou pelas funções do
-- servidor (convite, aceite e acesso por módulo), que contam as vagas.

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'organization_members'
                 and policyname = 'organization_members: modulo pago so pelo suporte') then
    create policy "organization_members: modulo pago so pelo suporte" on public.organization_members
      as restrictive for insert to authenticated
      with check (coalesce(modulos_acesso, '{}') <@ array['captacao']::text[] or public.is_jards_super_admin());
  end if;
end
$$;

-- ─── Convites: módulos que o convite pode dar ───────────────────────────────

alter table public.organization_invitations
  drop constraint if exists organization_invitations_modulos_acesso_check;
alter table public.organization_invitations
  add constraint organization_invitations_modulos_acesso_check
  check (cardinality(modulos_acesso) > 0 and modulos_acesso <@ array['captacao', 'prestacao', 'producao']::text[]);

-- ─── Vínculos: módulos que a pessoa usa na organização ──────────────────────

alter table public.organization_members
  drop constraint if exists organization_members_modulos_acesso_check;
alter table public.organization_members
  add constraint organization_members_modulos_acesso_check
  check (cardinality(modulos_acesso) > 0 and modulos_acesso <@ array['captacao', 'prestacao', 'producao']::text[]);

-- ─── Contratos: módulo contratado pela organização ──────────────────────────

alter table public.organization_modulos
  drop constraint if exists organization_modulos_modulo_check;
alter table public.organization_modulos
  add constraint organization_modulos_modulo_check
  check (modulo = any (array['captacao', 'prestacao', 'producao']::text[]));

-- ─── Compras de vagas: módulo da vaga ───────────────────────────────────────

alter table public.organization_seat_purchases
  drop constraint if exists organization_seat_purchases_modulo_check;
alter table public.organization_seat_purchases
  add constraint organization_seat_purchases_modulo_check
  check (modulo = any (array['captacao', 'prestacao', 'producao']::text[]));
