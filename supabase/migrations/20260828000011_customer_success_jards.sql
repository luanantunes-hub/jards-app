-- Customer Success Jards: empresa acionavel, Cliente 360, parceria e renovacao.
-- Reutiliza atividades e o workspace relacional; nao cria um segundo sistema de tarefas.

alter table public.empresas_crm
  add column if not exists responsavel_interno_id uuid references public.profiles(id) on delete set null,
  add column if not exists potencial_relacionamento smallint check (potencial_relacionamento between 0 and 100),
  add column if not exists potencial_justificativa text;

alter table public.contas_patrocinio
  add column if not exists responsavel_id uuid references public.profiles(id) on delete set null;

alter table public.contatos
  add column if not exists papel_decisao text check (papel_decisao is null or papel_decisao in ('decisor','patrocinador_interno','influenciador','operacional','financeiro','juridico','bloqueador','contato_inicial')),
  add column if not exists influencia smallint check (influencia is null or influencia between 1 and 5),
  add column if not exists sentimento text check (sentimento is null or sentimento in ('positivo','neutro','negativo','desconhecido')),
  add column if not exists forca_relacao smallint check (forca_relacao is null or forca_relacao between 1 and 5),
  add column if not exists canal_preferido text check (canal_preferido is null or canal_preferido in ('email','telefone','linkedin','mensagem','reuniao','outro')),
  add column if not exists responsavel_interno_id uuid references public.profiles(id) on delete set null,
  add column if not exists ativo_na_empresa boolean not null default true;

