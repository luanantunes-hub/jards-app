-- PD4.9: licenças e liberações por data.
--
-- producao_licencas: uma licença ou liberação de uma data (alvará, AVCB, ECAD, SBAT, Juizado de Menores, via pública,
-- autorização de filmagem ou outra) com a situação (a pedir, pedida, concedida, negada, dispensada), o responsável, o
-- prazo em dias antes ou depois da data (mudar a data move o prazo, como nas tarefas), a validade, o protocolo e notas.
-- O arquivo da licença vai em Arquivos da data.
--
-- "Viram tarefas": enquanto a licença está a pedir ou pedida, existe uma tarefa aberta dela em producao_tarefas
-- ("Licença: alvará"), com o mesmo prazo e responsável; concedida, negada ou dispensada, a tarefa fica feita. A tarefa
-- nasce, muda e sai sozinha com a licença (producao_tarefas.licenca_id, apagar a licença leva a tarefa).
--
-- Acesso: o da data (quem lê a data lê as licenças; quem edita e vê a data escreve). Sem dinheiro. O histórico usa o
-- tipo como rótulo. Apagar: a licença sai com a data e com a organização; apagar a pessoa só desliga o responsável.
--
-- Expansão: uma tabela nova e vazia, uma coluna anulável nova em producao_tarefas, duas funções de gatilho novas e a
-- função do histórico trocada (create or replace, mesma assinatura, os ramos de antes mais um no fim). Aditiva e
-- reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_licencas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  data_id uuid not null references public.producao_datas (id) on delete cascade,
  tipo text not null default 'outro',
  situacao text not null default 'a_pedir',
  responsavel_pessoa_id uuid references public.producao_pessoas (id) on delete set null,
  prazo_dias integer,
  validade date,
  protocolo text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_licencas_tipo_check check (tipo in ('alvara', 'avcb', 'ecad', 'sbat', 'juizado_menores', 'via_publica', 'filmagem', 'outro')),
  constraint producao_licencas_situacao_check check (situacao in ('a_pedir', 'pedida', 'concedida', 'negada', 'dispensada')),
  constraint producao_licencas_prazo_dias_check check (prazo_dias is null or prazo_dias between -730 and 730),
  constraint producao_licencas_protocolo_check check (protocolo is null or char_length(btrim(protocolo)) between 1 and 100),
  constraint producao_licencas_notas_check check (notas is null or char_length(notas) <= 500)
);

create index if not exists producao_licencas_org_idx on public.producao_licencas (organization_id);
create index if not exists producao_licencas_data_idx on public.producao_licencas (data_id);
create index if not exists producao_licencas_responsavel_idx on public.producao_licencas (responsavel_pessoa_id) where responsavel_pessoa_id is not null;

alter table public.producao_tarefas add column if not exists licenca_id uuid references public.producao_licencas (id) on delete cascade;
create unique index if not exists producao_tarefas_licenca_key on public.producao_tarefas (licenca_id) where licenca_id is not null;

-- Coerência da licença: a organização e a data não mudam; a data e a pessoa são da organização. Erros (check_violation):
-- organizacao_nao_muda, data_nao_muda, data_de_outra_organizacao, pessoa_de_outra_organizacao.
create or replace function public.fn_producao_licenca_coerencia()
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
  if new.responsavel_pessoa_id is not null and not exists (
    select 1 from public.producao_pessoas p where p.id = new.responsavel_pessoa_id and p.organization_id = new.organization_id
  ) then
    raise exception 'pessoa_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- A tarefa da licença: aberta enquanto a licença está a pedir ou pedida, feita nos outros casos.
create or replace function public.fn_producao_licenca_tarefa()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_titulo text;
begin
  v_titulo := 'Licença: ' || case new.tipo
    when 'alvara' then 'alvará' when 'avcb' then 'AVCB' when 'ecad' then 'ECAD' when 'sbat' then 'SBAT'
    when 'juizado_menores' then 'Juizado de Menores' when 'via_publica' then 'via pública' when 'filmagem' then 'autorização de filmagem'
    else 'outra liberação' end;
  insert into public.producao_tarefas (organization_id, data_id, titulo, prazo_dias, responsavel_pessoa_id, situacao, licenca_id)
  values (new.organization_id, new.data_id, v_titulo, new.prazo_dias, new.responsavel_pessoa_id,
          case when new.situacao in ('a_pedir', 'pedida') then 'aberta' else 'feita' end, new.id)
  on conflict (licenca_id) where licenca_id is not null do update set
    titulo = excluded.titulo,
    prazo_dias = excluded.prazo_dias,
    prazo = case when excluded.prazo_dias is null then null else public.producao_tarefas.prazo end,
    responsavel_pessoa_id = excluded.responsavel_pessoa_id,
    situacao = excluded.situacao;
  return null;
end;
$$;

create or replace trigger producao_licencas_coerencia
  before insert or update of organization_id, data_id, responsavel_pessoa_id on public.producao_licencas
  for each row execute function public.fn_producao_licenca_coerencia();
create or replace trigger producao_licencas_updated_at
  before update on public.producao_licencas
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_licencas_historico
  after insert or update or delete on public.producao_licencas
  for each row execute function public.fn_producao_historico('', 'tipo');
create or replace trigger producao_licencas_tarefa
  after insert or update of tipo, situacao, prazo_dias, responsavel_pessoa_id on public.producao_licencas
  for each row execute function public.fn_producao_licenca_tarefa();

-- Quem vê o histórico: o texto de 20261111003223_producao_turnos.sql com um ramo novo no fim.
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
  end, false);
$$;

alter table public.producao_licencas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_licencas' and policyname = 'producao_licencas: le') then
    create policy "producao_licencas: le" on public.producao_licencas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_datas d where d.id = producao_licencas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_licencas' and policyname = 'producao_licencas: leitura sem assinatura') then
    create policy "producao_licencas: leitura sem assinatura" on public.producao_licencas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_datas d where d.id = producao_licencas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_licencas' and policyname = 'producao_licencas: insere') then
    create policy "producao_licencas: insere" on public.producao_licencas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_datas d where d.id = producao_licencas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_licencas' and policyname = 'producao_licencas: edita') then
    create policy "producao_licencas: edita" on public.producao_licencas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_datas d where d.id = producao_licencas.data_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_datas d where d.id = producao_licencas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_licencas' and policyname = 'producao_licencas: apaga') then
    create policy "producao_licencas: apaga" on public.producao_licencas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_datas d where d.id = producao_licencas.data_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_licenca_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_licenca_tarefa() from public, anon, authenticated;
revoke all on public.producao_licencas from anon, authenticated;
grant select, insert, update, delete on public.producao_licencas to authenticated;

comment on table public.producao_licencas is
  'Licença ou liberação de uma data (alvará, AVCB, ECAD, SBAT, Juizado de Menores, via pública, filmagem), com situação, responsável, prazo relativo à data, validade e protocolo. A tarefa dela em producao_tarefas nasce e anda sozinha.';
