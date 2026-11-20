-- PD9.5 (primeiro corte): comunicação por data.
--
-- producao_comunicacao: o kit de imprensa de uma data — o release (texto), as artes e o clipping (endereços https) e o
-- que mais a produção quiser guardar, em lista, na ordem que ela escolher. Serve para mandar a quem divulga: a página
-- junta tudo num texto para copiar. Nada sai para fora do app: não há link público aqui.
--
-- O credenciamento de imprensa, que o plano previa nesta entrega, saiu com os ingressos (T1 da Ticketeria, 18/11/2026):
-- as credenciais não existem mais na Produção.
--
-- Acesso: o da data (quem lê a data lê a comunicação; quem edita e vê a data escreve), então o recorte "só onde está
-- vinculado" vale. Sem dinheiro. O histórico guarda o item e deixa o texto do release de fora (é longo e muda muito):
-- o título é o rótulo.
-- Apagar: o item sai com a data e com a organização.
--
-- Expansão: uma tabela nova e vazia, uma função de gatilho e a função do histórico trocada (create or replace, mesma
-- assinatura, os ramos de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_comunicacao (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  data_id uuid not null references public.producao_datas (id) on delete cascade,
  tipo text not null default 'release',
  titulo text not null,
  texto text,
  url text,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_comunicacao_tipo_check check (tipo in ('release', 'arte', 'foto', 'clipping', 'outro')),
  constraint producao_comunicacao_titulo_check check (char_length(btrim(titulo)) between 1 and 200),
  constraint producao_comunicacao_texto_check check (texto is null or char_length(btrim(texto)) between 1 and 5000),
  constraint producao_comunicacao_url_check check (url is null or (char_length(url) <= 500 and url ~ '^https://[^[:space:]]+$')),
  constraint producao_comunicacao_conteudo_check check (texto is not null or url is not null),
  constraint producao_comunicacao_ordem_check check (ordem between 0 and 999)
);

create index if not exists producao_comunicacao_org_idx on public.producao_comunicacao (organization_id);
create index if not exists producao_comunicacao_data_idx on public.producao_comunicacao (data_id, ordem, created_at);

-- Coerência: a organização e a data não mudam; a data é da organização.
-- Erros (check_violation): organizacao_nao_muda, data_nao_muda, data_de_outra_organizacao.
create or replace function public.fn_producao_comunicacao_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.data_id is distinct from old.data_id then
    raise exception 'data_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_datas d where d.id = new.data_id and d.organization_id = new.organization_id) then
    raise exception 'data_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_comunicacao_coerencia
  before insert or update on public.producao_comunicacao
  for each row execute function public.fn_producao_comunicacao_coerencia();
create or replace trigger producao_comunicacao_updated_at
  before update on public.producao_comunicacao
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_comunicacao_historico
  after insert or update or delete on public.producao_comunicacao
  for each row execute function public.fn_producao_historico('texto', 'titulo');

-- Quem vê o histórico: o texto de 20261118233748_producao_sem_ingressos.sql com um ramo novo no fim.
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
    when 'producao_veiculos' then exists (select 1 from public.producao_veiculos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_deslocamentos' then exists (select 1 from public.producao_deslocamentos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_hospedagens' then exists (select 1 from public.producao_hospedagens x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_convites' then exists (select 1 from public.producao_convites x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_ocorrencias' then exists (select 1 from public.producao_ocorrencias x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_voluntarios' then exists (select 1 from public.producao_voluntarios x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_acessibilidade' then exists (select 1 from public.producao_acessibilidade x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_visitas_horarios' then exists (select 1 from public.producao_visitas_horarios x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_visitas_agendamentos' then exists (select 1 from public.producao_visitas_agendamentos x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_turmas' then exists (select 1 from public.producao_turmas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_turma_aulas' then exists (select 1 from public.producao_turma_aulas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_matriculas' then exists (select 1 from public.producao_matriculas x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_expografia' then exists (select 1 from public.producao_expografia x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_documentos' then exists (
      select 1 from public.producao_documentos x
      where x.id = p_entidade_id and x.organization_id = p_org
        and (x.escopo = 'organizacao' or public.auth_producao_pode(p_org, 'dinheiro') or public.auth_producao_dinheiro_sem_assinatura(p_org))
    )
    when 'producao_comunicacao' then exists (select 1 from public.producao_comunicacao x where x.id = p_entidade_id and x.organization_id = p_org)
  end, false);
$$;

alter table public.producao_comunicacao enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_comunicacao' and policyname = 'producao_comunicacao: le') then
    create policy "producao_comunicacao: le" on public.producao_comunicacao for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_datas d where d.id = producao_comunicacao.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_comunicacao' and policyname = 'producao_comunicacao: leitura sem assinatura') then
    create policy "producao_comunicacao: leitura sem assinatura" on public.producao_comunicacao for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_datas d where d.id = producao_comunicacao.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_comunicacao' and policyname = 'producao_comunicacao: insere') then
    create policy "producao_comunicacao: insere" on public.producao_comunicacao for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_datas d where d.id = producao_comunicacao.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_comunicacao' and policyname = 'producao_comunicacao: edita') then
    create policy "producao_comunicacao: edita" on public.producao_comunicacao for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_datas d where d.id = producao_comunicacao.data_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_datas d where d.id = producao_comunicacao.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_comunicacao' and policyname = 'producao_comunicacao: apaga') then
    create policy "producao_comunicacao: apaga" on public.producao_comunicacao for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_datas d where d.id = producao_comunicacao.data_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_comunicacao_coerencia() from public, anon, authenticated;
revoke all on public.producao_comunicacao from anon, authenticated;
grant select, insert, update, delete on public.producao_comunicacao to authenticated;

comment on table public.producao_comunicacao is
  'Kit de imprensa de uma data: release (texto), artes, fotos e clipping (endereços https), na ordem que a produção escolher.';