create table if not exists public.planos_parceria (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  conta_patrocinio_id uuid not null references public.contas_patrocinio(id) on delete cascade,
  nome text not null default 'Plano da parceria',
  objetivo_geral text,
  responsavel_id uuid references public.profiles(id) on delete set null,
  status text not null default 'ativo' check (status in ('rascunho','ativo','concluido','arquivado')),
  data_inicio date not null default current_date,
  proxima_revisao date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.objetivos_parceria (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  plano_id uuid not null references public.planos_parceria(id) on delete cascade,
  titulo text not null,
  indicador text,
  meta text,
  valor_atual text,
  prazo date,
  status text not null default 'em_andamento' check (status in ('nao_iniciado','em_andamento','atingido','em_risco','cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.compromissos_cliente (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  conta_patrocinio_id uuid not null references public.contas_patrocinio(id) on delete cascade,
  contrato_id uuid references public.contratos(id) on delete set null,
  projeto_id uuid references public.projetos_crm(id) on delete set null,
  objetivo_id uuid references public.objetivos_parceria(id) on delete set null,
  titulo text not null,
  categoria text not null default 'outro' check (categoria in ('marca_comunicacao','hospitalidade','relatorio','ativacao','conteudo','colaboradores','impacto','compliance','financeiro','outro')),
  prazo date,
  responsavel_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente','em_andamento','entregue','aprovado','atrasado','cancelado')),
  evidencia_url text,
  aprovado_em timestamptz,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saude_conta (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  conta_patrocinio_id uuid not null references public.contas_patrocinio(id) on delete cascade,
  dimensao text not null check (dimensao in ('relacionamento','entregas','engajamento','resultados','financeiro','renovacao')),
  estado text not null check (estado in ('saudavel','atencao','risco','sem_dados')),
  tendencia text not null default 'estavel' check (tendencia in ('melhorando','estavel','piorando')),
  justificativa text,
  origem text not null default 'manual' check (origem in ('manual','regra','ia')),
  avaliado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.previsoes_renovacao (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  cenario text not null default 'renovar' check (cenario in ('renovar','expandir','reduzir','encerrar')),
  valor_esperado numeric(15,2),
  probabilidade smallint check (probabilidade between 0 and 100),
  confianca text check (confianca is null or confianca in ('baixa','media','alta')),
  data_esperada date,
  riscos text,
  responsavel_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contrato_id)
);

alter table public.atividades
  add column if not exists conta_patrocinio_id uuid references public.contas_patrocinio(id) on delete set null,
  add column if not exists contrato_id uuid references public.contratos(id) on delete set null,
  add column if not exists compromisso_id uuid references public.compromissos_cliente(id) on delete set null,
  add column if not exists plano_parceria_id uuid references public.planos_parceria(id) on delete set null,
  add column if not exists origem_automatica boolean not null default false,
  add column if not exists regra_origem text;

alter table public.crm_interacoes add column if not exists conta_patrocinio_id uuid references public.contas_patrocinio(id) on delete set null;
alter table public.crm_followups add column if not exists conta_patrocinio_id uuid references public.contas_patrocinio(id) on delete set null;
alter table public.crm_duvidas add column if not exists conta_patrocinio_id uuid references public.contas_patrocinio(id) on delete set null;

create index if not exists idx_empresas_responsavel on public.empresas_crm(responsavel_interno_id);
create index if not exists idx_contas_responsavel on public.contas_patrocinio(responsavel_id);
create index if not exists idx_planos_conta on public.planos_parceria(conta_patrocinio_id);
create index if not exists idx_objetivos_plano on public.objetivos_parceria(plano_id);
create index if not exists idx_compromissos_conta_prazo on public.compromissos_cliente(conta_patrocinio_id, prazo);
create index if not exists idx_saude_conta_dimensao on public.saude_conta(conta_patrocinio_id, dimensao, created_at desc);
create index if not exists idx_atividades_conta on public.atividades(conta_patrocinio_id, data_prevista);

do $$
declare tabela text;
begin
  foreach tabela in array array['planos_parceria','objetivos_parceria','compromissos_cliente','saude_conta','previsoes_renovacao'] loop
    execute format('alter table public.%I enable row level security', tabela);
    execute format('drop policy if exists %I on public.%I', tabela || '_org_select', tabela);
    execute format('drop policy if exists %I on public.%I', tabela || '_org_manage', tabela);
    execute format('create policy %I on public.%I for select using (exists (select 1 from public.organization_members om where om.organization_id = public.%I.organization_id and om.user_id = auth.uid()))', tabela || '_org_select', tabela, tabela);
    execute format('create policy %I on public.%I for all using (exists (select 1 from public.organization_members om where om.organization_id = public.%I.organization_id and om.user_id = auth.uid())) with check (exists (select 1 from public.organization_members om where om.organization_id = public.%I.organization_id and om.user_id = auth.uid()))', tabela || '_org_manage', tabela, tabela, tabela);
  end loop;
end $$;

grant select, insert, update, delete on public.planos_parceria, public.objetivos_parceria,
  public.compromissos_cliente, public.saude_conta, public.previsoes_renovacao to authenticated;

-- Uma consulta para a carteira inteira, evitando N+1 na pagina Clientes.
create or replace view public.vw_contas_carteira with (security_invoker = true) as
select cp.id, cp.organization_id, cp.account_id, cp.empresa_crm_id, cp.nome, cp.status,
  cp.data_abertura, cp.data_encerramento, cp.valor_total, cp.responsavel_id, cp.created_at,
  e.nome as empresa_nome, e.setor, e.domain_key, e.site,
  count(distinct c.id) filter (where c.status in ('assinado','vigente','renovado'))::int as n_contratos,
  min(c.proxima_renovacao) filter (where c.status = 'vigente') as proxima_renovacao,
  extract(day from now() - max(coalesce(i.ocorreu_em, a.created_at)))::int as dias_sem_atividade,
  count(distinct co.id) filter (where co.status in ('pendente','em_andamento','atrasado') and co.prazo < current_date)::int as compromissos_atrasados
from public.contas_patrocinio cp
join public.empresas_crm e on e.id = cp.empresa_crm_id
left join public.contratos c on c.conta_patrocinio_id = cp.id
left join public.crm_interacoes i on i.conta_patrocinio_id = cp.id
left join public.atividades a on a.conta_patrocinio_id = cp.id
left join public.compromissos_cliente co on co.conta_patrocinio_id = cp.id
group by cp.id, e.nome, e.setor, e.domain_key, e.site;

grant select on public.vw_contas_carteira to authenticated;

-- Gera atividades no sistema existente para compromissos e renovacoes.
create or replace function public.fn_customer_success_automations()
returns integer language plpgsql security invoker as $$
declare total integer := 0; adicionadas integer := 0;
begin
  insert into public.atividades (account_id, organization_id, empresa_crm_id, conta_patrocinio_id, compromisso_id,
    responsavel_id, nome, tipo, prioridade, data_prevista, feita, origem_automatica, regra_origem)
  select co.account_id, co.organization_id, cp.empresa_crm_id, co.conta_patrocinio_id, co.id,
    co.responsavel_id, 'Entregar: ' || co.titulo, 'outro',
    'alta', co.prazo, false, true, 'compromisso_prazo'
  from public.compromissos_cliente co
  join public.contas_patrocinio cp on cp.id = co.conta_patrocinio_id
  where co.status in ('pendente','em_andamento','atrasado') and co.prazo <= current_date + 14
    and not exists (select 1 from public.atividades a where a.compromisso_id = co.id and not a.feita);
  get diagnostics total = row_count;

  insert into public.atividades (account_id, organization_id, empresa_crm_id, conta_patrocinio_id, contrato_id,
    responsavel_id, nome, tipo, prioridade, data_prevista, feita, origem_automatica, regra_origem)
  select cp.account_id, cp.organization_id, cp.empresa_crm_id, cp.id, c.id,
    coalesce(pr.responsavel_id, cp.responsavel_id), 'Preparar renovacao: ' || coalesce(c.titulo,c.numero,'Contrato'),
    'outro', 'alta',
    (c.proxima_renovacao - interval '60 days')::date, false, true, 'renovacao_60d'
  from public.contratos c join public.contas_patrocinio cp on cp.id = c.conta_patrocinio_id
  left join public.previsoes_renovacao pr on pr.contrato_id = c.id
  where c.status = 'vigente' and c.proxima_renovacao between now() and now() + interval '90 days'
    and not exists (select 1 from public.atividades a where a.contrato_id = c.id and a.regra_origem = 'renovacao_60d' and not a.feita);
  get diagnostics adicionadas = row_count;
  total := total + adicionadas;
  return total;
end $$;

grant execute on function public.fn_customer_success_automations() to authenticated;
