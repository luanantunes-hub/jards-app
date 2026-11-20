-- PD4.1 e PD4.2: o acerto técnico (modelos e acertos por link).
--
-- producao_modelos_acerto: o modelo da organização (nome, quem preenche, e os campos em JSON: seção, tipo, destino e o que a
-- casa vê de cada um). Um acerto copia os campos do modelo no momento em que nasce, então mudar o modelo depois não mexe
-- em acerto já enviado.
-- producao_acertos: o acerto de uma data (situação aguardando, respondido, concluído ou cancelado), com o link: só o hash do
-- código fica guardado (o código aparece uma vez, quando o link é gerado), validade e revogação; e quem respondeu (nome e e-mail
-- digitados, sem conta). producao_acerto_itens: um campo do acerto, com o que a produção escreveu (valor_atual), o que a casa
-- respondeu, e a revisão item a item (aprovado ou recusado, com o motivo).
--
-- Regra central: nada chega ao campo real (a ficha da sala ou do espaço) sem aprovação. Só `fn_producao_acerto_revisar` grava
-- na ficha, e só depois que a produção aprova o item.
--
-- Acesso: os modelos são da organização inteira (como o inventário); o acerto e os itens são os da data (quem lê a data lê o
-- acerto; quem edita e vê a data escreve). A casa nunca toca nestas tabelas: a página pública (/acerto/[código]) e a resposta
-- passam pelo servidor, com a chave de serviço, que confere o hash do código, a validade e o que cada item permite.
-- As funções novas são `security invoker`: as regras de acesso de quem chama valem em cada passo.
--
-- Expansão: três tabelas novas e vazias, funções novas e a função do histórico trocada (create or replace, mesma assinatura,
-- os ramos de antes mais dois no fim). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.producao_modelos_acerto (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null,
  lado text not null default 'casa',
  tipo_producao text,
  campos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_modelos_acerto_nome_key unique (organization_id, nome),
  constraint producao_modelos_acerto_nome_check check (char_length(btrim(nome)) between 1 and 120),
  constraint producao_modelos_acerto_lado_check check (lado in ('casa', 'companhia')),
  constraint producao_modelos_acerto_tipo_producao_check check (tipo_producao is null or char_length(btrim(tipo_producao)) between 1 and 40),
  constraint producao_modelos_acerto_campos_check check (jsonb_typeof(campos) = 'array' and jsonb_array_length(campos) <= 80)
);

create index if not exists producao_modelos_acerto_org_idx on public.producao_modelos_acerto (organization_id);

create table if not exists public.producao_acertos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  data_id uuid not null references public.producao_datas (id) on delete cascade,
  modelo_nome text not null,
  lado text not null default 'casa',
  situacao text not null default 'aguardando',
  token_hash text,
  link_expira_em timestamptz,
  link_revogado_em timestamptz,
  respondente_nome text,
  respondente_email text,
  respondido_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_acertos_token_hash_key unique (token_hash),
  constraint producao_acertos_modelo_nome_check check (char_length(btrim(modelo_nome)) between 1 and 120),
  constraint producao_acertos_lado_check check (lado in ('casa', 'companhia')),
  constraint producao_acertos_situacao_check check (situacao in ('aguardando', 'respondido', 'concluido', 'cancelado')),
  constraint producao_acertos_token_hash_formato_check check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$'),
  constraint producao_acertos_respondente_nome_check check (respondente_nome is null or char_length(btrim(respondente_nome)) between 2 and 120),
  constraint producao_acertos_respondente_email_check check (respondente_email is null or (char_length(respondente_email) <= 254 and respondente_email ~ '^[^@[:space:]]+@[^@[:space:]]+$'))
);

create index if not exists producao_acertos_org_idx on public.producao_acertos (organization_id);
create index if not exists producao_acertos_data_idx on public.producao_acertos (data_id);
create index if not exists producao_acertos_criado_por_idx on public.producao_acertos (criado_por) where criado_por is not null;

