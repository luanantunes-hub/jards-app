-- PD7.2 (primeiro corte): convidados e cortesias por sessão.
--
-- producao_credencial_tipos: os tipos de credencial da casa (Imprensa, Convidado do elenco, Parceiro...), cada um com uma cota por sessão (vazia = sem limite).
-- producao_convidados: quem a produção convida para uma sessão da grade de programação (PD8.1), com o tipo, só o NOME e a afiliação, a quantidade de
-- lugares (a pessoa e os acompanhantes) e a situação: pedido, confirmado ou recusado. Sem CPF, sem documento, sem telefone: o resto
-- fica para quando houver política de dados.
--
-- A cota é conferida no banco: a soma dos lugares que não foram recusados, por sessão e por tipo, não passa da cota do tipo
-- (erro `cota_excedida`). A linha do tipo é travada durante a conferência, para dois pedidos ao mesmo tempo não furarem a cota.
-- A conferência só roda quando o consumo da cota aumenta (lugar novo, tipo trocado, pedido recusado que volta, mais lugares).
-- Baixar a cota abaixo do que já foi dado não apaga ninguém nem trava a edição: a tela mostra o saldo negativo.
--
-- Acesso: os tipos são da organização, no mesmo recorte das outras tabelas de cadastro; os convidados herdam o acesso da sessão
-- (e, por ela, o da pauta e do espaço: o recorte "só onde está vinculado" vale). Apagar: o convidado sai com a sessão; um tipo em uso
-- não se apaga (RESTRICT), arquiva-se.
--
-- Expansão: duas tabelas novas e vazias, duas funções de gatilho e a função do histórico trocada (create or replace, mesma assinatura,
-- os ramos de antes mais dois no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_credencial_tipos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null,
  cota_por_sessao integer,
  arquivado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_credencial_tipos_nome_check check (char_length(btrim(nome)) between 1 and 60),
  constraint producao_credencial_tipos_cota_check check (cota_por_sessao is null or cota_por_sessao between 0 and 5000)
);

create unique index if not exists producao_credencial_tipos_nome_idx on public.producao_credencial_tipos (organization_id, lower(btrim(nome)));

create table if not exists public.producao_convidados (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sessao_id uuid not null references public.producao_sessoes (id) on delete cascade,
  tipo_id uuid not null references public.producao_credencial_tipos (id) on delete restrict,
  nome text not null,
  afiliacao text,
  quantidade integer not null default 1,
  situacao text not null default 'pedido',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_convidados_nome_check check (char_length(btrim(nome)) between 1 and 120),
  constraint producao_convidados_afiliacao_check check (afiliacao is null or char_length(btrim(afiliacao)) between 1 and 120),
  constraint producao_convidados_quantidade_check check (quantidade between 1 and 20),
  constraint producao_convidados_situacao_check check (situacao in ('pedido', 'confirmado', 'recusado'))
);

create index if not exists producao_convidados_org_idx on public.producao_convidados (organization_id);
create index if not exists producao_convidados_sessao_idx on public.producao_convidados (sessao_id, tipo_id);
create index if not exists producao_convidados_tipo_idx on public.producao_convidados (tipo_id);

-- Coerência do tipo: a organização não muda.
-- Erros (check_violation): organizacao_nao_muda.
create or replace function public.fn_producao_credencial_tipo_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Coerência do convidado: a organização, a sessão e o tipo são da mesma organização; a sessão não muda; e a cota do tipo vale.
-- Erros (check_violation): organizacao_nao_muda, sessao_nao_muda, sessao_de_outra_organizacao, tipo_de_outra_organizacao,
-- tipo_arquivado (só ao escolher o tipo), cota_excedida.
create or replace function public.fn_producao_convidado_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cota integer;
  v_arquivado boolean;
  v_usados integer;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.sessao_id is distinct from old.sessao_id then
    raise exception 'sessao_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_sessoes s where s.id = new.sessao_id and s.organization_id = new.organization_id) then
    raise exception 'sessao_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  -- Trava a linha do tipo: dois pedidos ao mesmo tempo esperam um pelo outro e a soma sai certa.
  select t.cota_por_sessao, t.arquivado into v_cota, v_arquivado
  from public.producao_credencial_tipos t where t.id = new.tipo_id and t.organization_id = new.organization_id for update;
  if not found then
    raise exception 'tipo_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if (tg_op = 'INSERT' or new.tipo_id is distinct from old.tipo_id) and v_arquivado then
    raise exception 'tipo_arquivado' using errcode = 'check_violation';
  end if;
  -- Só confere a cota quando o consumo dela aumenta: lugar novo, tipo trocado, pedido recusado que volta ou mais lugares. Mudar o nome
  -- ou confirmar um pedido que já contava não trava, mesmo depois de a cota baixar.
  if new.situacao <> 'recusado' and v_cota is not null
     and (tg_op = 'INSERT' or new.tipo_id is distinct from old.tipo_id or old.situacao = 'recusado' or new.quantidade > old.quantidade) then
    select coalesce(sum(c.quantidade), 0) into v_usados
    from public.producao_convidados c
    where c.sessao_id = new.sessao_id and c.tipo_id = new.tipo_id and c.situacao <> 'recusado'
      and (tg_op = 'INSERT' or c.id <> new.id);
    if v_usados + new.quantidade > v_cota then
      raise exception 'cota_excedida' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger producao_credencial_tipos_coerencia
  before insert or update on public.producao_credencial_tipos
  for each row execute function public.fn_producao_credencial_tipo_coerencia();
