-- PD1.7: modelos de dia da organização.
--
-- producao_modelos_dia: o dia de uma data guardado como modelo ("Dia de show com passagem de som"), para montar o
-- dia de outras datas em um clique. Os blocos ficam em uma lista (jsonb): tipo, título e duração em minutos, na
-- ordem. Os modelos por tipo de produção continuam no código (lib/producao/vocabulario.ts); estes são os da organização.
--
-- Acesso: de toda a organização (não é de uma data). Lê quem lê a produção; cria, altera e apaga quem edita.
-- Sem dinheiro. O histórico usa o nome como rótulo. Apagar: o modelo sai com a organização.
--
-- Expansão: uma tabela nova e vazia, uma função de gatilho e a função do histórico trocada (create or replace,
-- mesma assinatura, os ramos de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_modelos_dia (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null,
  blocos jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_modelos_dia_nome_key unique (organization_id, nome),
  constraint producao_modelos_dia_nome_check check (char_length(btrim(nome)) between 1 and 120),
  constraint producao_modelos_dia_blocos_check check (jsonb_typeof(blocos) = 'array' and jsonb_array_length(blocos) between 1 and 60)
);

create index if not exists producao_modelos_dia_org_idx on public.producao_modelos_dia (organization_id);

-- Coerência: a organização não muda, e cada item da lista tem tipo, título e duração em minutos (1 a 1440).
-- Erros (check_violation): organizacao_nao_muda, bloco_invalido.
create or replace function public.fn_producao_modelo_dia_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item jsonb;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if new.blocos is null or jsonb_typeof(new.blocos) <> 'array' then
    return new; -- quem recusa é a restrição da tabela
  end if;
  for item in select * from jsonb_array_elements(new.blocos) loop
    if coalesce(jsonb_typeof(item), '') <> 'object'
       or coalesce(jsonb_typeof(item -> 'tipo'), '') <> 'string'
       or coalesce(jsonb_typeof(item -> 'titulo'), '') <> 'string'
       or coalesce(jsonb_typeof(item -> 'duracaoMin'), '') <> 'number' then
      raise exception 'bloco_invalido' using errcode = 'check_violation';
    end if;
    if char_length(item ->> 'tipo') not between 1 and 40
       or char_length(btrim(item ->> 'titulo')) not between 1 and 120
       or (item ->> 'duracaoMin')::numeric not between 1 and 1440
       or (item ->> 'duracaoMin')::numeric <> trunc((item ->> 'duracaoMin')::numeric) then
      raise exception 'bloco_invalido' using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end;
$$;

create or replace trigger producao_modelos_dia_coerencia
  before insert or update of organization_id, blocos on public.producao_modelos_dia
  for each row execute function public.fn_producao_modelo_dia_coerencia();
create or replace trigger producao_modelos_dia_updated_at
  before update on public.producao_modelos_dia
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_modelos_dia_historico
  after insert or update or delete on public.producao_modelos_dia
  for each row execute function public.fn_producao_historico('', 'nome');

-- Quem vê o histórico: o texto de 20261104054939_producao_notas.sql com um ramo novo no fim.
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
  end, false);
$$;

alter table public.producao_modelos_dia enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_modelos_dia' and policyname = 'producao_modelos_dia: le') then
    create policy "producao_modelos_dia: le" on public.producao_modelos_dia for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_modelos_dia' and policyname = 'producao_modelos_dia: leitura sem assinatura') then
    create policy "producao_modelos_dia: leitura sem assinatura" on public.producao_modelos_dia for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_modelos_dia' and policyname = 'producao_modelos_dia: insere') then
    create policy "producao_modelos_dia: insere" on public.producao_modelos_dia for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_modelos_dia' and policyname = 'producao_modelos_dia: edita') then
    create policy "producao_modelos_dia: edita" on public.producao_modelos_dia for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar'))
      with check (public.auth_producao_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_modelos_dia' and policyname = 'producao_modelos_dia: apaga') then
    create policy "producao_modelos_dia: apaga" on public.producao_modelos_dia for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar'));
  end if;
end
$$;

revoke execute on function public.fn_producao_modelo_dia_coerencia() from public, anon, authenticated;
revoke all on public.producao_modelos_dia from anon, authenticated;
grant select, insert, update, delete on public.producao_modelos_dia to authenticated;

comment on table public.producao_modelos_dia is
  'Modelo de dia da organização: uma lista de blocos (tipo, título, duração em minutos) para montar o dia de uma data em um clique.';
