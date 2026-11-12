-- PD6.7 (primeiro corte): hospedagem da temporada, com quartos e ocupantes.
--
-- producao_hospedagens: o hotel (ou casa, pousada) de uma temporada, com entrada e saída, endereço, localizador e notas.
-- producao_quartos: os quartos de uma hospedagem, cada um com nome (o número ou "Quarto dos músicos") e a capacidade.
-- producao_ocupantes: quem dorme em cada quarto (uma pessoa do cadastro da equipe, em um só quarto por hospedagem).
-- A lista de quartos (rooming list) sai daqui. O quarto não passa da capacidade (o banco recusa), e a capacidade não cai
-- abaixo de quantos já dormem nele. Sem dado de saúde: a alergia e as restrições só entram com a autorização da pessoa
-- (pré-requisito de dados pessoais), em tabela própria. Os cartões de hospedagem da PD1.8 ficam como estão.
--
-- Acesso: o da temporada (quem lê a temporada lê a hospedagem, e a hospedagem à vista traz os quartos e os ocupantes; quem
-- edita e vê a temporada escreve), então o recorte "só onde está vinculado" vale. Para pôr uma pessoa num quarto, a pessoa
-- tem de estar à vista de quem grava (quem tem o recorte não traz uma pessoa que não vê). Sem dinheiro (a diária entra
-- com o financeiro). O histórico guarda a hospedagem e deixa o localizador de fora; quartos e ocupantes não têm histórico.
-- Apagar: o hotel sai com a temporada e leva quartos e ocupantes; apagar a pessoa só falha se ela dorme em algum quarto.
--
-- Expansão: três tabelas novas e vazias, quatro funções de gatilho e a função do histórico trocada (create or replace,
-- mesma assinatura, os ramos de antes mais um no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_hospedagens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  temporada_id uuid not null references public.producao_temporadas (id) on delete cascade,
  hotel text not null,
  endereco text,
  entrada date,
  saida date,
  localizador text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_hospedagens_hotel_check check (char_length(btrim(hotel)) between 1 and 200),
  constraint producao_hospedagens_endereco_check check (endereco is null or char_length(btrim(endereco)) between 1 and 300),
  constraint producao_hospedagens_periodo_check check (saida is null or (entrada is not null and saida >= entrada)),
  constraint producao_hospedagens_localizador_check check (localizador is null or char_length(btrim(localizador)) between 1 and 80),
  constraint producao_hospedagens_notas_check check (notas is null or char_length(btrim(notas)) between 1 and 2000)
);

create index if not exists producao_hospedagens_org_idx on public.producao_hospedagens (organization_id);
create index if not exists producao_hospedagens_temporada_idx on public.producao_hospedagens (temporada_id, entrada);

create table if not exists public.producao_quartos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  hospedagem_id uuid not null references public.producao_hospedagens (id) on delete cascade,
  nome text not null,
  capacidade integer not null default 2,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_quartos_nome_check check (char_length(btrim(nome)) between 1 and 100),
  constraint producao_quartos_capacidade_check check (capacidade between 1 and 12),
  constraint producao_quartos_notas_check check (notas is null or char_length(btrim(notas)) between 1 and 1000)
);

create index if not exists producao_quartos_org_idx on public.producao_quartos (organization_id);
create index if not exists producao_quartos_hospedagem_idx on public.producao_quartos (hospedagem_id, nome);

create table if not exists public.producao_ocupantes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  hospedagem_id uuid not null references public.producao_hospedagens (id) on delete cascade,
  quarto_id uuid not null references public.producao_quartos (id) on delete cascade,
  pessoa_id uuid not null references public.producao_pessoas (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint producao_ocupantes_pessoa_key unique (hospedagem_id, pessoa_id)
);

create index if not exists producao_ocupantes_org_idx on public.producao_ocupantes (organization_id);
create index if not exists producao_ocupantes_quarto_idx on public.producao_ocupantes (quarto_id);
create index if not exists producao_ocupantes_pessoa_idx on public.producao_ocupantes (pessoa_id);

