-- PD0.4b: as tabelas centrais passam de "por pessoa" para "por organização".
--
-- Em produção, captacoes, contatos, editais_user, projetos_crm e atividades só
-- aparecem para quem as criou (account_id = auth.uid()). Isso impede a equipe:
-- um colaborador não vê o projeto do admin, nem a Prestação ou a Produção, que
-- leem projetos e atividades, funcionam para mais de uma pessoa. As migrations
-- de julho que fariam isso (20260726000012 e 20260726000022) nunca valeram no
-- banco.
--
-- Expansão, sem DROP e sem tocar nas regras existentes (as "por pessoa" ficam
-- e continuam valendo para quem criou e para captador e proponente):
--   ler:    membros internos (nem captador nem proponente) da organização, com
--           o módulo Captação nas três tabelas comerciais e com qualquer módulo
--           em projetos_crm e atividades (a Prestação e a Produção leem esses dois);
--   editar: o mesmo, menos o leitor;
--   apagar: só o admin da organização (ou quem criou, pela regra antiga).
-- Criar continua pela regra antiga (account_id = quem está logado). O super
-- admin não ganha leitura de outras organizações por aqui: só enxerga as dele.
--
-- Hoje a mudança não deixa ninguém ver nada novo: nenhuma organização tem linha
-- de mais de uma pessoa nessas tabelas (conferido em 15/10/2026).
--
-- Em projetos_crm e atividades entra também uma guarda restritiva de escrita:
-- com a leitura por organização, quem gravasse uma linha na organização de outro
-- inquilino a colocaria na frente dele. Linha sem organização continua aceita na
-- criação enquanto o app antigo não sai de circulação (a tela da negociação criava
-- atividade sem organização); a contração exige a organização.
--
-- Aditiva e idempotente; sem DROP.

-- ─── 1. Organizações em que a pessoa é da equipe ────────────────────────────
-- p_modulo: módulo exigido, ou null para "qualquer módulo". p_nivel: 'ver'
-- (membro interno), 'editar' (interno, menos o leitor) ou 'admin'. Nível
-- desconhecido não devolve nada. Sem passe livre para o super admin.

create or replace function public.auth_org_ids_equipe(p_modulo text, p_nivel text)
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.organization_id
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = auth.uid()
    and m.papel not in ('captador', 'proponente')
    and case p_nivel
          when 'ver' then true
          when 'editar' then m.papel <> 'leitor'
          when 'admin' then m.papel = 'admin'
          else false
        end
    and case
          when p_modulo is null then m.modulos_acesso && o.modulos_ativos
          else p_modulo = any (o.modulos_ativos) and p_modulo = any (m.modulos_acesso)
        end;
$$;

revoke execute on function public.auth_org_ids_equipe(text, text) from public, anon;
grant execute on function public.auth_org_ids_equipe(text, text) to authenticated;

comment on function public.auth_org_ids_equipe(text, text) is
  'Organizações em que a pessoa logada é da equipe (nem captador nem proponente), com o módulo pedido (null = qualquer) e o nível pedido: ver, editar (sem o leitor) ou admin.';

-- ─── 2. Registros antigos sem organização ───────────────────────────────────
-- Em 15/10/2026: 1 atividade de uma conta com uma só organização (ligada a ela)
-- e 3 projetos de setembro de uma conta com três organizações (ficam como estão:
-- não se adivinha em qual; seguem visíveis para quem os criou).

update public.projetos_crm p
set organization_id = (select m.organization_id from public.organization_members m where m.user_id = p.account_id)
where p.organization_id is null
  and (select count(*) from public.organization_members m where m.user_id = p.account_id) = 1;

update public.atividades a
set organization_id = (select m.organization_id from public.organization_members m where m.user_id = a.account_id)
where a.organization_id is null
  and (select count(*) from public.organization_members m where m.user_id = a.account_id) = 1;

-- ─── 3. Regras por organização ──────────────────────────────────────────────

do $$
declare
  v_tabela text;
  v_modulo text;
  v_nome text;
  v_condicao text;
begin
  foreach v_tabela in array array['captacoes', 'contatos', 'editais_user', 'projetos_crm', 'atividades'] loop
    -- Comerciais: módulo Captação. Compartilhadas: qualquer módulo.
    v_modulo := case when v_tabela in ('projetos_crm', 'atividades') then 'null::text' else '''captacao''' end;

    v_nome := v_tabela || ': select equipe';
    v_condicao := format('organization_id = any (array (select public.auth_org_ids_equipe(%s, ''ver'')))', v_modulo);
    if not exists (select 1 from pg_policy where polrelid = format('public.%I', v_tabela)::regclass and polname = v_nome) then
      execute format('create policy %I on public.%I for select to authenticated using (%s)', v_nome, v_tabela, v_condicao);
    end if;

    v_nome := v_tabela || ': update equipe';
    v_condicao := format('organization_id = any (array (select public.auth_org_ids_equipe(%s, ''editar'')))', v_modulo);
    if not exists (select 1 from pg_policy where polrelid = format('public.%I', v_tabela)::regclass and polname = v_nome) then
      execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
        v_nome, v_tabela, v_condicao, v_condicao);
    end if;

    v_nome := v_tabela || ': delete admin';
    v_condicao := format('organization_id = any (array (select public.auth_org_ids_equipe(%s, ''admin'')))', v_modulo);
    if not exists (select 1 from pg_policy where polrelid = format('public.%I', v_tabela)::regclass and polname = v_nome) then
      execute format('create policy %I on public.%I for delete to authenticated using (%s)', v_nome, v_tabela, v_condicao);
    end if;
  end loop;

  -- Guarda restritiva: projetos e atividades só se gravam na organização de quem grava.
  foreach v_tabela in array array['projetos_crm', 'atividades'] loop
    v_condicao := 'organization_id is null or organization_id = any (array (select public.auth_org_ids()))';

    v_nome := v_tabela || ': insere so na propria organizacao';
    if not exists (select 1 from pg_policy where polrelid = format('public.%I', v_tabela)::regclass and polname = v_nome) then
      execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (%s)',
        v_nome, v_tabela, v_condicao);
    end if;

    v_nome := v_tabela || ': altera so na propria organizacao';
    if not exists (select 1 from pg_policy where polrelid = format('public.%I', v_tabela)::regclass and polname = v_nome) then
      execute format('create policy %I on public.%I as restrictive for update to authenticated using (true) with check (%s)',
        v_nome, v_tabela, v_condicao);
    end if;
  end loop;
end
$$;
