-- Estrutura do módulo de prestação de contas, versionada a partir do banco de
-- produção (leitura de 04/10/2026).
--
-- As tabelas foram criadas em produção por migrations aplicadas direto no
-- banco (20260827074320 a 20260827224426) que nunca entraram nesta pasta.
-- Este arquivo consolida o estado delas e usa a versão da primeira, para vir
-- antes das migrations que já referenciam as tabelas (20260830044912 e
-- 20261001210000). Tudo é idempotente: em produção não muda nada; num banco
-- novo cria o módulo como está em produção.
--
-- Fora daqui, de propósito:
-- - can_access_prestacao e as regras por organização são redefinidas em
--   20260830044912 e 20261001210000; aqui a função é criada só para as regras
--   deste arquivo existirem num banco novo.
-- - Políticas do bucket "documentos": 20260830044912.

-- ─── Tipos ──────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'status_prestacao' and typnamespace = 'public'::regnamespace) then
    create type public.status_prestacao as enum
      ('rascunho', 'revisao_interna', 'enviado', 'ajuste_solicitado', 'aprovado', 'arquivado');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_comprovante' and typnamespace = 'public'::regnamespace) then
    create type public.status_comprovante as enum ('pendente', 'aceito', 'rejeitado');
  end if;
  if not exists (select 1 from pg_type where typname = 'tipo_comprovante' and typnamespace = 'public'::regnamespace) then
    create type public.tipo_comprovante as enum ('nfe', 'recibo', 'contrato', 'foto', 'planilha', 'outro');
  end if;
end
$$;

-- ─── Módulos (lidos pelo layout do dashboard) ───────────────────────────────

alter table public.organizations
  add column if not exists modulos_ativos text[] not null default '{captacao}'::text[];
alter table public.organization_members
  add column if not exists modulos_acesso text[] not null default '{captacao}'::text[];

-- ─── Tabelas ────────────────────────────────────────────────────────────────

create table if not exists public.prestacoes_contas (
  id uuid primary key default gen_random_uuid(),
  captacao_id uuid references public.captacoes(id) on delete set null,
  projeto_id uuid references public.projetos_crm(id) on delete set null,
  titulo text not null,
  status public.status_prestacao not null default 'rascunho',
  prazo date,
  valor_aprovado numeric(14,2),
  valor_realizado numeric(14,2) default 0,
  observacoes text,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data_inicio_execucao date,
  data_fim_execucao date
);

create table if not exists public.prestacao_status_log (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  status_anterior public.status_prestacao,
  status_novo public.status_prestacao not null,
  usuario_id uuid references auth.users(id) on delete set null,
  comentario text,
  created_at timestamptz not null default now()
);

