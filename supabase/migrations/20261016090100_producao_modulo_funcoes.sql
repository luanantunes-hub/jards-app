-- PD0.1 (2 de 2): as três funções que repetem a lista de módulos aceitam a produção.
--
-- Sem DROP: só create or replace, com a mesma assinatura. Aplique depois de
-- 20261016090000_producao_modulo_regras.sql, que é aplicada à mão no editor SQL.
-- As listas são as de MODULOS em lib/modulos.ts, na mesma ordem
-- (tests/producao-modulo-sql.test.ts confere).
--
-- O que muda (definições vigentes lidas em pg_proc, em 15/10/2026):
--   modulos_canonicos    a lista passa a ser captacao, prestacao, producao.
--                        Sem isso, quem pedia a produção a perdia sem erro.
--   fn_conferir_modulos  aceita a produção. Captador e proponente, que são de
--                        fora, só podem ter a captação: a produção é recusada
--                        para eles com captador_sem_modulo, como já era a
--                        prestação (e a regra vale para qualquer módulo que
--                        entre depois).
--   modulo_vagas_limite  ramo da produção igual ao da prestação: o contrato em
--                        vigor (cortesia usa vagas_cortesia; assinatura, 1 mais
--                        as compradas). Sem contrato em vigor, 0 vaga.
--
-- O que já serve sem mudar: admin_definir_acesso_modulo, alterar_modulos_membro,
-- reservar_convite_com_modulos, adicionar_membro_com_modulos e
-- accept_my_organization_invitations não têm lista de módulos; passam por estas
-- três e passam a aceitar a produção. O gatilho que mantém
-- organizations.modulos_ativos (fn_sincronizar_modulos_ativos e
-- fn_aplicar_modulo_ativo) e a proteção dele (fn_proteger_modulos_ativos) valem
-- para qualquer módulo: gravar um contrato de cortesia da produção em
-- organization_modulos já a põe em modulos_ativos.
--
-- Fora desta entrega (só relatado): a cobrança, que recusa módulo que não seja
-- a prestação (fn_processar_cobranca_modulo, PDL.1), e a rotina das cortesias,
-- que avisa só da prestação (fn_prestacao_cortesias_diaria, PD0.6).
--
-- Também revoga o acesso do visitante a modulos_canonicos, que nasceu sem o
-- revoke do restante do repositório: só as funções de convite a chamam.
-- Reaplicável: create or replace e revoke/grant repetem o mesmo resultado.

-- ─── Ordem fixa e sem repetição ─────────────────────────────────────────────
-- {producao, captacao} vira {captacao, producao}.

create or replace function public.modulos_canonicos(p_modulos text[])
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select array(select modulo from unnest(array['captacao', 'prestacao', 'producao']) modulo
               where modulo = any(coalesce(p_modulos, '{}')));
$$;

-- ─── Conferência dos módulos pedidos para um papel ──────────────────────────
-- `p_ja_tem` são os módulos que a pessoa já usa: não ocupam vaga nova. Quem
-- chama trava a organização antes.

create or replace function public.fn_conferir_modulos(
  p_org uuid, p_papel text, p_modulos text[], p_funcao text, p_ja_tem text[])
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  ativos text[];
  modulo text;
begin
  if cardinality(coalesce(p_modulos, '{}')) = 0 then
    raise exception 'ultimo_modulo' using errcode = 'P0001';
  end if;
  if not (p_modulos <@ array['captacao', 'prestacao', 'producao']::text[]) then
    raise exception 'modulo_invalido' using errcode = '22023';
  end if;
  if p_funcao is not null and p_funcao not in ('preparador', 'revisor', 'responsavel') then
    raise exception 'funcao_invalida' using errcode = '22023';
  end if;
  if p_papel in ('captador', 'proponente')
     and exists (select 1 from unnest(p_modulos) as pedido where pedido <> 'captacao') then
    raise exception 'captador_sem_modulo' using errcode = 'P0001';
  end if;

  select organizacao.modulos_ativos into ativos from public.organizations organizacao where organizacao.id = p_org;
  foreach modulo in array p_modulos loop
    continue when modulo = any(coalesce(p_ja_tem, '{}'));
    if not (modulo = any(coalesce(ativos, '{}'))) then
      raise exception 'modulo_inativo' using errcode = 'P0001';
    end if;
    if p_papel not in ('captador', 'proponente')
       and public.modulo_vagas_em_uso(p_org, modulo) >= public.modulo_vagas_limite(p_org, modulo) then
      raise exception 'sem_vaga_%', modulo using errcode = 'check_violation';
    end if;
  end loop;
end;
$$;

-- ─── Vagas por módulo ───────────────────────────────────────────────────────

create or replace function public.modulo_vagas_limite(p_org uuid, p_modulo text)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case p_modulo
    when 'captacao' then 1 + coalesce(
      (select seats.purchased_seats from public.organization_seats seats where seats.organization_id = p_org), 0)
    when 'prestacao' then coalesce(
      (select case when contrato.status = 'cortesia' then contrato.vagas_cortesia else 1 + contrato.vagas_compradas end
       from public.organization_modulos contrato
       where contrato.organization_id = p_org and contrato.modulo = 'prestacao'
         and public.modulo_em_vigor(contrato.status, contrato.cortesia_ate, contrato.past_due_since)), 0)
    when 'producao' then coalesce(
      (select case when contrato.status = 'cortesia' then contrato.vagas_cortesia else 1 + contrato.vagas_compradas end
       from public.organization_modulos contrato
       where contrato.organization_id = p_org and contrato.modulo = 'producao'
         and public.modulo_em_vigor(contrato.status, contrato.cortesia_ate, contrato.past_due_since)), 0)
    else 0
  end;
$$;

-- ─── Quem executa ───────────────────────────────────────────────────────────
-- fn_conferir_modulos e modulo_vagas_limite leem tabelas com a permissão do
-- dono e só a chave de serviço (e as funções de convite) as chamam, como já era.
-- modulos_canonicos não lê tabela: o visitante deixa de executá-la, e quem está
-- logado segue como estava. Ninguém no app chama as três pelo navegador.

revoke execute on function public.modulos_canonicos(text[]) from public, anon;
revoke execute on function public.fn_conferir_modulos(uuid, text, text[], text, text[]) from public, anon, authenticated;
revoke execute on function public.modulo_vagas_limite(uuid, text) from public, anon, authenticated;
grant execute on function public.modulo_vagas_limite(uuid, text) to service_role;
