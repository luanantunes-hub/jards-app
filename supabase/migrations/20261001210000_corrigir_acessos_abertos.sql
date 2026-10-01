-- Correções de acesso encontradas na auditoria de segurança. Idempotente.
--   1. Prestação de contas: regra "qualquer conta logada, tudo" -> só quem
--      tem acesso à prestação (can_access_prestacao, já usada em
--      prestacao_distribuicao e prestacao_divulgacao).
--   2. Perfil: o usuário só altera os campos de cadastro, nunca plano/Stripe.
--   4. Funções SECURITY DEFINER: anônimo só executa o que a página pública e
--      as regras de acesso realmente usam.
--   5. Funções SECURITY DEFINER sem search_path fixo.
--   6. proposta_visualizacoes com teto de inserções; sugestoes_editais sem
--      UPDATE aberto.
-- (O item 3, responsaveis, está em 20261001200100.)

-- ─── 1. Prestação de contas ─────────────────────────────────────────────────

drop policy if exists "auth users can manage prestacoes" on public.prestacoes_contas;
drop policy if exists "prestacoes_contas: select" on public.prestacoes_contas;
drop policy if exists "prestacoes_contas: insert" on public.prestacoes_contas;
drop policy if exists "prestacoes_contas: update" on public.prestacoes_contas;
drop policy if exists "prestacoes_contas: delete" on public.prestacoes_contas;
-- Criar: só em nome próprio. Ler/editar/apagar: quem tem acesso à prestação
-- (criador, ou membro da organização do projeto/captação).
create policy "prestacoes_contas: select" on public.prestacoes_contas
  for select to authenticated using (criado_por = auth.uid() or public.can_access_prestacao(id));
create policy "prestacoes_contas: insert" on public.prestacoes_contas
  for insert to authenticated with check (criado_por = auth.uid());
create policy "prestacoes_contas: update" on public.prestacoes_contas
  for update to authenticated
  using (public.can_access_prestacao(id)) with check (public.can_access_prestacao(id));
create policy "prestacoes_contas: delete" on public.prestacoes_contas
  for delete to authenticated using (public.can_access_prestacao(id));

drop policy if exists "auth users can manage atividades" on public.prestacao_atividades;
drop policy if exists "prestacao_atividades: acesso por organizacao" on public.prestacao_atividades;
create policy "prestacao_atividades: acesso por organizacao" on public.prestacao_atividades
  for all to authenticated
  using (public.can_access_prestacao(prestacao_id))
  with check (public.can_access_prestacao(prestacao_id));

drop policy if exists "auth users can manage itens" on public.prestacao_itens;
drop policy if exists "prestacao_itens: acesso por organizacao" on public.prestacao_itens;
create policy "prestacao_itens: acesso por organizacao" on public.prestacao_itens
  for all to authenticated
  using (public.can_access_prestacao(prestacao_id))
  with check (public.can_access_prestacao(prestacao_id));

drop policy if exists "auth users can manage comprovantes" on public.prestacao_comprovantes;
drop policy if exists "prestacao_comprovantes: acesso por organizacao" on public.prestacao_comprovantes;
create policy "prestacao_comprovantes: acesso por organizacao" on public.prestacao_comprovantes
  for all to authenticated
  using (public.can_access_prestacao(prestacao_id))
  with check (public.can_access_prestacao(prestacao_id));

drop policy if exists "auth users can manage relatorio" on public.prestacao_relatorio;
drop policy if exists "prestacao_relatorio: acesso por organizacao" on public.prestacao_relatorio;
create policy "prestacao_relatorio: acesso por organizacao" on public.prestacao_relatorio
  for all to authenticated
  using (public.can_access_prestacao(prestacao_id))
  with check (public.can_access_prestacao(prestacao_id));