-- Coerência da hospedagem: a organização e a temporada não mudam; a temporada é da organização.
-- Erros (check_violation): organizacao_nao_muda, temporada_nao_muda, temporada_de_outra_organizacao.
create or replace function public.fn_producao_hospedagem_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.temporada_id is distinct from old.temporada_id then
    raise exception 'temporada_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_temporadas t where t.id = new.temporada_id and t.organization_id = new.organization_id) then
    raise exception 'temporada_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Coerência do quarto: a organização e a hospedagem não mudam; a hospedagem é da organização; a capacidade não cai
-- abaixo de quantos já dormem no quarto.
-- Erros: organizacao_nao_muda, hospedagem_nao_muda, hospedagem_de_outra_organizacao, capacidade_menor_que_ocupantes.
create or replace function public.fn_producao_quarto_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.hospedagem_id is distinct from old.hospedagem_id then
    raise exception 'hospedagem_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new;
  end if;
  if not exists (select 1 from public.producao_hospedagens h where h.id = new.hospedagem_id and h.organization_id = new.organization_id) then
    raise exception 'hospedagem_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.capacidade < (select count(*) from public.producao_ocupantes o where o.quarto_id = new.id) then
    raise exception 'capacidade_menor_que_ocupantes' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Coerência do ocupante: a organização, o quarto e a pessoa não mudam; o quarto e a pessoa são da organização; a hospedagem
-- vem do quarto (quem grava não escolhe); o quarto não passa da capacidade.
-- Erros: organizacao_nao_muda, quarto_nao_muda, pessoa_nao_muda, quarto_de_outra_organizacao, pessoa_de_outra_organizacao, quarto_lotado.
create or replace function public.fn_producao_ocupante_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hospedagem uuid;
  v_capacidade integer;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.quarto_id is distinct from old.quarto_id then
    raise exception 'quarto_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.pessoa_id is distinct from old.pessoa_id then
    raise exception 'pessoa_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new;
  end if;
  select q.hospedagem_id, q.capacidade into v_hospedagem, v_capacidade
    from public.producao_quartos q where q.id = new.quarto_id and q.organization_id = new.organization_id;
  if not found then
    raise exception 'quarto_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.producao_pessoas p where p.id = new.pessoa_id and p.organization_id = new.organization_id) then
    raise exception 'pessoa_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  new.hospedagem_id := v_hospedagem;
  if tg_op = 'INSERT' and (select count(*) from public.producao_ocupantes o where o.quarto_id = new.quarto_id) >= v_capacidade then
    raise exception 'quarto_lotado' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_hospedagens_coerencia
  before insert or update of organization_id, temporada_id on public.producao_hospedagens
  for each row execute function public.fn_producao_hospedagem_coerencia();
create or replace trigger producao_hospedagens_updated_at
  before update on public.producao_hospedagens
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_hospedagens_historico
  after insert or update or delete on public.producao_hospedagens
  for each row execute function public.fn_producao_historico('localizador', 'hotel');

create or replace trigger producao_quartos_coerencia
  before insert or update of organization_id, hospedagem_id, capacidade on public.producao_quartos
  for each row execute function public.fn_producao_quarto_coerencia();
create or replace trigger producao_quartos_updated_at
  before update on public.producao_quartos
  for each row execute function public.fn_producao_updated_at();

create or replace trigger producao_ocupantes_coerencia
  before insert or update of organization_id, hospedagem_id, quarto_id, pessoa_id on public.producao_ocupantes
  for each row execute function public.fn_producao_ocupante_coerencia();

-- Quem vê o histórico: o texto de 20261114200000_producao_deslocamentos.sql com um ramo novo no fim.
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
  end, false);
$$;

alter table public.producao_hospedagens enable row level security;
alter table public.producao_quartos enable row level security;
alter table public.producao_ocupantes enable row level security;

