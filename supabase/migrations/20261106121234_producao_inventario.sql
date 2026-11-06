-- PD2.1: inventário da produção.
--
-- producao_itens: o que a produção carrega ou usa (cenário, figurino, instrumento, luz, som, vídeo, praticável,
-- adereço, obra de arte), com quantidade, dimensões (cm), peso (kg por unidade), série, potência e canais. O dono é a
-- produção, um espaço ou um fornecedor (locado: fornecedor, período e devolução). O volume em m³ não é guardado: sai
-- das dimensões e da quantidade na tela.
-- producao_itens_valores: o valor do item (por unidade) e o custo da locação, à parte porque só quem vê o dinheiro lê.
-- producao_item_datas: o item levado a uma data (e quantos), que diz onde cada item está em cada data.
--
-- Acesso: o inventário é da organização inteira; quem tem o recorte "só onde está vinculado" não o vê. Lê quem lê a
-- produção; cria, altera e apaga quem edita. O dinheiro segue a regra de dinheiro da PD0.7a. O histórico usa o nome do
-- item como rótulo (os valores e a ligação à data não têm histórico).
-- Apagar: o item sai com a organização; apagar o item leva os valores e as ligações às datas; apagar a data leva só a
-- ligação; a obra e o espaço só se desligam.
--
-- Expansão: três tabelas novas e vazias, três funções de gatilho e a função do histórico trocada (create or replace,
-- mesma assinatura, os ramos de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_itens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null,
  categoria text not null default 'outro',
  dono text not null default 'producao',
  obra_id uuid references public.producao_obras (id) on delete set null,
  espaco_id uuid references public.producao_espacos (id) on delete set null,
  fornecedor text,
  locacao_inicio date,
  locacao_fim date,
  devolvido_em date,
  quantidade integer not null default 1,
  comprimento_cm numeric(8, 1),
  largura_cm numeric(8, 1),
  altura_cm numeric(8, 1),
  peso_kg numeric(9, 2),
  serie text,
  potencia_w integer,
  canais integer,
  notas text,
  arquivado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_itens_nome_check check (char_length(btrim(nome)) between 1 and 200),
  constraint producao_itens_categoria_check check (categoria in ('cenario', 'figurino', 'instrumento', 'luz', 'som', 'video', 'praticavel', 'adereco', 'obra_de_arte', 'outro')),
  constraint producao_itens_dono_check check (dono in ('producao', 'espaco', 'locado')),
  constraint producao_itens_espaco_check check (dono = 'espaco' or espaco_id is null),
  constraint producao_itens_locacao_check check (dono = 'locado' or (fornecedor is null and locacao_inicio is null and locacao_fim is null and devolvido_em is null)),
  constraint producao_itens_fornecedor_check check (fornecedor is null or char_length(btrim(fornecedor)) between 1 and 200),
  constraint producao_itens_periodo_check check (locacao_fim is null or locacao_inicio is null or locacao_fim >= locacao_inicio),
  constraint producao_itens_quantidade_check check (quantidade between 1 and 99999),
  constraint producao_itens_dimensoes_check check ((comprimento_cm is null or comprimento_cm >= 0) and (largura_cm is null or largura_cm >= 0) and (altura_cm is null or altura_cm >= 0)),
  constraint producao_itens_peso_check check (peso_kg is null or peso_kg >= 0),
  constraint producao_itens_serie_check check (serie is null or char_length(btrim(serie)) between 1 and 100),
  constraint producao_itens_potencia_check check (potencia_w is null or potencia_w >= 0),
  constraint producao_itens_canais_check check (canais is null or canais between 0 and 512),
  constraint producao_itens_notas_check check (notas is null or char_length(notas) <= 2000)
);

create index if not exists producao_itens_org_idx on public.producao_itens (organization_id, nome);
create index if not exists producao_itens_obra_idx on public.producao_itens (obra_id) where obra_id is not null;
create index if not exists producao_itens_espaco_idx on public.producao_itens (espaco_id) where espaco_id is not null;