drop policy if exists "auth users can manage status log" on public.prestacao_status_log;
drop policy if exists "prestacao_status_log: acesso por organizacao" on public.prestacao_status_log;
create policy "prestacao_status_log: acesso por organizacao" on public.prestacao_status_log
  for all to authenticated
  using (public.can_access_prestacao(prestacao_id))
  with check (public.can_access_prestacao(prestacao_id));

drop policy if exists "auth users can manage evidencias" on public.prestacao_atividade_evidencias;
drop policy if exists "prestacao_atividade_evidencias: acesso por organizacao" on public.prestacao_atividade_evidencias;
create policy "prestacao_atividade_evidencias: acesso por organizacao" on public.prestacao_atividade_evidencias
  for all to authenticated
  using (exists (
    select 1 from public.prestacao_atividades a
    where a.id = atividade_id and public.can_access_prestacao(a.prestacao_id)))
  with check (exists (
    select 1 from public.prestacao_atividades a
    where a.id = atividade_id and public.can_access_prestacao(a.prestacao_id)));

-- ─── 2. Perfil: só campos de cadastro ───────────────────────────────────────
-- Privilégio por coluna: a policy de linha continua valendo (só o próprio
-- perfil), mas plano, Stripe, créditos, super admin e e-mail deixam de ser
-- graváveis pelo cliente. service_role (webhook do Stripe) não é afetado.

revoke update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, onde_conheceu, cargo_funcao, tipo_organizacao,
              tamanho_equipe, objetivo_principal, onboarding_completed)
  on public.profiles to authenticated;

-- ─── 5. search_path fixo nas funções SECURITY DEFINER que não têm ───────────

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prosecdef
      and (p.proconfig is null
           or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.assinatura);
  end loop;
end
$$;

-- ─── 4. Anônimo não executa funções SECURITY DEFINER, salvo as necessárias ──
-- Mantidas para anon: a página pública de proposta (fn_proposta_publica) e as
-- funções chamadas dentro de regras de acesso (auth_org_ids, is_jards_super_admin,
-- can_access_prestacao). Quem já podia executar como usuário logado, continua.

do $$
declare r record; v_authed boolean;
begin
  for r in
    select p.oid, p.oid::regprocedure as assinatura
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prosecdef
      and p.proname not in ('fn_proposta_publica', 'auth_org_ids', 'is_jards_super_admin', 'can_access_prestacao')
  loop
    v_authed := has_function_privilege('authenticated', r.oid, 'execute');
    execute format('revoke execute on function %s from public, anon', r.assinatura);
    if v_authed then
      execute format('grant execute on function %s to authenticated', r.assinatura);
    end if;
    execute format('grant execute on function %s to service_role', r.assinatura);
  end loop;
end
$$;

-- ─── 6. Colchões de segurança ───────────────────────────────────────────────

-- Visualizações de proposta: no máximo 30 por proposta por minuto e 3000 por
-- proposta por dia. Acima disso a linha é descartada em silêncio (não gera erro,
-- para a página pública nunca quebrar).
create or replace function public.fn_limitar_visualizacoes_proposta()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (select count(*) from public.proposta_visualizacoes v
        where v.proposta_id = NEW.proposta_id
          and v.visualizado_em > now() - interval '1 minute') >= 30
     or (select count(*) from public.proposta_visualizacoes v
           where v.proposta_id = NEW.proposta_id
             and v.visualizado_em > now() - interval '1 day') >= 3000
  then
    return null;
  end if;
  NEW.user_agent := left(NEW.user_agent, 300);
  NEW.ip_hash := left(NEW.ip_hash, 128);
  return NEW;
end;
$$;

drop trigger if exists trg_limitar_visualizacoes_proposta on public.proposta_visualizacoes;
create trigger trg_limitar_visualizacoes_proposta
  before insert on public.proposta_visualizacoes
  for each row execute function public.fn_limitar_visualizacoes_proposta();

-- Sugestões de edital: o app só insere. As funções de voto (SECURITY DEFINER)
-- continuam atualizando, pois ignoram esta regra.
drop policy if exists "sugestoes_editais_update_system" on public.sugestoes_editais;