create table if not exists public.prestacao_itens (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  rubrica text not null,
  descricao text,
  valor_aprovado numeric(14,2) not null default 0,
  valor_realizado numeric(14,2) not null default 0,
  tolerancia_pct smallint not null default 15,
  ordem smallint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.prestacao_comprovantes (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  item_id uuid references public.prestacao_itens(id) on delete set null,
  tipo public.tipo_comprovante not null default 'outro',
  nome_arquivo text not null,
  storage_path text not null,
  valor_extraido numeric(14,2),
  data_doc date,
  status public.status_comprovante not null default 'pendente',
  observacao text,
  enviado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  origem text not null default 'nacional' check (origem in ('nacional', 'internacional')),
  descricao_servico text,
  risco_glosa text check (risco_glosa in ('baixo', 'medio', 'alto')),
  motivos_glosa text[] default '{}'::text[],
  rubrica_sugerida_id uuid references public.prestacao_itens(id) on delete set null,
  rubrica_confianca integer
);

create table if not exists public.prestacao_atividades (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  titulo text not null,
  descricao text,
  data_realizacao date not null,
  local text,
  cidade text,
  estado character(2),
  publico_atingido integer,
  meta_prevista integer,
  ordem smallint not null default 0,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  empregos_diretos integer,
  empregos_indiretos integer,
  democratizacao_descricao text,
  acessibilidade_descricao text,
  status_realizacao text not null default 'realizado' check (status_realizacao in ('realizado', 'nao_realizado')),
  justificativa_nao_realizacao text,
  data_inicio date,
  data_fim date
);

create table if not exists public.prestacao_atividade_evidencias (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.prestacao_atividades(id) on delete cascade,
  nome_arquivo text not null,
  storage_path text not null,
  tipo text not null default 'foto',
  created_at timestamptz not null default now()
);

create table if not exists public.prestacao_relatorio (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  secao text not null,
  conteudo text not null default '',
  updated_at timestamptz not null default now(),
  unique (prestacao_id, secao)
);

create table if not exists public.prestacao_distribuicao (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  tipo text not null check (tipo in ('pago', 'gratuito', 'cortesia')),
  categoria text,
  quantidade integer not null default 0,
  preco_unitario numeric(10,2),
  publico_alvo text not null default 'geral'
    check (publico_alvo in ('geral', 'idosos', 'pne', 'estudantes', 'professores', 'outro')),
  observacoes text,
  created_at timestamptz default now()
);

create table if not exists public.prestacao_divulgacao (
  id uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references public.prestacoes_contas(id) on delete cascade,
  tipo text not null
    check (tipo in ('cartaz', 'folder', 'banner', 'programa', 'website', 'redes_sociais', 'release', 'video', 'outro')),
  descricao text,
  data_veiculacao date,
  lei_mencionada boolean not null default false,
  minc_logo boolean not null default false,
  arquivo_url text,
  created_at timestamptz default now()
);

create index if not exists prestacao_distribuicao_prestacao_id_idx on public.prestacao_distribuicao (prestacao_id);
create index if not exists prestacao_divulgacao_prestacao_id_idx on public.prestacao_divulgacao (prestacao_id);

-- ─── Gatilhos ───────────────────────────────────────────────────────────────
-- valor_realizado do item = soma dos comprovantes aceitos ligados a ele;
-- valor_realizado da prestação = soma dos itens.

create or replace function public.recalcular_valor_realizado()
returns trigger
language plpgsql
as $function$
DECLARE
  target_item_id uuid;
BEGIN
  -- Determina qual item_id recalcular
  IF TG_OP = 'DELETE' THEN
    target_item_id := OLD.item_id;
  ELSE
    target_item_id := NEW.item_id;
    -- Se item mudou, recalcula o antigo também
    IF TG_OP = 'UPDATE' AND OLD.item_id IS DISTINCT FROM NEW.item_id AND OLD.item_id IS NOT NULL THEN
      UPDATE prestacao_itens
      SET valor_realizado = COALESCE((
        SELECT SUM(valor_extraido)
        FROM prestacao_comprovantes
        WHERE item_id = OLD.item_id AND status = 'aceito' AND valor_extraido IS NOT NULL
      ), 0)
      WHERE id = OLD.item_id;
    END IF;
  END IF;

  IF target_item_id IS NOT NULL THEN
    UPDATE prestacao_itens
    SET valor_realizado = COALESCE((
      SELECT SUM(valor_extraido)
      FROM prestacao_comprovantes
      WHERE item_id = target_item_id AND status = 'aceito' AND valor_extraido IS NOT NULL
    ), 0)
    WHERE id = target_item_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

create or replace function public.sync_prestacao_valor_realizado()
returns trigger
language plpgsql
as $function$
BEGIN
  UPDATE prestacoes_contas
  SET valor_realizado = (
    SELECT COALESCE(SUM(valor_realizado), 0)
    FROM prestacao_itens
    WHERE prestacao_id = COALESCE(NEW.prestacao_id, OLD.prestacao_id)
  )
  WHERE id = COALESCE(NEW.prestacao_id, OLD.prestacao_id);
  RETURN NEW;
END;
$function$;

create or replace function public.set_prestacao_updated_at()
returns trigger
language plpgsql
as $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$;

create or replace function public.set_relatorio_updated_at()
returns trigger
language plpgsql
as $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_valor_realizado' and tgrelid = 'public.prestacao_comprovantes'::regclass) then
    create trigger trg_valor_realizado
      after insert or update or delete on public.prestacao_comprovantes
      for each row execute function public.recalcular_valor_realizado();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_itens_sync_valor' and tgrelid = 'public.prestacao_itens'::regclass) then
    create trigger prestacao_itens_sync_valor
      after insert or update or delete on public.prestacao_itens
      for each row execute function public.sync_prestacao_valor_realizado();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'prestacoes_contas_updated_at' and tgrelid = 'public.prestacoes_contas'::regclass) then
    create trigger prestacoes_contas_updated_at
      before update on public.prestacoes_contas
      for each row execute function public.set_prestacao_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'prestacao_relatorio_updated_at' and tgrelid = 'public.prestacao_relatorio'::regclass) then
    create trigger prestacao_relatorio_updated_at
      before update on public.prestacao_relatorio
      for each row execute function public.set_relatorio_updated_at();
  end if;