create table if not exists public.producao_itens_valores (
  item_id uuid primary key references public.producao_itens (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  valor_unitario numeric(14, 2),
  valor_locacao numeric(14, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_itens_valores_unitario_check check (valor_unitario is null or valor_unitario between 0 and 999999999999.99),
  constraint producao_itens_valores_locacao_check check (valor_locacao is null or valor_locacao between 0 and 999999999999.99)
);

create index if not exists producao_itens_valores_org_idx on public.producao_itens_valores (organization_id);

create table if not exists public.producao_item_datas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  item_id uuid not null references public.producao_itens (id) on delete cascade,
  data_id uuid not null references public.producao_datas (id) on delete cascade,
  quantidade integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_item_datas_item_data_key unique (item_id, data_id),
  constraint producao_item_datas_quantidade_check check (quantidade between 1 and 99999)
);

create index if not exists producao_item_datas_org_idx on public.producao_item_datas (organization_id);
create index if not exists producao_item_datas_data_idx on public.producao_item_datas (data_id);

-- Coerência do item: a organização não muda; obra e espaço são da organização.
-- Erros (check_violation): organizacao_nao_muda, obra_de_outra_organizacao, espaco_de_outra_organizacao.
create or replace function public.fn_producao_item_coerencia()
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
  if new.obra_id is not null and not exists (select 1 from public.producao_obras o where o.id = new.obra_id and o.organization_id = new.organization_id) then
    raise exception 'obra_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.espaco_id is not null and not exists (select 1 from public.producao_espacos e where e.id = new.espaco_id and e.organization_id = new.organization_id) then
    raise exception 'espaco_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Coerência dos valores: o item é da organização e não muda. Erros: organizacao_nao_muda, item_nao_muda, item_de_outra_organizacao.
create or replace function public.fn_producao_item_valor_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.item_id is distinct from old.item_id then
    raise exception 'item_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new;
  end if;
  if not exists (select 1 from public.producao_itens i where i.id = new.item_id and i.organization_id = new.organization_id) then
    raise exception 'item_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Coerência da ligação item × data: item e data são da organização e não mudam.
-- Erros: organizacao_nao_muda, item_nao_muda, data_nao_muda, item_de_outra_organizacao, data_de_outra_organizacao.
create or replace function public.fn_producao_item_data_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.item_id is distinct from old.item_id then
    raise exception 'item_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.data_id is distinct from old.data_id then
    raise exception 'data_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new;
  end if;
  if not exists (select 1 from public.producao_itens i where i.id = new.item_id and i.organization_id = new.organization_id) then
    raise exception 'item_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.producao_datas d where d.id = new.data_id and d.organization_id = new.organization_id) then
    raise exception 'data_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_itens_coerencia
  before insert or update of organization_id, obra_id, espaco_id on public.producao_itens
  for each row execute function public.fn_producao_item_coerencia();
create or replace trigger producao_itens_updated_at
  before update on public.producao_itens
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_itens_historico
  after insert or update or delete on public.producao_itens
  for each row execute function public.fn_producao_historico('', 'nome');

create or replace trigger producao_itens_valores_coerencia
  before insert or update of organization_id, item_id on public.producao_itens_valores
  for each row execute function public.fn_producao_item_valor_coerencia();
create or replace trigger producao_itens_valores_updated_at
  before update on public.producao_itens_valores
  for each row execute function public.fn_producao_updated_at();

create or replace trigger producao_item_datas_coerencia
  before insert or update of organization_id, item_id, data_id on public.producao_item_datas
  for each row execute function public.fn_producao_item_data_coerencia();
create or replace trigger producao_item_datas_updated_at
  before update on public.producao_item_datas
  for each row execute function public.fn_producao_updated_at();

-- Quem vê o histórico: o texto de 20261104073356_producao_pautas.sql com um ramo novo no fim.
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
  end, false);
$$;

alter table public.producao_itens enable row level security;
alter table public.producao_itens_valores enable row level security;
alter table public.producao_item_datas enable row level security;

-- O inventário é da organização inteira: quem tem o recorte "só onde está vinculado" não o vê
-- (auth_producao_ve_temporada(org, null) é verdadeiro só para quem não tem recorte).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_itens' and policyname = 'producao_itens: le') then
    create policy "producao_itens: le" on public.producao_itens for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_itens' and policyname = 'producao_itens: leitura sem assinatura') then
    create policy "producao_itens: leitura sem assinatura" on public.producao_itens for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_itens' and policyname = 'producao_itens: insere') then
    create policy "producao_itens: insere" on public.producao_itens for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_itens' and policyname = 'producao_itens: edita') then
    create policy "producao_itens: edita" on public.producao_itens for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_itens' and policyname = 'producao_itens: apaga') then
    create policy "producao_itens: apaga" on public.producao_itens for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