create table if not exists public.producao_acerto_itens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  acerto_id uuid not null references public.producao_acertos (id) on delete cascade,
  ordem integer not null default 0,
  chave text not null,
  secao text not null,
  rotulo text not null,
  tipo text not null default 'texto',
  opcoes jsonb not null default '[]'::jsonb,
  destino text not null default 'livre',
  visibilidade text not null default 'opcional',
  ajuda text,
  valor_atual text,
  resposta text,
  situacao text not null default 'pendente',
  motivo text,
  revisado_por uuid references auth.users (id) on delete set null,
  revisado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producao_acerto_itens_chave_key unique (acerto_id, chave),
  constraint producao_acerto_itens_chave_check check (chave ~ '^[a-z0-9_]{1,40}$'),
  constraint producao_acerto_itens_ordem_check check (ordem between 0 and 1000),
  constraint producao_acerto_itens_secao_check check (char_length(btrim(secao)) between 1 and 60),
  constraint producao_acerto_itens_rotulo_check check (char_length(btrim(rotulo)) between 1 and 200),
  constraint producao_acerto_itens_tipo_check check (tipo in ('texto', 'numero', 'escolha', 'sim_nao', 'data', 'hora')),
  constraint producao_acerto_itens_opcoes_check check (jsonb_typeof(opcoes) = 'array' and jsonb_array_length(opcoes) <= 12),
  constraint producao_acerto_itens_destino_check check (destino in ('livre', 'sala_palco_boca_m', 'sala_palco_profundidade_m', 'sala_palco_altura_m', 'sala_som_canais_entrada', 'sala_luz_refletores', 'sala_energia_kva', 'sala_energia_tensao_v', 'sala_camarins_quantidade', 'espaco_carga_descarga', 'espaco_doca_altura_m')),
  constraint producao_acerto_itens_visibilidade_check check (visibilidade in ('oculto', 'leitura', 'opcional', 'obrigatorio')),
  constraint producao_acerto_itens_ajuda_check check (ajuda is null or char_length(ajuda) <= 300),
  constraint producao_acerto_itens_valor_atual_check check (valor_atual is null or char_length(valor_atual) <= 2000),
  constraint producao_acerto_itens_resposta_check check (resposta is null or char_length(resposta) <= 2000),
  constraint producao_acerto_itens_situacao_check check (situacao in ('pendente', 'respondido', 'aprovado', 'recusado')),
  constraint producao_acerto_itens_motivo_check check (motivo is null or char_length(motivo) <= 500)
);

create index if not exists producao_acerto_itens_org_idx on public.producao_acerto_itens (organization_id);
create index if not exists producao_acerto_itens_acerto_idx on public.producao_acerto_itens (acerto_id, ordem);
create index if not exists producao_acerto_itens_revisado_por_idx on public.producao_acerto_itens (revisado_por) where revisado_por is not null;

-- Coerência do acerto: a organização e a data não mudam; a data é da organização. Erros (check_violation):
-- organizacao_nao_muda, data_nao_muda, data_de_outra_organizacao.
create or replace function public.fn_producao_acerto_coerencia()
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

-- Coerência do item: a organização e o acerto não mudam; o acerto é da organização. Erros (check_violation):
-- organizacao_nao_muda, acerto_nao_muda, acerto_de_outra_organizacao.
create or replace function public.fn_producao_acerto_item_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organizacao_nao_muda' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.acerto_id is distinct from old.acerto_id then
    raise exception 'acerto_nao_muda' using errcode = 'check_violation';
  end if;
  if new.organization_id is null then
    return new;
  end if;
  if not exists (select 1 from public.producao_acertos a where a.id = new.acerto_id and a.organization_id = new.organization_id) then
    raise exception 'acerto_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger producao_modelos_acerto_updated_at
  before update on public.producao_modelos_acerto
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_modelos_acerto_historico
  after insert or update or delete on public.producao_modelos_acerto
  for each row execute function public.fn_producao_historico('campos', 'nome');

create or replace trigger producao_acertos_coerencia
  before insert or update of organization_id, data_id on public.producao_acertos
  for each row execute function public.fn_producao_acerto_coerencia();
create or replace trigger producao_acertos_updated_at
  before update on public.producao_acertos
  for each row execute function public.fn_producao_updated_at();
create or replace trigger producao_acertos_historico
  after insert or update or delete on public.producao_acertos
  for each row execute function public.fn_producao_historico('token_hash,respondente_nome,respondente_email', 'modelo_nome');

