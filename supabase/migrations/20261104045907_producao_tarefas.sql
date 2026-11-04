-- PD1.11: tarefas com prazo contado a partir da data.
--
-- producao_tarefas: a tarefa de uma data (título, responsável, situação) com o prazo guardado em dias antes ou
-- depois da data ("30 dias antes"). Mudar a data move o prazo das tarefas abertas que têm prazo relativo (a
-- data adiada em 7 dias adia essas tarefas em 7 dias); as feitas e as de prazo fixo ficam onde estão. A tarefa
-- que veio de um modelo guarda a chave dele e não se repete na data.
--
-- Decisão de desenho (04/11/2026): tabela própria da produção, sem mexer em `atividades`, que o CRM usa. O
-- plano admite ligar as duas depois (a tarefa da produção aparecer em Atividades); fazer agora mudaria uma
-- tabela e uma página que clientes usam. Os modelos por tipo de produção ficam no código (lib/producao/tarefas.ts),
-- como os modelos de dia; os da organização virão depois.
--
-- Acesso: o da data (quem lê a data lê as tarefas; quem edita e vê a data escreve). Sem dinheiro. O histórico usa
-- o título como rótulo. Apagar: a tarefa sai com a data e com a organização; apagar a pessoa só desliga o responsável.
--
-- Expansão: uma tabela nova e vazia, duas funções de gatilho novas e a função do histórico trocada (create or replace,
-- mesma assinatura, os ramos de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_tarefas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  data_id uuid not null references public.producao_datas (id) on delete cascade,
  titulo text not null,
  modelo text,
  prazo date,
  prazo_dias integer,
  responsavel_pessoa_id uuid references public.producao_pessoas (id) on delete set null,
  funcao text,
  situacao text not null default 'aberta',
  concluida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_tarefas_data_modelo_key unique (data_id, modelo),
  constraint producao_tarefas_titulo_check check (char_length(btrim(titulo)) between 1 and 200),
  constraint producao_tarefas_modelo_check check (modelo is null or char_length(btrim(modelo)) between 1 and 60),
  constraint producao_tarefas_prazo_dias_check check (prazo_dias is null or prazo_dias between -730 and 730),
  constraint producao_tarefas_funcao_check check (funcao is null or char_length(btrim(funcao)) between 1 and 80),
  constraint producao_tarefas_situacao_check check (situacao in ('aberta', 'feita'))
);

create index if not exists producao_tarefas_org_idx on public.producao_tarefas (organization_id);
create index if not exists producao_tarefas_responsavel_idx on public.producao_tarefas (responsavel_pessoa_id) where responsavel_pessoa_id is not null;
create index if not exists producao_tarefas_prazo_idx on public.producao_tarefas (organization_id, prazo) where situacao = 'aberta';

-- Coerência: a tarefa está na organização da data e da pessoa, a data não muda, o prazo relativo vira data e a
-- conclusão carimba a hora. Erros (check_violation): organizacao_nao_muda, data_nao_muda, data_de_outra_organizacao,
-- pessoa_de_outra_organizacao.
create or replace function public.fn_producao_tarefa_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_data date;
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
  select d.data into v_data from public.producao_datas d where d.id = new.data_id and d.organization_id = new.organization_id;
  if new.data_id is not null and not found then
    raise exception 'data_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.responsavel_pessoa_id is not null and not exists (
    select 1 from public.producao_pessoas p where p.id = new.responsavel_pessoa_id and p.organization_id = new.organization_id
  ) then
    raise exception 'pessoa_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  -- O prazo relativo vale a data mais os dias; ao mudar os dias (ou criar), o prazo é recalculado.
  if new.prazo_dias is not null and (tg_op = 'INSERT' or new.prazo_dias is distinct from old.prazo_dias or new.prazo is null) then
    new.prazo := v_data + new.prazo_dias;
  end if;
  if new.situacao = 'feita' and new.concluida_em is null then
    new.concluida_em := now();
  elsif new.situacao = 'aberta' then
    new.concluida_em := null;
  end if;
  return new;
end;
$$;

-- Mudar o dia da data move o prazo das tarefas abertas de prazo relativo.
create or replace function public.fn_producao_data_move_tarefas()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.data is distinct from old.data then
    update public.producao_tarefas t
    set prazo = new.data + t.prazo_dias
    where t.data_id = new.id and t.situacao = 'aberta' and t.prazo_dias is not null;
  end if;
  return null;
end;
$$;

create or replace trigger producao_tarefas_coerencia
  before insert or update of organization_id, data_id, responsavel_pessoa_id, prazo_dias, situacao on public.producao_tarefas
  for each row execute function public.fn_producao_tarefa_coerencia();
create or replace trigger producao_tarefas_updated_at
  before update on public.producao_tarefas
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_tarefas_historico
  after insert or update or delete on public.producao_tarefas
  for each row execute function public.fn_producao_historico('', 'titulo');
create or replace trigger producao_datas_move_tarefas
  after update of data on public.producao_datas
  for each row execute function public.fn_producao_data_move_tarefas();

-- Quem vê o histórico: o texto de 20261104035041_producao_cartoes_dia.sql com um ramo novo no fim.
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
  end, false);
$$;

alter table public.producao_tarefas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_tarefas' and policyname = 'producao_tarefas: le') then
    create policy "producao_tarefas: le" on public.producao_tarefas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_datas d where d.id = producao_tarefas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_tarefas' and policyname = 'producao_tarefas: leitura sem assinatura') then
    create policy "producao_tarefas: leitura sem assinatura" on public.producao_tarefas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_datas d where d.id = producao_tarefas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_tarefas' and policyname = 'producao_tarefas: insere') then
    create policy "producao_tarefas: insere" on public.producao_tarefas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_datas d where d.id = producao_tarefas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_tarefas' and policyname = 'producao_tarefas: edita') then
    create policy "producao_tarefas: edita" on public.producao_tarefas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_datas d where d.id = producao_tarefas.data_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_datas d where d.id = producao_tarefas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_tarefas' and policyname = 'producao_tarefas: apaga') then
    create policy "producao_tarefas: apaga" on public.producao_tarefas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_datas d where d.id = producao_tarefas.data_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_tarefa_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_data_move_tarefas() from public, anon, authenticated;
revoke all on public.producao_tarefas from anon, authenticated;
grant select, insert, update, delete on public.producao_tarefas to authenticated;

comment on table public.producao_tarefas is
  'Tarefa de uma data, com prazo em dias antes ou depois dela. Mudar a data move o prazo das tarefas abertas de prazo relativo. Tabela própria da produção (não é atividades do CRM).';