create or replace trigger producao_credencial_tipos_updated_at
  before update on public.producao_credencial_tipos
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_credencial_tipos_historico
  after insert or update or delete on public.producao_credencial_tipos
  for each row execute function public.fn_producao_historico('', 'nome');

create or replace trigger producao_convidados_coerencia
  before insert or update on public.producao_convidados
  for each row execute function public.fn_producao_convidado_coerencia();
create or replace trigger producao_convidados_updated_at
  before update on public.producao_convidados
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_convidados_historico
  after insert or update or delete on public.producao_convidados
  for each row execute function public.fn_producao_historico('', 'nome');

-- Quem vê o histórico: o texto de 20261115100000_producao_voluntarios.sql com dois ramos novos no fim.
create or replace function public.auth_producao_ve_historico(p_org uuid, p_entidade text, p_entidade_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(case p_entidade
    when 'producao_obras' then exists (select 1 from public.producao_obras x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_temporadas' then exists (select 1 from public.producao_temporadas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_datas' then exists (select 1 from public.producao_datas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_blocos' then exists (select 1 from public.producao_blocos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_espacos' then exists (select 1 from public.producao_espacos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_salas' then exists (select 1 from public.producao_salas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_funcoes' then exists (select 1 from public.producao_funcoes x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_arquivos' then exists (select 1 from public.producao_arquivos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_pessoas' then exists (select 1 from public.producao_pessoas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_vinculos' then exists (select 1 from public.producao_vinculos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_escalas' then exists (select 1 from public.producao_escalas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_cartoes_dia' then exists (select 1 from public.producao_cartoes_dia x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_tarefas' then exists (select 1 from public.producao_tarefas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_notas' then exists (select 1 from public.producao_notas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_modelos_dia' then exists (select 1 from public.producao_modelos_dia x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_pautas' then exists (select 1 from public.producao_pautas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_itens' then exists (select 1 from public.producao_itens x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_plantas' then exists (select 1 from public.producao_plantas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_riders' then exists (select 1 from public.producao_riders x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_equipamentos' then exists (select 1 from public.producao_equipamentos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_turnos' then exists (select 1 from public.producao_turnos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_licencas' then exists (select 1 from public.producao_licencas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_modelos_acerto' then exists (select 1 from public.producao_modelos_acerto x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_acertos' then exists (select 1 from public.producao_acertos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_sessoes' then exists (select 1 from public.producao_sessoes x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_sites' then exists (select 1 from public.producao_sites x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_site_paginas' then exists (select 1 from public.producao_site_paginas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_veiculos' then exists (select 1 from public.producao_veiculos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_deslocamentos' then exists (select 1 from public.producao_deslocamentos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_hospedagens' then exists (select 1 from public.producao_hospedagens x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_convites' then exists (select 1 from public.producao_convites x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_ocorrencias' then exists (select 1 from public.producao_ocorrencias x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_voluntarios' then exists (select 1 from public.producao_voluntarios x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_credencial_tipos' then exists (select 1 from public.producao_credencial_tipos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_convidados' then exists (select 1 from public.producao_convidados x where x.id = p_entidade_id and x.organization_id = p_org)
  end, false);
$$;

alter table public.producao_credencial_tipos enable row level security;
alter table public.producao_convidados enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_credencial_tipos' and policyname = 'producao_credencial_tipos: le') then
    create policy "producao_credencial_tipos: le" on public.producao_credencial_tipos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_credencial_tipos' and policyname = 'producao_credencial_tipos: leitura sem assinatura') then
    create policy "producao_credencial_tipos: leitura sem assinatura" on public.producao_credencial_tipos for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_credencial_tipos' and policyname = 'producao_credencial_tipos: insere') then
    create policy "producao_credencial_tipos: insere" on public.producao_credencial_tipos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_credencial_tipos' and policyname = 'producao_credencial_tipos: edita') then
    create policy "producao_credencial_tipos: edita" on public.producao_credencial_tipos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_credencial_tipos' and policyname = 'producao_credencial_tipos: apaga') then
    create policy "producao_credencial_tipos: apaga" on public.producao_credencial_tipos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_convidados' and policyname = 'producao_convidados: le') then
    create policy "producao_convidados: le" on public.producao_convidados for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_sessoes s where s.id = producao_convidados.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_convidados' and policyname = 'producao_convidados: leitura sem assinatura') then
    create policy "producao_convidados: leitura sem assinatura" on public.producao_convidados for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_sessoes s where s.id = producao_convidados.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_convidados' and policyname = 'producao_convidados: insere') then
    create policy "producao_convidados: insere" on public.producao_convidados for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_convidados.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_convidados' and policyname = 'producao_convidados: edita') then
    create policy "producao_convidados: edita" on public.producao_convidados for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_convidados.sessao_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_convidados.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_convidados' and policyname = 'producao_convidados: apaga') then
    create policy "producao_convidados: apaga" on public.producao_convidados for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_convidados.sessao_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_credencial_tipo_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_convidado_coerencia() from public, anon, authenticated;
revoke all on public.producao_credencial_tipos, public.producao_convidados from anon, authenticated;
grant select, insert, update, delete on public.producao_credencial_tipos, public.producao_convidados to authenticated;

comment on table public.producao_credencial_tipos is 'Tipo de credencial da casa (imprensa, convidado do elenco...) com a cota por sessão; vazia = sem limite.';
comment on table public.producao_convidados is 'Convidado de uma sessão: tipo, só nome e afiliação, lugares e situação (pedido, confirmado, recusado); a cota do tipo é conferida pelo banco.';