create or replace trigger producao_acerto_itens_coerencia
  before insert or update of organization_id, acerto_id on public.producao_acerto_itens
  for each row execute function public.fn_producao_acerto_item_coerencia();
create or replace trigger producao_acerto_itens_updated_at
  before update on public.producao_acerto_itens
  for each row execute function public.fn_producao_updated_at();

-- Quem vê o histórico: o texto de 20261111021003_producao_licencas.sql com dois ramos novos no fim.
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
  end, false);
$$;

alter table public.producao_modelos_acerto enable row level security;
alter table public.producao_acertos enable row level security;
alter table public.producao_acerto_itens enable row level security;

do $$
begin
  -- Modelos: da organização inteira, como o inventário.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_modelos_acerto' and policyname = 'producao_modelos_acerto: le') then
    create policy "producao_modelos_acerto: le" on public.producao_modelos_acerto for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_modelos_acerto' and policyname = 'producao_modelos_acerto: leitura sem assinatura') then
    create policy "producao_modelos_acerto: leitura sem assinatura" on public.producao_modelos_acerto for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_modelos_acerto' and policyname = 'producao_modelos_acerto: insere') then
    create policy "producao_modelos_acerto: insere" on public.producao_modelos_acerto for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_modelos_acerto' and policyname = 'producao_modelos_acerto: edita') then
    create policy "producao_modelos_acerto: edita" on public.producao_modelos_acerto for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null))
      with check (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_modelos_acerto' and policyname = 'producao_modelos_acerto: apaga') then
    create policy "producao_modelos_acerto: apaga" on public.producao_modelos_acerto for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and public.auth_producao_ve_temporada(organization_id, null));
  end if;

  -- Acertos: os da data.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acertos' and policyname = 'producao_acertos: le') then
    create policy "producao_acertos: le" on public.producao_acertos for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_datas d where d.id = producao_acertos.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acertos' and policyname = 'producao_acertos: leitura sem assinatura') then
    create policy "producao_acertos: leitura sem assinatura" on public.producao_acertos for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_datas d where d.id = producao_acertos.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acertos' and policyname = 'producao_acertos: insere') then
    create policy "producao_acertos: insere" on public.producao_acertos for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_datas d where d.id = producao_acertos.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acertos' and policyname = 'producao_acertos: edita') then
    create policy "producao_acertos: edita" on public.producao_acertos for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_datas d where d.id = producao_acertos.data_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_datas d where d.id = producao_acertos.data_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acertos' and policyname = 'producao_acertos: apaga') then
    create policy "producao_acertos: apaga" on public.producao_acertos for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_datas d where d.id = producao_acertos.data_id));
  end if;

  -- Itens: herdam o acerto à vista (que herda a data).
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acerto_itens' and policyname = 'producao_acerto_itens: le') then
    create policy "producao_acerto_itens: le" on public.producao_acerto_itens for select to authenticated
      using (public.auth_producao_pode(organization_id, 'ler') and exists (select 1 from public.producao_acertos a where a.id = producao_acerto_itens.acerto_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acerto_itens' and policyname = 'producao_acerto_itens: leitura sem assinatura') then
    create policy "producao_acerto_itens: leitura sem assinatura" on public.producao_acerto_itens for select to authenticated
      using (public.auth_producao_le_sem_assinatura(organization_id) and exists (select 1 from public.producao_acertos a where a.id = producao_acerto_itens.acerto_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acerto_itens' and policyname = 'producao_acerto_itens: insere') then
    create policy "producao_acerto_itens: insere" on public.producao_acerto_itens for insert to authenticated
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_acertos a where a.id = producao_acerto_itens.acerto_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acerto_itens' and policyname = 'producao_acerto_itens: edita') then
    create policy "producao_acerto_itens: edita" on public.producao_acerto_itens for update to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_acertos a where a.id = producao_acerto_itens.acerto_id))
      with check (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_acertos a where a.id = producao_acerto_itens.acerto_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'producao_acerto_itens' and policyname = 'producao_acerto_itens: apaga') then
    create policy "producao_acerto_itens: apaga" on public.producao_acerto_itens for delete to authenticated
      using (public.auth_producao_pode(organization_id, 'editar') and exists (select 1 from public.producao_acertos a where a.id = producao_acerto_itens.acerto_id));
  end if;
end
$$;

-- Cria o acerto de uma data a partir de um modelo: copia os campos, guarda o que a produção escreveu nos campos "a casa só
-- lê" (p_valores, por chave) e deixa para a casa os campos de preencher. Devolve o id do acerto. As regras de acesso de quem
-- chama valem (security invoker): quem não edita a data não cria. Passe p_valores como '{}' quando não há campo "só lê" a preencher. Erros: P0002 modelo_ou_data_nao_encontrados.
create or replace function public.fn_producao_acerto_criar(p_data uuid, p_modelo uuid, p_valores jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_nome text;
  v_lado text;
  v_campos jsonb;
  v_id uuid;
begin
  select d.organization_id, m.nome, m.lado, m.campos into v_org, v_nome, v_lado, v_campos
  from public.producao_datas d
  join public.producao_modelos_acerto m on m.organization_id = d.organization_id
  where d.id = p_data and m.id = p_modelo;
  if not found then
    raise exception 'modelo_ou_data_nao_encontrados' using errcode = 'P0002';
  end if;
  insert into public.producao_acertos (organization_id, data_id, modelo_nome, lado, criado_por)
  values (v_org, p_data, v_nome, v_lado, auth.uid())
  returning id into v_id;
  insert into public.producao_acerto_itens (organization_id, acerto_id, ordem, chave, secao, rotulo, tipo, opcoes, destino, visibilidade, ajuda, valor_atual, situacao)
  select v_org, v_id, (e.n - 1)::integer * 10, e.campo->>'chave', e.campo->>'secao', e.campo->>'rotulo', e.campo->>'tipo',
         coalesce(e.campo->'opcoes', '[]'::jsonb), e.campo->>'destino', e.campo->>'visibilidade', nullif(e.campo->>'ajuda', ''),
         case when e.campo->>'visibilidade' = 'leitura' then nullif(btrim(coalesce(p_valores->>(e.campo->>'chave'), '')), '') end,
         case when e.campo->>'visibilidade' in ('opcional', 'obrigatorio') then 'pendente' else 'aprovado' end
  from jsonb_array_elements(v_campos) with ordinality as e(campo, n);
  return v_id;
end;
$$;

-- Gera um link novo para o acerto (e apaga o anterior): devolve o código, que aparece só esta vez; o banco guarda o hash.
-- O link vale de 1 a 90 dias (o app usa 30). Só acerto aguardando ou respondido. Erros: P0001 prazo_invalido, P0002 acerto_nao_encontrado.
create or replace function public.fn_producao_acerto_novo_link(p_acerto uuid, p_dias integer)
returns text
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  v_codigo text;
  v_id uuid;
begin
  if p_dias is null or p_dias < 1 or p_dias > 90 then
    raise exception 'prazo_invalido';
  end if;
  v_codigo := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  update public.producao_acertos
  set token_hash = encode(extensions.digest(v_codigo, 'sha256'), 'hex'), link_expira_em = now() + make_interval(days => p_dias), link_revogado_em = null
  where id = p_acerto and situacao in ('aguardando', 'respondido')
  returning id into v_id;
  if v_id is null then
    raise exception 'acerto_nao_encontrado' using errcode = 'P0002';
  end if;
  return v_codigo;
end;
$$;

-- Revisa um item respondido: aprova (e, se o destino é um campo real, grava na ficha da sala ou do espaço da data) ou recusa
-- com motivo (passe vazio ao aprovar). Devolve a situação do acerto depois da revisão. Quando não sobra item para revisar, o acerto volta a aguardar a casa (se houve recusa) ou conclui. Só a
-- produção chama, com as regras dela (security invoker): quem não edita a ficha não grava nela. Erros: P0002
-- item_nao_encontrado, 42501 sem_permissao, check_violation item_nao_esta_para_revisar, motivo_obrigatorio, data_sem_sala, data_sem_espaco.
create or replace function public.fn_producao_acerto_revisar(p_item uuid, p_aprovar boolean, p_motivo text)
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_item public.producao_acerto_itens%rowtype;
  v_sala uuid;
  v_espaco uuid;
  v_tabela text;
  v_chave text;
  v_coluna text;
  v_tipo text;
  v_id uuid;
begin
  select * into v_item from public.producao_acerto_itens where id = p_item;
  if not found then
    raise exception 'item_nao_encontrado' using errcode = 'P0002';
  end if;
  if v_item.situacao <> 'respondido' then
    raise exception 'item_nao_esta_para_revisar' using errcode = 'check_violation';
  end if;
  if not p_aprovar and btrim(coalesce(p_motivo, '')) = '' then
    raise exception 'motivo_obrigatorio' using errcode = 'check_violation';
  end if;
  if p_aprovar and v_item.destino <> 'livre' then
    select d.sala_id, d.espaco_id into v_sala, v_espaco
    from public.producao_acertos a join public.producao_datas d on d.id = a.data_id
    where a.id = v_item.acerto_id;
    select t.tabela, t.chave, t.coluna, t.tipo into v_tabela, v_chave, v_coluna, v_tipo
    from (values
      ('sala_palco_boca_m', 'producao_sala_fichas', 'sala_id', 'palco_boca_m', 'numeric'),
      ('sala_palco_profundidade_m', 'producao_sala_fichas', 'sala_id', 'palco_profundidade_m', 'numeric'),
      ('sala_palco_altura_m', 'producao_sala_fichas', 'sala_id', 'palco_altura_m', 'numeric'),
      ('sala_som_canais_entrada', 'producao_sala_fichas', 'sala_id', 'som_canais_entrada', 'integer'),
      ('sala_luz_refletores', 'producao_sala_fichas', 'sala_id', 'luz_refletores', 'integer'),
      ('sala_energia_kva', 'producao_sala_fichas', 'sala_id', 'energia_kva', 'numeric'),
      ('sala_energia_tensao_v', 'producao_sala_fichas', 'sala_id', 'energia_tensao_v', 'integer'),
      ('sala_camarins_quantidade', 'producao_sala_fichas', 'sala_id', 'camarins_quantidade', 'integer'),
      ('espaco_carga_descarga', 'producao_espaco_fichas', 'espaco_id', 'carga_descarga', 'text'),
      ('espaco_doca_altura_m', 'producao_espaco_fichas', 'espaco_id', 'doca_altura_m', 'numeric')
    ) as t(destino, tabela, chave, coluna, tipo)
    where t.destino = v_item.destino;
    if v_tabela = 'producao_sala_fichas' then
      if v_sala is null then raise exception 'data_sem_sala' using errcode = 'check_violation'; end if;
      v_id := v_sala;
    else
      if v_espaco is null then raise exception 'data_sem_espaco' using errcode = 'check_violation'; end if;
      v_id := v_espaco;
    end if;
    -- Nomes de tabela, chave, coluna e tipo vêm só da lista fechada acima; o valor entra como parâmetro.
    execute format('insert into public.%I (%I, organization_id, %I) values ($1, $2, $3::%s) on conflict (%I) do update set %I = excluded.%I',
                   v_tabela, v_chave, v_coluna, v_tipo, v_chave, v_coluna, v_coluna)
      using v_id, v_item.organization_id, replace(v_item.resposta, ',', '.');
  end if;
  update public.producao_acerto_itens
  set situacao = case when p_aprovar then 'aprovado' else 'recusado' end,
      motivo = case when p_aprovar then null else btrim(p_motivo) end,
      revisado_por = auth.uid(), revisado_em = now()
  where id = p_item;
  if not found then
    raise exception 'sem_permissao' using errcode = '42501'; -- as regras de quem chama não deixaram gravar
  end if;
  if not exists (select 1 from public.producao_acerto_itens where acerto_id = v_item.acerto_id and situacao = 'respondido') then
    update public.producao_acertos
    set situacao = case when exists (select 1 from public.producao_acerto_itens where acerto_id = v_item.acerto_id and situacao = 'recusado') then 'aguardando' else 'concluido' end
    where id = v_item.acerto_id and situacao = 'respondido';
  end if;
  return (select a.situacao from public.producao_acertos a where a.id = v_item.acerto_id);
end;
$$;

-- A resposta da casa, de uma vez só (tudo ou nada): grava as respostas dos itens que ela pode preencher agora (opcional ou
-- obrigatório, pendente ou recusado), o nome e o e-mail de quem respondeu, e passa o acerto a respondido. Só o servidor da
-- página pública chama (chave de serviço): o navegador não executa. O servidor já conferiu o formato dos valores; aqui ficam
-- a conferência do link e do estado e a gravação atômica. `p_respostas` é uma lista de {id, valor}. Devolve 'ok' ou o motivo:
-- inexistente, revogado, expirado, cancelado, indisponivel (já respondido ou concluído) ou sem_respostas.
create or replace function public.fn_producao_acerto_responder(p_hash text, p_nome text, p_email text, p_respostas jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_acerto public.producao_acertos%rowtype;
  v_gravados integer;
begin
  select * into v_acerto from public.producao_acertos where token_hash = p_hash for update;
  if not found then return 'inexistente'; end if;
  if v_acerto.link_revogado_em is not null then return 'revogado'; end if;
  if v_acerto.link_expira_em is null or v_acerto.link_expira_em < now() then return 'expirado'; end if;
  if v_acerto.situacao = 'cancelado' then return 'cancelado'; end if;
  if v_acerto.situacao <> 'aguardando' then return 'indisponivel'; end if;
  update public.producao_acerto_itens i
  set resposta = r.valor, situacao = 'respondido', motivo = null
  from jsonb_to_recordset(p_respostas) as r(id uuid, valor text)
  where i.id = r.id and i.acerto_id = v_acerto.id and i.visibilidade in ('opcional', 'obrigatorio') and i.situacao in ('pendente', 'recusado');
  get diagnostics v_gravados = row_count;
  if v_gravados = 0 then return 'sem_respostas'; end if;
  update public.producao_acertos
  set situacao = 'respondido', respondente_nome = p_nome, respondente_email = nullif(btrim(coalesce(p_email, '')), ''), respondido_em = now()
  where id = v_acerto.id;
  return 'ok';
end;
$$;

revoke execute on function public.fn_producao_acerto_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_acerto_responder(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.fn_producao_acerto_responder(text, text, text, jsonb) to service_role;
revoke execute on function public.fn_producao_acerto_item_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_producao_acerto_criar(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.fn_producao_acerto_novo_link(uuid, integer) from public, anon;
revoke execute on function public.fn_producao_acerto_revisar(uuid, boolean, text) from public, anon;
grant execute on function public.fn_producao_acerto_criar(uuid, uuid, jsonb) to authenticated;
grant execute on function public.fn_producao_acerto_novo_link(uuid, integer) to authenticated;
grant execute on function public.fn_producao_acerto_revisar(uuid, boolean, text) to authenticated;
revoke all on public.producao_modelos_acerto, public.producao_acertos, public.producao_acerto_itens from anon, authenticated;
grant select, insert, update, delete on public.producao_modelos_acerto to authenticated;
-- O hash do código nunca sai para o navegador: a produção lê as colunas do acerto menos ele.
grant select (id, organization_id, data_id, modelo_nome, lado, situacao, link_expira_em, link_revogado_em, respondente_nome, respondente_email, respondido_em, criado_por, created_at, updated_at) on public.producao_acertos to authenticated;
grant insert (organization_id, data_id, modelo_nome, lado, criado_por) on public.producao_acertos to authenticated;
-- Quem edita muda a situação e o link (as funções de link e de revisão são `security invoker` e precisam destas colunas).
grant update (situacao, token_hash, link_expira_em, link_revogado_em) on public.producao_acertos to authenticated;
grant delete on public.producao_acertos to authenticated;
grant select, insert, update, delete on public.producao_acerto_itens to authenticated;

comment on table public.producao_modelos_acerto is 'Modelo de acerto técnico da organização: nome, quem preenche e os campos (seção, tipo, destino e o que a casa vê). O acerto copia os campos ao nascer.';
comment on table public.producao_acertos is 'Acerto técnico de uma data, com o link para a casa responder sem conta (só o hash do código é guardado). Nada chega à ficha sem a produção aprovar o item.';
comment on table public.producao_acerto_itens is 'Um campo de um acerto: o que a produção escreveu, o que a casa respondeu e a revisão item a item.';
