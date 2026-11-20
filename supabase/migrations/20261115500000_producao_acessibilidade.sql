-- PD7.6 (primeiro corte): acessibilidade por sessão.
--
-- producao_acessibilidade: o que a casa oferece de acessibilidade numa sessão da programação (PD8.1): interpretação em Libras, audiodescrição, legendagem,
-- lugares reservados ou outro recurso, com a situação (planejado, confirmado ou cancelado), a pessoa da equipe escalada para o
-- recurso (a intérprete, o audiodescritor), quantos lugares estão reservados (só para "lugares reservados") e uma nota. O custo no
-- orçamento fica para quando houver o orçamento da produção.
--
-- Acesso: o da sessão (quem lê a sessão lê; quem edita e vê a sessão escreve), então o recorte "só onde está vinculado" vale. O histórico
-- guarda o tipo, a situação, a pessoa e os lugares e deixa a nota de fora (pode falar de uma pessoa do público). Apagar: o recurso sai com a
-- sessão; apagar a pessoa escalada só solta a ligação.
--
-- Expansão: uma tabela nova e vazia, uma função de gatilho e a função do histórico trocada (create or replace, mesma assinatura, os
-- ramos de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_acessibilidade (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sessao_id uuid not null references public.producao_sessoes (id) on delete cascade,
  tipo text not null,
  situacao text not null default 'planejado',
  pessoa_id uuid references public.producao_pessoas (id) on delete set null,
  lugares integer,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_acessibilidade_tipo_check check (tipo in ('libras', 'audiodescricao', 'legendagem', 'lugares_reservados', 'outro')),
  constraint producao_acessibilidade_situacao_check check (situacao in ('planejado', 'confirmado', 'cancelado')),
  constraint producao_acessibilidade_lugares_check check (lugares is null or (tipo = 'lugares_reservados' and lugares between 1 and 500)),
  constraint producao_acessibilidade_notas_check check (notas is null or char_length(btrim(notas)) between 1 and 500)
);

create index if not exists producao_acessibilidade_org_idx on public.producao_acessibilidade (organization_id);
create index if not exists producao_acessibilidade_sessao_idx on public.producao_acessibilidade (sessao_id, tipo);
create index if not exists producao_acessibilidade_pessoa_idx on public.producao_acessibilidade (pessoa_id) where pessoa_id is not null;

-- Coerência: a organização e a sessão não mudam; a sessão e a pessoa são da organização.
-- Erros (check_violation): organizacao_nao_muda, sessao_nao_muda, sessao_de_outra_organizacao, pessoa_de_outra_organizacao.
create or replace function public.fn_producao_acessibilidade_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
  if new.pessoa_id is not null
     and not exists (select 1 from public.producao_pessoas p where p.id = new.pessoa_id and p.organization_id = new.organization_id) then
    raise exception 'pessoa_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_acessibilidade_coerencia
  before insert or update on public.producao_acessibilidade
  for each row execute function public.fn_producao_acessibilidade_coerencia();
create or replace trigger producao_acessibilidade_updated_at
  before update on public.producao_acessibilidade
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_acessibilidade_historico
  after insert or update or delete on public.producao_acessibilidade
  for each row execute function public.fn_producao_historico('notas', 'tipo');

-- Quem vê o histórico: o texto de 20261115200000_producao_convidados.sql com um ramo novo no fim.
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
    when 'producao_acessibilidade' then exists (select 1 from public.producao_acessibilidade x where x.id = p_entidade_id and x.organization_id = p_org)
  end, false);
$$;

alter table public.producao_acessibilidade enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acessibilidade' and policyname = 'producao_acessibilidade: le') then
    create policy "producao_acessibilidade: le" on public.producao_acessibilidade for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_sessoes s where s.id = producao_acessibilidade.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acessibilidade' and policyname = 'producao_acessibilidade: leitura sem assinatura') then
    create policy "producao_acessibilidade: leitura sem assinatura" on public.producao_acessibilidade for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_sessoes s where s.id = producao_acessibilidade.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acessibilidade' and policyname = 'producao_acessibilidade: insere') then
    create policy "producao_acessibilidade: insere" on public.producao_acessibilidade for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_acessibilidade.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acessibilidade' and policyname = 'producao_acessibilidade: edita') then
    create policy "producao_acessibilidade: edita" on public.producao_acessibilidade for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_acessibilidade.sessao_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_acessibilidade.sessao_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acessibilidade' and policyname = 'producao_acessibilidade: apaga') then
    create policy "producao_acessibilidade: apaga" on public.producao_acessibilidade for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_sessoes s where s.id = producao_acessibilidade.sessao_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_acessibilidade_coerencia() from public, anon, authenticated;
revoke all on public.producao_acessibilidade from anon, authenticated;
grant select, insert, update, delete on public.producao_acessibilidade to authenticated;

comment on table public.producao_acessibilidade is 'Recurso de acessibilidade de uma sessão (Libras, audiodescrição, legendagem, lugares reservados), com situação, pessoa escalada e nota.';
