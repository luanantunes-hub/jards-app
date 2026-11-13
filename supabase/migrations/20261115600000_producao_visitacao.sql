-- PD7.5 (primeiro corte): visitação e grupos, com agendamento por link e capacidade por horário.
--
-- producao_visitas_horarios: os horários de visitação de um espaço (uma exposição, uma visita guiada): dia, início e fim, a capacidade de pessoas e o
-- público avulso (quem veio sem agendar, digitado depois). producao_visitas_agendamentos: o agendamento de uma escola ou de um grupo num horário: o nome do
-- grupo, a pessoa responsável, um contato (e-mail ou telefone), quantas pessoas, a situação (pedido, confirmado, recusado ou cancelado) e
-- quantas vieram de fato. producao_visitas_links: o link público do espaço (um por espaço, só o hash do código fica guardado), com validade e título.
--
-- A capacidade é conferida no banco: a soma das pessoas de pedidos e confirmados num horário não passa da capacidade (erro
-- `capacidade_excedida`), com a linha do horário travada para dois agendamentos ao mesmo tempo não furarem. O público do dia é a soma dos
-- que vieram (agendados) com o avulso. Dado pessoal: o responsável e o contato servem só para falar com o grupo; quem agenda pelo
-- link marca que concorda (`consentiu_em`). O histórico guarda o grupo, a situação e as pessoas e deixa de fora o contato e a
-- observação. O texto de privacidade que cobre esta coleta é decisão do dono.
--
-- Funções: `fn_producao_visitas_gerar_link(espaco, dias, titulo)` (a produção logada; devolve o código uma vez) e
-- `fn_producao_visita_agendar(hash, horario, grupo, responsavel, email, telefone, pessoas, observacao)` (só o servidor, pela página
-- pública; devolve 'ok' ou o motivo: inexistente, revogado, expirado, horario_invalido, lotado).
-- Acesso: o do espaço (recorte "só onde está vinculado" vale); os agendamentos herdam o do horário. O hash nunca sai para o navegador.
--
-- Expansão: três tabelas novas e vazias, três funções de gatilho, duas de negócio e a função do histórico trocada (create or replace,
-- mesma assinatura, os ramos de antes mais dois no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_visitas_horarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  espaco_id uuid not null references public.producao_espacos (id) on delete cascade,
  dia date not null,
  inicio time not null,
  fim time not null,
  capacidade integer not null,
  publico_avulso integer,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_visitas_horarios_horas_check check (fim > inicio),
  constraint producao_visitas_horarios_capacidade_check check (capacidade between 1 and 5000),
  constraint producao_visitas_horarios_avulso_check check (publico_avulso is null or publico_avulso between 0 and 100000),
  constraint producao_visitas_horarios_notas_check check (notas is null or char_length(btrim(notas)) between 1 and 300),
  constraint producao_visitas_horarios_unico_key unique (espaco_id, dia, inicio)
);

create index if not exists producao_visitas_horarios_org_idx on public.producao_visitas_horarios (organization_id);
create index if not exists producao_visitas_horarios_dia_idx on public.producao_visitas_horarios (espaco_id, dia, inicio);

create table if not exists public.producao_visitas_agendamentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  horario_id uuid not null references public.producao_visitas_horarios (id) on delete cascade,
  grupo text not null,
  responsavel text not null,
  email text,
  telefone text,
  pessoas integer not null,
  situacao text not null default 'pedido',
  presentes integer,
  observacao text,
  consentiu_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_visitas_agendamentos_grupo_check check (char_length(btrim(grupo)) between 1 and 120),
  constraint producao_visitas_agendamentos_responsavel_check check (char_length(btrim(responsavel)) between 1 and 120),
  constraint producao_visitas_agendamentos_email_check check (email is null or (char_length(email) between 3 and 200 and email ~ '^[^@\s]+@[^@\s]+$')),
  constraint producao_visitas_agendamentos_telefone_check check (telefone is null or char_length(btrim(telefone)) between 5 and 30),
  constraint producao_visitas_agendamentos_contato_check check (email is not null or telefone is not null),
  constraint producao_visitas_agendamentos_pessoas_check check (pessoas between 1 and 500),
  constraint producao_visitas_agendamentos_situacao_check check (situacao in ('pedido', 'confirmado', 'recusado', 'cancelado')),
  constraint producao_visitas_agendamentos_presentes_check check (presentes is null or presentes between 0 and 5000),
  constraint producao_visitas_agendamentos_observacao_check check (observacao is null or char_length(btrim(observacao)) between 1 and 300)
);