end
$$;

-- O dinheiro do item: a regra de dinheiro da PD0.7a, e o item à vista (a subconsulta passa pelas regras de producao_itens).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_itens_valores' and policyname = 'producao_itens_valores: le') then
    create policy "producao_itens_valores: le" on public.producao_itens_valores for select to authenticated
      using (public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_itens i where i.id = producao_itens_valores.item_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_itens_valores' and policyname = 'producao_itens_valores: leitura sem assinatura') then
    create policy "producao_itens_valores: leitura sem assinatura" on public.producao_itens_valores for select to authenticated
      using (public.auth_producao_dinheiro_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_itens i where i.id = producao_itens_valores.item_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_itens_valores' and policyname = 'producao_itens_valores: insere') then
    create policy "producao_itens_valores: insere" on public.producao_itens_valores for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_itens i where i.id = producao_itens_valores.item_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_itens_valores' and policyname = 'producao_itens_valores: edita') then
    create policy "producao_itens_valores: edita" on public.producao_itens_valores for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_itens i where i.id = producao_itens_valores.item_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
                  and exists (select 1 from public.producao_itens i where i.id = producao_itens_valores.item_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_itens_valores' and policyname = 'producao_itens_valores: apaga') then
    create policy "producao_itens_valores: apaga" on public.producao_itens_valores for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_pode(organization_id, 'dinheiro')
             and exists (select 1 from public.producao_itens i where i.id = producao_itens_valores.item_id));
  end if;
end
$$;

-- A ligação do item à data herda as duas regras: o item à vista e a data à vista.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_item_datas' and policyname = 'producao_item_datas: le') then
    create policy "producao_item_datas: le" on public.producao_item_datas for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler')
             and exists (select 1 from public.producao_itens i where i.id = producao_item_datas.item_id)
             and exists (select 1 from public.producao_datas d where d.id = producao_item_datas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_item_datas' and policyname = 'producao_item_datas: leitura sem assinatura') then
    create policy "producao_item_datas: leitura sem assinatura" on public.producao_item_datas for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id)
             and exists (select 1 from public.producao_itens i where i.id = producao_item_datas.item_id)
             and exists (select 1 from public.producao_datas d where d.id = producao_item_datas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_item_datas' and policyname = 'producao_item_datas: insere') then
    create policy "producao_item_datas: insere" on public.producao_item_datas for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_itens i where i.id = producao_item_datas.item_id)
                  and exists (select 1 from public.producao_datas d where d.id = producao_item_datas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_item_datas' and policyname = 'producao_item_datas: edita') then
    create policy "producao_item_datas: edita" on public.producao_item_datas for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_itens i where i.id = producao_item_datas.item_id)
             and exists (select 1 from public.producao_datas d where d.id = producao_item_datas.data_id))
      with check (public.auth_producao_pode(organization_id, 'editar')
                  and exists (select 1 from public.producao_itens i where i.id = producao_item_datas.item_id)
                  and exists (select 1 from public.producao_datas d where d.id = producao_item_datas.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_item_datas' and policyname = 'producao_item_datas: apaga') then
    create policy "producao_item_datas: apaga" on public.producao_item_datas for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar')
             and exists (select 1 from public.producao_itens i where i.id = producao_item_datas.item_id)
             and exists (select 1 from public.producao_datas d where d.id = producao_item_datas.data_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_item_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_item_valor_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_item_data_coerencia() from public, anon, authenticated;
revoke all on public.producao_itens, public.producao_itens_valores, public.producao_item_datas from anon, authenticated;
grant select, insert, update, delete on public.producao_itens, public.producao_itens_valores, public.producao_item_datas to authenticated;

comment on table public.producao_itens is
  'Item do inventário da produção: categoria, dono (produção, espaço ou locado), quantidade, dimensões em cm e peso em kg por unidade.';
comment on table public.producao_itens_valores is
  'Valor do item e custo da locação; só quem vê o dinheiro lê e grava.';
comment on table public.producao_item_datas is
  'O item levado a uma data, e quantos: diz onde cada item está em cada data.';