-- A hospedagem herda a temporada à vista; o quarto herda a hospedagem; o ocupante herda o quarto (e a pessoa, para gravar).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_hospedagens' and policyname = 'producao_hospedagens: le') then
    create policy "producao_hospedagens: le" on public.producao_hospedagens for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_temporadas h where h.id = producao_hospedagens.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_hospedagens' and policyname = 'producao_hospedagens: leitura sem assinatura') then
    create policy "producao_hospedagens: leitura sem assinatura" on public.producao_hospedagens for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_temporadas h where h.id = producao_hospedagens.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_hospedagens' and policyname = 'producao_hospedagens: insere') then
    create policy "producao_hospedagens: insere" on public.producao_hospedagens for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_temporadas h where h.id = producao_hospedagens.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_hospedagens' and policyname = 'producao_hospedagens: apaga') then
    create policy "producao_hospedagens: apaga" on public.producao_hospedagens for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_temporadas h where h.id = producao_hospedagens.temporada_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_hospedagens' and policyname = 'producao_hospedagens: edita') then
    create policy "producao_hospedagens: edita" on public.producao_hospedagens for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_temporadas h where h.id = producao_hospedagens.temporada_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_temporadas h where h.id = producao_hospedagens.temporada_id));
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_quartos' and policyname = 'producao_quartos: le') then
    create policy "producao_quartos: le" on public.producao_quartos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_hospedagens h where h.id = producao_quartos.hospedagem_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_quartos' and policyname = 'producao_quartos: leitura sem assinatura') then
    create policy "producao_quartos: leitura sem assinatura" on public.producao_quartos for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_hospedagens h where h.id = producao_quartos.hospedagem_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_quartos' and policyname = 'producao_quartos: insere') then
    create policy "producao_quartos: insere" on public.producao_quartos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_hospedagens h where h.id = producao_quartos.hospedagem_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_quartos' and policyname = 'producao_quartos: apaga') then
    create policy "producao_quartos: apaga" on public.producao_quartos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_hospedagens h where h.id = producao_quartos.hospedagem_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_quartos' and policyname = 'producao_quartos: edita') then
    create policy "producao_quartos: edita" on public.producao_quartos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_hospedagens h where h.id = producao_quartos.hospedagem_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_hospedagens h where h.id = producao_quartos.hospedagem_id));
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_ocupantes' and policyname = 'producao_ocupantes: le') then
    create policy "producao_ocupantes: le" on public.producao_ocupantes for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_quartos h where h.id = producao_ocupantes.quarto_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_ocupantes' and policyname = 'producao_ocupantes: leitura sem assinatura') then
    create policy "producao_ocupantes: leitura sem assinatura" on public.producao_ocupantes for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_quartos h where h.id = producao_ocupantes.quarto_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_ocupantes' and policyname = 'producao_ocupantes: insere') then
    create policy "producao_ocupantes: insere" on public.producao_ocupantes for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_quartos h where h.id = producao_ocupantes.quarto_id) and exists (select 1 from public.producao_pessoas p where p.id = producao_ocupantes.pessoa_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_ocupantes' and policyname = 'producao_ocupantes: apaga') then
    create policy "producao_ocupantes: apaga" on public.producao_ocupantes for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_quartos h where h.id = producao_ocupantes.quarto_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_ocupantes' and policyname = 'producao_ocupantes: edita') then
    create policy "producao_ocupantes: edita" on public.producao_ocupantes for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_quartos h where h.id = producao_ocupantes.quarto_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_quartos h where h.id = producao_ocupantes.quarto_id) and exists (select 1 from public.producao_pessoas p where p.id = producao_ocupantes.pessoa_id));
  end if;
end
$$;

revoke execute on function public.fn_producao_hospedagem_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_quarto_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_ocupante_coerencia() from public, anon, authenticated;
revoke all on public.producao_hospedagens, public.producao_quartos, public.producao_ocupantes from anon, authenticated;
grant select, insert, update, delete on public.producao_hospedagens, public.producao_quartos, public.producao_ocupantes to authenticated;

comment on table public.producao_hospedagens is
  'Hospedagem da temporada: o hotel, a entrada e a saída, o endereço, o localizador e notas.';
comment on table public.producao_quartos is
  'Quarto de uma hospedagem, com nome e capacidade (o banco não deixa passar dela).';
comment on table public.producao_ocupantes is
  'Quem dorme em cada quarto: uma pessoa da equipe, em um só quarto por hospedagem.';