create index if not exists producao_visitas_agendamentos_org_idx on public.producao_visitas_agendamentos (organization_id);
create index if not exists producao_visitas_agendamentos_horario_idx on public.producao_visitas_agendamentos (horario_id, situacao);

create table if not exists public.producao_visitas_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  espaco_id uuid not null references public.producao_espacos (id) on delete cascade,
  token_hash text not null,
  titulo text,
  expira_em timestamptz not null,
  revogado_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_visitas_links_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint producao_visitas_links_titulo_check check (titulo is null or char_length(btrim(titulo)) between 1 and 120),
  constraint producao_visitas_links_hash_key unique (token_hash),
  constraint producao_visitas_links_espaco_key unique (espaco_id)
);

create index if not exists producao_visitas_links_org_idx on public.producao_visitas_links (organization_id);

-- Coerência do horário e do link: a organização e o espaço não mudam; o espaço é da organização.
-- Erros (check_violation): organizacao_nao_muda, espaco_nao_muda, espaco_de_outra_organizacao.
create or replace function public.fn_producao_visitas_espaco_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.espaco_id is distinct from old.espaco_id then
    raise exception 'espaco_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  if not exists (select 1 from public.producao_espacos e where e.id = new.espaco_id and e.organization_id = new.organization_id) then
    raise exception 'espaco_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Coerência do agendamento: a organização e o horário não mudam; o horário é da organização; a capacidade do horário vale.
-- Erros (check_violation): organizacao_nao_muda, horario_nao_muda, horario_de_outra_organizacao, capacidade_excedida.
create or replace function public.fn_producao_visita_agendamento_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_capacidade integer;
  v_usados integer;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.horario_id is distinct from old.horario_id then
    raise exception 'horario_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new; -- a coluna é not null: quem recusa é a tabela
  end if;
  -- Trava a linha do horário: dois agendamentos ao mesmo tempo esperam um pelo outro e a soma sai certa.
  select h.capacidade into v_capacidade from public.producao_visitas_horarios h
  where h.id = new.horario_id and h.organization_id = new.organization_id for update;
  if not found then
    raise exception 'horario_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  -- Só confere quando o consumo da capacidade aumenta: agendamento novo, pedido recusado ou cancelado que volta, mais pessoas.
  if new.situacao in ('pedido', 'confirmado')
     and (tg_op = 'INSERT' or old.situacao in ('recusado', 'cancelado') or new.pessoas > old.pessoas) then
    select coalesce(sum(a.pessoas), 0) into v_usados
    from public.producao_visitas_agendamentos a
    where a.horario_id = new.horario_id and a.situacao in ('pedido', 'confirmado') and (tg_op = 'INSERT' or a.id <> new.id);
    if v_usados + new.pessoas > v_capacidade then
      raise exception 'capacidade_excedida' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger producao_visitas_horarios_coerencia
  before insert or update on public.producao_visitas_horarios
  for each row execute function public.fn_producao_visitas_espaco_coerencia();
create or replace trigger producao_visitas_horarios_updated_at
  before update on public.producao_visitas_horarios
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_visitas_horarios_historico
  after insert or update or delete on public.producao_visitas_horarios
  for each row execute function public.fn_producao_historico('', 'dia');

create or replace trigger producao_visitas_agendamentos_coerencia
  before insert or update on public.producao_visitas_agendamentos
  for each row execute function public.fn_producao_visita_agendamento_coerencia();
create or replace trigger producao_visitas_agendamentos_updated_at
  before update on public.producao_visitas_agendamentos
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_visitas_agendamentos_historico
  after insert or update or delete on public.producao_visitas_agendamentos
  for each row execute function public.fn_producao_historico('email,telefone,observacao,consentiu_em', 'grupo');

create or replace trigger producao_visitas_links_coerencia
  before insert or update on public.producao_visitas_links
  for each row execute function public.fn_producao_visitas_espaco_coerencia();
create or replace trigger producao_visitas_links_updated_at
  before update on public.producao_visitas_links
  for each row execute function public.fn_producao_updated_at();

-- Quem vê o histórico: o texto de 20261115500000_producao_acessibilidade.sql com dois ramos novos no fim.
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
    when 'producao_visitas_horarios' then exists (select 1 from public.producao_visitas_horarios x where x.id = p_entidade_id and x.organization_id = p_org)
    when 'producao_visitas_agendamentos' then exists (select 1 from public.producao_visitas_agendamentos x where x.id = p_entidade_id and x.organization_id = p_org)
  end, false);
