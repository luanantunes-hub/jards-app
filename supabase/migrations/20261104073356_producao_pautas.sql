-- PD1.5: pauta mínima do espaço.
--
-- producao_pautas: a sala ocupada por um período de dias (início e fim, inclusive), com título, contratante e situação:
-- consulta, pré-reserva (com a ordem na fila e a validade), confirmada ou cancelada. Liga-se, se quiser, a uma data da
-- produção; o evento recebido pelo espaço nasce direto na sala, sem exigir temporada. O conflito (duas confirmadas
-- na mesma sala em dias que se cruzam) é aviso na tela, não trava: o banco não o impede.
--
-- Acesso: o da sala (quem lê a sala lê a pauta; quem edita e vê a sala escreve), então o recorte "só onde está
-- vinculado" vale por espaço. Sem dinheiro. O histórico usa o título como rótulo.
-- Apagar: a pauta sai com a sala e com a organização; apagar a data só solta a ligação.
--
-- Expansão: uma tabela nova e vazia, uma função de gatilho e a função do histórico trocada (create or replace,
-- mesma assinatura, os ramos de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_pautas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sala_id uuid not null references public.producao_salas (id) on delete cascade,
  titulo text not null,
  contratante text,
  inicio date not null,
  fim date not null,
  situacao text not null default 'consulta',
  ordem_na_fila integer,
  valida_ate date,
  data_id uuid references public.producao_datas (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_pautas_titulo_check check (char_length(btrim(titulo)) between 1 and 200),
  constraint producao_pautas_contratante_check check (contratante is null or char_length(btrim(contratante)) between 1 and 200),
  constraint producao_pautas_periodo_check check (fim >= inicio and fim - inicio <= 365),
  constraint producao_pautas_situacao_check check (situacao in ('consulta', 'pre_reserva', 'confirmada', 'cancelada')),
  constraint producao_pautas_fila_check check (ordem_na_fila is null or ordem_na_fila between 1 and 99),
  constraint producao_pautas_pre_reserva_check check (situacao = 'pre_reserva' or (ordem_na_fila is null and valida_ate is null))
);

create index if not exists producao_pautas_org_idx on public.producao_pautas (organization_id);
create index if not exists producao_pautas_sala_periodo_idx on public.producao_pautas (sala_id, inicio, fim);
create index if not exists producao_pautas_data_idx on public.producao_pautas (data_id) where data_id is not null;

-- Coerência: a sala e a data (se houver) são da organização da pauta, e a organização não muda.
-- Erros (check_violation): organizacao_nao_muda, sala_de_outra_organizacao, data_de_outra_organizacao.
create or replace function public.fn_producao_pauta_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  perform 1 from public.producao_salas s where s.id = new.sala_id and s.organization_id = new.organization_id;
  if new.sala_id is not null and not found then
    raise exception 'sala_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.data_id is not null then
    perform 1 from public.producao_datas d where d.id = new.data_id and d.organization_id = new.organization_id;
    if not found then
      raise exception 'data_de_outra_organizacao' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger producao_pautas_coerencia
  before insert or update of organization_id, sala_id, data_id on public.producao_pautas
  for each row execute function public.fn_producao_pauta_coerencia();
create or replace trigger producao_pautas_updated_at
  before update on public.producao_pautas
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_pautas_historico
  after insert or update or delete on public.producao_pautas
  for each row execute function public.fn_producao_historico('', 'titulo');

-- Quem vê o histórico: o texto de 20261104062333_producao_modelos_dia.sql com um ramo novo no fim.
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
  end, false);
$$;

alter table public.producao_pautas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_pautas' and policyname = 'producao_pautas: le') then
    create policy "producao_pautas: le" on public.producao_pautas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_salas s where s.id = producao_pautas.sala_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_pautas' and policyname = 'producao_pautas: leitura sem assinatura') then
    create policy "producao_pautas: leitura sem assinatura" on public.producao_pautas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_salas s where s.id = producao_pautas.sala_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_pautas' and policyname = 'producao_pautas: insere') then
    create policy "producao_pautas: insere" on public.producao_pautas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_salas s where s.id = producao_pautas.sala_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_pautas' and policyname = 'producao_pautas: edita') then
    create policy "producao_pautas: edita" on public.producao_pautas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_salas s where s.id = producao_pautas.sala_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_salas s where s.id = producao_pautas.sala_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_pautas' and policyname = 'producao_pautas: apaga') then
    create policy "producao_pautas: apaga" on public.producao_pautas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_salas s where s.id = producao_pautas.sala_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_pauta_coerencia() from public, anon, authenticated;
revoke all on public.producao_pautas from anon, authenticated;
grant select, insert, update, delete on public.producao_pautas to authenticated;

comment on table public.producao_pautas is
  'Pauta de uma sala: um período de dias com título, contratante e situação (consulta, pré-reserva, confirmada, cancelada). O conflito é aviso na tela, não trava.';