end
$$;

-- ─── Acesso ─────────────────────────────────────────────────────────────────
-- Mesmo corpo de 20260830044912 (que a redefine). Criador, ou membro da
-- organização do projeto ou da captação.

create or replace function public.can_access_prestacao(target_prestacao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.prestacoes_contas p
    where p.id = target_prestacao_id
      and (
        p.criado_por = auth.uid()
        or exists (
          select 1 from public.projetos_crm projeto
          where projeto.id = p.projeto_id
            and projeto.organization_id = any(array(select public.auth_org_ids()))
        )
        or exists (
          select 1 from public.captacoes captacao
          where captacao.id = p.captacao_id
            and captacao.organization_id = any(array(select public.auth_org_ids()))
        )
      )
  );
$$;
revoke all on function public.can_access_prestacao(uuid) from public;
grant execute on function public.can_access_prestacao(uuid) to authenticated;

alter table public.prestacoes_contas enable row level security;
alter table public.prestacao_status_log enable row level security;
alter table public.prestacao_itens enable row level security;
alter table public.prestacao_comprovantes enable row level security;
alter table public.prestacao_atividades enable row level security;
alter table public.prestacao_atividade_evidencias enable row level security;
alter table public.prestacao_relatorio enable row level security;
alter table public.prestacao_distribuicao enable row level security;
alter table public.prestacao_divulgacao enable row level security;

-- Regras por acesso à prestação. Em produção as regras originais
-- ("auth users can manage ...", abertas a qualquer conta logada) foram
-- restringidas em 04/10/2026; 20261001210000 troca estas pelas versões com
-- nome por tabela.
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacoes_contas') then
    create policy "auth users can manage prestacoes" on public.prestacoes_contas
      for all to authenticated
      using (criado_por = auth.uid() or public.can_access_prestacao(id))
      with check (criado_por = auth.uid() or public.can_access_prestacao(id));
  end if;

  foreach t in array array['prestacao_status_log', 'prestacao_itens', 'prestacao_comprovantes', 'prestacao_atividades', 'prestacao_relatorio'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.can_access_prestacao(prestacao_id)) with check (public.can_access_prestacao(prestacao_id))',
        t || ': acesso por organizacao', t);
    end if;
  end loop;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prestacao_atividade_evidencias') then
    create policy "prestacao_atividade_evidencias: acesso por organizacao" on public.prestacao_atividade_evidencias
      for all to authenticated
      using (exists (select 1 from public.prestacao_atividades a
                     where a.id = atividade_id and public.can_access_prestacao(a.prestacao_id)))
      with check (exists (select 1 from public.prestacao_atividades a
                          where a.id = atividade_id and public.can_access_prestacao(a.prestacao_id)));
  end if;
end
$$;