$$;

alter table public.producao_visitas_horarios enable row level security;
alter table public.producao_visitas_agendamentos enable row level security;
alter table public.producao_visitas_links enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_visitas_horarios' and policyname = 'producao_visitas_horarios: le') then
    create policy "producao_visitas_horarios: le" on public.producao_visitas_horarios for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and public.auth_producao_ve_espaco(organization_id, espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_visitas_horarios' and policyname = 'producao_visitas_horarios: leitura sem assinatura') then
    create policy "producao_visitas_horarios: leitura sem assinatura" on public.producao_visitas_horarios for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and public.auth_producao_ve_espaco(organization_id, espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_visitas_horarios' and policyname = 'producao_visitas_horarios: insere') then
    create policy "producao_visitas_horarios: insere" on public.producao_visitas_horarios for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_espaco(organization_id, espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_visitas_horarios' and policyname = 'producao_visitas_horarios: edita') then
    create policy "producao_visitas_horarios: edita" on public.producao_visitas_horarios for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_espaco(organization_id, espaco_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_espaco(organization_id, espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_visitas_horarios' and policyname = 'producao_visitas_horarios: apaga') then
    create policy "producao_visitas_horarios: apaga" on public.producao_visitas_horarios for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_espaco(organization_id, espaco_id));
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_visitas_agendamentos' and policyname = 'producao_visitas_agendamentos: le') then
    create policy "producao_visitas_agendamentos: le" on public.producao_visitas_agendamentos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_visitas_horarios h where h.id = producao_visitas_agendamentos.horario_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_visitas_agendamentos' and policyname = 'producao_visitas_agendamentos: leitura sem assinatura') then
    create policy "producao_visitas_agendamentos: leitura sem assinatura" on public.producao_visitas_agendamentos for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_visitas_horarios h where h.id = producao_visitas_agendamentos.horario_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_visitas_agendamentos' and policyname = 'producao_visitas_agendamentos: insere') then
    create policy "producao_visitas_agendamentos: insere" on public.producao_visitas_agendamentos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_visitas_horarios h where h.id = producao_visitas_agendamentos.horario_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_visitas_agendamentos' and policyname = 'producao_visitas_agendamentos: edita') then
    create policy "producao_visitas_agendamentos: edita" on public.producao_visitas_agendamentos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_visitas_horarios h where h.id = producao_visitas_agendamentos.horario_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_visitas_horarios h where h.id = producao_visitas_agendamentos.horario_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_visitas_agendamentos' and policyname = 'producao_visitas_agendamentos: apaga') then
    create policy "producao_visitas_agendamentos: apaga" on public.producao_visitas_agendamentos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_visitas_horarios h where h.id = producao_visitas_agendamentos.horario_id));
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_visitas_links' and policyname = 'producao_visitas_links: le') then
    create policy "producao_visitas_links: le" on public.producao_visitas_links for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and public.auth_producao_ve_espaco(organization_id, espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_visitas_links' and policyname = 'producao_visitas_links: leitura sem assinatura') then
    create policy "producao_visitas_links: leitura sem assinatura" on public.producao_visitas_links for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and public.auth_producao_ve_espaco(organization_id, espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_visitas_links' and policyname = 'producao_visitas_links: insere') then
    create policy "producao_visitas_links: insere" on public.producao_visitas_links for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_espaco(organization_id, espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_visitas_links' and policyname = 'producao_visitas_links: edita') then
    create policy "producao_visitas_links: edita" on public.producao_visitas_links for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_espaco(organization_id, espaco_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_espaco(organization_id, espaco_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_visitas_links' and policyname = 'producao_visitas_links: apaga') then
    create policy "producao_visitas_links: apaga" on public.producao_visitas_links for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_espaco(organization_id, espaco_id));
  end if;
end
$$;

-- Gera (ou renova) o link de agendamento do espaço e devolve o código, que aparece só esta vez; o banco guarda o hash. O link vale de 1 a
-- 365 dias. As regras de acesso de quem chama valem (security invoker). Erros: P0001 prazo_invalido, P0002 espaco_nao_encontrado.
create or replace function public.fn_producao_visitas_gerar_link(p_espaco uuid, p_dias integer, p_titulo text)
returns text
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  v_org uuid;
  v_codigo text;
  v_hash text;
  v_titulo text := nullif(btrim(coalesce(p_titulo, '')), '');
begin
  if p_dias is null or p_dias < 1 or p_dias > 365 then
    raise exception 'prazo_invalido';
  end if;
  select e.organization_id into v_org from public.producao_espacos e where e.id = p_espaco;
  if v_org is null then
    raise exception 'espaco_nao_encontrado' using errcode = 'P0002';
  end if;
  v_codigo := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_hash := encode(extensions.digest(v_codigo, 'sha256'), 'hex');
  -- Atualiza o link que já existe; se não houver, cria. (Sem ON CONFLICT: ele leria a coluna do hash, que o navegador não lê.)
  update public.producao_visitas_links
  set token_hash = v_hash, expira_em = now() + make_interval(days => p_dias), titulo = v_titulo, revogado_em = null
  where espaco_id = p_espaco;
  if not found then
    insert into public.producao_visitas_links (organization_id, espaco_id, token_hash, expira_em, titulo, criado_por)
    values (v_org, p_espaco, v_hash, now() + make_interval(days => p_dias), v_titulo, auth.uid());
  end if;
  return v_codigo;
end;
$$;

-- O agendamento pelo link: só a página pública chama (chave de serviço); o navegador não executa. O servidor já conferiu o formato dos
-- valores; aqui ficam a conferência do link, do horário (do espaço do link e de hoje em diante) e a gravação; a capacidade é conferida
-- pelo gatilho do agendamento. Devolve 'ok' ou o motivo: inexistente, revogado, expirado, horario_invalido, lotado.
create or replace function public.fn_producao_visita_agendar(p_hash text, p_horario uuid, p_grupo text, p_responsavel text, p_email text, p_telefone text, p_pessoas integer, p_observacao text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_link public.producao_visitas_links%rowtype;
begin
  select * into v_link from public.producao_visitas_links where token_hash = p_hash;
  if not found then return 'inexistente'; end if;
  if v_link.revogado_em is not null then return 'revogado'; end if;
  if v_link.expira_em <= now() then return 'expirado'; end if;
  if not exists (select 1 from public.producao_visitas_horarios h where h.id = p_horario and h.espaco_id = v_link.espaco_id and h.dia >= current_date) then
    return 'horario_invalido';
  end if;
  begin
    insert into public.producao_visitas_agendamentos (organization_id, horario_id, grupo, responsavel, email, telefone, pessoas, situacao, observacao, consentiu_em)
    values (v_link.organization_id, p_horario, p_grupo, p_responsavel, nullif(lower(btrim(coalesce(p_email, ''))), ''), nullif(btrim(coalesce(p_telefone, '')), ''),
            p_pessoas, 'pedido', nullif(btrim(coalesce(p_observacao, '')), ''), now());
  exception when check_violation then
    if sqlerrm = 'capacidade_excedida' then return 'lotado'; end if;
    raise;
  end;
  return 'ok';
end;
$$;

revoke execute on function public.fn_producao_visitas_espaco_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_visita_agendamento_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_visitas_gerar_link(uuid, integer, text) from public, anon;
grant execute on function public.fn_producao_visitas_gerar_link(uuid, integer, text) to authenticated;
revoke execute on function public.fn_producao_visita_agendar(text, uuid, text, text, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.fn_producao_visita_agendar(text, uuid, text, text, text, text, integer, text) to service_role;
revoke all on public.producao_visitas_horarios, public.producao_visitas_agendamentos, public.producao_visitas_links from anon, authenticated;
grant select, insert, update, delete on public.producao_visitas_horarios, public.producao_visitas_agendamentos to authenticated;
-- O hash do código nunca sai para o navegador: a produção lê as colunas do link menos ele.
grant select (id, organization_id, espaco_id, titulo, expira_em, revogado_em, criado_por, created_at, updated_at) on public.producao_visitas_links to authenticated;
grant insert (organization_id, espaco_id, token_hash, titulo, expira_em, criado_por) on public.producao_visitas_links to authenticated;
grant update (token_hash, titulo, expira_em, revogado_em) on public.producao_visitas_links to authenticated;
grant delete on public.producao_visitas_links to authenticated;

comment on table public.producao_visitas_horarios is 'Horário de visitação de um espaço: dia, hora, capacidade de pessoas e público avulso.';
comment on table public.producao_visitas_agendamentos is 'Agendamento de uma escola ou grupo num horário de visitação: responsável, contato, pessoas, situação e quantos vieram; a capacidade é conferida pelo banco.';
comment on table public.producao_visitas_links is 'Link público de agendamento de visitas de um espaço (só o hash do código é guardado), com validade e título.';
